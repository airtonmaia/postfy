import { supabase } from './supabase';
import { webhookApi, ApiError } from './api';
import type { Automation } from '../types';

/**
 * Motor das automações.
 *
 * Antes `trigger` e `action` eram texto livre: descreviam a regra em
 * português para alguém ler, e nada as executava. A tela até mostrava um
 * contador de execuções que ninguém incrementava.
 *
 * Agora o evento é tipado, o motor casa as regras ligadas da agência e
 * executa. O disparo sai do navegador depois que a mudança já foi gravada —
 * não antes, senão um e-mail avisaria sobre uma aprovação que falhou no
 * banco.
 *
 * O e-mail **não sai daqui**: esta função só o enfileira, e quem envia é o
 * cron que já roda de 5 em 5 minutos (`api/publicar.ts`). Antes o navegador
 * chamava a rota de envio direto, e fechar a aba no mesmo segundo
 * interrompia o disparo — o conteúdo ficava aprovado e o aviso não saía, sem
 * erro em lugar nenhum. Um insert acaba antes de a aba fechar; uma chamada
 * HTTP com Resend do outro lado, não.
 *
 * O webhook continua saindo daqui: ele é um teste de ida e volta que a tela
 * mostra na hora ("destino respondeu 200"), e enfileirá-lo trocaria uma
 * resposta útil por um "na fila" que não diz nada.
 */

export type EventoDeAutomacao =
  | 'conteudo_aguardando_aprovacao'
  | 'conteudo_aprovado'
  | 'pedido_de_ajuste';

export interface ContextoDoEvento {
  jobId: string;
  jobTitle: string;
  clientName?: string;
  feedback?: string;
}

export interface ResultadoDaAutomacao {
  automacaoId: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
}

/**
 * Executa as automações ligadas para o evento.
 *
 * Nunca lança: uma automação é efeito colateral de uma ação que já deu certo,
 * e derrubar a tela porque um webhook não respondeu seria pior que o
 * problema. O resultado volta para quem quiser exibir.
 */
export const dispararAutomacoes = async (
  evento: EventoDeAutomacao,
  contexto: ContextoDoEvento
): Promise<ResultadoDaAutomacao[]> => {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('trigger_event', evento)
    .eq('enabled', true);

  if (error) {
    console.warn('[automacoes] não foi possível ler as regras:', error.message);
    return [];
  }

  const regras = (data || []) as any[];
  if (regras.length === 0) return [];

  const resultados: ResultadoDaAutomacao[] = [];

  // Em série: duas regras do mesmo evento costumam falar com o mesmo
  // destino, e disparar tudo de uma vez só rende limite de taxa.
  for (const regra of regras) {
    const resultado = await executar(regra, evento, contexto);
    resultados.push(resultado);
    if (resultado.ok) void registrarExecucao(regra.id, regra.execution_count ?? 0);
  }

  return resultados;
};

const executar = async (
  regra: any,
  evento: EventoDeAutomacao,
  contexto: ContextoDoEvento
): Promise<ResultadoDaAutomacao> => {
  const base = { automacaoId: regra.id, titulo: regra.title as string };

  try {
    if (regra.action_type === 'email') {
      const res = await enfileirarEmail(evento, contexto);
      return {
        ...base,
        ok: res.ok,
        // "Na fila", e não "enviado": quem envia é o cron, daqui a alguns
        // minutos. Dizer "enviado" aqui seria a tela afirmando o que não
        // aconteceu ainda — e um endereço inválido só se revela lá.
        detalhe: res.detalhe,
      };
    }

    if (regra.action_type === 'webhook') {
      const url = regra.action_config?.url;
      if (typeof url !== 'string' || !url.startsWith('http')) {
        return { ...base, ok: false, detalhe: 'Webhook sem URL configurada.' };
      }
      const res = await webhookApi.test(url, evento);
      return {
        ...base,
        ok: res.ok,
        detalhe: `Destino respondeu ${res.status}`,
      };
    }

    // Regra antiga, de quando trigger e action eram texto livre.
    return { ...base, ok: false, detalhe: 'Ação não configurada.' };
  } catch (erro) {
    return {
      ...base,
      ok: false,
      detalhe: erro instanceof ApiError ? erro.message : 'Falha ao executar.',
    };
  }
};

