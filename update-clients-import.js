import fs from 'fs';

let content = fs.readFileSync('src/components/clients/ClientsView.tsx', 'utf8');

if (!content.includes('import { ClientDetail }')) {
  content = content.replace("import { Client } from '../../types';", "import { Client } from '../../types';\nimport { ClientDetail } from './ClientDetail';");
  
  const oldDetailView = `    return (
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-6 pb-0 flex items-center justify-between">
          <div>
             <button onClick={() => setSelectedClientId(null)} className="text-xs font-bold text-slate-500 hover:text-purple-600 flex items-center gap-1 mb-2">
               &larr; Voltar para lista
             </button>
             <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
               {client.name}
               <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Ativo</span>
             </h3>
          </div>
        </div>

        {/* Client Detail Tabs Implementation pending... */}
        <div className="p-6">
           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
              <p className="text-sm text-slate-500">Tabs: Cadastro | Arquivos | Senhas | Notas Fiscais | Briefing</p>
              <p className="text-xs mt-2 text-slate-400">(Módulo em construção)</p>
           </div>
        </div>
      </div>
    );`;
    
  const newDetailView = `    return <ClientDetail client={client} onBack={() => setSelectedClientId(null)} />;`;
  
  content = content.replace(oldDetailView, newDetailView);
  
  fs.writeFileSync('src/components/clients/ClientsView.tsx', content);
}
