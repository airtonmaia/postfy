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
  /** Uma das chaves de `ICONES_DA_ETAPA`. Ausente = o ícone do produto. */
  icone?: string;
  /**
   * Quantos dias a peça deveria ficar nesta etapa.
   *
   * Ausente ou zero é **"não medimos isso"**, nunca "zero dias": o histórico
   * mostra o estouro só onde há prazo combinado, e um padrão de zero acusaria
   * atraso em toda peça de toda agência no primeiro dia.
   */
  slaDias?: number;
  /**
   * Em que posição a etapa aparece. Ausente = a posição do produto.
   *
   * **É um número por etapa, e não uma lista de status no topo do jsonb**, e a
   * diferença é de segurança: uma lista pode vir incompleta — de uma versão
   * mais nova, de uma edição à mão, de uma etapa que o produto acrescente
   * depois — e aí falta decidir o que fazer com quem não está nela. Com um
   * número por etapa não existe esse estado: a lista desenhada continua sendo
   * `ETAPAS_DO_CONTEUDO`, ordenada por um critério. **Nenhuma etapa pode sumir
   * do quadro por causa da ordem**, porque sumir uma coluna é esconder o
   * trabalho que está dentro dela.
   */
  ordem?: number;
}

export type FluxoDeProducao = Partial<Record<JobStatus, AjusteDaEtapa>>;

