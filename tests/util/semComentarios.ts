/**
 * Tira os comentários da fonte, **sem levar código junto.**
 *
 * O projeto registra nos comentários o que deu errado antes — inclusive as
 * classes e as strings exatas de cada bug. Por isso quase toda guarda lê a
 * fonte por aqui: sem isso ela acusaria a própria memória do bug, e a saída
 * seria apagar a explicação.
 *
 * ---
 *
 * **Isto mora num arquivo só porque a versão anterior estava errada, e a cópia
 * dela vivia em 21 testes.**
 *
 * A regra era `fonte.replace(/\/\*[\s\S]*?\*\//g, '')`. Ela trata **todo**
 * `/*` como abertura de comentário — e `accept="image/*"` tem um. O `/` vem
 * colado no `e` de `image`, mas o regex não olha o que está antes: a partir
 * dali ele engolia tudo até o primeiro `*​/` de verdade, dezenas de linhas
 * abaixo.
 *
 * Medido: **32% do `file-upload.tsx`, 44% do `AuthModal.tsx` e 21% do
 * `MediaUploader.tsx`** sumiam antes de qualquer guarda olhar — justamente os
 * três arquivos que mexem com upload de imagem, que é onde `image/*` aparece.
 *
 * E o efeito é o pior possível: **as guardas passavam.** Elas procuram o que
 * não pode existir, e o que não pode existir tinha sido apagado junto. A guarda
 * do `alert()`, a do `<Button>` com conteúdo em bloco e a do `toLocale*` sem
 * fuso estavam cegas para um terço desses arquivos, com o CI verde o tempo
 * todo. É a armadilha 0 dentro da própria rede de proteção.
 *
 * A correção é olhar o caractere anterior: comentário de verdade vem no começo
 * da linha ou depois de espaço, `{`, `(`, `,`, `;`, `=` ou `:`. Um `/*` colado
 * num identificador é caminho de arquivo ou tipo MIME, nunca comentário.
 */
const ABRE_COMENTARIO = /(^|[\s{(,;=:])\/\*[\s\S]*?\*\//g;

/** Comentário de bloco e de linha, para TypeScript e TSX. */
export const semComentarios = (fonte: string): string =>
  fonte
    .replace(ABRE_COMENTARIO, '$1')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * A mesma coisa para SQL: `--` até o fim da linha.
 *
 * Migração não tem `/* *​/`, e o `--` só conta no começo da linha — dentro de
 * uma string ele é texto.
 */
export const semComentariosSql = (sql: string): string => sql.replace(/^\s*--.*$/gm, '');

/**
 * TS/TSX **e** SQL na mesma passada.
 *
 * Alguns testes leem migração e componente com o mesmo helper; separar os dois
 * ali só produziria duas chamadas onde uma resolve.
 */
export const semComentariosTudo = (fonte: string): string =>
  semComentariosSql(semComentarios(fonte));

/**
 * Também some com a linha de continuação de bloco (`   * texto`).
 *
 * Usada onde o bloco já foi removido por outro caminho e sobram as linhas do
 * meio — é o caso de `tests/dialogos.test.ts`.
 */
export const semComentariosEEstrela = (fonte: string): string =>
  semComentarios(fonte).replace(/^\s*\*.*$/gm, '');
