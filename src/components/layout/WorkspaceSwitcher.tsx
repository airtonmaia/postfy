import React from 'react';
import { ChevronDown, CheckCircle2, Plus } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';

export const WorkspaceSwitcher: React.FC = () => {
  const { currentWorkspace, setCurrentWorkspace, workspaces } = usePostfy();

  return (
    <div className="relative group z-50">
      <button 
        className="w-full sm:w-auto flex items-center justify-between gap-3 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          {currentWorkspace.logo ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0 shadow-xs">
              <img 
                src={currentWorkspace.logo} 
                alt={currentWorkspace.name} 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm text-xs shrink-0"
              style={{ backgroundColor: currentWorkspace.primaryColor || '#9333ea' }}
            >
              {currentWorkspace.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 text-left hidden sm:block">
            <h1 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight truncate w-32">
              {currentWorkspace.name}
            </h1>
            <span className="text-[9px] uppercase text-slate-500 dark:text-slate-400 block truncate">
              Workspace da agência
            </span>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors hidden sm:block" />
      </button>

      {/* Dropdown Menu */}
      <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1 w-64 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Suas Contas
          </div>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => setCurrentWorkspace(ws)}
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition cursor-pointer ${
                ws.id === currentWorkspace.id ? 'bg-purple-50/50 dark:bg-purple-900/20' : ''
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
              <span className={`text-xs truncate flex-1 ${
                ws.id === currentWorkspace.id ? 'font-bold text-purple-700 dark:text-purple-400' : 'font-medium text-slate-700 dark:text-slate-300'
              }`}>
                {ws.name}
              </span>
              {ws.id === currentWorkspace.id && (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              )}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            Criar novo workspace
          </button>
        </div>
      </div>
    </div>
  );
};
