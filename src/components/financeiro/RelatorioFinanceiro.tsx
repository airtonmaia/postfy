import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Lancamento,
  ResumoDoFinanceiro,
  formatarCentavos,
  emReais,
  porCategoria,
  mesDe,
  rotuloDoMes,
} from '../../lib/financeiro';
import { Cartao, Vazio } from './pecas';

/**
 * O relatório do dinheiro.
 *
 * **Ele mostra competência e caixa lado a lado, e para por aí.** A referência
 * que originou esta tela trazia um DRE completo, com dedução de impostos
 * "classificada automaticamente por nome de categoria (heurística)" — e isso é
 * exatamente o que este projeto não faz: adivinhar que uma linha chamada "DAS"
 * é imposto produz um lucro líquido que ninguém conferiu, numa tela que existe
 * para decidir. Enquanto o produto não tiver um campo dizendo o que é imposto,
 * o relatório soma o que foi lançado e nomeia o que não sabe.
 *
 * A evolução é de **seis meses pelo caixa**: é o extrato, a pergunta que a
 * série temporal responde bem. Pelo vencimento ela diria o que estava
 * combinado, não o que aconteceu.
 */

interface Props {
  resumo: ResumoDoFinanceiro;
  mes: string;
  doMes: Lancamento[];
  /** Seis meses de liquidações, para a evolução. */
  historico: Lancamento[];
  carregandoHistorico: boolean;
}

const ListaDeCategorias: React.FC<{
  titulo: string;
  dados: { categoria: string; total: number }[];
  cor: string;
}> = ({ titulo, dados, cor }) => {
  const total = dados.reduce((s, d) => s + d.total, 0);
  return (
    <Cartao className="p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
      {dados.length === 0 ? (
        <Vazio titulo="Sem dados no período" />
      ) : (
        <div className="space-y-2.5">
          {dados.map((d) => {
            // Divisão por zero não acontece: a lista só existe com total > 0.
            const parte = Math.round((d.total / total) * 100);
            return (
              <div key={d.categoria} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-slate-700 dark:text-slate-300 truncate">
                    {d.categoria}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                    {formatarCentavos(d.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full ${cor}`} style={{ width: `${parte}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Cartao>
  );
};

export const RelatorioFinanceiro: React.FC<Props> = ({
  resumo,
  mes,
  doMes,
  historico,
  carregandoHistorico,
}) => {
  const evolucao = useMemo(() => {
    const meses = new Map<string, { mes: string; entrou: number; saiu: number }>();
    for (const l of historico) {
      if (!l.liquidadoEm) continue;
      const chave = mesDe(l.liquidadoEm);
      const linha = meses.get(chave) || { mes: chave, entrou: 0, saiu: 0 };
      if (l.tipo === 'receber') linha.entrou += l.valorCentavos;
      else linha.saiu += l.valorCentavos;
      meses.set(chave, linha);
    }
    return [...meses.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((linha) => ({
        nome: rotuloDoMes(linha.mes).split(' de ')[0].slice(0, 3),
        Entrou: emReais(linha.entrou),
        Saiu: emReais(linha.saiu),
      }));
  }, [historico]);

  const aReceberTotal = resumo.receber.vencido + resumo.receber.liquidado;
  /*
    Inadimplência é o que **venceu e não entrou**, sobre o que venceu. Somar o
    que ainda está no prazo no denominador diluiria o atraso e faria o número
    parecer melhor do que é.
  */
  const inadimplencia =
    aReceberTotal > 0 ? Math.round((resumo.receber.vencido / aReceberTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <Cartao className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Resumo de {rotuloDoMes(mes)}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Competência é o que vence no mês. Caixa é o que entrou e saiu no mês.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="text-left font-bold pb-2">Indicador</th>
                <th className="text-right font-bold pb-2">Competência</th>
                <th className="text-right font-bold pb-2">Caixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-2 text-slate-700 dark:text-slate-300">Receita</td>
                <td className="py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatarCentavos(resumo.receber.previsto)}
                </td>
                <td className="py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatarCentavos(resumo.receber.liquidado)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-700 dark:text-slate-300">Despesa</td>
                <td className="py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                  {formatarCentavos(resumo.pagar.previsto)}
                </td>
                <td className="py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                  {formatarCentavos(resumo.pagar.liquidado)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-bold text-slate-900 dark:text-white">Resultado</td>
                <td className="py-2 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                  {formatarCentavos(resumo.resultadoPrevisto)}
                </td>
                <td className="py-2 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                  {formatarCentavos(resumo.resultadoDeCaixa)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-700 dark:text-slate-300">
                  Inadimplência
                  <span className="block text-[11px] text-slate-400">
                    {resumo.receber.contasVencidas} conta(s) vencida(s)
                  </span>
                </td>
                <td
                  className="py-2 text-right tabular-nums text-amber-600 dark:text-amber-400"
                  colSpan={2}
                >
                  {formatarCentavos(resumo.receber.vencido)} ({inadimplencia}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/*
          A tela diz o que ela **não** calcula. Campo ausente num relatório
          financeiro lê como "deu zero", e quem lê leva o número para uma
          decisão.
        */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
          Não há dedução de impostos nem lucro líquido aqui: o produto não guarda o que é
          imposto, e deduzi-lo adivinhando pelo nome da categoria produziria um resultado que
          ninguém conferiu. O que está acima é a soma do que foi lançado.
        </p>
      </Cartao>

      <Cartao className="p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Entradas e saídas, mês a mês
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seis meses até {rotuloDoMes(mes)}, pelo dia em que o dinheiro andou.
          </p>
        </div>

        {carregandoHistorico ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-10 text-center">Lendo...</p>
        ) : evolucao.length === 0 ? (
          <Vazio
            titulo="Nada liquidado nos últimos seis meses"
            detalhe="O gráfico mostra o que foi marcado como recebido ou pago. Conta em aberto não entra aqui."
          />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => formatarCentavos(Math.round(v * 100))}
                  contentStyle={{ fontSize: 12, borderRadius: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Entrou" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saiu" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListaDeCategorias
          titulo={`Receita por categoria — ${rotuloDoMes(mes)}`}
          dados={porCategoria(doMes, 'receber')}
          cor="bg-emerald-500"
        />
        <ListaDeCategorias
          titulo={`Despesa por categoria — ${rotuloDoMes(mes)}`}
          dados={porCategoria(doMes, 'pagar')}
          cor="bg-rose-500"
        />
      </div>
    </div>
  );
};
