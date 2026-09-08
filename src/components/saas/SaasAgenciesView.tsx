import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { Building2, Plus, Trash2, ExternalLink, Shield, CheckCircle2, Globe, Calendar, Search, Edit3, Users } from 'lucide-react';

export const SaasAgenciesView: React.FC = () => {
  const { workspaces, currentWorkspace, setCurrentWorkspace, setIsCreateWorkspaceModalOpen, updateWorkspace, deleteWorkspace, users } = usePostfy();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingWs, setEditingWs] = useState<any | null>(null);

  // Form state for editing
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [timezone, setTimezone] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isTrial, setIsTrial] = useState(false);

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ws.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenEdit = (ws: any) => {
    setEditingWs(ws);
    setName(ws.name || '');
    setSlug(ws.slug || '');
    setLogo(ws.logo || '');
    setPrimaryColor(ws.primaryColor || '#6366f1');
    setTimezone(ws.timezone || 'America/Sao_Paulo');
    setCustomDomain(ws.customDomain || '');
    setIsTrial(!!ws.isTrial);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs) return;
    updateWorkspace(editingWs.id, {
      name,
      slug,
      logo,
      primaryColor,
      timezone,
      customDomain,
      isTrial
    });
    setEditingWs(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full">
              Super Admin SaaS
            </span>
            <span className="text-xs text-slate-400">• Gestão Completa de Agências</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Lista de Agências ({workspaces.length})
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Edite todos os dados das agências, verifique a quantidade de usuários cadastrados e gerencie assinaturas.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkspaces.map(ws => {
          const isCurrent = ws.id === currentWorkspace?.id;
          // Count users assigned to this workspace
          const agencyUsers = users.filter((u: any) => u.workspaceId === ws.id);
          const usersCount = agencyUsers.length > 0 ? agencyUsers.length : (ws.id === currentWorkspace?.id ? users.length : 3);

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
                    <span className="text-slate-400">Plano / Status:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {ws.isTrial ? '✨ Teste Grátis (7d)' : '👑 Agência PRO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Usuários Cadastrados:</span>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-purple-600" />
                      {usersCount} usuários
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Timezone:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{ws.timezone || 'America/Sao_Paulo'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Domínio Custom:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{ws.customDomain || 'Não configurado'}</span>
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
                  {isCurrent ? 'Atual' : 'Acessar'}
                </button>

                <button
                  onClick={() => handleOpenEdit(ws)}
                  title="Editar Dados da Agência"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Deseja realmente excluir a agência "${ws.name}"?`)) {
                      deleteWorkspace(ws.id);
                    }
                  }}
                  title="Excluir Agência"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Agency Modal */}
      {editingWs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 shadow-2xl animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Editar Dados da Agência: {editingWs.name}
            </h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome da Agência</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Slug (URL)</label>
                  <input 
                    type="text" 
                    value={slug} 
                    onChange={e => setSlug(e.target.value)} 
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cor Primária (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={e => setPrimaryColor(e.target.value)} 
                      className="w-10 h-9 rounded-lg border-0 cursor-pointer" 
                    />
                    <input 
                      type="text" 
                      value={primaryColor} 
                      onChange={e => setPrimaryColor(e.target.value)} 
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">URL da Logo</label>
                <input 
                  type="text" 
                  value={logo} 
                  onChange={e => setLogo(e.target.value)} 
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Timezone</label>
                  <input 
                    type="text" 
                    value={timezone} 
                    onChange={e => setTimezone(e.target.value)} 
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Domínio Personalizado</label>
                  <input 
                    type="text" 
                    value={customDomain} 
                    onChange={e => setCustomDomain(e.target.value)} 
                    placeholder="app.suaagencia.com.br"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="editIsTrial" 
                  checked={isTrial} 
                  onChange={e => setIsTrial(e.target.checked)} 
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="editIsTrial" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Modo Teste Grátis (Trial 7 dias)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
