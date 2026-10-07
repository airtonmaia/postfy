import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';
import type { TabType } from '../../types';
import {
  Caixa,
  Lancamento,
  TipoDeLancamento,
  carregarCaixas,
  carregarDoMes,
  carregarLiquidadosNoPeriodo,
  carregarVencidos,
  excluirLancamento,
  hojeNaAgencia,
  limitesDoMes,
  liquidarLancamento,
  mesDe,
  mesVizinho,
  resumoDoPeriodo,
  rotuloDoMes,
  salvarCaixa,
  salvarLancamento,
  excluirCaixa,
} from '../../lib/financeiro';
import { VisaoGeralDoFinanceiro } from './VisaoGeralDoFinanceiro';
import { ListaDeLancamentos } from './ListaDeLancamentos';
import { CaixasDaAgencia } from './CaixasDaAgencia';
import { RelatorioFinanceiro } from './RelatorioFinanceiro';
import { ModalDeLancamento } from './ModalDeLancamento';

/**
 * O Financeiro da agência — cinco telas num componente.
 *
 * Elas dividem o mês escolhido, as três consultas e a modal de lançamento;
 * separá-las em cinco arquivos de topo faria cada uma recarregar o mesmo mês
 * ao trocar de aba, e trocar de aba é o que mais acontece aqui.
 *
 * **Nada é persistido por diff.** As dez coleções do `PostfyContext` gravam
 * sozinhas e mostram o resultado antes de o banco responder — o que neste
 * produto já custou dez conteúdos perdidos em silêncio. Aqui cada gravação é
 * uma chamada explícita, e a falha aparece em faixa, acima da tela, com o
 * motivo. Em dinheiro é a troca certa.
 *
 * **E a leitura que falha não vira tela vazia.** "Nenhum lançamento" depois de
 * um erro é a frase que faz a pessoa concluir que perdeu o histórico — a mesma
 * lição da Biblioteca com o balde sem credencial.
 */

