import fs from 'fs';

let content = fs.readFileSync('src/components/clients/ClientsView.tsx', 'utf8');

// We will add a state: `const [selectedClientId, setSelectedClientId] = useState<string | null>(null);`
// And if selectedClientId is set, render the Client Detail View instead of the grid.
content = content.replace(
  'const [monthlyValue, setMonthlyValue] = useState(4500);',
  `const [monthlyValue, setMonthlyValue] = useState(4500);\n  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);`
);

// We need to inject the detailed view
const clientDetailView = `
  if (selectedClientId) {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return null;

    return (
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
    );
  }
`;

content = content.replace(
  '  return (\n    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">',
  clientDetailView + '\n  return (\n    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">'
);

const actionButtonsOld = `              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setClientFilter(client.id);
                    setActiveTab('calendario');
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-purple-600 transition"`;

const actionButtonsNew = `              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedClientId(client.id)}
                  className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 transition"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Abrir Perfil
                </button>
                <button
                  onClick={() => {
                    setClientFilter(client.id);
                    setActiveTab('calendario');
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-purple-600 transition"`;

content = content.replace(actionButtonsOld, actionButtonsNew);

fs.writeFileSync('src/components/clients/ClientsView.tsx', content);

