import type { JobStatus } from '../types';
import { ETAPAS_DO_CONTEUDO } from './etapasDoConteudo';

/**
 * Como **esta** agência chama cada etapa, com que cor e em quanto tempo.
 *
 * As sete etapas sempre foram fixas no código, e agência nenhuma chama as
 * coisas assim: quem faz vídeo tem "Captação" e "Edição" onde está escrito
 * "Produção"; quem faz tráfego tem "Briefing" onde está "Ideias". O nome
 * errado no quadro não é detalhe de gosto — é a equipe traduzindo mentalmente
 * a coluna toda vez que olha para ela.
 *
 * ### O que isto **não** faz
 *
 * Não acrescenta nem remove etapas, e a razão está no banco: `jobs.status` tem
 * um `check` com os sete valores. Oferecer um oitavo na tela sem valor no
 * `check` é exatamente o que o `feed_story` custou — a gravação roda em
 * segundo plano, o Postgres recusa a linha, e **dez conteúdos sumiram em
 * silêncio** enquanto o histórico de atividade afirmava que tinham sido
 * criados.
 *
 * Etapa nova precisa de valor no `check`, de coluna no quadro, de lugar no
 * publicador e no fluxo de aprovação. O que muda aqui é como as sete **se
 * chamam e se parecem**, que resolve o problema real sem abrir aquele buraco.
 *
 * ### Ajuste ausente cai no padrão, sempre
 *
 * O que a agência não mexeu **não é guardado**. Gravar as sete etapas
 * inteiras na primeira abertura da tela congelaria os nomes de hoje, e a
 * próxima renomeação do produto nunca chegaria nessa agência — a mesma
 * família do `trial_ends_at`: um valor que parece escolha e é só uma cópia
 * velha do padrão.
 */

export interface AjusteDaEtapa {
  /** O nome que esta agência dá à etapa. Ausente = o nome do produto. */
  rotulo?: string;
  /** Uma das chaves de `CORES_DA_ETAPA`. Ausente = a cor do produto. */
  cor?: string;
  /**
   * Quantos dias a peça deveria ficar nesta etapa.
   *
   * Ausente ou zero é **"não medimos isso"**, nunca "zero dias": o histórico
   * mostra o estouro só onde há prazo combinado, e um padrão de zero acusaria
   * atraso em toda peça de toda agência no primeiro dia.
   */
  slaDias?: number;
}

export type FluxoDeProducao = Partial<Record<JobStatus, AjusteDaEtapa>>;

export interface EtapaDoFluxo {
  status: JobStatus;
  rotulo: string;
  /** O nome que o produto dá, para a tela de ajuste mostrar de onde se partiu. */
  rotuloPadrao: string;
  cor: string;
  slaDias?: number;
  /** A agência mexeu nesta etapa. */
  ajustada: boolean;
}

/**
 * A paleta é **fechada**, e as cores saíram do que já está em tela.
 *
 * Um seletor de cor livre põe sete tons quaisquer lado a lado numa coluna e
 * desfaz de uma vez o vocabulário que o projeto inteiro mantém. Estes são os
 * mesmos tons dos selos de status — o que muda é qual etapa usa qual.
 */
export interface CorDaEtapa {
  valor: string;
  rotulo: string;
  /** O pontinho na lista e no seletor. */
  ponto: string;
  /** Fundo e texto do rótulo da coluna no quadro. */
  caixa: string;
  /** A borda da mesma caixa — separada porque a coluna a aplica noutro lugar. */
  borda: string;
}

