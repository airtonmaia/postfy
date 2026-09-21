import type { Client, Job, JobStatus } from '../types';

/**
 * Os insights do Dashboard, derivados do que está no banco.
 *
 * **O que havia aqui era texto fixo**, e era a armadilha 9 na tela mais vista
 * do produto: o card afirmava que o cliente "EcoModa Brasil" acumulava 6
 * solicitações de ajuste na quinzena, e que "Café Aroma Gourmet" aprovava
 * 100% dos carrosséis em menos de 24 horas. Nenhum dos dois existe em base
 * nenhuma, e os números não saíam de lugar algum — são a mesma família das
 * transações da Vanguarda Social no Financeiro do SaaS.
 *
 * O custo não é a tela errada, é a decisão tomada em cima dela: um gargalo
 * apontado no cliente errado manda a agência cobrar quem não atrasou.
 *
 * Três regras, e as três vieram daquele bug:
 *
 * 1. **Todo número sai de uma contagem**, e o texto diz de onde. "6
 *    solicitações" sem origem é indistinguível de invenção.
 * 2. **Nenhum nome é escrito à mão.** O nome do cliente vem de `clients`, e
 *    quando o cliente não está carregado o insight é descartado em vez de
 *    nomear alguém errado.
 * 3. **Sem dado, a tela diz o que falta** — nunca preenche o espaço. Card
 *    vazio é honesto; card bonito com número inventado é o que se paga caro.
 *
 * A função é pura de propósito: `tests/insights.test.ts` a exercita com dados
 * de verdade em vez de descrever o mecanismo dela.
 */

/** Quem já passou da aprovação. Mesma lista que `calculateAgencyHealth` usa. */
const CONCLUIDOS: JobStatus[] = ['approved', 'scheduled', 'published'];

/**
 * Mínimo de peças concluídas para uma taxa por cliente valer alguma coisa.
 *
 * Com duas peças, "100% na primeira versão" é ruído com cara de mérito — e o
 * card passaria a eleger sempre o cliente mais novo da agência.
 */
const AMOSTRA_MINIMA = 3;

/** Abaixo disto a taxa não é elogio; é só "não deu problema ainda". */
const TAXA_DE_ELOGIO = 80;

export interface ParteDoTexto {
  texto: string;
  /** Veio do dado (nome de cliente). A tela destaca. */
  forte?: boolean;
}

export interface Insight {
  id: string;
  tom: 'atencao' | 'bom';
  titulo: string;
  partes: ParteDoTexto[];
}

const plural = (n: number, singular: string, muitos: string) =>
  `${n} ${n === 1 ? singular : muitos}`;

/** Data que o banco pode ter devolvido vazia não vira "muito atrasada". */
const venceuAntes = (data: string | undefined, agora: number): boolean => {
  if (!data) return false;
  const t = new Date(data).getTime();
  return Number.isFinite(t) && t < agora;
};

const porCliente = (jobs: Job[]): Map<string, number> => {
  const contagem = new Map<string, number>();
  for (const job of jobs) {
    if (!job.clientId) continue;
    contagem.set(job.clientId, (contagem.get(job.clientId) || 0) + 1);
  }
  return contagem;
};

/**
 * O cliente com mais ocorrências, **desde que ele esteja carregado**.
 *
 * Descartar o que não dá para nomear é a regra 2: um "cliente sem nome" no
 * lugar do nome faria a tela apontar um gargalo que ninguém consegue atender.
 */
const maiorAcumulo = (
  contagem: Map<string, number>,
  nomes: Map<string, string>
): { nome: string; quantidade: number } | null => {
  let melhor: { nome: string; quantidade: number } | null = null;
  for (const [clientId, quantidade] of contagem) {
    const nome = nomes.get(clientId);
    if (!nome) continue;
    if (!melhor || quantidade > melhor.quantidade) melhor = { nome, quantidade };
  }
  return melhor;
};

