import type { Job, JobPlatform } from '../types';
import { dentroDoPeriodo, type IntervaloDeDias, type Periodo } from './ordemDoQuadro';

/**
 * O recorte do conteúdo — **um só, para o quadro e para o calendário**.
 *
 * ### Por que isto existe
 *
 * O mesmo predicado estava escrito **cinco vezes**: uma no `KanbanBoard` e
 * uma em cada uma das quatro visões do calendário (mês, semana, dia, lista).
 * Elas não divergiram por sorte, e o custo já tinha aparecido: o filtro de
 * formato existia só no quadro, então a mesma pergunta — "o que está marcado
 * para esta semana em Reels?" — tinha resposta numa tela e não tinha na
 * outra.
 *
 * É a história das doze alturas de botão, das sete barras de abas e das três
 * cópias do `find` que escolhia a conta errada. Aqui ela é pior em um ponto:
 * **filtro que diverge esconde conteúdo**, e conteúdo escondido não avisa que
 * sumiu. Quem olha conclui que a peça não existe.
 *
 * ### O que não mora aqui
 *
 * A **data da grade** fica em cada visão, e de propósito: a casinha do
 * calendário é rótulo, não instante (armadilha 8.2), e o dia que a semana
 * mostra não é o mesmo recorte que a janela de datas faz. Misturar os dois
 * aqui faria a grade do mês passar a depender do filtro de período para
 * desenhar as casas.
 */
export interface FiltrosDoConteudo {
  /** `all` ou o id do cliente. */
  cliente: string;
  /** `all` ou uma `JobPlatform`. */
  rede: string;
  /** `todos` ou um valor de `JobFormat`. */
  formato: string;
  periodo: Periodo;
  intervalo: IntervaloDeDias;
  /** `all` ou um `JobStatus` — só o calendário usa hoje. */
  status?: string;
}

/**
 * Os canais da peça.
 *
 * `platform` é o primeiro de `canais`, e peça gravada antes do multicanal não
 * tem `canais` nenhum. Sem este recuo, o acervo inteiro sumiria de qualquer
 * filtro de rede.
 */
const canaisDoJob = (job: Job): JobPlatform[] =>
  job.canais?.length ? job.canais : [job.platform];

export const passaNosFiltros = (
  job: Job,
  filtros: FiltrosDoConteudo,
  agora: Date = new Date()
): boolean => {
  if (filtros.cliente !== 'all' && job.clientId !== filtros.cliente) return false;

  /*
    **A rede olha `canais`, e não só `platform`.** Comparar com `platform`
    sozinho escondia toda peça multicanal cuja rede principal não fosse a
    filtrada — um conteúdo marcado para Instagram e Facebook sumia do filtro
    "Facebook", com a tela afirmando que não havia nada para publicar lá.
  */
  if (filtros.rede !== 'all' && !canaisDoJob(job).includes(filtros.rede as JobPlatform)) {
    return false;
  }

  if (filtros.formato !== 'todos' && job.format !== filtros.formato) return false;
  if (filtros.status && filtros.status !== 'all' && job.status !== filtros.status) return false;

  // O fuso fica no padrão de propósito: `diaNoFuso` já cai no fuso da
  // agência, e passar o do dispositivo aqui é exatamente a armadilha 8.2.
  return dentroDoPeriodo(job, filtros.periodo, agora, undefined, filtros.intervalo);
};