export const CORES_DA_ETAPA: CorDaEtapa[] = [
  { valor: 'slate', rotulo: 'Cinza', ponto: 'bg-slate-400', caixa: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', borda: 'border-slate-300' },
  { valor: 'blue', rotulo: 'Azul', ponto: 'bg-blue-500', caixa: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', borda: 'border-blue-300' },
  { valor: 'amber', rotulo: 'Âmbar', ponto: 'bg-amber-500', caixa: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300', borda: 'border-amber-300' },
  { valor: 'rose', rotulo: 'Rosa', ponto: 'bg-rose-500', caixa: 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300', borda: 'border-rose-300' },
  { valor: 'emerald', rotulo: 'Verde', ponto: 'bg-emerald-500', caixa: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300', borda: 'border-emerald-300' },
  { valor: 'purple', rotulo: 'Roxo', ponto: 'bg-purple-500', caixa: 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300', borda: 'border-purple-300' },
  { valor: 'teal', rotulo: 'Turquesa', ponto: 'bg-teal-600', caixa: 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-300', borda: 'border-teal-300' },
];

/** A cor que cada etapa tem quando a agência não escolheu nenhuma. */
const COR_PADRAO: Record<JobStatus, string> = {
  ideas: 'slate',
  in_production: 'blue',
  for_approval: 'amber',
  in_adjustment: 'rose',
  approved: 'emerald',
  scheduled: 'purple',
  published: 'teal',
};

export const corDaEtapa = (cor: string) =>
  CORES_DA_ETAPA.find((c) => c.valor === cor) ?? CORES_DA_ETAPA[0];

/** Nome em branco não é nome: ele deixaria a coluna do quadro sem rótulo. */
const textoUtil = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim().slice(0, 40);
  return limpo || undefined;
};

/**
 * O que veio do banco, reduzido ao que o produto reconhece.
 *
 * **Descartar é melhor que recusar.** O jsonb não tem `check` de propósito:
 * uma chave desconhecida — de uma versão mais nova, de uma edição à mão, de um
 * campo que o produto aposentou — não pode derrubar a gravação das
 * configurações inteiras. Aqui ela simplesmente não entra, e o resto vale.
 */
export const sanearFluxo = (valor: unknown): FluxoDeProducao => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};

  const bruto = valor as Record<string, unknown>;
  const saida: FluxoDeProducao = {};

  for (const { valor: status } of ETAPAS_DO_CONTEUDO) {
    const item = bruto[status];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const campos = item as Record<string, unknown>;
    const rotulo = textoUtil(campos.rotulo);
    const cor = CORES_DA_ETAPA.some((c) => c.valor === campos.cor)
      ? (campos.cor as string)
      : undefined;

    const dias = Number(campos.slaDias);
    // Prazo negativo, fracionado ou absurdo não é prazo. O teto existe porque
    // um campo numérico aceita o que a pessoa digitar, e "3650" dias de SLA
    // não é uma combinação, é um engano.
    const slaDias =
      Number.isFinite(dias) && dias > 0 && dias <= 365 ? Math.round(dias) : undefined;

    // Etapa sem nenhum ajuste não entra: ela é indistinguível do padrão, e
    // guardá-la vazia faria a tela dizer "ajustada" sobre o que ninguém mexeu.
    if (rotulo || cor || slaDias) saida[status] = { rotulo, cor, slaDias };
  }

  return saida;
};

/** As sete etapas como **esta** agência as vê, na ordem do fluxo. */
export const etapasDoFluxo = (fluxo?: FluxoDeProducao | null): EtapaDoFluxo[] => {
  const ajustes = fluxo ?? {};

  return ETAPAS_DO_CONTEUDO.map(({ valor, rotulo }) => {
    const ajuste = ajustes[valor];
    return {
      status: valor,
      rotulo: ajuste?.rotulo || rotulo,
      rotuloPadrao: rotulo,
      cor: ajuste?.cor || COR_PADRAO[valor],
      slaDias: ajuste?.slaDias,
      ajustada: Boolean(ajuste?.rotulo || ajuste?.cor || ajuste?.slaDias),
    };
  });
};

/** O nome de uma etapa só, com recuo para status que a lista não conheça. */
export const rotuloNoFluxo = (status: string, fluxo?: FluxoDeProducao | null): string =>
  etapasDoFluxo(fluxo).find((e) => e.status === status)?.rotulo ?? status;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * A peça passou do prazo combinado para esta etapa?
 *
 * **Sem prazo, a resposta é não — nunca "sim por omissão".** É a regra de
 * `post_metrics` aplicada ao tempo: um SLA que ninguém combinou não pode
 * acusar atraso, porque esse aviso é levado para a conversa com quem fez o
 * trabalho.
 */
export const estourouOSla = (duracaoMs: number, slaDias?: number): boolean =>
  Boolean(slaDias && slaDias > 0 && duracaoMs > slaDias * DIA_MS);
