/**
 * Os blocos do painel, e quem decide se eles aparecem.
 *
 * A lista mora aqui — fora do componente — porque **ela é desenhada e
 * configurada em dois lugares**: o Dashboard monta cada bloco, e
 * `PersonalizarPainel` lista os interruptores. Duas listas divergem na
 * primeira pressa, e divergir aqui dá os dois piores desfechos: um bloco que
 * ninguém consegue desligar, ou um interruptor que não liga coisa nenhuma.
 *
 * É dado puro — sem React — pela mesma razão de `ICONES_DA_ETAPA`: assim a
 * regra é exercitada em teste sem montar componente nenhum.
 */

export type IdDoBloco =
  | 'saude'
  | 'insights'
  | 'atalhos'
  | 'indicadores'
  | 'publicacoes'
  | 'clientes'
  | 'atividades';

export interface BlocoDoPainel {
  id: IdDoBloco;
  rotulo: string;
  /** O que ele responde. É o que a pessoa lê para decidir se o mantém. */
  descricao: string;
  /**
   * Em que largura ele existe.
   *
   * Não é preferência: é desenho. A saúde e os insights ocupam duas telas de
   * um aparelho de 390px antes do primeiro número, e os atalhos só fazem
   * sentido onde a barra lateral é gaveta. A lista de interruptores segue
   * isto — oferecer o que a tela não tem é prometer o que não acontece.
   */
  onde: 'ambos' | 'largo' | 'estreito';
}

export const BLOCOS_DO_PAINEL: BlocoDoPainel[] = [
  {
    id: 'atalhos',
    rotulo: 'Atalhos do menu',
    descricao: 'As telas do produto a um toque, em ladrilhos.',
    onde: 'estreito',
  },
  {
    id: 'saude',
    rotulo: 'Saúde operacional',
    descricao: 'O score da agência, com prazo, aprovação e retrabalho.',
    onde: 'largo',
  },
  {
    id: 'insights',
    rotulo: 'Insights da operação',
    descricao: 'O que está parado e o que está indo bem, contado agora.',
    onde: 'largo',
  },
  {
    id: 'indicadores',
    rotulo: 'Indicadores',
    descricao: 'Em produção, aguardando aprovação, agendados, publicados.',
    onde: 'ambos',
  },
  {
    id: 'publicacoes',
    rotulo: 'Publicações de hoje',
    descricao: 'O que sai hoje, com horário e canal.',
    onde: 'ambos',
  },
  {
    id: 'clientes',
    rotulo: 'Saúde dos clientes',
    descricao: 'Quantas peças de cada cliente esperam aprovação ou ajuste.',
    onde: 'ambos',
  },
  {
    id: 'atividades',
    rotulo: 'Atividades recentes',
    descricao: 'Quem fez o quê na agência, em ordem.',
    onde: 'ambos',
  },
];

/**
 * O bloco aparece?
 *
 * A lista guardada é a do que está **escondido**, e é essa inversão que faz
 * bloco novo nascer visível para todo mundo. Guardando o que aparece, o bloco
 * acrescentado depois ficaria fora da lista de quem já salvou a preferência
 * uma vez — e nunca apareceria, sem erro em lugar nenhum.
 */
export const blocoVisivel = (id: IdDoBloco, ocultos: string[]): boolean =>
  !(ocultos || []).includes(id);

/**
 * Os blocos que esta largura comporta.
 *
 * A tela de personalização mostra só estes: um interruptor para o que não
 * cabe aqui seria a tela oferecendo o que ela não honra — a família do
 * `feed_story` no Facebook antes de existir publicador de story lá.
 */
export const blocosDaLargura = (estreita: boolean): BlocoDoPainel[] =>
  BLOCOS_DO_PAINEL.filter(
    (bloco) => bloco.onde === 'ambos' || bloco.onde === (estreita ? 'estreito' : 'largo')
  );

/**
 * Liga ou desliga um bloco, devolvendo a lista nova de escondidos.
 *
 * Pura de propósito: é a única regra aqui que tem como errar em silêncio — um
 * id repetido na lista não muda nada visível e cresce para sempre.
 */
export const alternarBloco = (id: IdDoBloco, ocultos: string[], visivel: boolean): string[] => {
  const atuais = (ocultos || []).filter((x) => x !== id);
  return visivel ? atuais : [...atuais, id];
};