const oQuePrecisaAtencao = (
  jobs: Job[],
  nomes: Map<string, string>,
  agora: number
): Insight | null => {
  /*
    A ordem de prioridade não é arbitrária: o que já venceu vem antes do que
    está apenas acumulando. Prazo de aprovação vencido é o cliente esperando
    agora; ajuste acumulado é tendência.
  */
  const aprovacaoVencida = jobs.filter(
    (j) => j.status === 'for_approval' && venceuAntes(j.deadlineApproval, agora)
  );

  if (aprovacaoVencida.length > 0) {
    const um = aprovacaoVencida.length === 1;
    const partes: ParteDoTexto[] = [
      {
        texto: `${plural(aprovacaoVencida.length, 'conteúdo passou', 'conteúdos passaram')} do prazo de aprovação e ${
          um ? 'continua aguardando' : 'continuam aguardando'
        } o cliente.`,
      },
    ];

    const maior = maiorAcumulo(porCliente(aprovacaoVencida), nomes);
    if (maior && maior.quantidade > 1) {
      partes.push({ texto: ' A maior parte é de ' });
      partes.push({ texto: maior.nome, forte: true });
      partes.push({ texto: `: ${plural(maior.quantidade, 'peça', 'peças')}.` });
    }

    return { id: 'aprovacao-vencida', tom: 'atencao', titulo: 'Aprovação parada', partes };
  }

  const emAjuste = jobs.filter((j) => j.status === 'in_adjustment');
  const maiorEmAjuste = maiorAcumulo(porCliente(emAjuste), nomes);

  if (maiorEmAjuste && maiorEmAjuste.quantidade >= 2) {
    return {
      id: 'ajustes-concentrados',
      tom: 'atencao',
      titulo: 'Retrabalho concentrado',
      partes: [
        { texto: maiorEmAjuste.nome, forte: true },
        {
          texto: ` está com ${plural(
            maiorEmAjuste.quantidade,
            'conteúdo',
            'conteúdos'
          )} em ajuste agora, o maior acúmulo da agência. Alinhar a pauta antes de produzir a próxima leva sai mais barato que refazer.`,
        },
      ],
    };
  }

  const producaoAtrasada = jobs.filter(
    (j) => !CONCLUIDOS.includes(j.status) && venceuAntes(j.deadlineProduction, agora)
  );

  if (producaoAtrasada.length > 0) {
    return {
      id: 'producao-atrasada',
      tom: 'atencao',
      titulo: 'Produção atrasada',
      partes: [
        {
          texto: `${plural(
            producaoAtrasada.length,
            'conteúdo passou',
            'conteúdos passaram'
          )} do prazo de produção sem chegar à aprovação.`,
        },
      ],
    };
  }

  if (emAjuste.length > 0) {
    return {
      id: 'ajustes-abertos',
      tom: 'atencao',
      titulo: 'Ajustes em aberto',
      partes: [
        {
          texto: `${plural(
            emAjuste.length,
            'conteúdo aguarda',
            'conteúdos aguardam'
          )} ajuste. Nenhum prazo vencido até agora.`,
        },
      ],
    };
  }

  return null;
};

const oQueVaiBem = (
  jobs: Job[],
  nomes: Map<string, string>,
  agora: number
): Insight | null => {
  const concluidos = jobs.filter((j) => CONCLUIDOS.includes(j.status));

  /*
    Taxa de primeira versão por cliente. `currentVersion === 1` é o mesmo
    critério de `calculateAgencyHealth` — duas definições de "aprovou de
    primeira" na mesma tela dariam dois números para a mesma pergunta.
  */
  const total = porCliente(concluidos);
  const dePrimeira = porCliente(concluidos.filter((j) => j.currentVersion === 1));

  let melhor: { nome: string; taxa: number; de: number; total: number } | null = null;
  let qualificados = 0;

  for (const [clientId, quantidade] of total) {
    if (quantidade < AMOSTRA_MINIMA) continue;
    const nome = nomes.get(clientId);
    if (!nome) continue;
    qualificados++;
    const de = dePrimeira.get(clientId) || 0;
    const taxa = Math.round((de / quantidade) * 100);
    if (!melhor || taxa > melhor.taxa) melhor = { nome, taxa, de, total: quantidade };
  }

  if (melhor && melhor.taxa >= TAXA_DE_ELOGIO) {
    return {
      id: 'aprovacao-de-primeira',
      tom: 'bom',
      titulo: 'Ponto positivo',
      partes: [
        { texto: melhor.nome, forte: true },
        { texto: ` aprovou ${melhor.de} de ${melhor.total} na primeira versão (${melhor.taxa}%)` },
        // "a melhor taxa da agência" só é verdade quando há com quem comparar.
        { texto: qualificados > 1 ? ', a melhor taxa da agência.' : '.' },
      ],
    };
  }

  const abertos = jobs.filter((j) => !CONCLUIDOS.includes(j.status));
  const nenhumAtraso =
    abertos.length > 0 &&
    !abertos.some(
      (j) =>
        venceuAntes(j.deadlineProduction, agora) ||
        (j.status === 'for_approval' && venceuAntes(j.deadlineApproval, agora))
    );

  if (nenhumAtraso) {
    return {
      id: 'sem-atraso',
      tom: 'bom',
      titulo: 'Ponto positivo',
      partes: [
        {
          texto: `${plural(
            abertos.length,
            'conteúdo aberto está',
            'conteúdos abertos estão'
          )} dentro do prazo. Nenhum vencido.`,
        },
      ],
    };
  }

  return null;
};

/**
 * Até dois insights: o que pede atenção e o que vai bem.
 *
 * Devolve lista vazia quando não há nada medido — e aí a tela diz isso, que é
 * a regra 3. Preencher com frase genérica seria voltar ao texto fixo com
 * outra roupa.
 */
export const derivarInsights = (
  jobs: Job[],
  clients: Client[],
  agora: Date = new Date()
): Insight[] => {
  if (jobs.length === 0) return [];

  const nomes = new Map(
    clients.filter((c) => c.name && c.name.trim()).map((c) => [c.id, c.name.trim()])
  );
  const t = agora.getTime();

  return [oQuePrecisaAtencao(jobs, nomes, t), oQueVaiBem(jobs, nomes, t)].filter(
    (i): i is Insight => i !== null
  );
};
