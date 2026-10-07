import React, { useMemo, useState } from 'react';
import { Search, CheckCircle2, RotateCcw, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Lancamento,
  TipoDeLancamento,
  formatarCentavos,
  situacaoDoLancamento,
  SituacaoDoLancamento,
} from '../../lib/financeiro';
import { Cartao, SeloDaSituacao, Vazio, diaLegivel } from './pecas';
import type { Client } from '../../types';

/**
 * A lista de contas — a receber ou a pagar.
 *
 * **É um componente só, montado duas vezes.** As duas telas fazem a mesma
 * pergunta sobre lados opostos do caixa, e escrever as duas garantiria que uma
 * ganhasse o filtro, a busca ou o total que a outra não tem — a história das
 * doze alturas de botão e das sete barras de abas. O que muda é o vocabulário
 * ("Recebido" / "Pago", "Cliente" / "Fornecedor"), e ele vem do `tipo`.
 */

interface Props {
  tipo: TipoDeLancamento;
  lancamentos: Lancamento[];
  /** Os vencidos de **qualquer** mês, que a lista do período não alcança. */
  vencidos: Lancamento[];
  clientes: Client[];
  hoje: string;
  aoEditar: (lancamento: Lancamento) => void;
  aoLiquidar: (lancamento: Lancamento, quando: string | null) => void;
}

type Recorte = 'todos' | 'aberto' | 'vencido' | 'liquidado';

export const ListaDeLancamentos: React.FC<Props> = ({
  tipo,
  lancamentos,
  vencidos,
  clientes,
  hoje,
  aoEditar,
  aoLiquidar,
}) => {
  const [recorte, setRecorte] = useState<Recorte>('todos');
  const [busca, setBusca] = useState('');

  const nomeDoCliente = (id?: string) =>
    id ? clientes.find((c) => c.id === id)?.name : undefined;

  /**
   * A lista é a do mês **mais** os vencidos de meses anteriores.
   *
   * Sem os vencidos, a conta esquecida há dois meses não aparece em mês
   * nenhum: ela não vence no mês que está na tela nem foi liquidada nele. Uma
   * tela de cobrança que esconde justamente o que está atrasado é o contrário
   * do que ela existe para fazer.
   */
  const todas = useMemo(() => {
    const porId = new Map<string, Lancamento>();
    for (const l of [...lancamentos, ...vencidos]) {
      if (l.tipo === tipo) porId.set(l.id, l);
    }
    return [...porId.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [lancamentos, vencidos, tipo]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todas.filter((l) => {
      const situacao: SituacaoDoLancamento = situacaoDoLancamento(l, hoje);
      if (recorte !== 'todos' && situacao !== recorte) return false;
      if (!termo) return true;
      const alvo = [l.descricao, l.categoria, l.contraparte, nomeDoCliente(l.clientId)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [todas, recorte, busca, hoje, clientes]);

  const total = filtradas.reduce((s, l) => s + l.valorCentavos, 0);
  const emAberto = filtradas
    .filter((l) => !l.liquidadoEm)
    .reduce((s, l) => s + l.valorCentavos, 0);

  const contarDe = (alvo: Recorte) =>
    alvo === 'todos'
      ? todas.length
      : todas.filter((l) => situacaoDoLancamento(l, hoje) === alvo).length;

  const ehReceber = tipo === 'receber';

  return (
    <Cartao className="p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={recorte} onValueChange={(v) => setRecorte(v as Recorte)}>
          <TabsList aparencia="segmentado">
            <TabsTrigger value="todos">Todos ({contarDe('todos')})</TabsTrigger>
            <TabsTrigger value="aberto">Em aberto ({contarDe('aberto')})</TabsTrigger>
            <TabsTrigger value="vencido">Vencidos ({contarDe('vencido')})</TabsTrigger>
            <TabsTrigger value="liquidado">
              {ehReceber ? 'Recebidos' : 'Pagos'} ({contarDe('liquidado')})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={ehReceber ? 'Buscar por cliente ou descrição...' : 'Buscar por fornecedor ou descrição...'}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Total listado{' '}
          <strong className="text-slate-900 dark:text-white">{formatarCentavos(total)}</strong>
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Em aberto{' '}
          <strong className="text-amber-600 dark:text-amber-400">
            {formatarCentavos(emAberto)}
          </strong>
        </span>
      </div>

      {filtradas.length === 0 ? (
        <Vazio
          titulo={
            todas.length === 0
              ? ehReceber
                ? 'Nada a receber lançado ainda'
                : 'Nada a pagar lançado ainda'
              : 'Nenhuma conta com este filtro'
          }
          detalhe={
            todas.length === 0
              ? 'Este mês ainda não tem lançamento. O que você cadastrar aqui alimenta a visão geral, o caixa e os relatórios.'
              : undefined
          }
        />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtradas.map((l) => {
            const situacao = situacaoDoLancamento(l, hoje);
            const quem = nomeDoCliente(l.clientId) || l.contraparte;
            return (
              <div
                key={l.id}
                className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {l.descricao}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {[quem, l.categoria].filter(Boolean).join(' · ') || 'Sem cliente nem categoria'}
                  </p>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 w-28 shrink-0">
                  <span className="block">Vence {diaLegivel(l.vencimento)}</span>
                  {l.liquidadoEm && (
                    <span className="block text-emerald-600 dark:text-emerald-400">
                      {ehReceber ? 'Recebido' : 'Pago'} {diaLegivel(l.liquidadoEm)}
                    </span>
                  )}
                </div>

                <SeloDaSituacao situacao={situacao} tipo={tipo} />

                <span
                  className={`text-xs font-bold tabular-nums w-28 text-right shrink-0 ${
                    ehReceber
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatarCentavos(l.valorCentavos)}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  {/*
                    Marcar e desmarcar são o mesmo botão, e desfazer existe
                    porque o clique é de um toque numa linha de dinheiro: sem
                    volta, consertar um "recebi" errado seria apagar a conta e
                    cadastrá-la de novo.
                  */}
                  {l.liquidadoEm ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => aoLiquidar(l, null)}
                      aria-label={ehReceber ? 'Desfazer recebimento' : 'Desfazer pagamento'}
                      title={ehReceber ? 'Desfazer recebimento' : 'Desfazer pagamento'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => aoLiquidar(l, hoje)}
                      aria-label={ehReceber ? 'Marcar como recebido' : 'Marcar como pago'}
                      title={ehReceber ? 'Marcar como recebido hoje' : 'Marcar como pago hoje'}
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => aoEditar(l)}
                    aria-label="Editar lançamento"
                    title="Editar lançamento"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Cartao>
  );
};
