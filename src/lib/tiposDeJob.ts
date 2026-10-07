import type { JobTipo } from '../types';

/**
 * Os tipos de entrega que vão para aprovação.
 *
 * O catálogo vive aqui, e não espalhado, porque as mesmas linhas aparecem em
 * quatro lugares — o menu Adicionar, o selo do card, o título do modal e a
 * tela do cliente. Escritas em cada um, a primeira mudança de texto já
 * deixaria dois lugares discordando.
 *
 * **A lista tem um `check` do outro lado**, em `jobs.tipo`, e as duas metades
 * andam juntas: acrescentar um valor aqui sem a migração não quebra nada até
 * alguém escolhê-lo — a persistência roda em segundo plano, o Postgres recusa
 * a linha e a tela já pintou o card. Foi assim que `feed_story` custou dez
 * conteúdos perdidos em silêncio. `tests/formato-no-banco.test.ts` deriva as
 * duas listas e exige que o banco aceite esta.
 *
 * `pedeArte` é a diferença que importa de verdade: copy e roteiro são texto,
 * e pedir upload de imagem neles seria pedir aprovação de algo que não
 * existe. É esse campo que o modal e o portal consultam — não o nome do tipo,
 * para um tipo novo não obrigar a caçar `if (tipo === 'copy')` pelo código.
 */
export interface DefinicaoDeTipo {
  valor: JobTipo;
  rotulo: string;
  /** O que o cliente faz com isso. Aparece embaixo do nome no menu. */
  descricao: string;
  /** Tem arte para olhar? Decide o upload, a proporção e a prévia. */
  pedeArte: boolean;
  /** Rótulo do campo de texto principal, que muda de nome com o tipo. */
  rotuloDoTexto: string;
  exemploDoTexto: string;
  /**
   * O texto deste tipo é o que vai publicado — logo, o limite da rede vale.
   *
   * Vale para conteúdo e copy, que viram legenda. **Não vale para roteiro**:
   * ele é documento de gravação, não texto de post. Mostrar "280 / 2.200"
   * num roteiro seria afirmar um limite que não existe ali (armadilha 9), e
   * pior, faria alguém encurtar a direção de cena para caber num número que
   * nada mede.
   */
  respeitaLimiteDaRede: boolean;
}

export const TIPOS_DE_JOB: DefinicaoDeTipo[] = [
  {
    valor: 'conteudo',
    rotulo: 'Conteúdo',
    descricao: 'Aprove um conteúdo pronto',
    pedeArte: true,
    rotuloDoTexto: 'Legenda Proposta',
    exemploDoTexto: 'Digite aqui o texto que acompanhará a publicação...',
    respeitaLimiteDaRede: true,
  },
  {
    valor: 'copy',
    rotulo: 'Copy',
    descricao: 'Aprove o texto do conteúdo',
    pedeArte: false,
    rotuloDoTexto: 'Texto para aprovação',
    exemploDoTexto: 'Escreva aqui a copy que o cliente vai aprovar...',
    respeitaLimiteDaRede: true,
  },
  {
    valor: 'roteiro',
    rotulo: 'Roteiro',
    descricao: 'Aprove um roteiro de gravação',
    pedeArte: false,
    rotuloDoTexto: 'Roteiro',
    exemploDoTexto: 'Cena 1 — abertura, fala do apresentador...',
    respeitaLimiteDaRede: false,
  },

  /*
    **As cinco entregas que não viram post, e por isso nenhuma respeita limite
    de rede.**

    `respeitaLimiteDaRede` liga o contador "280 / 2.200" ao texto, e ele só faz
    sentido onde o texto **vira legenda**. Num manual de marca ou no corpo de
    um e-mail, o número não mede nada — e pior que não medir: ele faria alguém
    encurtar o texto para caber num limite que não existe. É a mesma razão de o
    roteiro já estar de fora.

    `pedeArte` é verdadeiro nas cinco porque em todas há **algo para olhar** —
    o layout, o slide, a foto, o print da página, o e-mail montado. É esse
    campo que o editor e o portal consultam, nunca o nome do tipo: assim um
    tipo novo não obriga a caçar `if (tipo === ...)` pelo código.
  */
  {
    valor: 'branding',
    rotulo: 'Branding',
    descricao: 'Aprove uma peça de identidade visual',
    pedeArte: true,
    rotuloDoTexto: 'Descrição da peça',
    exemploDoTexto: 'O que esta aplicação resolve, onde ela vai ser usada...',
    respeitaLimiteDaRede: false,
  },
  {
    valor: 'apresentacao',
    rotulo: 'Apresentação',
    descricao: 'Aprove um deck antes de apresentar',
    pedeArte: true,
    rotuloDoTexto: 'Roteiro da apresentação',
    exemploDoTexto: 'Slide 1 — abertura. Slide 2 — o problema do cliente...',
    respeitaLimiteDaRede: false,
  },
  {
    valor: 'foto',
    rotulo: 'Foto',
    descricao: 'Aprove a seleção de um ensaio',
    pedeArte: true,
    rotuloDoTexto: 'Observações da seleção',
    exemploDoTexto: 'Tratamento, recorte, quais entram no feed...',
    respeitaLimiteDaRede: false,
  },
  {
    valor: 'landing',
    rotulo: 'Landing page',
    descricao: 'Aprove o layout e o texto de uma página',
    pedeArte: true,
    rotuloDoTexto: 'Texto da página',
    exemploDoTexto: 'Título, subtítulo, benefícios, chamada do botão...',
    respeitaLimiteDaRede: false,
  },
  {
    valor: 'email',
    rotulo: 'E-mail marketing',
    descricao: 'Aprove um e-mail antes do disparo',
    pedeArte: true,
    rotuloDoTexto: 'Corpo do e-mail',
    exemploDoTexto: 'Assunto, abertura, oferta, chamada para ação...',
    respeitaLimiteDaRede: false,
  },
];

const PADRAO = TIPOS_DE_JOB[0];

/** Nunca devolve indefinido: tipo desconhecido cai em conteúdo, como no banco. */
export const definicaoDoTipo = (tipo?: JobTipo): DefinicaoDeTipo =>
  TIPOS_DE_JOB.find((t) => t.valor === tipo) || PADRAO;
