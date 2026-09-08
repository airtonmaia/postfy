import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { Building2, Plus, Trash2, ExternalLink, Shield, CheckCircle2, Globe, Calendar, Search } from 'lucide-react';

export const SaasAgenciesView: React.FC = () => {
  const { workspaces, currentWorkspace, setCurrentWorkspace, setIsCreateWorkspaceModalOpen } = usePostfy();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ws.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full">
              Super Admin SaaS
            </span>
            <span className="text-xs text-slate-400">• Gestão de Agências</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Todas as Agências do SaaS ({workspaces.length})
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie todas as agências cadastradas, acesse os workspaces, configure planos e remova agências inativas.
          </p>
        </div>

        <button
          onClick={() => setIsCreateWorkspaceModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Agência</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar agência por nome ou slug..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
        />
      </div>

      {/* Agencies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkspaces.map(ws => {
          const isCurrent = ws.id === currentWorkspace?.id;

          return (
            <div 
              key={ws.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm flex flex-col justify-between transition ${
                isCurrent 
                  ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-md' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {ws.logo ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0 shadow-xs">
                        <img src={ws.logo} alt={ws.name} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: ws.primaryColor || '#9333ea' }}
                      >
                        {ws.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="truncate">{ws.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                            Ativa
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">@{ws.slug}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {ws.isTrial ? '✨ Teste Grátis' : '👑 Assinante PRO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Timezone:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{ws.timezone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Domínio Custom:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{ws.customDomain || 'Padrão'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 pt-2">
                <button
                  onClick={() => setCurrentWorkspace(ws)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isCurrent 
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isCurrent ? 'Workspace Atual' : 'Acessar Workspace'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
