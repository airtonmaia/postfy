import React, { useState } from 'react';
import { usePostfy } from '../../../context/PostfyContext';
import { 
  Users, Plus, Mail, Shield, Check, Trash2, CheckCircle2, UserCheck, X 
} from 'lucide-react';
import { User } from '../../../types';

export const SettingsUsers: React.FC = () => {
  const { users } = usePostfy();
  const [userList, setUserList] = useState<User[]>(users);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<User['role']>('designer');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newUser: User = {
      id: `u-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80`,
      role,
      workspaceId: 'ws-1'
    };

    setUserList(prev => [...prev, newUser]);
    setName('');
    setEmail('');
    setShowInviteModal(false);
    setFeedback(`Convite enviado com sucesso para ${email}!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const getRoleBadge = (r: User['role']) => {
    switch (r) {
      case 'admin':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Administrador</span>;
      case 'designer':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Designer</span>;
      case 'copywriter':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Copywriter</span>;
      case 'social_media':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">Social Media</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">Membro</span>;
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            Membros da Agência ({userList.length})
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie os acessos e permissões dos profissionais da sua equipe.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Convidar Membro
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
        {userList.map(user => (
          <div key={user.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img 
                src={user.avatar} 
                alt="" 
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-xs" 
              />
              <div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                  {user.name}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                  {user.email}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {getRoleBadge(user.role)}
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hidden sm:inline-block">
                Ativo
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Matrix Info Card */}
      <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-5 space-y-2">
        <h5 className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
          Hierarquia de Permissões
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
          <div>
            <strong className="text-purple-700 dark:text-purple-400">Administrador:</strong> Acesso irrestrito a configurações, dados financeiros, cobranças e clientes.
          </div>
          <div>
            <strong className="text-blue-700 dark:text-blue-400">Designer / Copywriter:</strong> Acesso à produção de conteúdo, upload de criativos e kanban da pauta.
          </div>
          <div>
            <strong className="text-teal-700 dark:text-teal-400">Social Media:</strong> Criação de pautas, agendamento de posts e envio para aprovação.
          </div>
          <div>
            <strong className="text-slate-700 dark:text-slate-300">Cliente (Portal):</strong> Visualização apenas dos próprios posts, aprovações, notas e briefing.
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleInvite} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Convidar Novo Membro da Agência</h4>
              <button 
                type="button" 
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Lucas Mendes"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail Profissional</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="lucas@agencia.com.br"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Função / Perfil de Acesso</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="designer">Designer (Produção Visual)</option>
                <option value="copywriter">Copywriter (Textos & Roteiros)</option>
                <option value="social_media">Social Media (Pauta & Agendamento)</option>
                <option value="admin">Administrador (Total)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Enviar Convite
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
