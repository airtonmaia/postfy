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
     * **"Feed + Story" entrou aqui depois do publicador, nunca antes.**
     *
     * A primeira versão daquela entrega ofereceu o formato para o Facebook
     * enquanto `publicarItem` publicava só o feed e **descartava a arte do
     * story em silêncio** — com a fila dizendo "publicado". A pessoa subia
     * duas artes, aprovava as duas com o cliente, e uma não saía.
     *
     * Story de Página é outro fluxo (`/{page-id}/photo_stories`, com a foto
     * enviada **não publicada** antes; `/video_stories` em fases, para vídeo),
     * e ele agora existe em `api/_lib/facebook.ts`. A ordem importa: acrescentar
     * a linha desta lista é prometer a publicação, e a promessa só pode vir
     * depois de haver quem a cumpra.
     */
    { valor: 'feed_story', rotulo: 'Feed + Story' },
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

/**
 * A peça é "Feed + Story" e não tem a arte do story?
 *
 * **Isto existe porque um story errado foi ao ar no perfil de um cliente.**
 * `api/publicar.ts` tinha um `|| midia` que, faltando a arte vertical, mandava
 * a **do feed** para o story. A Meta aceita e publica, então a fila fechou
 * como `publicado`, com `story_external_id` preenchido e `last_error` nulo:
 * sucesso completo, story errado no perfil. E o que sai não volta.
 *
 * O servidor já não substitui — ele publica o feed e deixa o motivo em
 * `last_error`. Mas descobrir ali é tarde: o feed já está no ar, e a peça
 * ficou pela metade. Por isso a conferência também mora **antes da ação**,
 * onde ainda dá para subir a arte.
 *
 * Fica em `formatos.ts`, e não em cada tela, pela mesma razão de
 * `FORMATOS_POR_CANAL` ter saído da `CreateJobModal`: são quatro botões em
 * três telas que disparam publicação, e repetir a regra em cada um garante
 * esquecer um — e esquecer aqui não quebra nada visível.
 */
export const faltaArteDoStory = (peca: {
  format?: JobFormat;
  storyMediaUrls?: string[];
}): boolean =>
  peca.format === 'feed_story' &&
  !(peca.storyMediaUrls || []).some((u) => (u || '').trim().length > 0);

/** O que dizer quando falta. Um texto só, pelos mesmos motivos. */
export const AVISO_SEM_ARTE_DE_STORY =
  'Este conteúdo é "Feed + Story" e não tem arte de story. Suba a arte 9:16 em ' +
  '"Mídia do Story" — sem ela, só o feed vai ao ar.';

/**
 * A proporção em que a arte é mostrada, pela rede e pelo formato reais — nunca
 * um quadrado genérico.
 *
 * Estava escrita dentro de `ClientPortalView.tsx`, que era o único lugar com
 * prévia de arte. Deixou de ser: o calendário da agência passou a mostrar a
 * mesma prévia no hover, e uma segunda cópia divergiria na primeira pressa —
 * a história das doze alturas de botão e das sete barras de abas.
 *
 * Divergir *aqui* tem um custo próprio: a mesma peça apareceria 4:5 de um lado
 * e 9:16 do outro, e é exatamente o enquadramento que a prévia existe para
 * mostrar. A agência confere o corte na tela dela e manda para o cliente, que
 * vê outro.
 *
 * Vertical (Story/Reels) vem **antes** da rede: o formato manda mais na
 * proporção do que a plataforma.
 */
export const proporcaoDoCriativo = (platform: JobPlatform, format: JobFormat): string => {
  if (format === 'story' || format === 'reel') return 'aspect-[9/16]';
  if (format === 'video') return 'aspect-video';
  if (platform === 'tiktok') return 'aspect-[9/16]';
  if (platform === 'youtube') return 'aspect-video';
  // Feed/carrossel: 4:5 é o formato de maior área útil no Instagram e
  // Facebook, e serve como referência razoável para LinkedIn/X também.
  return 'aspect-[4/5]';
};
