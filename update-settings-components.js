import fs from 'fs';

// We'll create separate files for the components

const SettingsWhitelabel = `import React from 'react';
import { Paintbrush } from 'lucide-react';

export const SettingsWhitelabel: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Paintbrush className="w-4 h-4 text-purple-600" />
          Whitelabel e Identidade
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Logo da Agência (URL)</label>
            <input type="text" placeholder="https://..." className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Favicon (URL)</label>
            <input type="text" placeholder="https://..." className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cor Primária (Hex)</label>
            <div className="flex gap-2">
              <input type="color" defaultValue="#9333ea" className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700" />
              <input type="text" defaultValue="#9333ea" className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white uppercase font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cor Secundária (Hex)</label>
            <div className="flex gap-2">
              <input type="color" defaultValue="#4f46e5" className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700" />
              <input type="text" defaultValue="#4f46e5" className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white uppercase font-mono" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link Customizado (Aprovação de Clientes)</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-300 dark:border-slate-700 rounded-l-lg">
                https://
              </span>
              <input type="text" defaultValue="portal.suaagencia.com.br" className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-none rounded-r-lg bg-transparent text-slate-900 dark:text-white font-mono" />
            </div>
            <p className="mt-1 text-xs text-slate-500">Conecte seu domínio próprio e tenha uma experiência 100% customizável.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button className="px-5 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-purple-700 transition">
            Salvar Identidade
          </button>
        </div>
      </div>
    </div>
  );
};
`;

fs.writeFileSync('src/components/settings/tabs/SettingsWhitelabel.tsx', SettingsWhitelabel);

const SettingsOverview = `import React from 'react';
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
`;
fs.writeFileSync('src/components/settings/tabs/SettingsOverview.tsx', SettingsOverview);


const SettingsIntegrations = `import React from 'react';
import { Link } from 'lucide-react';

export const SettingsIntegrations: React.FC = () => {
  const integrations = [
    { name: 'API do Sistema', status: 'Conectado', desc: 'Acesso via Bearer token' },
    { name: 'WhatsApp', status: 'Desconectado', desc: 'Notificações via WhatsApp' },
    { name: 'Zapier', status: 'Desconectado', desc: 'Integrações com +5000 apps' },
    { name: 'Google Drive', status: 'Conectado', desc: 'Armazenamento de assets' },
    { name: 'Canva', status: 'Desconectado', desc: 'Importação direta de designs' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Link className="w-4 h-4 text-purple-600" />
          Integrações
        </h4>
        <div className="space-y-4">
          {integrations.map((int, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
               <div>
                 <span className="text-sm font-bold text-slate-900 dark:text-white block">{int.name}</span>
                 <span className="text-xs text-slate-500">{int.desc}</span>
               </div>
               <button className={\`text-xs font-bold px-4 py-1.5 rounded-lg \${
                 int.status === 'Conectado' 
                 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                 : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
               }\`}>
                 {int.status === 'Conectado' ? 'Gerenciar' : 'Conectar'}
               </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
`;
fs.writeFileSync('src/components/settings/tabs/SettingsIntegrations.tsx', SettingsIntegrations);

