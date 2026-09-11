/**
 * Lixeira de agências: o que a tela precisa saber sobre o prazo.
 *
 * Quem apaga de verdade é `api/expurgar-lixeira.ts`, no cron diário. Este
 * módulo existe só para a tela **dizer o mesmo prazo** que o servidor
 * cumpre — e `tests/lixeira.test.ts` falha se os dois números divergirem.
 * Sem essa guarda, mudar o cron para 3 dias deixaria a tela prometendo 7, e
 * quem confiasse nela perderia a agência quatro dias antes do combinado.
 */
export const DIAS_NA_LIXEIRA = 7;

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * Dias que faltam para o expurgo. Nunca negativo: passado o prazo, a linha
 * ainda está lá até o cron rodar, e "faltam -2 dias" não diz nada a ninguém.
 */
export const diasAteOExpurgo = (deletedAt: string): number => {
  const entrou = new Date(deletedAt).getTime();
  if (Number.isNaN(entrou)) return DIAS_NA_LIXEIRA;
  const decorridos = (Date.now() - entrou) / UM_DIA;
  return Math.max(0, Math.ceil(DIAS_NA_LIXEIRA - decorridos));
};
