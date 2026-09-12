import React, { useState } from 'react';
import { ChevronDown, CheckCircle2, Plus } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';

export const WorkspaceSwitcher: React.FC = () => {
  const { currentWorkspace, setCurrentWorkspace, workspaces, setIsCreateWorkspaceModalOpen, isPlatformAdmin } = usePostfy();
  const [isOpen, setIsOpen] = useState(false);

  // Vinha de `role === 'owner' || email.includes('airtonmaiamt')`. As duas
  // metades estavam erradas: `owner` é o papel de quem cria qualquer agência,
  // e a checagem de e-mail casava por substring — airtonmaiamt@outrodominio
  // virava super admin. Agora vem da tabela platform_admins.
  const isSuperAdmin = isPlatformAdmin;

  // A lista já chega recortada pela RLS: `workspaces` só traz as agências das
  // quais a pessoa é membro (ou todas, para o admin da plataforma).
  //
  // Havia um filtro extra aqui, por `currentUser.workspaceId`, que reduzia a
  // lista à agência do login: quem era membro de três agências enxergava uma
  // só, e não tinha como chegar nas outras. `currentUser.workspaceId` é a
  // agência em que a sessão começou, não o conjunto ao qual a pessoa pertence.
  const visibleWorkspaces = workspaces;

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {currentWorkspace?.logo ? (
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0 shadow-xs">
              <img
                src={currentWorkspace.logo}
                alt={currentWorkspace.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm text-xs shrink-0"
              style={{ backgroundColor: currentWorkspace?.primaryColor || '#9333ea' }}
            >
              {(currentWorkspace?.name || 'Agência').substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 text-left">
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {currentWorkspace?.name || 'Minha Agência'}
            </h1>
            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 block truncate">
              {currentWorkspace?.isTrial ? '✨ Teste Grátis (7 dias)' : (isSuperAdmin ? '👑 Super Admin' : 'Workspace')}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 min-w-56 z-50 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>{isSuperAdmin ? 'Todas as Agências (Super Admin)' : 'Sua Agência'}</span>
                {isSuperAdmin && <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-bold">Admin</span>}
              </div>
              {visibleWorkspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setCurrentWorkspace(ws);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition cursor-pointer ${
                    ws.id === currentWorkspace?.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''
                  }`}
                >
                  {ws.logo ? (
                    <div className="w-6 h-6 rounded-md overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-0.5 shrink-0">
                      <img src={ws.logo} alt={ws.name} className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div 
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: ws.primaryColor || '#9333ea' }}
                    >
                      {ws.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs truncate block ${
                      ws.id === currentWorkspace?.id ? 'font-bold text-indigo-700 dark:text-indigo-400' : 'font-medium text-slate-700 dark:text-slate-300'
                    }`}>
                      {ws.name}
                    </span>
                    {ws.isTrial && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium block">
                        Teste Grátis (7d)
                      </span>
                    )}
                  </div>
                  {ws.id === currentWorkspace?.id && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <Button variant="ghost" 
                onClick={() => {
                  setIsCreateWorkspaceModalOpen(true);
                  setIsOpen(false);
                }}
                className="w-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/35"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar novo workspace
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