export const FinanceiroView: React.FC = () => {
  /*
    A seção sai do `activeTab`, e não de uma prop: as telas carregadas sob
    demanda são tipadas sem propriedade nenhuma em `telaSobDemanda`, e abrir
    uma exceção aqui mudaria a assinatura das catorze. Quem decide qual seção
    aparece é a URL, que é o mesmo que decide qual tela monta.
  */
  const { currentWorkspace, clients, activeTab } = usePostfy();
  const secao = activeTab as TabType;
  const workspaceId = currentWorkspace?.id || '';

  const hoje = hojeNaAgencia();
  const [mes, setMes] = useState(() => mesDe(hojeNaAgencia()));

  const [doMes, setDoMes] = useState<Lancamento[]>([]);
  const [vencidos, setVencidos] = useState<Lancamento[]>([]);
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [historico, setHistorico] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const [modalAberta, setModalAberta] = useState(false);
  const [tipoDaModal, setTipoDaModal] = useState<TipoDeLancamento>('receber');
  const [emEdicao, setEmEdicao] = useState<Lancamento | null>(null);
  const [caixaDaModal, setCaixaDaModal] = useState<string | undefined>(undefined);
  const [nasceLiquidado, setNasceLiquidado] = useState(false);

  /*
    `clients` já vem recortado pela agência aberta — o contexto deriva o
    recorte de `allClients`, porque a RLS corta por **pessoa** e não por
    agência. Filtrar de novo aqui seria repetir a regra num segundo lugar, que
    é como ela começa a divergir.
  */
  const clientesDaAgencia = clients || [];

  const recarregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    setErro(null);
    try {
      const [mesAtual, atrasados, contas] = await Promise.all([
        carregarDoMes(workspaceId, mes),
        carregarVencidos(workspaceId, hoje),
        carregarCaixas(workspaceId),
      ]);
      setDoMes(mesAtual);
      setVencidos(atrasados);
      setCaixas(contas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o financeiro.');
    } finally {
      setCarregando(false);
    }
  }, [workspaceId, mes, hoje]);

  useEffect(() => {
    void recarregar();
  }, [recarregar, versao]);

  /*
    Os seis meses do gráfico só são lidos quando a tela de Relatórios está
    aberta: é a consulta mais larga daqui, e quem está em "Pagar" não precisa
    dela.
  */
  useEffect(() => {
    if (secao !== 'financeiro_relatorios' || !workspaceId) return;
    let cancelado = false;
    const inicio = limitesDoMes(mesVizinho(mes, -5)).de;
    const fim = limitesDoMes(mes).ate;
    setCarregandoHistorico(true);
    carregarLiquidadosNoPeriodo(workspaceId, inicio, fim)
      .then((linhas) => {
        if (!cancelado) setHistorico(linhas);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Falha ao ler o histórico.');
      })
      .finally(() => {
        if (!cancelado) setCarregandoHistorico(false);
      });
    return () => {
      cancelado = true;
    };
  }, [secao, workspaceId, mes, versao]);

  const resumo = useMemo(
    () => resumoDoPeriodo(doMes, vencidos, mes, hoje),
    [doMes, vencidos, mes, hoje]
  );

  const comErro = async (acao: () => Promise<void>) => {
    setErro(null);
    try {
      await acao();
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gravar.');
    }
  };

  const abrirNovo = (tipo: TipoDeLancamento) => {
    setTipoDaModal(tipo);
    setEmEdicao(null);
    setCaixaDaModal(undefined);
    setNasceLiquidado(false);
    setModalAberta(true);
  };

  const abrirEdicao = (lancamento: Lancamento) => {
    setTipoDaModal(lancamento.tipo);
    setEmEdicao(lancamento);
    setCaixaDaModal(undefined);
    setNasceLiquidado(false);
    setModalAberta(true);
  };

  /** "Entrada" e "Saída" do caixa: a modal de sempre, já liquidada e no caixa. */
  const abrirNoCaixa = (caixaId: string, tipo: TipoDeLancamento) => {
    setTipoDaModal(tipo);
    setEmEdicao(null);
    setCaixaDaModal(caixaId);
    setNasceLiquidado(true);
    setModalAberta(true);
  };

  const ehVisaoGeral = secao === 'financeiro';
  const ehReceber = secao === 'financeiro_receber';
  const ehPagar = secao === 'financeiro_pagar';
  const ehCaixa = secao === 'financeiro_caixa';
  const ehRelatorios = secao === 'financeiro_relatorios';

  const titulo = ehReceber
    ? 'Contas a receber'
    : ehPagar
    ? 'Contas a pagar'
    : ehCaixa
    ? 'Caixa'
    : ehRelatorios
    ? 'Relatórios financeiros'
    : 'Financeiro';

  return (
    // A raiz traz a própria rolagem: o `<main>` do App corta, e tela sem
    // `overflow-y-auto` fica com o conteúdo inalcançável abaixo da dobra.
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{titulo}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {ehCaixa
              ? 'O dinheiro que já entrou e saiu, por lugar onde ele fica.'
              : 'O que a agência tem a receber, a pagar e o que sobrou.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* O mês não governa o Caixa: saldo é acumulado, e um seletor de mês
              ao lado dele sugeriria um saldo "de outubro" que não existe. */}
          {!ehCaixa && (
            <div className="flex items-center">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMes((m) => mesVizinho(m, -1))}
                aria-label="Mês anterior"
                className="rounded-none rounded-l-lg"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setMes(mesDe(hoje))}
                className="rounded-none border-x-0 min-w-[9.5rem]"
                title="Voltar para o mês atual"
              >
                {rotuloDoMes(mes)}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMes((m) => mesVizinho(m, 1))}
                aria-label="Próximo mês"
                className="rounded-none rounded-r-lg"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {(ehVisaoGeral || ehReceber) && (
            <Button variant="success" onClick={() => abrirNovo('receber')}>
              <TrendingUp className="w-3.5 h-3.5" />
              Novo recebimento
            </Button>
          )}
          {(ehVisaoGeral || ehPagar) && (
            <Button variant="destructive" onClick={() => abrirNovo('pagar')}>
              <TrendingDown className="w-3.5 h-3.5" />
              Lançar despesa
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="leading-relaxed flex-1 min-w-0">
            <p className="font-bold">O financeiro não respondeu por inteiro.</p>
            <p>
              O que está abaixo pode estar incompleto — não conclua que faltam lançamentos sem
              recarregar. {erro}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => void recarregar()} aria-label="Tentar de novo">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {carregando && doMes.length === 0 && caixas.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-10 text-center">
          Lendo o financeiro...
        </p>
      ) : (
        <>
          {ehVisaoGeral && (
            <VisaoGeralDoFinanceiro
              resumo={resumo}
              doMes={doMes}
              vencidos={vencidos}
              clientes={clientesDaAgencia}
              rotuloDoMes={rotuloDoMes(mes)}
            />
          )}

          {(ehReceber || ehPagar) && (
            <ListaDeLancamentos
              tipo={ehReceber ? 'receber' : 'pagar'}
              lancamentos={doMes}
              vencidos={vencidos}
              clientes={clientesDaAgencia}
              hoje={hoje}
              aoEditar={abrirEdicao}
              aoLiquidar={(l, quando) =>
                void comErro(() => liquidarLancamento(workspaceId, l.id, quando))
              }
            />
          )}

          {ehCaixa && (
            <CaixasDaAgencia
              workspaceId={workspaceId}
              caixas={caixas}
              lancamentosDoMes={doMes}
              versao={versao}
              aoSalvarCaixa={(caixa) => comErro(async () => {
                await salvarCaixa(workspaceId, caixa);
              })}
              aoExcluirCaixa={(id) => comErro(async () => {
                await excluirCaixa(workspaceId, id);
              })}
              aoLancarNoCaixa={abrirNoCaixa}
            />
          )}

          {ehRelatorios && (
            <RelatorioFinanceiro
              resumo={resumo}
              mes={mes}
              doMes={doMes}
              historico={historico}
              carregandoHistorico={carregandoHistorico}
            />
          )}
        </>
      )}

      <ModalDeLancamento
        aberta={modalAberta}
        aoFechar={() => setModalAberta(false)}
        tipo={tipoDaModal}
        lancamento={emEdicao}
        jaLiquidado={nasceLiquidado}
        caixaFixo={caixaDaModal}
        caixas={caixas}
        clientes={clientesDaAgencia}
        aoSalvar={async (dados) => {
          await salvarLancamento(workspaceId, dados);
          setVersao((v) => v + 1);
        }}
        aoExcluir={async (id) => {
          await excluirLancamento(workspaceId, id);
          setVersao((v) => v + 1);
        }}
      />
    </div>
  );
};

export default FinanceiroView;
