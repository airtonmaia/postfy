import type { JobPlatform, JobFormat } from '../types';

/**
 * O que cada rede pede.
 *
 * O cadastro mostrava os mesmos campos para todas: legenda, formato, data.
 * Mas um Reel pede capa e "compartilhar no feed"; o YouTube pede descrição,
 * thumbnail, categoria e visibilidade; o LinkedIn, tipo de publicação. Pedir
 * tudo em toda rede enche a tela de campo que não vai a lugar nenhum — e
 * pedir só o comum obriga a agência a guardar o resto na cabeça.
 *
 * O catálogo é declarativo de propósito: a tela percorre esta lista em vez
 * de acumular `if (platform === 'youtube')`. Rede nova entra aqui e aparece
 * no formulário e na prévia sem tocar em componente.
 */

export type TipoDeCampo = 'texto' | 'textoLongo' | 'selecao' | 'booleano' | 'midia';

export interface CampoDoCanal {
  chave: string;
  rotulo: string;
  tipo: TipoDeCampo;
  /**
   * Onde o valor mora.
   *
   * `job` são as colunas que toda rede tem — legenda e primeiro comentário
   * têm coluna própria e ficam nelas. `config` é o `jsonb`, para o que só
   * existe numa rede.
   */
  destino: 'job' | 'config';
  exemplo?: string;
  ajuda?: string;
  opcoes?: { valor: string; rotulo: string }[];
  /** Só aparece nestes formatos. Capa do Reel não existe no Feed. */
  formatos?: JobFormat[];
  linhas?: number;
}

const LEGENDA: CampoDoCanal = {
  chave: 'caption',
  rotulo: 'Legenda',
  tipo: 'textoLongo',
  destino: 'job',
  exemplo: 'Digite aqui o texto que acompanhará a publicação...',
  linhas: 10,
};

export const CAMPOS_POR_CANAL: Record<JobPlatform, CampoDoCanal[]> = {
  instagram: [
    LEGENDA,
    {
      chave: 'localizacao',
      rotulo: 'Localização',
      tipo: 'texto',
      destino: 'config',
      exemplo: 'Ex: São Paulo, Brasil',
    },
    {
      chave: 'firstComment',
      rotulo: 'Primeiro comentário',
      tipo: 'textoLongo',
      destino: 'job',
      exemplo: 'Costuma levar as hashtags, para não poluir a legenda.',
      linhas: 3,
    },
    {
      chave: 'capaDoReel',
      rotulo: 'Capa do Reel',
      tipo: 'midia',
      destino: 'config',
      ajuda: 'É o quadro que aparece no perfil. Sem capa, o Instagram escolhe um.',
      formatos: ['reel'],
    },
    {
      chave: 'compartilharNoFeed',
      rotulo: 'Compartilhar também no feed',
      tipo: 'booleano',
      destino: 'config',
      formatos: ['reel'],
    },
  ],

  youtube: [
    {
      chave: 'caption',
      rotulo: 'Descrição',
      tipo: 'textoLongo',
      destino: 'job',
      exemplo: 'O texto que aparece abaixo do vídeo...',
      linhas: 10,
    },
    {
      chave: 'thumbnail',
      rotulo: 'Thumbnail',
      tipo: 'midia',
      destino: 'config',
      ajuda: 'A miniatura que decide o clique.',
    },
    {
      chave: 'categoria',
      rotulo: 'Categoria',
      tipo: 'selecao',
      destino: 'config',
      opcoes: [
        { valor: 'educacao', rotulo: 'Educação' },
        { valor: 'entretenimento', rotulo: 'Entretenimento' },
        { valor: 'pessoas', rotulo: 'Pessoas e blogs' },
        { valor: 'ciencia', rotulo: 'Ciência e tecnologia' },
        { valor: 'esportes', rotulo: 'Esportes' },
        { valor: 'noticias', rotulo: 'Notícias e política' },
      ],
    },
    {
      chave: 'visibilidade',
      rotulo: 'Visibilidade',
      tipo: 'selecao',
      destino: 'config',
      opcoes: [
        { valor: 'publico', rotulo: 'Público' },
        { valor: 'naoListado', rotulo: 'Não listado' },
        { valor: 'privado', rotulo: 'Privado' },
      ],
    },
  ],

  linkedin: [
    {
      chave: 'caption',
      rotulo: 'Texto',
      tipo: 'textoLongo',
      destino: 'job',
      exemplo: 'O texto da publicação...',
      linhas: 10,
    },
    {
      chave: 'tipoDePublicacao',
      rotulo: 'Tipo de publicação',
      tipo: 'selecao',
      destino: 'config',
      opcoes: [
        { valor: 'organica', rotulo: 'Publicação orgânica' },
        { valor: 'artigo', rotulo: 'Artigo' },
        { valor: 'documento', rotulo: 'Documento / PDF' },
      ],
    },
  ],

  // As três abaixo ainda não ganharam campos próprios. Ficam com a legenda,
  // e é melhor assim do que inventar campo que ninguém conferiu com a rede.
  facebook: [LEGENDA],
  tiktok: [LEGENDA],
  twitter: [{ ...LEGENDA, rotulo: 'Texto do post', linhas: 6 }],
};

/** Os campos daquela rede que fazem sentido no formato escolhido. */
export const camposVisiveis = (
  plataforma: JobPlatform,
  formato: JobFormat
): CampoDoCanal[] =>
  (CAMPOS_POR_CANAL[plataforma] || CAMPOS_POR_CANAL.instagram).filter(
    (campo) => !campo.formatos || campo.formatos.includes(formato)
  );
