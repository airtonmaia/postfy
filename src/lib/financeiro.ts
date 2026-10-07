import { supabase } from './supabase';
import { formatCurrency } from './utils';
import { diaNoFuso } from './fusoHorario';

/**
 * O dinheiro da agência: o que ela tem a receber, o que tem a pagar e em qual
 * caixa isso está.
 *
 * O produto media o **trabalho** (Relatórios) e a **venda** (Comercial), e
 * nunca mediu o caixa. A permissão `ver_financeiro` e o papel `financial`
 * existiam desde a primeira versão de `permissions.ts` sem nenhuma tela atrás
 * deles — a família do `trial_ends_at`: um nome que parece uma regra e não é.
 *
 * ### Por que isto não entra no estado global
 *
 * As dez coleções de `PostfyContext` são carregadas na entrada e passam pelo
 * `diferenciar()` a cada edição. Lançamento financeiro é como conteúdo
 * concluído: cresce **com o tempo de uso**, não com o tamanho da agência — uma
 * agência de três anos tem milhares deles e precisa de doze por tela. Entrar
 * na carga inicial repetiria a dívida que a janela de 90 dias dos jobs veio
 * pagar.
 *
 * O preço dessa escolha é que **nada aqui é persistido sozinho**: cada
 * gravação é uma chamada explícita, e quem chama trata o erro. Em dinheiro
 * isso é a troca certa — a persistência por diff mostra o resultado antes de
 * o banco responder, e é exatamente o que este arquivo não pode fazer.
 *
 * ### O recorte por agência é explícito, e não é redundância
 *
 * A RLS recorta por **pessoa**, não por agência aberta: quem participa de três
 * agências recebe as linhas das três em toda consulta. Nas coleções do
 * contexto quem conserta isso é `belongsToWorkspace`; aqui a consulta já sai
 * filtrada, como `driveDaAgencia` e a equipe fazem.
 *
 * ### Centavos inteiros
 *
 * `0.1 + 0.2` é `0.30000000000000004` em JavaScript. Num campo de dinheiro
 * isso vira um centavo de diferença por soma — invisível numa linha e visível
 * no fechamento do mês. O valor é inteiro em centavos do banco até a tela, e a
 * divisão por 100 acontece uma vez, na hora de escrever.
 */

export type TipoDeLancamento = 'receber' | 'pagar';

export interface Lancamento {
  id: string;
  workspaceId: string;
  tipo: TipoDeLancamento;
  descricao: string;
  categoria?: string;
  clientId?: string;
  /** Nome livre: o fornecedor do lado de pagar, ou quem paga sem ser cliente. */
  contraparte?: string;
  valorCentavos: number;
  /** `YYYY-MM-DD`, data de parede: conta vence num dia, não num instante. */
  vencimento: string;
  /** `YYYY-MM-DD`, ou vazio quando ainda está em aberto. */
  liquidadoEm?: string;
  caixaId?: string;
  observacao?: string;
  criadoEm?: string;
}

export interface Caixa {
  id: string;
  workspaceId: string;
  nome: string;
  saldoInicialCentavos: number;
  arquivado: boolean;
  criadoEm?: string;
}

// ---------------------------------------------------------------------
// Dinheiro: ler, escrever e mostrar
// ---------------------------------------------------------------------

/** Centavos para a tela. A divisão por 100 acontece aqui, e só aqui. */
export const emReais = (centavos: number): number => (centavos || 0) / 100;

export const formatarCentavos = (centavos: number): string =>
  formatCurrency(emReais(centavos));

/**
 * O que a pessoa digitou, em centavos — ou `null`, que é "não entendi".
 *
 * **`null` não é zero**, e essa diferença é a razão de a função existir.
 * `parseFloat('abc')` devolve `NaN`, e `NaN || 0` devolve zero: um campo
 * digitado errado viraria um lançamento de R$ 0,00 gravado com cara de certo.
 * Quem chama decide o que fazer com o `null` — aqui, recusar o salvamento.
 *
 * Aceita as duas escritas que aparecem de verdade: `1.234,56` (teclado
 * brasileiro) e `1234.56` (colado de planilha). A regra que as separa é a
 * **última** pontuação: é ela que divide os centavos.
 */
