import React from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { DollarSign, Building2, Clock, AlertTriangle, Plug } from 'lucide-react';

/**
 * Financeiro do SaaS.
 *
 * Esta tela afirmava um faturamento que não existe. Ela calculava
 * `MRR = agências × R$ 197` — contando como pagante toda agência criada,
 * inclusive as em teste —, projetava o ARR em cima disso, e exibia
 * "100% adimplentes", "+18,4% este mês" e "Ticket Médio R$ 197,00" como
 * texto fixo. Abaixo, uma tabela de "Últimas Transações do SaaS" com quatro
 * pagamentos de agências inventadas: Vanguarda Social, Pixel Mídia e Creative
 * Hub, que nunca existiram na base.
 *
 * No dia em que isso foi corrigido, a realidade era: três agências, todas em
 * teste, nenhuma pagante, R$ 0,00 de receita. A tela mostrava R$ 591,00.
 *
 * Número inventado em tela financeira é pior que tela vazia: ele é usado para
 * decidir. Enquanto não houver cobrança de verdade, aqui só entra o que o
 * banco sabe — quantas agências existem, quais estão em teste e desde quando.
 *
 * O que falta para esta tela ter faturamento está escrito nela, com nome:
 * não há tabela de assinatura da agência com o SaaS, nem de pagamentos.
 * `plans` é outra coisa — é o catálogo que cada agência monta para os
 * clientes dela.
 */

const formatarData = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const AdminFinanceiroView: React.FC = () => {
  const { workspaces } = usePostfy();

  const total = workspaces.length;
  const emTeste = workspaces.filter((w) => w.isTrial).length;
  // "Pagante" é o que sobra de quem não está em teste. Não é cobrança
  // confirmada — é o mais perto disso que o banco permite dizer hoje, e o
  // rótulo abaixo não promete mais do que isso.
  const foraDoTeste = total - emTeste;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
            Financeiro
          </span>
          <span className="text-xs text-slate-400">• Situação das agências</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Financeiro & Faturamento do SaaS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Situação das agências cadastradas no produto.
        </p>
      </div>

      {/* O aviso vem antes dos números, e não num rodapé: quem abre uma tela
          chamada "Financeiro" espera receita, e precisa saber que ela ainda
          não é medida aqui antes de ler qualquer coisa. */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Ainda não há cobrança ligada ao produto
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed max-w-3xl">
            Não existe MRR, ARR nem histórico de pagamentos para mostrar: falta a
            assinatura de cada agência com o SaaS e o registro das cobranças — nenhuma
            das duas coisas existe no banco hoje. A tabela <code className="font-mono">plans</code> é
            outra coisa: é o catálogo que cada agência monta para os clientes dela.
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed max-w-3xl">
            Até isso existir, esta tela mostra só o que o banco sabe. Antes ela
            estimava a receita multiplicando o número de agências por R$ 197 e listava
            pagamentos de agências que não existem.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Agências cadastradas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{total}</div>
          <span className="text-[11px] text-slate-400 block mt-1">Total na base</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Em teste grátis</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{emTeste}</div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {total > 0 ? `${Math.round((emTeste / total) * 100)}% da base` : 'Nenhuma agência ainda'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Fora do teste</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{foraDoTeste}</div>
          {/* O rótulo não diz "pagantes": sair do teste e pagar são coisas
              diferentes, e o banco não sabe a segunda. */}
          <span className="text-[11px] text-slate-400 block mt-1">
            Sem cobrança confirmada
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Agências na base</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cada agência cadastrada e a situação do teste. Aqui ficava um histórico de
            transações que era exemplo, não dado.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="p-8 text-center">
            <Plug className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Nenhuma agência cadastrada ainda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3">Agência</th>
                  <th className="px-5 py-3">Endereço</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3">Teste termina em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workspaces.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                        {w.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">{w.slug}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          w.isTrial
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {w.isTrial ? 'Em teste' : 'Fora do teste'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {formatarData(w.trialEndsAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