/**
 * Contador e data da última execução.
 *
 * Melhor seria um incremento atômico no banco; com uma agência mexendo por
 * vez, a corrida aqui custaria uma contagem errada num número informativo.
 * Não vale uma RPC só para isso agora.
 */
const registrarExecucao = async (id: string, atual: number): Promise<void> => {
  const { error } = await supabase
    .from('automations')
    .update({ execution_count: atual + 1, last_run_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.warn('[automacoes] não foi possível registrar a execução:', error.message);
};

/**
 * Põe o e-mail na fila e resolve, agora, para quem ele vai.
 *
 * O destinatário é congelado aqui de propósito. O modelo diz "cliente" ou
 * "agência"; quando é a agência, o destino é quem está na sessão — e o cron,
 * que envia depois, não tem sessão para perguntar isso. Guardar a resposta
 * junto com o item é o que permite o envio acontecer sem ninguém logado.
 */
const enfileirarEmail = async (
  evento: EventoDeAutomacao,
  contexto: ContextoDoEvento
): Promise<{ ok: boolean; detalhe: string }> => {
  const { data: job } = await supabase
    .from('jobs')
    .select('workspace_id, client_id')
    .eq('id', contexto.jobId)
    .maybeSingle();

  if (!job) return { ok: false, detalhe: 'Conteúdo não encontrado.' };

  const { data: modelo } = await supabase
    .from('email_templates')
    .select('ativo, destinatario')
    .eq('evento', evento)
    .maybeSingle();

  if (!modelo) return { ok: false, detalhe: 'Modelo de e-mail não encontrado.' };
  // Desligado na tela do Super Admin não é erro: é a resposta certa, e não
  // vale ocupar a fila com o que não vai sair.
  if (!modelo.ativo) return { ok: false, detalhe: 'Disparo desligado nas configurações.' };

  let destinatario = '';
  if (modelo.destinatario === 'cliente') {
    const { data: cliente } = await supabase
      .from('clients')
      .select('email')
      .eq('id', job.client_id)
      .maybeSingle();
    destinatario = cliente?.email?.trim() || '';
  } else {
    const { data } = await supabase.auth.getUser();
    destinatario = data.user?.email?.trim() || '';
  }

  if (!destinatario) {
    return { ok: false, detalhe: 'Destinatário sem e-mail cadastrado.' };
  }

  const { error } = await supabase.from('email_queue').insert({
    workspace_id: job.workspace_id,
    evento,
    job_id: contexto.jobId,
    destinatario,
  });

  if (error) return { ok: false, detalhe: error.message };

  return { ok: true, detalhe: `E-mail na fila para ${destinatario}` };
};

/** Rótulos das opções, para a tela não repetir string solta. */
export const EVENTOS_DISPONIVEIS: { valor: EventoDeAutomacao; rotulo: string; quando: string }[] = [
  {
    valor: 'conteudo_aguardando_aprovacao',
    rotulo: 'Conteúdo enviado para aprovação',
    quando: 'quando um conteúdo entra em "Aguardando aprovação"',
  },
  {
    valor: 'conteudo_aprovado',
    rotulo: 'Conteúdo aprovado',
    quando: 'quando o cliente aprova um conteúdo',
  },
  {
    valor: 'pedido_de_ajuste',
    rotulo: 'Pedido de ajustes',
    quando: 'quando o cliente solicita alterações',
  },
];

export const ACOES_DISPONIVEIS: { valor: Automation['actionType']; rotulo: string }[] = [
  { valor: 'email', rotulo: 'Enviar o e-mail do sistema' },
  { valor: 'webhook', rotulo: 'Chamar um webhook' },
];
