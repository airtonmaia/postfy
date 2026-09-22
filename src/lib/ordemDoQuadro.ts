import type { Job } from '../types';
import { diaNoFuso } from './fusoHorario';

/**
 * Como o quadro se organiza: a ordem de cada coluna e a janela de datas.
 *
 * **O quadro nunca ordenou nada.** `filteredJobs` não tinha um `.sort()`: a
 * ordem era a da carga do banco, que ninguém escolheu e que muda quando a
 * consulta muda. Parecia ordenado por data por acidente — e acidente que
 * parece regra é a pior espécie, porque as pessoas passam a contar com ele.
 *
 * A regra agora é explícita: **por data, do mais próximo para o mais
 * distante**, que é a ordem que ajuda a trabalhar a fila — o que vence antes,
 * e o que já venceu, sobe.
 *
 * E a exceção é o ponto da entrega: **card movido à mão segura o índice, e o
 * resto flui por data em volta dele.** É o que diferencia esta escolha de um
 * "modo manual": o quadro não para de se reorganizar, ele só respeita os
 * poucos cards em que alguém tomou uma decisão. Card que ninguém tocou
 * continua obedecendo à data para sempre.
 *
 * Tudo aqui é puro para ser exercitado, não descrito: `tests/quadro.test.ts`
 * roda o algoritmo com dados de verdade. Guarda que descreve o mecanismo
 * aprova qualquer mecanismo com aquela forma — foi assim que as quatro
 * guardas da bandeira booleana passaram enquanto o produto perdia dado.
 */

export type ChaveDeOrdem = 'data' | 'cliente' | 'prioridade' | 'titulo';

export const ORDENS: { valor: ChaveDeOrdem; rotulo: string }[] = [
  { valor: 'data', rotulo: 'Data' },
  { valor: 'cliente', rotulo: 'Cliente' },
  { valor: 'prioridade', rotulo: 'Prioridade' },
  { valor: 'titulo', rotulo: 'Título' },
];

export const ORDEM_PADRAO: ChaveDeOrdem = 'data';

export type Periodo =
  | 'todos'
  | 'atrasados'
  | 'proximos_7'
  | 'este_mes'
  | 'mes_que_vem';

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Qualquer data' },
  { valor: 'atrasados', rotulo: 'Já passou' },
  { valor: 'proximos_7', rotulo: 'Próximos 7 dias' },
  { valor: 'este_mes', rotulo: 'Este mês' },
  { valor: 'mes_que_vem', rotulo: 'Mês que vem' },
];

export const PERIODO_PADRAO: Periodo = 'todos';

/**
 * Peça sem data vai para o fim, sempre.
 *
 * Ela não tem urgência para comparar, e deixá-la no topo empurraria para
 * baixo justamente o que tem prazo. Não é o mesmo que escondê-la: ela
 * continua na coluna, com "sem data" escrito no card, que é o que avisa que
 * falta agendar.
 */
const SEM_DATA = Number.POSITIVE_INFINITY;

const instante = (iso?: string): number => {
  if (!iso) return SEM_DATA;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : SEM_DATA;
};

/** Mais urgente primeiro, para a comparação ser "menor vem antes" como as outras. */
const PESO_DA_PRIORIDADE: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * A data que ordena é a **que o card mostra**.
 *
 * O card desenha `scheduledDate` com o ícone de relógio. Ordenar por
 * `deadlineProduction` ou `deadlineApproval` seria defensável — cada coluna
 * tem o prazo que lhe importa — e estaria errado aqui: a lista ficaria numa
 * ordem que a pessoa não consegue conferir olhando, porque o número que
 * justifica a posição não está na tela. Ordem que não dá para conferir é
 * indistinguível de desordem.
 */
export const dataQueOrdena = (job: Job): string | undefined => job.scheduledDate;

