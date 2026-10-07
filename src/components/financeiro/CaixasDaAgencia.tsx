import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { useConfirmacao } from '../ui/alert-dialog';
import {
  Caixa,
  Lancamento,
  carregarDoCaixa,
  centavosDe,
  emReais,
  formatarCentavos,
  saldoDoCaixa,
} from '../../lib/financeiro';
import { Cartao, Vazio, diaLegivel } from './pecas';

/**
 * Onde o dinheiro fica: conta, carteira, cofre.
 *
 * **O saldo é derivado, nunca gravado.** Ele é `saldo inicial + o que foi
 * liquidado neste caixa` — a mesma soma que o relatório faz. Uma coluna
 * `saldo` na tabela exigiria reescrevê-la a cada lançamento, e a segunda
 * escrita podendo falhar sozinha produziria o pior desfecho possível numa
 * tela de dinheiro: um saldo que não bate com as linhas que o explicam, sem
 * nada acusando.
 *
 * **E "Entrada" e "Saída" não são uma tabela nova.** Elas gravam um lançamento
 * já liquidado neste caixa. Duas tabelas respondendo "quanto entrou" divergem
 * na primeira pressa, e aí o saldo e o relatório ficam certos cada um pelo seu
 * lado — que é o jeito mais caro de errar.
 */

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none';

interface Props {
  workspaceId: string;
  caixas: Caixa[];
  /** O que já está carregado do mês — basta para o saldo quando o caixa é novo. */
  lancamentosDoMes: Lancamento[];
  aoSalvarCaixa: (caixa: Partial<Caixa> & { id?: string }) => Promise<void>;
  aoExcluirCaixa: (id: string) => Promise<void>;
  aoLancarNoCaixa: (caixaId: string, tipo: 'receber' | 'pagar') => void;
  /** Sobe a cada gravação, para a lista do caixa ser relida. */
  versao: number;
}

