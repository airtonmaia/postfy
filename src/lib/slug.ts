/**
 * Slug a partir de um nome, igual ao que o banco faz.
 *
 * Existe para a tela **mostrar** o endereço antes de gravar: quem cadastra a
 * agência precisa ver que "Ação & Cia" vira `acao-cia`, porque é esse
 * endereço que o cliente dela vai usar no portal.
 *
 * A regra é a mesma de `criar_agencia` e de `private.slug_do_cliente` — sem
 * acento, sem símbolo, minúsculo, sem hífen sobrando nas pontas, cortado em
 * 50. Se as duas divergirem, a tela promete um endereço e o banco grava
 * outro; `tests/slug.test.ts` compara as duas com os mesmos casos.
 *
 * **Quem manda continua sendo o banco.** Isto aqui é prévia, não decisão: o
 * banco ainda resolve colisão com sufixo (`acao-cia-1`), e a tela não tem
 * como saber disso sem consultar.
 */

/** Mesma tabela de `public.unaccent_simples`. */
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN';

const semAcento = (texto: string): string =>
  texto.replace(/./g, (c) => {
    const i = COM_ACENTO.indexOf(c);
    return i === -1 ? c : SEM_ACENTO[i];
  });

export const gerarSlug = (nome: string, reserva = 'agencia'): string => {
  const base = semAcento((nome || '').trim())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return (base.length === 0 ? reserva : base).slice(0, 50);
};
