import React from 'react';
import { Building2 } from 'lucide-react';
import { usePostfy } from '../../../context/PostfyContext';

export const SettingsOverview: React.FC = () => {
  const { currentUser, currentWorkspace } = usePostfy();
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          Dados da Conta
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Usuário</label>
            <input type="text" defaultValue={currentUser.name} className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail Corporativo</label>
            <input type="email" defaultValue={currentUser.email} disabled className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Celular (WhatsApp)</label>
            <input type="text" defaultValue="(11) 99999-9999" className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Empresa / Workspace</label>
            <input type="text" defaultValue={currentWorkspace.name} className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">CPF/CNPJ</label>
            <input type="text" placeholder="00.000.000/0001-00" className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Data de Registro</label>
            <input type="text" defaultValue="01/01/2026" disabled className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed" />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button className="px-5 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-purple-700 transition">
            Atualizar Perfil
          </button>
        </div>
      </div>
    </div>
  );
};
