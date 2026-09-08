import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { X, LogOut, ShieldCheck, Building2, Mail, RefreshCw, CloudOff, Cloud } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROTULO_PAPEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gestor',
  social_media: 'Social Media',
  designer: 'Designer',
  copywriter: 'Copywriter',
  financial: 'Financeiro',
  client: 'Cliente',
};

/**
 * Painel da conta.
 *
 * Antes esta modal permitia trocar o próprio papel ("Acesso Total", "Cliente",
 * etc.) com um clique e exibia "Login realizado com sucesso via Firebase" sem
 * autenticar nada. Trocar o próprio papel no cliente é escalonamento de
 * privilégio, então a função saiu: o papel vem da sessão do servidor.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, currentWorkspace, logout, syncState, syncError, forceSync } = usePostfy();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!isOpen) return null;

  const sincronizar = async () => {
    setOcupado(true);
    setMensagem(null);
    const res = await forceSync();
    setMensagem(res.message);
    setOcupado(false);
    setTimeout(() => setMensagem(null), 4000);
  };

  const sair = async () => {
    setOcupado(true);
    await logout();
    setOcupado(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Sua conta</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sessão autenticada no servidor
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
              {(currentUser?.name || '?').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentUser?.name || 'Sem sessão'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <Mail className="w-3 h-3 shrink-0" />
                {currentUser?.email || '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Papel
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                {ROTULO_PAPEL[currentUser?.role] || currentUser?.role || '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Agência
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {currentWorkspace?.name || '—'}
              </p>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              syncState === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {syncState === 'error' ? (
              <CloudOff className="w-4 h-4 shrink-0" />
            ) : (
              <Cloud className="w-4 h-4 shrink-0" />
            )}
            <span className="font-medium">
              {syncState === 'error'
                ? syncError || 'Falha de sincronização.'
                : syncState === 'saving'
                ? 'Salvando no servidor...'
                : syncState === 'loading'
                ? 'Carregando dados do servidor...'
                : 'Dados sincronizados com o servidor.'}
            </span>
          </div>

          {mensagem && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {mensagem}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={sincronizar}
              disabled={ocupado}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ocupado ? 'animate-spin' : ''}`} />
              Sincronizar agora
            </button>
            <button
              onClick={sair}
              disabled={ocupado}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
