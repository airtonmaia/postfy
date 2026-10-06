import type { JobStatus } from '../types';
import { ETAPAS_DO_CONTEUDO, rotuloDaEtapa } from './etapasDoConteudo';

/**
 * Quem mexeu na peça, quando, e quanto tempo ela ficou em cada lugar.
 *
 * A pergunta que isto responde é a que decide a conversa com o cliente:
 * *"esta peça está parada em aprovação há quanto tempo, e quem a mandou para
 * lá?"*. O produto não sabia responder nenhuma das duas metades — `jobs.status`
 * é o estado de agora, `updated_at` é a última edição de qualquer campo
 * (inclusive de uma vírgula na legenda), e **ninguém** guardava o autor da
 * mudança.
 *
 * ### É uma lista de acontecimentos, não um resumo por etapa
 *
 * A primeira versão disto somava as visitas: uma linha por etapa, com o tempo
 * total gasto nela. Lê bem e **apaga o que importa** — "voltou para ajuste
 * três vezes" vira "ficou 6h em ajuste", e o vaivém, que é a história da peça,
 * desaparece. Cada entrada em etapa é uma linha, na ordem em que aconteceu.
 *
 * ### A duração é derivada, nunca gravada
 *
 * O banco guarda só **quando** a peça entrou em cada etapa
 * (`historico_de_etapas`, escrita por gatilho). A duração é a diferença para a
 * linha seguinte, e a da última é a diferença para agora.
 *
 * Gravar a duração junto exigiria fechar a linha anterior a cada mudança —
 * duas escritas onde cabe uma, e a segunda podendo falhar sozinha. O resultado
 * seria uma etapa "aberta para sempre", com a tela somando um tempo que não
 * passou. Derivar não tem esse estado intermediário.
 *
 * ### O que a função **não** faz
 *
 * Ela não inventa o que não foi medido. Conteúdo criado antes de o registro
 * existir volta com `medido: false` e acontecimento nenhum — a tela diz isso em
 * texto, em vez de desenhar uma linha do tempo que parece completa. É a regra
 * de `post_metrics`: nulo é "não medi", e "não medi" se diz.
 */

/**
 * De onde veio a mudança.
 *
 * Os três chegam ao banco com `auth.uid()` nulo nos dois últimos casos, e
 * tratá-los igual seria perder a informação que faz a agência abrir o
 * histórico: "Aprovado" sem dizer que foi **o cliente** não responde nada.
 */
export type OrigemDaMudanca = 'equipe' | 'portal' | 'sistema';

export interface EventoDeEtapa {
  id: string;
  status: JobStatus;
  /** ISO. Quando a peça entrou nesta etapa. */
  entrouEm: string;
  /** O nome de quem moveu. Só existe quando a origem é `equipe`. */
  porNome?: string;
  origem: OrigemDaMudanca;
}

export interface AcontecimentoDoConteudo {
  id: string;
  status: JobStatus;
  /** "Enviado para aprovação", "Devolvido para ajuste", "Criado". */
  acao: string;
  /** "Enviado para aprovação por Airton Maia" — a linha pronta. */
  frase: string;
  entrouEm: string;
  duracaoMs: number;
  /** A etapa está correndo agora: a duração continua subindo. */
  emAndamento: boolean;
  porNome?: string;
  origem: OrigemDaMudanca;
}

export interface LinhaDoTempo {
  /** Em ordem cronológica: o mais antigo primeiro, como o trabalho aconteceu. */
  acontecimentos: AcontecimentoDoConteudo[];
  /** Etapas que a peça ainda não alcançou. */
  pendentes: { status: JobStatus; rotulo: string }[];
  /** Soma das durações medidas. */
  totalMs: number;
  /** Falso quando não há nenhum evento: o acervo anterior ao registro. */
  medido: boolean;
}

/**
 * O que **aconteceu** quando a peça entrou em cada etapa.
 *
 * Não é o nome da etapa: "Aprovação" é um lugar, "Enviado para aprovação" é um
 * ato, e é o ato que o histórico conta. Ler "Aprovação — Airton Maia" deixa em
 * aberto se ele mandou ou se ele aprovou, que são coisas opostas.
 */
const ACAO_DA_ETAPA: Record<string, string> = {
  ideas: 'Voltou para ideias',
  in_production: 'Enviado para produção',
  for_approval: 'Enviado para aprovação',
  in_adjustment: 'Devolvido para ajuste',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  published: 'Publicado',
};

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * "7m", "2h 15m", "3d 4h" — e "menos de 1m" no começo.
 *
 * Duas casas no máximo, de propósito: "3d 4h 12m 8s" é preciso e ninguém lê.
 * O zero à direita some ("2h", não "2h 0m") porque uma unidade zerada faz a
 * pessoa reler para conferir se entendeu.
 *
 * **"menos de 1m" em vez de "0m"**, porque `0m` numa etapa que acabou de
 * começar parece erro de medição — e é justamente o estado em que a pessoa
 * olha a tela logo depois de arrastar o card.
 */
export const duracaoLegivel = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < MINUTO) return 'menos de 1m';

  if (ms < HORA) return `${Math.floor(ms / MINUTO)}m`;

  if (ms < DIA) {
    const horas = Math.floor(ms / HORA);
    const minutos = Math.floor((ms % HORA) / MINUTO);
    return minutos ? `${horas}h ${minutos}m` : `${horas}h`;
  }

  const dias = Math.floor(ms / DIA);
  const horas = Math.floor((ms % DIA) / HORA);
  return horas ? `${dias}d ${horas}h` : `${dias}d`;
};

