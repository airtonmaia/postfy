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

/**
 * O que a faixa deve mostrar. `null` significa **não mexa no estado**.
 *
 * `titulo` em `null` é a frase padrão — "uma alteração não chegou ao banco",
 * que é a consequência de uma gravação recusada. Nem toda falha que acende
 * esta faixa é isso, e afirmar que foi é pior que não dizer nada: a cópia de
 * um vídeo que não coube no tempo da função **não perdeu alteração nenhuma**,
 * e mandar recarregar para "ver o que foi gravado" faz a pessoa procurar um
 * estrago que não existe, enquanto o problema de verdade — a publicação sem
 * arquivo — passa batido.
 */
export type Repintura =
  | { estado: 'saved' | 'error'; mensagem: string | null; titulo?: string | null }
  | null;

export interface PainelDeErros {
  /**
   * Uma origem falhou. Devolve sempre uma repintura: o aviso tem de acender.
   *
   * `titulo` é opcional porque o caso comum é o da gravação, e repeti-lo em
   * cada chamada seria o convite para uma delas divergir.
   */
  falhou(origem: string, mensagem: string, titulo?: string): Repintura;
  /** Uma origem voltou a gravar. */
  deuCerto(origem: string): Repintura;
  /** Quantas origens estão com erro em aberto. */
  readonly abertos: number;
}

export const criarPainelDeErros = (): PainelDeErros => {
  const erros = new Map<string, { mensagem: string; titulo?: string }>();

  const repintar = (): Repintura => {
    const abertos = [...erros.values()];
    if (!abertos.length) return { estado: 'saved', mensagem: null, titulo: null };

    /*
      **Com origens diferentes em aberto, vale a frase padrão.**

      Uma delas sem título é uma gravação recusada, e essa é a afirmação mais
      grave das duas: o trabalho pode não estar no banco. Deixar o título da
      outra no lugar esconderia isso atrás de um aviso mais brando — e a
      pessoa não recarregaria para conferir. Títulos diferentes entre si caem
      no mesmo lugar, pela mesma razão: na dúvida, a frase que manda conferir.
    */
    const titulos = new Set(abertos.map((e) => e.titulo));
    const titulo = titulos.size === 1 ? [...titulos][0] ?? null : null;

    // Duas coleções que falham pelo mesmo motivo não repetem o texto.
    return {
      estado: 'error',
      mensagem: [...new Set(abertos.map((e) => e.mensagem))].join(' '),
      titulo,
    };
  };

  return {
    falhou(origem, mensagem, titulo) {
      erros.set(origem, { mensagem, titulo });
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
