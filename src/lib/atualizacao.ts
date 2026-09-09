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
