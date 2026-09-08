import React from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { DollarSign, TrendingUp, Users, ArrowUpRight, ShieldCheck, CreditCard, Building2 } from 'lucide-react';

export const SaasFinancialView: React.FC = () => {
  const { workspaces } = usePostfy();

  // Calculate SaaS Financial metrics
  const totalAgencies = workspaces.length;
  const mrr = totalAgencies * 197; // Estimated MRR
  const arr = mrr * 12;

  const transactions = [
    { id: 'tx-1', agency: 'Orquesia', plan: 'Agência PRO', value: 197.00, date: '08/09/2026', status: 'pago' },
    { id: 'tx-2', agency: 'Vanguarda Social', plan: 'Agência PRO', value: 197.00, date: '05/09/2026', status: 'pago' },
    { id: 'tx-3', agency: 'Pixel Mídia', plan: 'Teste Grátis (7d)', value: 0.00, date: '01/09/2026', status: 'trial' },
    { id: 'tx-4', agency: 'Creative Hub', plan: 'Enterprise', value: 497.00, date: '28/08/2026', status: 'pago' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
              Super Admin SaaS
            </span>
            <span className="text-xs text-slate-400">• Painel Financeiro</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Financeiro & Faturamento do SaaS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visão consolidada de faturamento recorrente (MRR), ARR e transações de todas as agências.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">MRR (Receita Recorrente)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18.4% este mês</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">ARR (Receita Anual Projetada)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            R$ {arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Projeção com base no ativo</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Agências Pagantes</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalAgencies} Agências
          </div>
          <span className="text-[11px] text-emerald-600 font-bold block mt-1">100% adimplentes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Ticket Médio</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            R$ 197,00
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Por workspace ativo</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Últimas Transações do SaaS</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Histórico de pagamentos de assinaturas das agências</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Agência / Workspace</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    {tx.agency}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-medium">{tx.plan}</td>
                  <td className="px-5 py-3.5 text-slate-500 font-mono">{tx.date}</td>
                  <td className="px-5 py-3.5 font-bold font-mono text-slate-900 dark:text-white">
                    R$ {tx.value.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      tx.status === 'pago' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
