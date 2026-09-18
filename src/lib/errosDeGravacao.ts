/**
 * Quem falhou ao gravar, e quem já voltou a gravar.
 *
 * ---
 *
 * **Isto existe porque o sucesso de uma coleção apagava o erro de outra — e
 * foi assim que todo bug de gravação silenciosa passou despercebido.**
 *
 * As dez coleções de `PostfyContext` compartilham uma fila de gravação e
 * compartilhavam **um** `syncState`. `createJob` mexe em duas delas no mesmo
 * render:
 *
 * ```
 * setAllJobs(...)    → insert em `jobs`          falha  → faixa acende
 * logActivity(...)   → insert em `activity_logs` passa  → faixa apaga
 * ```
 *
 * A fila é sequencial e `activityLogs` vem depois de `jobs`, então o
 * `'saved'` do log chegava milissegundos depois do `'error'` do conteúdo.
 * **O registro de "Criou o conteúdo" era exatamente o que apagava o aviso de
 * que o conteúdo não foi criado.**
 *
 * Os números de produção fecham com isso: numa tarde, dez linhas
 * `Criou o conteúdo` em `activity_logs` e **uma** em `jobs`, sem ninguém ver
 * erro nenhum. O `feed_story` recusado pelo banco, a bandeira que descartava
 * a edição seguinte e o canal que não entrava na fila — os três só ficaram
 * caros porque o aviso não sobrevivia ao próprio commit que o causava.
 *
 * Mora aqui, fora do componente, porque é **estado puro**: assim a decisão é
 * exercitada por teste de verdade em vez de descrita por uma varredura de
 * fonte. Guarda que descreve o mecanismo aprova qualquer mecanismo com aquela
 * forma.
 */

/** O que a faixa deve mostrar. `null` significa **não mexa no estado**. */
export type Repintura = { estado: 'saved' | 'error'; mensagem: string | null } | null;

export interface PainelDeErros {
  /** Uma origem falhou. Devolve sempre uma repintura: o aviso tem de acender. */
  falhou(origem: string, mensagem: string): Repintura;
  /** Uma origem voltou a gravar. */
  deuCerto(origem: string): Repintura;
  /** Quantas origens estão com erro em aberto. */
  readonly abertos: number;
}

export const criarPainelDeErros = (): PainelDeErros => {
  const erros = new Map<string, string>();

  const repintar = (): Repintura => {
    const mensagens = [...erros.values()];
    if (!mensagens.length) return { estado: 'saved', mensagem: null };
    // Duas coleções que falham pelo mesmo motivo não repetem o texto.
    return { estado: 'error', mensagem: [...new Set(mensagens)].join(' ') };
  };

  return {
    falhou(origem, mensagem) {
      erros.set(origem, mensagem);
      return repintar();
    },

    /**
     * **A saída antecipada é a correção.**
     *
     * Sem ela, a gravação bem-sucedida de qualquer coleção devolveria
     * `'saved'` e apagaria a falha da vizinha. Quem não tinha erro nenhum não
     * tem o que limpar — e, com outra origem ainda em aberto, não pode
     * silenciar o aviso dela.
     */
    deuCerto(origem) {
      const tinhaErro = erros.delete(origem);
      if (!tinhaErro && erros.size) return null;
      return repintar();
    },

    get abertos() {
      return erros.size;
    },
  };
};
