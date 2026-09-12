import React, { useState } from 'react';
import { Building2, Sparkles, X, Check, ShieldCheck, Link2} from 'lucide-react';
import { gerarSlug } from '../../lib/slug';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';

const COLOR_PRESETS = [
  { label: 'Orquesia Indigo', value: '#6366f1' },
  { label: 'Roxo Postfy', value: '#9333ea' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Rosa Vibrante', value: '#f43f5e' },
  { label: 'Laranja Comercial', value: '#f97316' },
  { label: 'Azul Corporativo', value: '#3b82f6' },
];

export const CreateWorkspaceModal: React.FC = () => {
  const { isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen, createWorkspace } = usePostfy();
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [isLoading, setIsLoading] = useState(false);

  if (!isCreateWorkspaceModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // A criação agora vai ao banco; o setTimeout de antes só simulava espera.
    setIsLoading(true);
    try {
      await createWorkspace(name.trim(), primaryColor);
      setName('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Criar Nova Agência</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Novo workspace operacional</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm"
            onClick={() => setIsCreateWorkspaceModalOpen(false)}
            className="w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* 7 days trial notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 dark:text-indigo-200">
              <span className="font-bold block mb-0.5">Teste Grátis de 7 Dias PRO</span>
              Esta nova agência terá acesso completo a todas as funcionalidades de IA, Kanban, aprovações e white-label por 7 dias sem compromisso.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nome da Agência ou Empresa
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Agência Criativa Alpha"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
              required
              autoFocus
            />

            {/* Mesma prévia da tela de cadastro: o endereço do portal sai do
                nome, e quem cria precisa ver isso antes de gravar. */}
            {name.trim() && (
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                <Link2 className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                <span>
                  Portal dos clientes:{' '}
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    /portal-do-cliente?agencia={gerarSlug(name)}
                  </span>
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Cor Principal da Marca (Tema)
            </label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setPrimaryColor(preset.value)}
                  className={`h-10 rounded-xl flex items-center justify-center transition cursor-pointer relative ${
                    primaryColor === preset.value ? 'ring-2 ring-offset-2 ring-indigo-600 scale-105' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                >
                  {primaryColor === preset.value && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline"
              type="button"
              onClick={() => setIsCreateWorkspaceModalOpen(false)}
              className="text-slate-600 dark:text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? 'Criando Agência...' : 'Criar Agência (7 Dias Grátis)'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
