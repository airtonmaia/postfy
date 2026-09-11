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
  /**
   * Ganha a barra de ferramentas e o contador.
   *
   * Só o campo principal de texto. Pôr a barra em todo `textoLongo` daria
   * botão de IA no primeiro comentário, que é onde vão as hashtags — a
   * ferramenta certa no lugar errado ainda é ruído.
   */
  barra?: boolean;
  /**
   * Sai da linha do formulário e vira ícone ao lado da legenda, abrindo em
   * modal.
   *
   * Localização, primeiro comentário e marcação são acessórios: a maioria dos
   * conteúdos não usa nenhum deles, e os três ocupavam quase metade da altura
   * do formulário empurrando a legenda — que é o campo onde o trabalho
   * realmente acontece — para fora da tela.
   *
   * Atrás de ícone eles continuam a um clique, e a tela volta a mostrar o que
   * importa primeiro. O preenchido é sinalizado no próprio ícone: acessório
   * escondido que ninguém vê preenchido é acessório esquecido.
   */
  atalho?: {
    /** Chave do ícone. O mapa para o componente mora na tela, não aqui. */
    icone: 'localizacao' | 'comentario' | 'marcacao';
    /** Vai no tooltip. Ícone sozinho não se explica — é a regra do projeto. */
    dica: string;
  };
}

/**
 * Quantas hashtags a rede aceita, somando legenda e primeiro comentário.
 *
 * É assim que o Instagram conta: passar as hashtags para o comentário deixa a
 * legenda limpa, mas **não aumenta o teto**. Quem não sabe disso divide 40
 * hashtags entre os dois campos achando que resolveu.
 *
 * Só entra rede cujo limite foi conferido. Inventar um número para as outras
 * seria a armadilha 9 num contador.
 */
export const LIMITE_DE_HASHTAGS: Partial<Record<JobPlatform, number>> = {
  instagram: 30,
};

/** Conta as hashtags de vários campos de uma vez, sem repetir as iguais. */
export const contarHashtags = (...textos: (string | undefined)[]): number => {
  const achadas = new Set<string>();

  for (const texto of textos) {
    for (const t of (texto || '').match(/#[\p{L}\p{N}_]+/gu) || []) {
      // O Instagram trata #Marketing e #marketing como a mesma hashtag.
      achadas.add(t.toLowerCase());
    }
  }
  return achadas.size;
};

/**
 * Quantos caracteres cada rede aceita no texto principal.
 *
 * São os limites publicados pelas próprias plataformas, não medição nossa.
 * Ficam aqui, e não espalhados na tela, porque mudam de fora para dentro:
 * quando uma rede muda o número, muda numa linha só.
 *
 * O contador existe porque o custo de descobrir tarde é alto: um texto de
 * 400 caracteres escrito para o X é reescrito inteiro, e hoje a tela deixava
 * escrever à vontade e só a rede reclamava — depois de aprovado pelo cliente.
 */
export const LIMITE_DO_CANAL: Record<JobPlatform, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  twitter: 280,
};

/**
 * O limite que vale quando o mesmo texto vai para mais de uma rede: o menor.
 *
 * É o primeiro que estoura, e é o único número acionável — dizer "2.200" com
 * o X selecionado deixaria escrever 2.199 caracteres que não publicam. Volta
 * junto qual rede impõe, porque um limite sem dono não diz o que cortar.
 */
export const limiteMaisApertado = (
  canais: JobPlatform[]
): { limite: number; canal: JobPlatform } | null => {
  const validos = canais.filter((c) => LIMITE_DO_CANAL[c]);
  if (!validos.length) return null;

  return validos.reduce(
    (menor, canal) =>
      LIMITE_DO_CANAL[canal] < menor.limite
        ? { limite: LIMITE_DO_CANAL[canal], canal }
        : menor,
    { limite: LIMITE_DO_CANAL[validos[0]], canal: validos[0] }
  );
};

const LEGENDA: CampoDoCanal = {
  chave: 'caption',
  rotulo: 'Legenda',
  tipo: 'textoLongo',
  destino: 'job',
  exemplo: 'Digite aqui o texto que acompanhará a publicação...',
  linhas: 10,
  barra: true,
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
      /* Sem busca de estabelecimento: isso exige um provedor de lugares que o
         projeto não tem. O nome digitado é o que a equipe procura na hora de
         publicar — um botão "Buscar" que não busca seria pior que campo
         simples. */
      ajuda: 'O nome do lugar como ele aparece na rede.',
      atalho: { icone: 'localizacao', dica: 'Localização' },
    },
    {
      chave: 'firstComment',
      rotulo: 'Primeiro comentário',
      tipo: 'textoLongo',
      destino: 'job',
      exemplo: 'Costuma levar as hashtags, para não poluir a legenda.',
      linhas: 6,
      atalho: { icone: 'comentario', dica: 'Primeiro comentário' },
    },
    {
      chave: 'marcacoes',
      /* Campo simples de propósito, e não `textoLongo`: uma lista de @perfis
         não tem o que formatar. Barra de negrito e emoji ali seria ferramenta
         para um texto que não existe. */
      tipo: 'texto',
      rotulo: 'Marcar pessoas',
      destino: 'config',
      exemplo: '@perfil1 @perfil2',
      /* Anotação para quem publica, não marcação automática: publicar pela
         API já depende de revisão da Meta, e marcar terceiros depende de
         outra permissão ainda. Prometer o automático aqui seria a armadilha 9
         — a agência confiaria e ninguém seria marcado. */
      ajuda: 'Os perfis a marcar na publicação. A marcação é feita na hora de publicar.',
      atalho: { icone: 'marcacao', dica: 'Marcar pessoas' },
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
      barra: true,
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
      barra: true,
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
