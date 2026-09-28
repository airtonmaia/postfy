import type { Job } from '../types';

/**
 * O que entra na grade do feed, e em que ordem.
 *
 * O cliente aprova peça por peça, uma de cada vez — e o perfil dele não é uma
 * peça de cada vez: é o conjunto, lido de relance. Duas artes lindas e
 * seguidas na mesma paleta brigam no grid, e isso só aparece **depois de
 * publicadas**, quando não volta.
 *
 * A regra mora aqui, e não dentro da tela, pela razão de sempre neste
 * projeto: assim ela é exercitada por teste de verdade em vez de descrita por
 * uma varredura de fonte. Guarda que descreve o mecanismo aprova qualquer
 * mecanismo com aquela forma.
 */

/**
 * Esta peça vai ao Instagram?
 *
 * `canais` é a lista de redes marcadas; `platform` é o campo antigo, de quando
 * o conteúdo ia para uma rede só. O mapeamento já preenche `canais` com
 * `[platform]` quando a linha é anterior à coluna, então ler `canais` primeiro
 * é o certo — e o recuo para `platform` fica por segurança, porque uma lista
 * vazia aqui não pode esconder a peça do dono dela.
 *
 * **A grade é um perfil do Instagram, então ela só pode mostrar o que vai
 * para lá.** Uma peça de LinkedIn no meio do grid afirmaria uma publicação
 * que não vai acontecer — e o cliente decide a estética do perfil olhando
 * para isso.
 */
export const vaiParaOInstagram = (job: Pick<Job, 'canais' | 'platform'>): boolean => {
  const canais = job.canais?.length ? job.canais : [job.platform];
  return canais.includes('instagram');
};

/**
 * Quando a peça ocupa o lugar dela na grade.
 *
 * `scheduledDate` pode faltar — a tela do calendário já recua para o prazo de
 * produção, e aqui vale o mesmo. Sem nenhuma das duas, a peça vai para o fim
 * em vez de sumir: `NaN` numa comparação de ordenação devolve `false` dos dois
 * lados, e o resultado passa a depender do algoritmo de ordenação do
 * navegador — uma grade que se reorganiza sozinha entre recarregamentos.
 */
const quando = (job: Job): number => {
  const bruto = job.scheduledDate || job.deadlineProduction;
  const instante = bruto ? new Date(bruto).getTime() : Number.NaN;
  /*
    Zero, e não `-Infinity`: duas peças sem data comparadas entre si dariam
    `-Infinity - (-Infinity)`, que é `NaN` — e comparador que devolve `NaN` faz
    a ordem depender do algoritmo do navegador. Com zero elas empatam, e o
    empate é estável.
  */
  return Number.isNaN(instante) ? 0 : instante;
};

/**
 * A grade do cliente: o que vai ao Instagram, do mais novo para o mais antigo.
 *
 * **Ideia não entra**, e é a regra que mais importa aqui. A coluna Ideias é o
 * rascunho da agência — pauta anotada, tema em estudo, o que foi levantado na
 * reunião e ainda pode não virar nada. Mostrar isso ao cliente como parte do
 * feed dele promete publicação que ninguém decidiu fazer, e é a família de bug
 * que este projeto já pagou várias vezes: *a tela oferece mais do que o
 * servidor honra*.
 *
 * **A ordem é a do Instagram, não a do quadro**: mais recente no canto
 * superior esquerdo, descendo pela data. É o que faz a simulação valer — uma
 * grade na ordem de cadastro mostraria uma harmonia que o perfil nunca vai
 * ter.
 *
 * Ordenar compara **instantes**, e por isso não passa por fuso nenhum: o fuso
 * da agência decide como a data é *escrita* na tela (armadilha 8.2), e a
 * conversão não muda qual peça vem antes.
 */
export const feedDoCliente = (jobs: Job[]): Job[] =>
  jobs
    .filter((job) => job.status !== 'ideas' && vaiParaOInstagram(job))
    .sort((a, b) => quando(b) - quando(a));
