import { JobFormat, JobPlatform } from '../types';

/**
 * Que formato existe em cada rede — e o nome que cada uma dá a ele.
 *
 * Estava dentro de `CreateJobModal.tsx`, que era o único lugar que escolhia
 * formato. Deixou de ser: a modal de detalhe passou a editar o formato da peça
 * já criada, e uma segunda cópia desta tabela divergiria na primeira vez que
 * alguém acrescentasse um formato num lado só. Foi assim que nasceram as doze
 * alturas de botão e as sete barras de abas.
 *
 * A regra que ela carrega continua a mesma: **formato só existe dentro de uma
 * rede**. "Story" não existe no YouTube e "Short" não existe no Instagram —
 * oferecer a lista inteira em toda rede deixa escolher combinação que não vai
 * ao ar, e o erro só apareceria na hora de publicar.
 *
 * O rótulo muda com a rede porque a mesma coisa tem nome diferente em cada
 * uma: vídeo curto é Reels no Instagram e Short no YouTube.
 */
export interface OpcaoDeFormato {
  valor: JobFormat;
  rotulo: string;
}

export const FORMATOS_POR_CANAL: Record<JobPlatform, OpcaoDeFormato[]> = {
  instagram: [
    { valor: 'feed', rotulo: 'Feed' },
    { valor: 'feed_story', rotulo: 'Feed + Story' },
    { valor: 'carousel', rotulo: 'Carrossel' },
    { valor: 'reel', rotulo: 'Reels' },
    { valor: 'story', rotulo: 'Story' },
  ],
  facebook: [
    { valor: 'feed', rotulo: 'Feed' },
    /**
     * **"Feed + Story" não entra aqui**, e a primeira versão daquela entrega
     * errou isso: o formato foi oferecido para o Facebook enquanto
     * `publicarItem` publicava só o feed e **descartava a arte do story em
     * silêncio** — com a fila dizendo "publicado".
     *
     * Story de Página é outro fluxo (`/{page-id}/photo_stories`, com a foto
     * enviada não publicada antes) e outro escopo. Enquanto ele não existir em
     * `api/_lib/facebook.ts`, oferecer o formato é prometer meia publicação —
     * que é justamente o motivo de esta lista ser por rede.
     */
    { valor: 'carousel', rotulo: 'Carrossel' },
    { valor: 'reel', rotulo: 'Reels' },
    { valor: 'story', rotulo: 'Story' },
    { valor: 'video', rotulo: 'Vídeo' },
  ],
  linkedin: [
    { valor: 'feed', rotulo: 'Publicação' },
    { valor: 'carousel', rotulo: 'Carrossel' },
    { valor: 'article', rotulo: 'Artigo' },
    { valor: 'video', rotulo: 'Vídeo' },
  ],
  tiktok: [{ valor: 'reel', rotulo: 'Vídeo' }],
  youtube: [
    { valor: 'video', rotulo: 'Vídeo' },
    { valor: 'reel', rotulo: 'Short' },
  ],
  twitter: [
    { valor: 'feed', rotulo: 'Post' },
    { valor: 'video', rotulo: 'Vídeo' },
  ],
};

/**
 * Os formatos que existem em **todas** as redes escolhidas.
 *
 * Instagram e Facebook compartilham feed, carrossel, reel e story; já
 * Instagram e YouTube só compartilham o vídeo curto. Oferecer a união
 * deixaria escolher Story para o YouTube, que não tem — e o erro só
 * apareceria na hora de publicar.
 *
 * Interseção vazia (redes sem nada em comum) cai na lista do canal
 * principal: melhor do que um seletor sem nenhuma opção.
 */
export const formatosComuns = (canais: JobPlatform[]): OpcaoDeFormato[] => {
  const listas = canais.map((c) => FORMATOS_POR_CANAL[c] || []);
  if (!listas.length) return FORMATOS_POR_CANAL.instagram;

  const comuns = listas[0].filter((f) =>
    listas.every((lista) => lista.some((o) => o.valor === f.valor))
  );
  return comuns.length ? comuns : listas[0];
};

/**
 * O rótulo do formato **na rede em que ele está**.
 *
 * `reel` se chama "Reels" no Instagram e "Short" no YouTube; mostrar um nome
 * só faria a tela de detalhe contradizer a de cadastro, que já mostra o certo.
 * Formato fora da lista da rede (rede trocada depois) cai no próprio valor, em
 * vez de sumir: a peça existe e a tela precisa dizer o que ela é.
 */
export const rotuloDoFormato = (formato: JobFormat, rede: JobPlatform): string =>
  (FORMATOS_POR_CANAL[rede] || []).find((f) => f.valor === formato)?.rotulo ?? formato;