/**
 * Quem fez, escrito por extenso — e **nada** quando o banco não sabe.
 *
 * "por Sistema" para uma mudança sem autor seria inventar um: `por_nome` vem
 * nulo tanto do cron quanto do portal, e a diferença entre os dois é a coisa
 * mais útil da linha. Sem a origem no banco, a saída honesta é a frase sem
 * complemento.
 */
const complementoDoAutor = (evento: {
  porNome?: string;
  origem: OrigemDaMudanca;
}): string => {
  if (evento.origem === 'portal') return ' pelo cliente, no portal';
  if (evento.origem === 'sistema') return ' pelo agendador';
  return evento.porNome ? ` por ${evento.porNome}` : '';
};

const instante = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

export const linhaDoTempo = (
  eventos: EventoDeEtapa[],
  statusAtual: JobStatus,
  agora: Date = new Date(),
  /**
   * As etapas como a agência as chama. Ausente = os nomes do produto.
   *
   * **Renomear a etapa troca a frase, e só então.** "Aprovado" descreve o
   * **ato**, e o ato não muda quando a coluna muda de nome — quem não mexeu no
   * fluxo continua lendo as frases boas. Mas quem chamou "Aprovação" de
   * "Revisão do cliente" não pode ler "Enviado para aprovação" num produto que
   * não tem mais essa palavra em lugar nenhum: aí a frase vira "Movido para
   * Revisão do cliente", genérica e correta.
   */
  etapas?: { status: JobStatus; rotulo: string; rotuloPadrao: string }[]
): LinhaDoTempo => {
  const daAgencia = (status: JobStatus) => etapas?.find((e) => e.status === status);
  const nome = (status: JobStatus) => daAgencia(status)?.rotulo ?? rotuloDaEtapa(status);
  const renomeada = (status: JobStatus) => {
    const e = daAgencia(status);
    return Boolean(e && e.rotulo !== e.rotuloPadrao);
  };

  /*
    A ordem vem da data, não da ordem em que as linhas chegaram: o `select`
    pode mudar, e uma linha fora de lugar daria duração negativa — que
    apareceria na tela como "—" sem ninguém entender por quê.
  */
  const ordenados = [...eventos]
    .filter((e) => e.entrouEm && !Number.isNaN(Date.parse(e.entrouEm)))
    .sort((a, b) => instante(a.entrouEm) - instante(b.entrouEm));

  const acontecimentos: AcontecimentoDoConteudo[] = ordenados.map((evento, i) => {
    const seguinte = ordenados[i + 1];
    const fim = seguinte ? instante(seguinte.entrouEm) : agora.getTime();
    /*
      `Math.max(0, …)` porque o relógio do dispositivo pode estar atrás do do
      banco: a última etapa teria duração negativa, e o total viraria um número
      menor que a soma das partes.
    */
    const duracaoMs = Math.max(0, fim - instante(evento.entrouEm));

    /*
      **A primeira linha é a criação da peça**, e não "voltou para ideias". O
      gatilho dispara no insert, então o primeiro evento é sempre o nascimento
      — e dizer "voltou" sobre algo que acabou de nascer faz procurar um
      histórico anterior que não existe.

      A etapa vai junto quando a peça não nasceu na primeira: criar direto em
      "Produção" é comum, e omitir isso deixaria um buraco entre a criação e o
      primeiro movimento registrado.
    */
    const criacao = i === 0;
    const acao = criacao
      ? evento.status === ETAPAS_DO_CONTEUDO[0].valor
        ? 'Criado'
        : `Criado em ${nome(evento.status)}`
      : renomeada(evento.status)
        ? `Movido para ${nome(evento.status)}`
        : (ACAO_DA_ETAPA[evento.status] ?? `Movido para ${nome(evento.status)}`);

    return {
      id: evento.id,
      status: evento.status,
      acao,
      frase: `${acao}${complementoDoAutor(evento)}`,
      entrouEm: evento.entrouEm,
      duracaoMs,
      /*
        Só a última linha corre — e só se a etapa dela for mesmo a atual. As
        duas divergem numa peça que mudou de etapa antes de o registro existir,
        e sem conferir as duas pontas a etapa que a peça já deixou continuaria
        contando tempo para sempre, com o total subindo sozinho na tela.
      */
      emAndamento: !seguinte && evento.status === statusAtual,
      porNome: evento.porNome,
      origem: evento.origem,
    };
  });

  const alcancados = new Set(ordenados.map((e) => e.status));

  return {
    acontecimentos,
    /*
      O que ainda não aconteceu é mostrado apagado, e isso não é enfeite: sem
      as etapas pendentes, uma peça em produção e uma peça publicada desenham
      listas do mesmo tamanho, e some de vista o quanto falta.
    */
    pendentes: ETAPAS_DO_CONTEUDO.filter(
      (e) => !alcancados.has(e.valor) && e.valor !== statusAtual
    ).map((e) => ({ status: e.valor, rotulo: nome(e.valor) })),
    totalMs: acontecimentos.reduce((soma, a) => soma + a.duracaoMs, 0),
    medido: ordenados.length > 0,
  };
};