const comparar = (
  chave: ChaveDeOrdem,
  nomeDoCliente: (job: Job) => string
) => (a: Job, b: Job): number => {
  if (chave === 'cliente') {
    const d = nomeDoCliente(a).localeCompare(nomeDoCliente(b), 'pt-BR');
    if (d !== 0) return d;
  }

  if (chave === 'prioridade') {
    const pa = PESO_DA_PRIORIDADE[a.priority] ?? 9;
    const pb = PESO_DA_PRIORIDADE[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
  }

  if (chave === 'titulo') {
    const d = (a.title || '').localeCompare(b.title || '', 'pt-BR');
    if (d !== 0) return d;
  }

  // A data é o critério principal e o desempate de todos os outros: sem ela,
  // duas peças do mesmo cliente trocariam de lugar entre renderizações.
  const da = instante(dataQueOrdena(a));
  const db = instante(dataQueOrdena(b));
  if (da !== db) return da - db;

  // Último desempate pelo id, que é estável. Sem ele a ordem de dois cards
  // idênticos depende do `sort` do motor, e a lista "treme" sem motivo.
  return a.id.localeCompare(b.id);
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** `'2026-09'` a partir de `'2026-09-22'`. */
const mesDo = (dia: string): string => dia.slice(0, 7);

const mesSeguinte = (dia: string): string => {
  const ano = Number(dia.slice(0, 4));
  const mes = Number(dia.slice(5, 7));
  return mes === 12
    ? `${ano + 1}-01`
    : `${ano}-${String(mes + 1).padStart(2, '0')}`;
};

/**
 * A peça cabe na janela escolhida?
 *
 * **A fronteira do dia é a do fuso da agência, nunca a do dispositivo.** É a
 * armadilha 8.2, e ela mordeu escrevendo esta função: a primeira versão usava
 * `new Date(ano, mes, dia)`, que é meia-noite *local*. O efeito é o de sempre
 * — não quebra nada visível. Um conteúdo marcado para as 22h de ontem
 * aparece em "já passou" para quem está em São Paulo e não aparece para o
 * colega em Manaus, no mesmo quadro, com a mesma peça. Quem olha conclui que
 * o filtro está com defeito, não que os dois relógios discordam.
 *
 * A comparação é feita em `YYYY-MM-DD` de propósito: o dia no fuso da agência
 * é texto, e texto compara sem reabrir a questão do instante.
 *
 * **Peça sem data nunca cabe numa janela**, e isso é decisão: a janela
 * pergunta "o que acontece neste período", e o que não tem data não acontece
 * em período nenhum. Escondê-la em silêncio seria o problema — por isso quem
 * chama conta as escondidas e a tela diz o número.
 */
export const dentroDoPeriodo = (
  job: Job,
  periodo: Periodo,
  agora: Date = new Date(),
  fuso?: string
): boolean => {
  if (periodo === 'todos') return true;

  const iso = dataQueOrdena(job);
  if (instante(iso) === SEM_DATA) return false;

  const dia = diaNoFuso(iso as string, fuso);
  const hoje = diaNoFuso(agora, fuso);
  if (!dia || !hoje) return false;

  if (periodo === 'atrasados') return dia < hoje;

  if (periodo === 'proximos_7') {
    const limite = diaNoFuso(new Date(agora.getTime() + 7 * DIA_MS), fuso);
    return dia >= hoje && dia < limite;
  }

  if (periodo === 'este_mes') return mesDo(dia) === mesDo(hoje);

  return mesDo(dia) === mesSeguinte(hoje);
};

/**
 * A ordem final de uma coluna: os fixados nos índices deles, o resto fluindo.
 *
 * O algoritmo é um passeio pelos índices. Em cada posição, se algum card foi
 * fixado ali, ele entra; senão entra o próximo card solto, já ordenado pela
 * chave escolhida.
 *
 * Três detalhes que não são detalhe:
 *
 * - **Dois cards fixados no mesmo índice não podem existir**, mas podem
 *   chegar aqui: o banco é compartilhado e duas pessoas podem fixar ao mesmo
 *   tempo. O desempate é a própria chave de ordenação, e ele é determinístico
 *   — sem isso a coluna ficaria com ordem diferente em cada máquina.
 * - **Índice maior que a coluna vai para o fim.** Uma peça fixada na posição
 *   7 cuja coluna encolheu para 3 cards não pode sumir nem travar o laço.
 * - **O índice é por coluna.** Ele é o lugar na lista que a pessoa está
 *   vendo, e mudar de coluna é mudar de lista — por isso quem move entre
 *   colunas refixa no índice novo, em vez de carregar o antigo para uma lista
 *   de outro tamanho.
 */
export const ordenarColuna = (
  jobs: Job[],
  chave: ChaveDeOrdem,
  nomeDoCliente: (job: Job) => string = () => ''
): Job[] => {
  const cmp = comparar(chave, nomeDoCliente);

  const soltos = jobs.filter((j) => j.posicaoFixa == null).sort(cmp);
  const fixos = jobs
    .filter((j) => j.posicaoFixa != null)
    .sort((a, b) => {
      const d = (a.posicaoFixa as number) - (b.posicaoFixa as number);
      return d !== 0 ? d : cmp(a, b);
    });

  const resultado: Job[] = [];
  let iSolto = 0;
  let iFixo = 0;

  for (let posicao = 0; posicao < jobs.length; posicao++) {
    if (iFixo < fixos.length && (fixos[iFixo].posicaoFixa as number) <= posicao) {
      resultado.push(fixos[iFixo++]);
      continue;
    }
    if (iSolto < soltos.length) {
      resultado.push(soltos[iSolto++]);
      continue;
    }
    if (iFixo < fixos.length) resultado.push(fixos[iFixo++]);
  }

  // Sobra: fixados com índice além do fim da coluna.
  while (iFixo < fixos.length) resultado.push(fixos[iFixo++]);
  while (iSolto < soltos.length) resultado.push(soltos[iSolto++]);

  return resultado;
};