export const CaixasDaAgencia: React.FC<Props> = ({
  workspaceId,
  caixas,
  lancamentosDoMes,
  aoSalvarCaixa,
  aoExcluirCaixa,
  aoLancarNoCaixa,
  versao,
}) => {
  const { pedir, dialogo } = useConfirmacao();

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [editando, setEditando] = useState<Caixa | null>(null);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [salvando, setSalvando] = useState(false);

  const caixaAberto = caixas.find((c) => c.id === selecionado) || caixas[0];

  /*
    As movimentações do caixa não saem do mês carregado: o saldo é a soma de
    **toda** a vida dele, e a lista precisa mostrar as últimas de verdade, não
    as últimas de outubro.
  */
  useEffect(() => {
    if (!caixaAberto?.id) {
      setMovimentacoes([]);
      return;
    }
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    carregarDoCaixa(workspaceId, caixaAberto.id)
      .then((linhas) => {
        if (!cancelado) setMovimentacoes(linhas);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Falha ao ler as movimentações.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [workspaceId, caixaAberto?.id, versao]);

  const abrirEdicao = (caixa: Caixa | null) => {
    setEditando(caixa);
    setNovo(!caixa);
    setNome(caixa?.nome || '');
    setSaldoInicial(
      caixa ? String(emReais(caixa.saldoInicialCentavos).toFixed(2)).replace('.', ',') : ''
    );
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await aoSalvarCaixa({
        id: editando?.id,
        nome,
        // Saldo inicial aceita negativo: conta no cheque especial existe, e
        // recusá-la obrigaria a mentir no número de partida.
        saldoInicialCentavos: centavosDe(saldoInicial) ?? 0,
      });
      setEditando(null);
      setNovo(false);
    } finally {
      setSalvando(false);
    }
  };

  /*
    O saldo soma as movimentações lidas **e** as do mês que ainda não estão
    nelas: a lista vem limitada às 50 últimas, e somar só o que está na tela
    daria um saldo que muda conforme o limite da consulta.
  */
  const saldoDe = (caixa: Caixa) => {
    const porId = new Map<string, Lancamento>();
    for (const l of [...lancamentosDoMes, ...(caixa.id === caixaAberto?.id ? movimentacoes : [])]) {
      porId.set(l.id, l);
    }
    return saldoDoCaixa(caixa, [...porId.values()]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Caixas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O saldo sai dos lançamentos liquidados em cada caixa, somados ao saldo inicial.
          </p>
        </div>
        <Button onClick={() => abrirEdicao(null)}>
          <Plus className="w-3.5 h-3.5" />
          Novo caixa
        </Button>
      </div>

      {caixas.length === 0 ? (
        <Cartao className="p-5">
          <Vazio
            titulo="Nenhum caixa cadastrado"
            detalhe="Crie um para cada lugar onde o dinheiro fica — a conta do banco, a carteira digital, o dinheiro em espécie. O saldo inicial é o que já havia ali quando você começou."
          />
        </Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {caixas.map((caixa) => {
            const saldo = saldoDe(caixa);
            const aberto = caixa.id === caixaAberto?.id;
            return (
              <Cartao
                key={caixa.id}
                className={`p-4 cursor-pointer transition ${
                  aberto
                    ? 'ring-2 ring-purple-500/40 border-purple-200 dark:border-purple-800'
                    : 'hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div onClick={() => setSelecionado(caixa.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {caixa.nome}
                    </span>
                    <Wallet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                  <p
                    className={`text-lg font-extrabold tabular-nums mt-1 ${
                      saldo < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatarCentavos(saldo)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Saldo inicial {formatarCentavos(caixa.saldoInicialCentavos)}
                  </p>
                </div>

                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    onClick={() => aoLancarNoCaixa(caixa.id, 'receber')}
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    Entrada
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => aoLancarNoCaixa(caixa.id, 'pagar')}
                    className="text-rose-600 dark:text-rose-400"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Saída
                  </Button>
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => abrirEdicao(caixa)}
                    aria-label="Editar caixa"
                    title="Editar caixa"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      pedir({
                        titulo: `Excluir o caixa "${caixa.nome}"?`,
                        descricao:
                          'Os lançamentos ficam: eles perdem o caixa e mantêm valor, data e descrição. O que some é o saldo deste lugar, e o saldo inicial que você informou.',
                        rotuloConfirmar: 'Excluir',
                        destrutivo: true,
                        aoConfirmar: () => aoExcluirCaixa(caixa.id),
                      })
                    }
                    aria-label="Excluir caixa"
                    title="Excluir caixa"
                    className="text-rose-600 dark:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}

      {caixaAberto && (
        <Cartao className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Movimentações — {caixaAberto.nome}
          </h3>

          {erro ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">{erro}</p>
          ) : carregando ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Lendo...</p>
          ) : movimentacoes.length === 0 ? (
            <Vazio
              titulo="Nenhuma movimentação registrada"
              detalhe="Só entra aqui o que foi marcado como recebido ou pago neste caixa. Conta em aberto não movimenta dinheiro."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {movimentacoes.map((l) => (
                <div key={l.id} className="py-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {l.descricao}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {diaLegivel(l.liquidadoEm)}
                      {l.categoria ? ` · ${l.categoria}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      l.tipo === 'receber'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {l.tipo === 'receber' ? '+' : '−'} {formatarCentavos(l.valorCentavos)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      )}

      <Dialog
        open={Boolean(editando) || novo}
        onOpenChange={(v) => {
          if (!v) {
            setEditando(null);
            setNovo(false);
          }
        }}
      >
        <DialogContent tamanho="recado" className="p-0 gap-0">
          <div className="shrink-0 p-5 pr-12 border-b border-slate-200 dark:border-slate-800">
            <DialogTitle asChild>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editando ? 'Editar caixa' : 'Novo caixa'}
              </h3>
            </DialogTitle>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Conta do banco, carteira, espécie"
                className={CAMPO}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Saldo inicial
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                placeholder="0,00"
                className={CAMPO}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                O que já havia neste lugar antes do primeiro lançamento aqui. Sem ele o saldo
                começaria em zero e a tela diria um valor que não é o da conta.
              </p>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditando(null);
                setNovo(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} disabled={salvando || !nome.trim()}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {dialogo}
    </div>
  );
};