export const centavosDe = (texto: string): number | null => {
  const limpo = (texto || '').replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;

  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  const separador = Math.max(ultimaVirgula, ultimoPonto);

  let inteiros = limpo;
  let decimais = '';

  // Três ou mais casas depois do separador não são centavos: é o milhar de
  // `1.234` escrito sem decimal nenhum.
  if (separador > -1 && limpo.length - separador - 1 <= 2) {
    inteiros = limpo.slice(0, separador);
    decimais = limpo.slice(separador + 1);
  }

  const negativo = inteiros.trim().startsWith('-');
  const digitos = inteiros.replace(/\D/g, '');
  if (!digitos && !decimais) return null;

  const centavos =
    Number(digitos || '0') * 100 + Number((decimais + '00').slice(0, 2) || '0');
  if (!Number.isFinite(centavos)) return null;
  return negativo ? -centavos : centavos;
};

// ---------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------

/** Hoje, no fuso da **agência** — nunca o do aparelho (armadilha 8.2). */
export const hojeNaAgencia = (): string => diaNoFuso(new Date());

/** `YYYY-MM-DD` → `YYYY-MM`. */
export const mesDe = (dia: string): string => (dia || '').slice(0, 7);

/**
 * O primeiro e o último dia do mês, como texto.
 *
 * Sai da aritmética de `Date` em UTC de propósito: `new Date(ano, mes, 0)`
 * usaria o fuso do aparelho para decidir o último dia, e em fevereiro isso é
 * a diferença entre 28 e 29.
 */
export const limitesDoMes = (mes: string): { de: string; ate: string } => {
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const z = (n: number) => String(n).padStart(2, '0');
  return { de: `${ano}-${z(m)}-01`, ate: `${ano}-${z(m)}-${z(ultimo)}` };
};

export const mesVizinho = (mes: string, passo: number): string => {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const rotuloDoMes = (mes: string): string => {
  const [ano, m] = mes.split('-').map(Number);
  return `${MESES[m - 1] || '—'} de ${ano}`;
};

// ---------------------------------------------------------------------
// Situação e somas — tudo puro, para ser exercitado e não descrito
// ---------------------------------------------------------------------

export type SituacaoDoLancamento = 'liquidado' | 'vencido' | 'aberto';

/**
 * Em que pé está esta conta.
 *
 * "Vencido" é **sempre** sobre o que não foi liquidado: uma conta paga com
 * atraso não é uma conta vencida, é uma conta paga — e marcá-la de vermelho
 * para sempre faria a lista de pendências nunca esvaziar, que é como se
 * aprende a ignorar o vermelho.
 */
export const situacaoDoLancamento = (
  lancamento: Lancamento,
  hoje: string
): SituacaoDoLancamento => {
  if (lancamento.liquidadoEm) return 'liquidado';
  return lancamento.vencimento < hoje ? 'vencido' : 'aberto';
};

export interface LadoDoResumo {
  /** Vencimentos do mês, liquidados ou não. É a **competência**. */
  previsto: number;
  /** O que de fato andou no mês. É o **caixa**. */
  liquidado: number;
  /** Do mês, ainda em aberto e dentro do prazo. */
  aberto: number;
  /** Em aberto e com o prazo vencido — de **qualquer** mês. */
  vencido: number;
  contasVencidas: number;
}

export interface ResumoDoFinanceiro {
  receber: LadoDoResumo;
  pagar: LadoDoResumo;
  /** O que sobrou no mês, pelo que entrou e saiu de verdade. */
  resultadoDeCaixa: number;
  /** O que sobraria se tudo que vence no mês fosse pago no mês. */
  resultadoPrevisto: number;
}

const zerado = (): LadoDoResumo => ({
  previsto: 0,
  liquidado: 0,
  aberto: 0,
  vencido: 0,
  contasVencidas: 0,
});

/**
 * As duas perguntas de um mês, e elas não são a mesma.
 *
 * *Quanto vence neste mês?* é **competência**; *quanto entrou e saiu neste
 * mês?* é **caixa**. Uma conta de setembro paga em outubro aparece nas duas,
 * em meses diferentes — e quem junta as duas numa linha só produz um número
 * que não fecha com o extrato nem com o contrato.
 *
 * Os vencidos chegam por fora (`vencidos`), e não saem da lista do mês: uma
 * conta de dois meses atrás, ainda em aberto, é justamente a que importa — e
 * ela não tem vencimento nem liquidação dentro do mês que a tela está
 * mostrando.
 */
export const resumoDoPeriodo = (
  doMes: Lancamento[],
  vencidos: Lancamento[],
  mes: string,
  hoje: string
): ResumoDoFinanceiro => {
  const resumo: ResumoDoFinanceiro = {
    receber: zerado(),
    pagar: zerado(),
    resultadoDeCaixa: 0,
    resultadoPrevisto: 0,
  };

  for (const l of doMes) {
    const lado = l.tipo === 'receber' ? resumo.receber : resumo.pagar;
    if (mesDe(l.vencimento) === mes) {
      lado.previsto += l.valorCentavos;
      if (!l.liquidadoEm && l.vencimento >= hoje) lado.aberto += l.valorCentavos;
    }
    if (l.liquidadoEm && mesDe(l.liquidadoEm) === mes) {
      lado.liquidado += l.valorCentavos;
    }
  }

  for (const l of vencidos) {
    if (l.liquidadoEm || l.vencimento >= hoje) continue;
    const lado = l.tipo === 'receber' ? resumo.receber : resumo.pagar;
    lado.vencido += l.valorCentavos;
    lado.contasVencidas += 1;
  }

  resumo.resultadoDeCaixa = resumo.receber.liquidado - resumo.pagar.liquidado;
  resumo.resultadoPrevisto = resumo.receber.previsto - resumo.pagar.previsto;
  return resumo;
};

/**
 * O saldo de um caixa.
 *
 * `saldo_inicial + o que foi liquidado nele` — e é a **mesma** soma que o
 * relatório faz, porque não existe uma segunda tabela de movimentação. As
 * entradas e saídas avulsas da tela de Caixa são lançamentos já liquidados;
 * duas tabelas respondendo "quanto entrou" divergem, e aí o saldo e o
 * relatório ficam certos cada um pelo seu lado.
 *
 * Só conta o que está **liquidado**: saldo que soma conta a receber é
 * previsão com cara de extrato.
 */
export const saldoDoCaixa = (caixa: Caixa, lancamentos: Lancamento[]): number =>
  lancamentos.reduce(
    (total, l) =>
      l.caixaId === caixa.id && l.liquidadoEm
        ? total + (l.tipo === 'receber' ? l.valorCentavos : -l.valorCentavos)
        : total,
    caixa.saldoInicialCentavos || 0
  );

/** Soma por categoria, maior primeiro. Linha sem categoria vira "Sem categoria". */
export const porCategoria = (
  lancamentos: Lancamento[],
  tipo: TipoDeLancamento
): { categoria: string; total: number }[] => {
  const mapa = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== tipo || !l.liquidadoEm) continue;
    const chave = (l.categoria || '').trim() || 'Sem categoria';
    mapa.set(chave, (mapa.get(chave) || 0) + l.valorCentavos);
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
};

