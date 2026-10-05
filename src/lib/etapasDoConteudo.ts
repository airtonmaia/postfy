import type { JobStatus } from '../types';

/**
 * As etapas do fluxo, **na ordem em que o trabalho acontece**.
 *
 * Esta lista já existia em três lugares com três propósitos: o `<select>` do
 * card do quadro, as colunas do `KanbanBoard` e o seletor da modal de
 * conteúdo. Ela saiu para cá quando a linha do tempo do histórico passou a
 * precisar da **ordem** — e ordem é justamente o que uma lista copiada perde
 * primeiro: basta uma delas ganhar uma etapa no meio para o histórico
 * desenhar o fluxo de outro produto.
 *
 * ### Ordem não é o mesmo que `JobStatus`
 *
 * A união de tipos não tem ordem; esta lista tem, e é ela que decide o que
 * vem antes e o que ainda não foi alcançado na linha do tempo.
 *
 * **"Ajuste" fica entre aprovação e aprovado, e isso é uma simplificação
 * consciente.** Na vida real ele é um laço — a peça volta para o ajuste
 * depois de já ter passado por aprovação, às vezes duas vezes. A linha do
 * tempo não tenta desenhar o laço: ela mostra cada etapa uma vez, com o
 * tempo **somado** de todas as visitas. Desenhar o vaivém daria uma lista que
 * cresce a cada revisão e deixa de responder a pergunta que importa, que é
 * "onde esta peça gastou o tempo dela".
 *
 * Os rótulos são os curtos, de uma palavra. Os longos (`Em Produção`,
 * `Para Aprovação`) continuam em `Badges.tsx`, onde são selo: ali o selo
 * aparece sozinho, fora de contexto, e precisa se explicar; aqui a lista
 * inteira está à vista e a palavra basta.
 */
export interface EtapaDoConteudo {
  valor: JobStatus;
  rotulo: string;
}

export const ETAPAS_DO_CONTEUDO: EtapaDoConteudo[] = [
  { valor: 'ideas', rotulo: 'Ideias' },
  { valor: 'in_production', rotulo: 'Produção' },
  { valor: 'for_approval', rotulo: 'Aprovação' },
  { valor: 'in_adjustment', rotulo: 'Ajuste' },
  { valor: 'approved', rotulo: 'Aprovado' },
  { valor: 'scheduled', rotulo: 'Agendado' },
  { valor: 'published', rotulo: 'Publicado' },
];

/**
 * O nome da etapa, com recuo para um status que a lista não conheça.
 *
 * O recuo existe porque o histórico guarda o que **foi** verdade: um status
 * aposentado continua nas linhas antigas, e a tela precisa escrever alguma
 * coisa em vez de um espaço em branco.
 */
export const rotuloDaEtapa = (status: string): string =>
  ETAPAS_DO_CONTEUDO.find((e) => e.valor === status)?.rotulo ?? status;
