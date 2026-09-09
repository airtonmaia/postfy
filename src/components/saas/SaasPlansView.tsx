import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { useServerCollection } from '../../lib/useServerCollection';
import { novoId } from '../../lib/sincronizacao';
import { Crown, Check, Plus, Edit2, Trash2, Shield, DollarSign, Users } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  maxWorkspaces: number;
  maxUsers: number;
  storage: string;
  features: string[];
  activeAgenciesCount: number;
  badge?: string;
}

export const SaasPlansView: React.FC = () => {
  const { currentWorkspace } = usePostfy();
  // Planos persistidos no servidor. Antes viviam num useState local e
  // qualquer edição sumia no recarregamento da página.
  const PLANOS_PADRAO: Plan[] = [
    {
      id: novoId(),
      name: 'Teste Grátis (7 dias)',
      price: 0,
      interval: 'monthly',
      maxWorkspaces: 1,
      maxUsers: 3,
      storage: '5 GB',
      features: ['Até 3 usuários', 'Fila de aprovações', 'Quadro Kanban', 'Suporte por e-mail'],
      activeAgenciesCount: 3,
      badge: 'Trial'
    },
    {
      id: novoId(),
      name: 'Agência PRO',
      price: 197,
      interval: 'monthly',
      maxWorkspaces: 5,
      maxUsers: 15,
      storage: '50 GB',
      features: ['Até 15 usuários', 'Whitelabel Completo', 'Domínio Personalizado', 'Automações Avançadas', 'Relatórios & BI', 'Suporte Prioritário'],
      activeAgenciesCount: 12,
      badge: 'Mais Popular'
    },
    {
      id: novoId(),
      name: 'Enterprise / Holding',
      price: 497,
      interval: 'monthly',
      maxWorkspaces: 999,
      maxUsers: 999,
      storage: 'Ilimitado',
      features: ['Usuários e workspaces ilimitados', 'API Dedicada', 'Gerente de Conta Exclusivo', 'SLA 99.9%', 'Whitelabel Avançado'],
      activeAgenciesCount: 2,
      badge: 'VIP'
    }
  ];

  const { linhas: plans, salvar: setPlans, erro: erroPlanos } = useServerCollection<Plan>(
    'plans',
    PLANOS_PADRAO,
    currentWorkspace?.id || '',
    (p, workspaceId) => ({
      id: p.id,
      workspace_id: workspaceId,
      name: p.name,
      price: p.price,
      interval: p.interval,
      max_workspaces: p.maxWorkspaces,
      max_users: p.maxUsers,
      storage: p.storage,
      features: p.features,
      badge: p.badge,
      active_agencies_count: p.activeAgenciesCount,
    }),
    (l) => ({
      id: l.id,
      name: l.name,
      price: Number(l.price ?? 0),
      interval: l.interval,
      maxWorkspaces: l.max_workspaces,
      maxUsers: l.max_users,
      storage: l.storage ?? '',
      features: l.features ?? [],
      badge: l.badge ?? undefined,
      activeAgenciesCount: l.active_agencies_count ?? 0,
    })
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(197);
  const [maxUsers, setMaxUsers] = useState(10);
  const [storage, setStorage] = useState('20 GB');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      setPlans(atual => atual.map(p => p.id === editingPlan.id ? { ...p, name, price, maxUsers, storage } : p));
    } else {
      const newPlan: Plan = {
        id: novoId(),
        name,
        price,
        interval: 'monthly',
        maxWorkspaces: 10,
        maxUsers,
        storage,
        features: ['Recursos completos PRO', 'Suporte padrão'],
        activeAgenciesCount: 0
      };
      setPlans(atual => [...atual, newPlan]);
    }
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      {erroPlanos && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium">
          {erroPlanos}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full">
              Super Admin SaaS
            </span>
            <span className="text-xs text-slate-400">• Gerenciamento de Planos</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Planos & Assinaturas do SaaS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Crie, edite e configure os planos de assinatura disponíveis para as agências na plataforma.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingPlan(null);
            setName('');
            setPrice(197);
            setMaxUsers(10);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Plano</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div 
            key={plan.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-700 transition"
          >
            {plan.badge && (
              <div className="absolute top-4 right-4 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {plan.badge}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {plan.activeAgenciesCount} agências ativas
                  </span>
                </div>
              </div>

              <div className="my-5">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  R$ {plan.price}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  /mês
                </span>
              </div>

              <div className="space-y-2.5 py-4 border-y border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Limite de Usuários:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{plan.maxUsers} usuários</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Armazenamento:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{plan.storage}</span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {plan.features.map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setEditingPlan(plan);
                  setName(plan.name);
                  setPrice(plan.price);
                  setMaxUsers(plan.maxUsers);
                  setStorage(plan.storage);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar Plano
              </button>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                Ativo
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Create/Edit Plan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome do Plano</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  placeholder="Ex: Agência Turbo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Preço Mensal (R$)</label>
                  <input 
                    type="number" 
                    value={price} 
                    onChange={e => setPrice(Number(e.target.value))} 
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Máx. Usuários</label>
                  <input 
                    type="number" 
                    value={maxUsers} 
                    onChange={e => setMaxUsers(Number(e.target.value))} 
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Armazenamento</label>
                <input 
                  type="text" 
                  value={storage} 
                  onChange={e => setStorage(e.target.value)} 
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  placeholder="Ex: 50 GB"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition"
                >
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
