import { supabase } from './supabase';
import { emailApi, webhookApi, ApiError } from './api';
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
 * Isso significa que fechar a aba no meio interrompe o disparo. É a
 * consequência de não haver worker: a alternativa seria um gatilho no
 * Postgres chamando a função, e ele fica para quando houver volume que
 * justifique. Até lá, o efeito de perder um e-mail é o aviso não sair — o
 * dado principal já está salvo.
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
      const res = await emailApi.disparar(evento, contexto.jobId);
      return {
        ...base,
        ok: res.enviado,
        detalhe: res.enviado ? `E-mail enviado para ${res.para}` : res.motivo || 'Não enviado.',
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
