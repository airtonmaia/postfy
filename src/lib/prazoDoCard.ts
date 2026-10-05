import type { Job } from '../types';
import { diaNoFuso } from './fusoHorario';

/**
 * O prazo que está apertando — **a frase que o card mostra, e quando não
 * mostra nada**.
 *
 * O quadro já tinha os dois prazos no schema (`deadlineProduction` e
 * `deadlineApproval`) e **nenhuma tela do fluxo de trabalho os lia**: só o
 * painel de Insights, que é outra tela e outra hora. Quem olha o quadro —
 * que é onde o trabalho acontece — não tinha como saber que uma peça vence
 * hoje. É a família do `trial_ends_at`: coluna que parece uma regra e não é.
 *
 * ### Três decisões
 *
 * - **Qual prazo vale depende da etapa.** Peça esperando o cliente é medida
 *   pelo prazo de aprovação; peça em produção, pelo de produção. Mostrar os
 *   dois sempre faria o card dizer duas coisas, e a que importa é uma só.
 * - **Peça concluída não tem prazo.** Aprovada, agendada ou publicada já
 *   chegou; um "venceu há 4 dias" num card publicado é alarme sobre trabalho
 *   que foi feito.
 * - **Só aparece quando é hoje, amanhã ou já passou.** Um selo em todo card
 *   não distingue nada — e a pessoa para de ler os selos todos. O corte é o
 *   que transforma o selo em aviso.
 *
 * A comparação é de **dias no fuso da agência**, por string `YYYY-MM-DD`.
 * Subtrair instantes diria "vence em 3 horas" para um prazo que é das 23:00
 * de hoje às 02:00 de amanhã — e diria coisas diferentes para dois membros da
 * equipe em estados diferentes. É a armadilha 8.2.
 */

export type TomDoPrazo = 'vencido' | 'hoje' | 'amanha';

export interface PrazoDoCard {
  texto: string;
  tom: TomDoPrazo;
}

/** Etapas em que a peça já chegou: não há prazo correndo. */
const CONCLUIDAS = ['approved', 'scheduled', 'published'];

const DIA_MS = 24 * 60 * 60 * 1000;

/** A diferença em dias entre dois dias já escritos como `YYYY-MM-DD`. */
const diasEntre = (de: string, ate: string): number =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);

export const prazoDoCard = (job: Job, agora: Date = new Date()): PrazoDoCard | null => {
  if (CONCLUIDAS.includes(job.status)) return null;

  const prazo = job.status === 'for_approval' ? job.deadlineApproval : job.deadlineProduction;
  if (!prazo) return null;

  const dia = diaNoFuso(prazo);
  const hoje = diaNoFuso(agora);
  if (!dia || !hoje) return null;

  const faltam = diasEntre(hoje, dia);

  if (faltam === 0) return { texto: 'Vence hoje', tom: 'hoje' };
  if (faltam === 1) return { texto: 'Vence amanhã', tom: 'amanha' };
  if (faltam === -1) return { texto: 'Venceu ontem', tom: 'vencido' };
  if (faltam < -1) return { texto: `Venceu há ${-faltam} dias`, tom: 'vencido' };

  return null;
};
