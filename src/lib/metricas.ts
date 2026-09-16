import { supabase } from './supabase';

/**
 * As métricas reais do que foi publicado.
 *
 * Relatórios sempre mediu **produção** — quantas peças, prazos cumpridos, o
 * que está atrasado. Isso responde como a agência trabalha, e não responde a
 * pergunta que o cliente dela faz ao ler o relatório: *o que isso deu?*
 *
 * O número vem da Meta, pelo token que já publica, e **o navegador não tem
 * como buscá-lo**: `social_tokens` tem RLS ligada e zero políticas — nem o
 * dono da agência alcança. Quem mede é o cron, com a chave de serviço, e daqui
 * só se lê `post_metrics`, que a RLS recorta por agência como qualquer outra
 * tabela.
 */

export interface MetricaDePost {
  id: string;
  jobId: string | null;
  clientId: string | null;
  externalId: string;
  permalink: string | null;
  publicadoEm: string | null;
  /** **Nulo é "não medi", zero é "medi e deu zero".** Ver `agregar`. */
  alcance: number | null;
  curtidas: number | null;
  comentarios: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  medidoEm: string;
  ultimoErro: string | null;
}

export const carregarMetricas = async (
  desde: Date,
  ate: Date
): Promise<MetricaDePost[]> => {
  const { data, error } = await supabase
    .from('post_metrics')
    .select(
      'id, job_id, client_id, external_id, permalink, publicado_em, alcance, curtidas, comentarios, salvamentos, compartilhamentos, medido_em, ultimo_erro'
    )
    .gte('publicado_em', desde.toISOString())
    .lte('publicado_em', ate.toISOString())
    .order('publicado_em', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((l) => ({
    id: l.id,
    jobId: l.job_id ?? null,
    clientId: l.client_id ?? null,
    externalId: l.external_id,
    permalink: l.permalink ?? null,
    publicadoEm: l.publicado_em ?? null,
    alcance: l.alcance ?? null,
    curtidas: l.curtidas ?? null,
    comentarios: l.comentarios ?? null,
    salvamentos: l.salvamentos ?? null,
    compartilhamentos: l.compartilhamentos ?? null,
    medidoEm: l.medido_em,
    ultimoErro: l.ultimo_erro ?? null,
  }));
};

/** Um total e quantos posts entraram nele. Ver por que os dois andam juntos. */
export interface Agregado {
  total: number;
  /** Quantos posts tinham esse número medido. `0` = ninguém, e aí `total` mente. */
  medidos: number;
}

/**
 * Soma ignorando os nulos — e **devolve quantos entraram na conta**.
 *
 * Os dois andam juntos de propósito. Somar `null` como zero produz um total
 * que parece medido e não é: dez posts com alcance nulo viram "alcance: 0", e
 * a agência leva esse número para a reunião com o cliente achando que o
 * conteúdo não alcançou ninguém. O erro não aparece em lugar nenhum — é a
 * armadilha 9 na tela que mais custa caro.
 *
 * Com `medidos` junto, a tela mostra o total **e** de quantos posts ele saiu,
 * e `medidos === 0` vira "ainda não medido" em vez de zero.
 */
export const agregar = (
  linhas: MetricaDePost[],
  campo: 'alcance' | 'curtidas' | 'comentarios' | 'salvamentos' | 'compartilhamentos'
): Agregado => {
  let total = 0;
  let medidos = 0;

  for (const linha of linhas) {
    const valor = linha[campo];
    if (valor === null) continue;
    total += valor;
    medidos += 1;
  }

  return { total, medidos };
};

/**
 * Quando a medição mais velha do conjunto aconteceu.
 *
 * A tela mostra isso porque o número **não é de agora**: o cron mede em
 * passadas, alguns posts por vez. Sem a data, "1.240 de alcance" parece o
 * valor deste instante, e a diferença importa quando a agência está olhando
 * um post de ontem.
 */
export const medicaoMaisAntiga = (linhas: MetricaDePost[]): Date | null => {
  const datas = linhas
    .map((l) => new Date(l.medidoEm).getTime())
    .filter((t) => Number.isFinite(t) && t > 0);

  return datas.length ? new Date(Math.min(...datas)) : null;
};

export const formatarNumero = (n: number): string =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
