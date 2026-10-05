/**
 * O caminho de um arquivo relativo à raiz do repositório, **com barra**.
 *
 * ### Por que isto existe
 *
 * Doze lugares faziam a mesma coisa à mão:
 *
 * ```ts
 * arquivo.replace(`${RAIZ}/`, '')
 * ```
 *
 * E ela **não funciona no Windows**. `join()` monta o caminho com `\`, então
 * o `${RAIZ}/` nunca casa: o `replace` devolve o caminho absoluto inteiro, e
 * a guarda passa a comparar `C:\Users\...\src\App.tsx` com uma lista escrita
 * `src/App.tsx`. Nenhum item bate, **tudo** vira achado, e a guarda reprova
 * vinte arquivos corretos de uma vez.
 *
 * O custo não é diagnosticar uma vez. É a suíte ficar vermelha numa das duas
 * máquinas o tempo todo — e aí ninguém mais olha para ela. É a mesma lição
 * que este projeto já registrou sobre guarda que reprova código correto:
 * *ela ensina a ignorá-la*. A falha de verdade chega no meio do ruído.
 *
 * A barra é mantida de propósito, e não trocada pelo separador do sistema: é
 * assim que as listas de exceção das guardas estão escritas, e é assim que a
 * mensagem de erro fica clicável no editor.
 */
export const relativoAoRepo = (arquivo: string, raiz: string): string =>
  arquivo
    .replace(/\\/g, '/')
    .replace(`${raiz.replace(/\\/g, '/')}/`, '');
