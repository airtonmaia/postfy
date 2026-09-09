declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
declare const __COMMIT__: string;

/**
 * Descobre que subiu versão nova enquanto a aba estava aberta.
 *
 * O problema é velho e silencioso: alguém deixa o Orquesia aberto, um deploy
 * sai, e a pessoa segue no bundle antigo — clicando em telas que já mudaram e
 * às vezes batendo em rotas `/api` que não existem mais. O sintoma chega como
 * "sumiu o botão" ou "deu erro do nada", e a primeira pergunta de quem
 * atende é sempre "você deu F5?".
 *
 * A aba não tem como saber isso sozinha: a versão dela está compilada dentro
 * do próprio JS. Por isso o build publica `version.json` ao lado do bundle, e
 * aqui a gente compara um com o outro.
 *
 * A comparação usa a build inteira, e não só o número da versão: um hotfix
 * costuma sair sem bump de versão, e é justamente o caso em que recarregar
 * mais importa.
 */

export interface IdentidadeDaBuild {
  versao: string;
  build: string;
  commit: string;
}

export const identidadeLocal = (): IdentidadeDaBuild => ({
  versao: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  build: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '',
  commit: typeof __COMMIT__ === 'string' ? __COMMIT__ : 'local',
});

const assinatura = (i: IdentidadeDaBuild): string => `${i.versao}|${i.commit}|${i.build}`;

/**
 * Identidade publicada agora.
 *
 * `no-store` mais a query com timestamp: sem os dois, o navegador responde
 * com a cópia que ele já tem — que é exatamente a versão antiga que estamos
 * tentando detectar.
 *
 * Devolve `null` em qualquer falha, e isso é de propósito: em
 * desenvolvimento o arquivo não existe (o plugin só roda no build), e uma
 * queda de rede não pode virar aviso de atualização.
 */
export const identidadePublicada = async (): Promise<IdentidadeDaBuild | null> => {
  try {
    const resposta = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (!dados || typeof dados.build !== 'string') return null;

    return {
      versao: String(dados.versao ?? ''),
      build: String(dados.build),
      commit: String(dados.commit ?? ''),
    };
  } catch {
    return null;
  }
};

/**
 * `import()` de tela que sobrevive a um deploy no meio do caminho.
 *
 * Cada tela é um chunk com hash no nome. Quando sai um deploy, os nomes
 * mudam e os arquivos antigos deixam de existir — mas a aba aberta continua
 * apontando para eles. Na hora em que a pessoa abre uma tela que ainda não
 * tinha carregado, o navegador pede um arquivo que sumiu e a aplicação cai
 * inteira com "Failed to fetch dynamically imported module".
 *
 * O aviso de versão nova não cobre esse caso: ele confere de dois em dois
 * minutos, e o chunk pode ser pedido antes disso.
 *
 * A saída é recarregar: a página nova vem com o index.html novo, que aponta
 * para os arquivos que existem. Uma vez só — se falhar de novo depois de
 * recarregar, o problema é outro (rede, arquivo corrompido) e insistir viraria
 * um laço de recarga infinito, que é bem pior que a tela de erro.
 */
const CHAVE_RECARGA = 'orquesia:recarga-por-chunk';

export const comRetentativaDeDeploy = <T>(carregar: () => Promise<T>): Promise<T> =>
  carregar().catch((erro) => {
    let jaRecarregou = false;
    try {
      jaRecarregou = window.sessionStorage.getItem(CHAVE_RECARGA) === '1';
      window.sessionStorage.setItem(CHAVE_RECARGA, '1');
    } catch {
      // Sem sessionStorage não dá para saber se já tentamos. Melhor entregar
      // o erro do que arriscar o laço.
      throw erro;
    }

    if (jaRecarregou) throw erro;

    window.location.reload();
    // A página está indo embora: esta promessa nunca resolve de propósito,
    // para o React não pintar erro nem fallback no meio da saída.
    return new Promise<T>(() => {});
  });

/** Chamado quando a aplicação sobe inteira: a próxima falha pode tentar de novo. */
export const marcarCargaBemSucedida = (): void => {
  try {
    window.sessionStorage.removeItem(CHAVE_RECARGA);
  } catch {
    /* idem */
  }
};

/** Há versão nova no ar? */
export const temVersaoNova = async (): Promise<IdentidadeDaBuild | null> => {
  const publicada = await identidadePublicada();
  if (!publicada) return null;

  const local = identidadeLocal();
  // Build local sem carimbo é `vite dev`: ali o HMR já resolve, e o aviso só
  // atrapalharia.
  if (!local.build) return null;

  return assinatura(publicada) === assinatura(local) ? null : publicada;
};
