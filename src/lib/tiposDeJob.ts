import type { JobTipo } from '../types';

/**
 * Os três tipos de entrega que vão para aprovação.
 *
 * O catálogo vive aqui, e não espalhado, porque as mesmas três linhas
 * aparecem em quatro lugares — o menu Adicionar, o selo do card, o título do
 * modal e a tela do cliente. Escritas em cada um, a primeira mudança de texto
 * já deixaria dois lugares discordando.
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
}

export const TIPOS_DE_JOB: DefinicaoDeTipo[] = [
  {
    valor: 'conteudo',
    rotulo: 'Conteúdo',
    descricao: 'Aprove um conteúdo pronto',
    pedeArte: true,
    rotuloDoTexto: 'Legenda Proposta',
    exemploDoTexto: 'Digite aqui o texto que acompanhará a publicação...',
  },
  {
    valor: 'copy',
    rotulo: 'Copy',
    descricao: 'Aprove o texto do conteúdo',
    pedeArte: false,
    rotuloDoTexto: 'Texto para aprovação',
    exemploDoTexto: 'Escreva aqui a copy que o cliente vai aprovar...',
  },
  {
    valor: 'roteiro',
    rotulo: 'Roteiro',
    descricao: 'Aprove um roteiro de gravação',
    pedeArte: false,
    rotuloDoTexto: 'Roteiro',
    exemploDoTexto: 'Cena 1 — abertura, fala do apresentador...',
  },
];

const PADRAO = TIPOS_DE_JOB[0];

/** Nunca devolve indefinido: tipo desconhecido cai em conteúdo, como no banco. */
export const definicaoDoTipo = (tipo?: JobTipo): DefinicaoDeTipo =>
  TIPOS_DE_JOB.find((t) => t.valor === tipo) || PADRAO;
