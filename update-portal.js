import fs from 'fs';

let content = fs.readFileSync('src/components/portal/ClientPortalView.tsx', 'utf8');

// Add the icons for the new tabs
if (!content.includes('Key,') && !content.includes('Receipt,')) {
  content = content.replace(
    'import { \n  CheckCircle2,',
    'import { \n  CheckCircle2,\n  Key,\n  Receipt,\n  FolderOpen,'
  );
}

// Update activeTab state
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'approvals' | 'calendar' | 'files'>('approvals');",
  "const [activeTab, setActiveTab] = useState<'approvals' | 'arquivos' | 'senhas' | 'notas' | 'briefing'>('approvals');"
);

// We need to find the Top Navigation for the portal and replace the tabs
const topNavOldRegex = /\{?\/\*\s*Top Navigation\s*\*\/\}[\s\S]*?(?=<div className="max-w-7xl)/;

const newTabsCode = `
      {/* Top Navigation */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white shadow-sm shadow-purple-600/20">
                {currentWorkspace.name.substring(0,1)}
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                  {currentWorkspace.name} <span className="font-normal text-slate-500">| Portal do Cliente</span>
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{client.name}</p>
              </div>
            </div>
            <button 
              onClick={closeClientPortal}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Sair do Portal
            </button>
          </div>

          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('approvals')}
              className={\`pb-3 pt-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap \${
                activeTab === 'approvals' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Aprovações
              {pendingApprovals.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('arquivos')}
              className={\`pb-3 pt-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap \${
                activeTab === 'arquivos' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              <FolderOpen className="w-4 h-4" />
              Arquivos
            </button>
            <button
              onClick={() => setActiveTab('senhas')}
              className={\`pb-3 pt-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap \${
                activeTab === 'senhas' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              <Key className="w-4 h-4" />
              Senhas
            </button>
            <button
              onClick={() => setActiveTab('notas')}
              className={\`pb-3 pt-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap \${
                activeTab === 'notas' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              <Receipt className="w-4 h-4" />
              Notas Fiscais
            </button>
            <button
              onClick={() => setActiveTab('briefing')}
              className={\`pb-3 pt-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap \${
                activeTab === 'briefing' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              <FileText className="w-4 h-4" />
              Briefing
            </button>
          </div>
        </div>
      </div>
`;

content = content.replace(topNavOldRegex, newTabsCode);

// Add content for the new tabs below the main "approvals" content
const newTabContents = `

        {activeTab === 'arquivos' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-3xl mx-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Seus Arquivos</h4>
            <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><FolderOpen className="w-5 h-5"/></div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">Google Drive (Imagens Brutas)</span>
                    <span className="text-xs text-slate-500">Compartilhado pela agência</span>
                  </div>
               </div>
               <a href="#" className="text-xs font-bold text-purple-600 hover:underline">Acessar Pasta</a>
            </div>
          </div>
        )}

        {activeTab === 'senhas' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-2xl mx-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Cofre de Senhas Compartilhadas</h4>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 font-mono text-sm">
               <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                 <span className="font-bold text-slate-700 dark:text-slate-300">Instagram (@{client.name.toLowerCase().replace(/\s/g,'')})</span>
                 <span className="text-slate-500">Senha: ***********</span>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'notas' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs mx-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Notas Fiscais</h4>
            <p className="text-xs text-slate-500 text-center py-10">Nenhuma nota fiscal disponível no momento.</p>
          </div>
        )}

        {activeTab === 'briefing' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-4xl mx-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Seu Briefing</h4>
            <div className="p-4 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
               {client.notes || "O seu briefing está sendo revisado pela nossa equipe."}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
`;

// Replace the end of the file to include these tabs
const endOfFileRegex = /<\/div>\s*<\/div>\s*\);\s*}\s*;\s*$/;
content = content.replace(endOfFileRegex, newTabContents);

fs.writeFileSync('src/components/portal/ClientPortalView.tsx', content);