// ---------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------

const daLinha = (l: any): Lancamento => ({
  id: l.id,
  workspaceId: l.workspace_id,
  tipo: l.tipo,
  descricao: l.descricao || '',
  categoria: l.categoria || undefined,
  clientId: l.client_id || undefined,
  contraparte: l.contraparte || undefined,
  valorCentavos: Number(l.valor_centavos) || 0,
  vencimento: l.vencimento,
  liquidadoEm: l.liquidado_em || undefined,
  caixaId: l.caixa_id || undefined,
  observacao: l.observacao || undefined,
  criadoEm: l.created_at || undefined,
});

const paraLinha = (l: Partial<Lancamento>) => ({
  tipo: l.tipo,
  descricao: (l.descricao || '').trim(),
  categoria: l.categoria?.trim() || null,
  client_id: l.clientId || null,
  contraparte: l.contraparte?.trim() || null,
  valor_centavos: l.valorCentavos,
  vencimento: l.vencimento,
  liquidado_em: l.liquidadoEm || null,
  caixa_id: l.caixaId || null,
  observacao: l.observacao?.trim() || null,
});

const doCaixa = (c: any): Caixa => ({
  id: c.id,
  workspaceId: c.workspace_id,
  nome: c.nome || '',
  saldoInicialCentavos: Number(c.saldo_inicial_centavos) || 0,
  arquivado: Boolean(c.arquivado),
  criadoEm: c.created_at || undefined,
});

/**
 * Os lançamentos que tocam o mês — pelo vencimento **ou** pela liquidação.
 *
 * Buscar só por vencimento esconderia a conta de setembro paga em outubro
 * justamente da tela de outubro, que é onde o dinheiro saiu.
 */
