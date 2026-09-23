/**
 * A arte que mora no Google Drive, e não no R2.
 *
 * ### Por que existe uma URL falsa
 *
 * `jobs.media_urls` é uma lista de endereços de mídia, e todo lugar que
 * desenha a peça lê o primeiro item dela: o card do quadro, a grade do
 * calendário, a prévia, o portal do cliente. Guardar a referência do Drive
 * numa coluna paralela obrigaria **cada um** desses lugares a juntar duas
 * listas e a decidir a ordem — e ordem aqui tem significado, porque o segundo
 * item é a página 2 do carrossel.
 *
 * Então a referência entra na própria lista, com um esquema que não é http:
 *
 * ```
 * drive://1AbC...?nome=corte-final.mp4&tipo=video%2Fmp4&miniatura=https%3A%2F%2F...
 * ```
 *
 * A ordem se preserva sozinha, e quem só conta itens (`mediaUrls.length`)
 * continua certo sem saber que isto existe.
 *
 * ### E por que isso é seguro
 *
 * O preço de uma URL falsa é que um `<img src>` com ela não desenha nada.
 * É um defeito **visível na primeira olhada** — e o que não pode acontecer
 * aqui é o silencioso: a Meta **baixa** a mídia da URL que mandamos, sem
 * sessão, e um link do Drive devolve HTML. Publicar com ele sairia errado ou
 * não sairia, com a fila dizendo que deu certo.
 *
 * Por isso o publicador **recusa** `drive://` em vez de tentar. A peça só
 * publica com `jobs.midia_publicavel` preenchida, que é a cópia temporária no
 * R2 feita na hora de agendar — e apagada depois que a peça foi ao ar.
 */

export const PREFIXO_DO_DRIVE = 'drive://';

export interface ArquivoDoDrive {
  id: string;
  nome: string;
  /** O mime do Google. É ele que diz se a peça é vídeo. */
  tipo: string;
  /** A miniatura que o Google devolve. Pode não vir. */
  miniatura?: string;
}

export const ehDoDrive = (url: string): boolean =>
  typeof url === 'string' && url.startsWith(PREFIXO_DO_DRIVE);

/** A referência como ela é guardada em `media_urls`. */
export const referenciaDoDrive = (arquivo: ArquivoDoDrive): string => {
  const campos = new URLSearchParams({ nome: arquivo.nome, tipo: arquivo.tipo });
  if (arquivo.miniatura) campos.set('miniatura', arquivo.miniatura);
  return `${PREFIXO_DO_DRIVE}${arquivo.id}?${campos.toString()}`;
};

export const dadosDoDrive = (url: string): ArquivoDoDrive | null => {
  if (!ehDoDrive(url)) return null;

  const resto = url.slice(PREFIXO_DO_DRIVE.length);
  const corte = resto.indexOf('?');
  const id = corte >= 0 ? resto.slice(0, corte) : resto;
  if (!id) return null;

  const campos = new URLSearchParams(corte >= 0 ? resto.slice(corte + 1) : '');
  return {
    id,
    nome: campos.get('nome') || 'arquivo do Drive',
    tipo: campos.get('tipo') || '',
    miniatura: campos.get('miniatura') || undefined,
  };
};

/**
 * O que um `<img src>` pode receber.
 *
 * Para arte do R2 é a própria URL. Para arte do Drive é a miniatura — e
 * quando nem ela veio, string vazia, que desenha o quadro vazio em vez de um
 * ícone de imagem quebrada.
 */
export const urlDeExibicao = (url: string): string => {
  const doDrive = dadosDoDrive(url);
  if (!doDrive) return url;
  return doDrive.miniatura || '';
};

/** Onde o arquivo abre de verdade, para quem tem acesso à pasta. */
export const urlNoDrive = (url: string): string | null => {
  const doDrive = dadosDoDrive(url);
  return doDrive ? `https://drive.google.com/file/d/${doDrive.id}/view` : null;
};

export const ehVideo = (url: string): boolean => {
  const doDrive = dadosDoDrive(url);
  if (doDrive) return doDrive.tipo.startsWith('video/');
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
};

/** Quantas artes desta peça ainda estão só no Drive. */
export const quantasNoDrive = (...listas: (string[] | undefined)[]): number =>
  listas.flatMap((l) => l || []).filter(ehDoDrive).length;
