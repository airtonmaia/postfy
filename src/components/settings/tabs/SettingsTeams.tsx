import React, { useState } from 'react';
import { usePostfy } from '../../../context/PostfyContext';
import { useServerCollection } from '../../../lib/useServerCollection';
import { 
  Shield, Users, Plus, Check, Trash2, CheckCircle2, Building2, Briefcase, X 
} from 'lucide-react';

interface Squad {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  clientIds: string[];
  color: string;
}

export const SettingsTeams: React.FC = () => {
  const { users, clients } = usePostfy();

  // Squads persistidos no servidor. Antes viviam num useState local e
  // desapareciam no recarregamento da página.
  const SQUADS_PADRAO: Squad[] = [
    {
      id: 'sq-1',
      name: 'Squad Retail & Gastronomia',
      leaderId: 'u-1',
      memberIds: ['u-1', 'u-2', 'u-4'],
      clientIds: ['c-1'],
      color: 'purple'
    },
    {
      id: 'sq-2',
      name: 'Squad B2B & Fintech',
      leaderId: 'u-3',
      memberIds: ['u-3', 'u-2'],
      clientIds: ['c-2'],
      color: 'blue'
    }
  ];

  const { linhas: squads, salvar: setSquads, erro: erroSquads } = useServerCollection<Squad>(
    'squads',
    SQUADS_PADRAO
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [leaderId, setLeaderId] = useState(users[0]?.id || '');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCreateSquad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadName.trim()) return;

    const newSq: Squad = {
      id: `sq-${Date.now()}`,
      name: squadName.trim(),
      leaderId: leaderId || users[0]?.id || 'u-1',
      memberIds: [leaderId || 'u-1'],
      clientIds: [],
      color: 'teal'
    };

    setSquads(prev => [...prev, newSq]);
    setSquadName('');
    setShowAddModal(false);
    setFeedback(`Equipe "${newSq.name}" criada com sucesso!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      {erroSquads && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium">
          {erroSquads}
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600" />
            Squads & Células de Atendimento ({squads.length})
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize os clientes em equipes multidisciplinares com líderes e metas dedicadas.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Squad
        </button>
      </div>

      {/* Squads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {squads.map(squad => {
          const leader = users.find(u => u.id === squad.leaderId);
          const squadMembers = users.filter(u => squad.memberIds.includes(u.id));
          const squadClients = clients.filter(c => squad.clientIds.includes(c.id));

          return (
            <div 
              key={squad.id} 
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {squad.name}
                  </h5>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200">
                    Célula Ativa
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <span className="block text-[11px] text-slate-400">Líder Operacional:</span>
                  <div className="flex items-center gap-2">
                    <img 
                      src={leader?.avatar} 
                      alt="" 
                      className="w-6 h-6 rounded-full object-cover border border-slate-200" 
                    />
                    <strong className="text-slate-800 dark:text-slate-200">{leader?.name || 'Não definido'}</strong>
                  </div>
                </div>

                {/* Assigned Clients */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Clientes Atendidos ({squadClients.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {squadClients.map(c => (
                      <span 
                        key={c.id} 
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {c.name}
                      </span>
                    ))}
                    {squadClients.length === 0 && (
                      <span className="text-xs text-slate-400 italic">Nenhum cliente associado ainda.</span>
                    )}
                  </div>
                </div>

                {/* Team Members */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Profissionais na Squad ({squadMembers.length})
                  </span>
                  <div className="flex items-center -space-x-2">
                    {squadMembers.map(m => (
                      <img 
                        key={m.id} 
                        src={m.avatar} 
                        title={`${m.name} (${m.role})`}
                        alt="" 
                        className="w-7 h-7 rounded-full object-cover border-2 border-white dark:border-slate-900" 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Squad Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleCreateSquad} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Criar Nova Squad</h4>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Squad</label>
              <input
                type="text"
                required
                value={squadName}
                onChange={e => setSquadName(e.target.value)}
                placeholder="Ex: Squad Saúde & Clínicas"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Líder da Squad</label>
              <select
                value={leaderId}
                onChange={e => setLeaderId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Criar Squad
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
