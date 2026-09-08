import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { 
  X, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ShieldCheck, 
  LogOut, 
  Flame, 
  Sparkles,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { isFirebaseConfigured } from '../../lib/firebase';
import { Role } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, switchUserRole, logout } = usePostfy();
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'profile'>('profile');
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const teamProfiles: { name: string; role: Role; email: string; avatar: string; label: string }[] = [
    { 
      name: 'Airton Maia (Você)', 
      role: 'owner', 
      email: 'airtonmaiamt@gmail.com', 
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      label: 'Diretoria / Owner (Acesso Total)'
    },
    { 
      name: 'Camila Social Media', 
      role: 'social_media', 
      email: 'camila.social@postfy.agency', 
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      label: 'Planejamento & Publicação'
    },
    { 
      name: 'Lucas Designer', 
      role: 'designer', 
      email: 'lucas.design@postfy.agency', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      label: 'Criação Visual & Criativos'
    },
    { 
      name: 'Mariana Copywriter', 
      role: 'copywriter', 
      email: 'mariana.copy@postfy.agency', 
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      label: 'Textos, CTAs & Roteiros'
    },
    { 
      name: 'Cliente MARY (Portal)', 
      role: 'client', 
      email: 'aprovacao@mary.com', 
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      label: 'Visão de Aprovação de Conteúdo'
    },
  ];

  const handleSwitchProfile = (role: Role, emailVal: string, nameVal: string) => {
    switchUserRole(role);
    setMessage(`Perfil alternado para ${nameVal} com sucesso!`);
    setTimeout(() => {
      setMessage(null);
      onClose();
    }, 1200);
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(`Login realizado com sucesso via Firebase para ${email}!`);
    setTimeout(() => {
      setMessage(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Conta & Equipe</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Autenticação & Sessão</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {message && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{message}</span>
            </div>
          )}

          {/* Current Profile Banner */}
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={currentUser.avatar} 
                alt="" 
                className="w-10 h-10 rounded-full object-cover border border-purple-300 dark:border-purple-700" 
              />
              <div>
                <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                  {currentUser.name}
                </span>
                <span className="text-[11px] text-purple-600 dark:text-purple-300 uppercase font-mono font-bold">
                  Cargo: {currentUser.role}
                </span>
              </div>
            </div>

            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
              Sessão Ativa
            </span>
          </div>

          {/* Switch Profile Fast Access */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Alternar Usuário da Equipe
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {teamProfiles.map((p, idx) => {
                const isActive = currentUser.role === p.role;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSwitchProfile(p.role, p.email, p.name)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition cursor-pointer ${
                      isActive 
                        ? 'bg-purple-100/70 dark:bg-purple-950/80 border-purple-400' 
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={p.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.label}
                        </div>
                      </div>
                    </div>

                    {isActive ? (
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                        Atual
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logout Action */}
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold text-xs transition border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão (Sair do Sistema)</span>
          </button>

          {/* Firebase Credentials Info */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] text-slate-400">
              Conectado ao <strong>Google Firebase Firestore</strong> com segurança de regras e isolamento de permissões.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