export interface EtapaDoFluxo {
  status: JobStatus;
  rotulo: string;
  /** O nome que o produto dá, para a tela de ajuste mostrar de onde se partiu. */
  rotuloPadrao: string;
  cor: string;
  icone: string;
  slaDias?: number;
  /** A agência mexeu nesta etapa. Não conta a ordem — ver `etapasDoFluxo`. */
  ajustada: boolean;
  /** Onde ela aparece hoje: a escolhida pela agência, ou a do produto. */
  posicao: number;
  /** Onde o produto a põe. É ela que desempata, e é ela que "restaurar" devolve. */
  posicaoPadrao: number;
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
  { valor: 'slate', rotulo: 'Cinza', ponto: 'bg-slate-400', caixa: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', borda: 'border-slate-300 dark:border-slate-700' },
  { valor: 'blue', rotulo: 'Azul', ponto: 'bg-blue-500', caixa: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', borda: 'border-blue-300 dark:border-blue-900' },
  { valor: 'amber', rotulo: 'Âmbar', ponto: 'bg-amber-500', caixa: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300', borda: 'border-amber-300 dark:border-amber-900' },
  { valor: 'rose', rotulo: 'Rosa', ponto: 'bg-rose-500', caixa: 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300', borda: 'border-rose-300 dark:border-rose-900' },
  { valor: 'emerald', rotulo: 'Verde', ponto: 'bg-emerald-500', caixa: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300', borda: 'border-emerald-300 dark:border-emerald-900' },
  { valor: 'indigo', rotulo: 'Índigo', ponto: 'bg-indigo-500', caixa: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300', borda: 'border-indigo-300 dark:border-indigo-900' },
  { valor: 'teal', rotulo: 'Turquesa', ponto: 'bg-teal-600', caixa: 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-300', borda: 'border-teal-300 dark:border-teal-900' },
];

/**
 * **Nenhuma cor da paleta pode ser `purple`, e isso não é gosto.**
 *
 * `DynamicThemeProvider` injeta uma folha de `!important` que repinta **toda**
 * classe `purple-*` com a cor da agência — é assim que o whitelabel funciona.
 * A paleta tinha "Roxo", e numa agência de marca rosa a bolinha roxa saía
 * **rosa**: dois botões idênticos no seletor, e a etapa escolhida como roxa
 * aparecendo no quadro com a cor de outra. Relatado como *"não está
 * sincronizado"*, que é exatamente o que parece — você escolhe uma cor e a
 * tela mostra outra.
 *
 * O lugar que troca é a paleta, nunca a folha: o roxo **é** a marca neste
 * produto, e tirá-lo de lá apagaria o whitelabel para consertar um seletor.
 * `indigo` entrou no lugar porque já tem 77 usos no `src` — cor levantada por
 * contagem, como manda a regra de desenho, e não inventada.
 *
 * A tradução existe para quem já tinha escolhido: sem ela, `sanearFluxo`
 * descartaria o `purple` guardado como chave desconhecida e a etapa voltaria
 * calada para a cor padrão. Quem escolheu continua com a cor que escolheu.
 */
const COR_RENOMEADA: Record<string, string> = { purple: 'indigo' };

const corConhecida = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const traduzida = COR_RENOMEADA[valor] ?? valor;
  return CORES_DA_ETAPA.some((c) => c.valor === traduzida) ? traduzida : undefined;
};

/**
 * O ícone da etapa — lista fechada, pelo mesmo motivo da paleta.
 *
 * Um campo livre de nome de ícone erra na primeira letra trocada e a tela fica
 * sem nada, sem dizer por quê. Aqui a chave ou está na lista ou é descartada,
 * e o padrão do produto assume.
 *
 * **A lista são chaves, não componentes**, e isso é o que a mantém testável:
 * `src/components/common/IconeDaEtapa.tsx` faz a tradução para o desenho, e a
 * guarda exige que toda chave daqui tenha um lá. Pôr o componente nesta lista
 * levaria React para dentro de um módulo que hoje é dado puro.
 */
export interface IconeDaEtapaOpcao {
  valor: string;
  rotulo: string;
}

export const ICONES_DA_ETAPA: IconeDaEtapaOpcao[] = [
  { valor: 'ideia', rotulo: 'Ideia' },
  { valor: 'prancheta', rotulo: 'Planejamento' },
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'design', rotulo: 'Design' },
  { valor: 'camera', rotulo: 'Captação' },
  { valor: 'video', rotulo: 'Vídeo' },
  { valor: 'olho', rotulo: 'Revisão' },
  { valor: 'conversa', rotulo: 'Conversa' },
  { valor: 'voltar', rotulo: 'Ajuste' },
  { valor: 'conferido', rotulo: 'Aprovado' },
  { valor: 'calendario', rotulo: 'Agendado' },
  { valor: 'enviar', rotulo: 'Envio' },
  { valor: 'foguete', rotulo: 'Publicado' },
  { valor: 'megafone', rotulo: 'Divulgação' },
];

/** O ícone que cada etapa tem quando a agência não escolheu nenhum. */
const ICONE_PADRAO: Record<JobStatus, string> = {
  ideas: 'ideia',
  in_production: 'design',
  for_approval: 'olho',
  in_adjustment: 'voltar',
  approved: 'conferido',
  scheduled: 'calendario',
  published: 'foguete',
};

/** A cor que cada etapa tem quando a agência não escolheu nenhuma. */
const COR_PADRAO: Record<JobStatus, string> = {
  ideas: 'slate',
  in_production: 'blue',
  for_approval: 'amber',
  in_adjustment: 'rose',
  approved: 'emerald',
  scheduled: 'indigo',
  published: 'teal',
};

export const corDaEtapa = (cor: string) =>
  CORES_DA_ETAPA.find((c) => c.valor === (COR_RENOMEADA[cor] ?? cor)) ?? CORES_DA_ETAPA[0];

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
    const cor = corConhecida(campos.cor);
    const icone = ICONES_DA_ETAPA.some((i) => i.valor === campos.icone)
      ? (campos.icone as string)
      : undefined;

    const dias = Number(campos.slaDias);
    // Prazo negativo, fracionado ou absurdo não é prazo. O teto existe porque
    // um campo numérico aceita o que a pessoa digitar, e "3650" dias de SLA
    // não é uma combinação, é um engano.
    const slaDias =
      Number.isFinite(dias) && dias > 0 && dias <= 365 ? Math.round(dias) : undefined;

    /*
      A posição só vale se couber na lista: fora do intervalo, fracionada ou
      não numérica, ela volta a ser a do produto. Lista de sete não tem
      posição 9 nem 2,5.
    */
    const pos = Number(campos.ordem);
    const ordem =
      Number.isInteger(pos) && pos >= 0 && pos < ETAPAS_DO_CONTEUDO.length ? pos : undefined;

    /*
      Etapa sem nenhum ajuste não entra: ela é indistinguível do padrão, e
      guardá-la vazia faria a tela dizer "ajustada" sobre o que ninguém mexeu.

      **`ordem` entra por `!== undefined`, nunca por verdade.** A primeira
      posição é `0`, que é falso em JavaScript: num `||` junto dos outros
      campos, a etapa que a pessoa arrastou para o começo seria a única
      descartada — e ela voltaria calada para o lugar antigo, que é o defeito
      mais difícil de acreditar quando se vê.
    */
    if (rotulo || cor || icone || slaDias || ordem !== undefined) {
      saida[status] = { rotulo, cor, icone, slaDias, ordem };
    }
  }

  return saida;
};

/**
 * As sete etapas como **esta** agência as vê, na ordem que ela escolheu.
 *
 * A lista desenhada é sempre `ETAPAS_DO_CONTEUDO` inteira — o que a agência
 * escolhe é a ordem, nunca quem entra. Etapa sem `ordem` fica na posição do
 * produto, e empate é desfeito pela posição do produto também: ordenar é
 * mudar de lugar, e duas etapas no mesmo lugar não podem trocar de lugar entre
 * si a cada render.
 *
 * **O `ajustada` não conta a ordem**, de propósito: ele marca a etapa que a
 * agência repintou ou renomeou, e arrastar a fileira uma vez marcaria as sete
 * de uma vez — um selo que vale para todos não distingue ninguém.
 */
export const etapasDoFluxo = (fluxo?: FluxoDeProducao | null): EtapaDoFluxo[] => {
  const ajustes = fluxo ?? {};

  return ETAPAS_DO_CONTEUDO.map(({ valor, rotulo }, i) => {
    const ajuste = ajustes[valor];
    return {
      status: valor,
      rotulo: ajuste?.rotulo || rotulo,
      rotuloPadrao: rotulo,
      cor: ajuste?.cor || COR_PADRAO[valor],
      icone: ajuste?.icone || ICONE_PADRAO[valor],
      slaDias: ajuste?.slaDias,
      ajustada: Boolean(ajuste?.rotulo || ajuste?.cor || ajuste?.icone || ajuste?.slaDias),
      posicao: ajuste?.ordem ?? i,
      posicaoPadrao: i,
    };
  }).sort((a, b) => a.posicao - b.posicao || a.posicaoPadrao - b.posicaoPadrao);
};

/**
 * O fluxo com as etapas renumeradas na ordem recebida.
 *
 * **As sete saem numeradas, não só as que se moveram.** Gravar só o que mudou
 * deixaria o resto com a posição do produto, e aí uma etapa parada ficaria
 * entre duas movidas sem que ninguém tivesse pedido isso — a ordem é uma
 * sequência, e sequência meio escrita não é sequência.
 */
export const reordenarFluxo = (
  fluxo: FluxoDeProducao | null | undefined,
  statusEmOrdem: JobStatus[]
): FluxoDeProducao => {
  const atual = fluxo ?? {};
  const proximo: FluxoDeProducao = { ...atual };

  statusEmOrdem.forEach((status, i) => {
    proximo[status] = { ...(atual[status] ?? {}), ordem: i };
  });

  return sanearFluxo(proximo);
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
