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
 * Todos os formatos que existem, sem repetir, na ordem da tabela.
 *
 * A tabela é por rede e o mesmo formato aparece em várias; quem pergunta
 * "qual formato", sem rede no meio, precisa da lista achatada. O rótulo que
 * fica é o da **primeira** rede em que o formato aparece — `rotuloDoFormato`
 * continua sendo o caminho para o nome dentro de uma rede.
 */
export const TODOS_OS_FORMATOS: OpcaoDeFormato[] = Object.values(FORMATOS_POR_CANAL)
  .flat()
  .filter((f, i, todos) => todos.findIndex((o) => o.valor === f.valor) === i);

/**
 * Os formatos que a agência **tem em conteúdo**, para o filtro oferecer.
 *
 * O filtro listava os oito que existem no produto, somando as seis redes.
 * Numa agência que só faz Instagram, três deles — Vídeo, Artigo e o que mais
 * vier — **não podem dar resultado nenhum**: escolher um esvazia o quadro, e
 * quadro vazio depois de um clique num filtro é exatamente a tela que faz a
 * pessoa concluir que o conteúdo sumiu.
 *
 * É a mesma regra de `FORMATOS_POR_CANAL` um degrau acima: *não oferecer
 * combinação que não vai ao ar*. Lá o limite é o que a rede aceita; aqui, o
 * que a agência tem.
 *
 * **O escolhido entra mesmo sem conteúdo**, e isso não é exceção decorativa:
 * apagar a última peça de um formato enquanto ele é o filtro ativo tiraria da
 * lista justamente a linha que está marcada — o menu abriria sem nada
 * selecionado, afirmando um estado que não é o da tela.
 *
 * A contagem sai do que está carregado, que é trabalho aberto mais 90 dias de
 * concluído. Formato que só existe em peça mais antiga não aparece — e também
 * não daria resultado, porque a tela filtra o mesmo conjunto.
 */
export const formatosEmUso = (
  jobs: { format: JobFormat }[],
  selecionado?: string
): OpcaoDeFormato[] => {
  const usados = new Set<string>(jobs.map((j) => j.format));
  if (selecionado) usados.add(selecionado);
  return TODOS_OS_FORMATOS.filter((f) => usados.has(f.valor));
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

/**
 * Quantas artes o formato comporta — e **só o carrossel comporta mais de uma.**
 *
 * O formulário oferecia até dez em qualquer formato, e isso é a tela
 * prometendo o que a rede não honra: um "Feed" com três imagens sai no perfil
 * com uma, e as outras duas ficam gravadas sem nunca aparecer. É a família do
 * `feed_story` oferecido no Facebook antes de existir publicador de story lá —
 * *a tela oferece mais do que o servidor honra.*
 *
 * Isto mora aqui, e não na tela, pelo mesmo motivo de `FORMATOS_POR_CANAL`: o
 * uploader é montado em dois lugares, e repetir a regra em cada um garante
 * esquecer um.
 *
 * O número **não limita o que já está gravado**: uma peça antiga com três
 * artes num formato de uma continua mostrando as três, e dá para remover. O
 * limite fecha a porta de entrada, não apaga o que entrou por ela.
 */
export const ARTES_DO_FORMATO: Partial<Record<JobFormat, number>> = {
  carousel: 10,
};

export const artesDoFormato = (formato: JobFormat): number =>
  ARTES_DO_FORMATO[formato] ?? 1;

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