export const carregarDoMes = async (
  workspaceId: string,
  mes: string
): Promise<Lancamento[]> => {
  const { de, ate } = limitesDoMes(mes);
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .eq('workspace_id', workspaceId)
    .or(
      `and(vencimento.gte.${de},vencimento.lte.${ate}),` +
        `and(liquidado_em.gte.${de},liquidado_em.lte.${ate})`
    )
    .order('vencimento', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(daLinha);
};

/**
 * Um intervalo qualquer, pela data em que o dinheiro andou.
 *
 * É a consulta do relatório, que olha vários meses de uma vez. Ela filtra por
 * **liquidação**, e não por vencimento, porque a pergunta de lá é a do
 * extrato: quanto entrou e quanto saiu em cada mês. O que ainda não andou não
 * tem lugar numa linha do tempo de caixa.
 */
export const carregarLiquidadosNoPeriodo = async (
  workspaceId: string,
  de: string,
  ate: string
): Promise<Lancamento[]> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('liquidado_em', de)
    .lte('liquidado_em', ate)
    .order('liquidado_em', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(daLinha);
};

/**
 * Tudo que está em aberto e já venceu, de qualquer mês.
 *
 * É a lista que não pode depender do período escolhido: a conta esquecida há
 * dois meses não aparece em nenhum mês que alguém esteja olhando.
 */
export const carregarVencidos = async (
  workspaceId: string,
  hoje: string
): Promise<Lancamento[]> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('liquidado_em', null)
    .lt('vencimento', hoje)
    .order('vencimento', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(daLinha);
};

/** Os lançamentos já liquidados de um caixa — as movimentações dele. */
export const carregarDoCaixa = async (
  workspaceId: string,
  caixaId: string,
  limite = 50
): Promise<Lancamento[]> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('caixa_id', caixaId)
    .not('liquidado_em', 'is', null)
    .order('liquidado_em', { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return (data || []).map(daLinha);
};

export const carregarCaixas = async (workspaceId: string): Promise<Caixa[]> => {
  const { data, error } = await supabase
    .from('financeiro_caixas')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(doCaixa);
};

export const salvarLancamento = async (
  workspaceId: string,
  lancamento: Partial<Lancamento> & { id?: string }
): Promise<Lancamento> => {
  if (!lancamento.descricao?.trim()) throw new Error('Descreva o lançamento.');
  if (!lancamento.valorCentavos || lancamento.valorCentavos <= 0) {
    throw new Error('O valor precisa ser maior que zero.');
  }
  if (!lancamento.vencimento) throw new Error('Informe o vencimento.');

  const corpo = paraLinha(lancamento);

  const { data, error } = lancamento.id
    ? await supabase
        .from('financeiro_lancamentos')
        .update(corpo)
        .eq('id', lancamento.id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()
    : await supabase
        .from('financeiro_lancamentos')
        .insert({ ...corpo, workspace_id: workspaceId })
        .select()
        .single();

  if (error) throw new Error(error.message);
  return daLinha(data);
};

/**
 * Marca como liquidado, ou desfaz.
 *
 * Desfazer existe porque o clique é de um toque e a linha é de dinheiro: sem
 * volta, o conserto de um "recebi" errado seria apagar a conta e cadastrá-la
 * de novo — que perde a data de criação e o histórico de quem é.
 */
export const liquidarLancamento = async (
  workspaceId: string,
  id: string,
  quando: string | null,
  caixaId?: string | null
): Promise<void> => {
  const { error } = await supabase
    .from('financeiro_lancamentos')
    .update({
      liquidado_em: quando,
      // Desliquidar solta o caixa junto: uma conta em aberto apontando para
      // um caixa diria, na tela dele, que o dinheiro andou.
      ...(quando ? (caixaId !== undefined ? { caixa_id: caixaId } : {}) : { caixa_id: null }),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
};

export const excluirLancamento = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  const { error } = await supabase
    .from('financeiro_lancamentos')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
};

export const salvarCaixa = async (
  workspaceId: string,
  caixa: Partial<Caixa> & { id?: string }
): Promise<Caixa> => {
  if (!caixa.nome?.trim()) throw new Error('Dê um nome ao caixa.');

  const corpo = {
    nome: caixa.nome.trim(),
    saldo_inicial_centavos: caixa.saldoInicialCentavos || 0,
    arquivado: Boolean(caixa.arquivado),
  };

  const { data, error } = caixa.id
    ? await supabase
        .from('financeiro_caixas')
        .update(corpo)
        .eq('id', caixa.id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()
    : await supabase
        .from('financeiro_caixas')
        .insert({ ...corpo, workspace_id: workspaceId })
        .select()
        .single();

  if (error) throw new Error(error.message);
  return doCaixa(data);
};

/**
 * Exclui o caixa.
 *
 * Os lançamentos **ficam**: a chave é `on delete set null`, então eles perdem
 * o caixa e mantêm o valor, a data e a descrição. Apagar o histórico junto
 * com a conta bancária seria apagar o que aconteceu porque o lugar mudou de
 * nome.
 */
export const excluirCaixa = async (workspaceId: string, id: string): Promise<void> => {
  const { error } = await supabase
    .from('financeiro_caixas')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
};
