import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus,
  Instagram,
  Linkedin,
  Video,
  Youtube,
  Clock,
  Sparkles
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { JobPlatform, JobStatus } from '../../types';

interface CalendarSidebarProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
}

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ currentDate, onSelectDate }) => {
  const { 
    clients, 
    clientFilter, 
    setClientFilter, 
    platformFilter, 
    setPlatformFilter,
    statusFilter,
    setStatusFilter,
    openCreateJobModal,
    jobs
  } = usePostfy();

  // Mini-calendar date calculations
  const [miniCalMonth, setMiniCalMonth] = React.useState<Date>(new Date(currentDate));

  const daysOfWeek = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = miniCalMonth.getFullYear();
  const month = miniCalMonth.getMonth();
  const daysInCurrentMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  // Previous month trailing days
  const prevMonthDays = getDaysInMonth(year, month - 1);
  const trailingDays = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    trailingDays.push(prevMonthDays - i);
  }

  // Current month days
  const currentMonthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  // Month title in Portuguese
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMiniMonth = () => {
    setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() - 1, 1));
  };

  const handleNextMiniMonth = () => {
    setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 1));
  };

  const isSelectedDate = (day: number) => {
    return (
      currentDate.getDate() === day &&
      currentDate.getMonth() === month &&
      currentDate.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const platforms: { id: JobPlatform | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Todas Redes', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'instagram', label: 'Instagram', icon: <Instagram className="w-3.5 h-3.5 text-pink-500" /> },
    { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-3.5 h-3.5 text-blue-600" /> },
    { id: 'tiktok', label: 'TikTok', icon: <Video className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" /> },
    { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-3.5 h-3.5 text-red-500" /> },
  ];

  const statuses: { id: JobStatus | 'all'; label: string; color: string }[] = [
    { id: 'all', label: 'Todos os Status', color: 'bg-slate-400' },
    { id: 'for_approval', label: 'Para Aprovação', color: 'bg-amber-500' },
    { id: 'in_adjustment', label: 'Em Ajuste', color: 'bg-rose-500' },
    { id: 'approved', label: 'Aprovados', color: 'bg-emerald-500' },
    { id: 'scheduled', label: 'Agendados', color: 'bg-purple-500' },
    { id: 'published', label: 'Publicados', color: 'bg-teal-600' },
  ];

  // Quick stats
  const scheduledCount = jobs.filter(j => j.status === 'scheduled').length;
  const pendingApprovalCount = jobs.filter(j => j.status === 'for_approval').length;

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 p-4 space-y-6 overflow-y-auto">
      {/* Primary Action Button */}
      <button
        id="btn-sidebar-new-job"
        onClick={() => openCreateJobModal(currentDate.toISOString())}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold rounded-lg shadow-sm shadow-purple-200 transition duration-150 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Novo Conteúdo
      </button>

      {/* Mini Calendar */}
      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            {monthNames[month]} {year}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMiniMonth}
              className="p-1 rounded hover:bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition"
              title="Mês anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextMiniMonth}
              className="p-1 rounded hover:bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition"
              title="Próximo mês"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1">
          {daysOfWeek.map((d, i) => (
            <div key={i} className="py-0.5">{d}</div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {trailingDays.map((d, i) => (
            <div key={`prev-${i}`} className="py-1 text-slate-300 select-none">
              {d}
            </div>
          ))}
          {currentMonthDays.map(day => {
            const selected = isSelectedDate(day);
            const today = isToday(day);
            return (
              <button
                key={`cur-${day}`}
                onClick={() => onSelectDate(new Date(year, month, day))}
                className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs transition cursor-pointer ${
                  selected
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : today
                    ? 'bg-purple-100 text-purple-700 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:bg-slate-900 hover:shadow-xs'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clientes Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <span>Clientes</span>
          {clientFilter !== 'all' && (
            <button
              onClick={() => setClientFilter('all')}
              className="text-[11px] font-normal text-purple-600 hover:underline cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          <button
            onClick={() => setClientFilter('all')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              clientFilter === 'all'
                ? 'bg-purple-50 text-purple-700 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="truncate">Todos os Clientes</span>
          </button>
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => setClientFilter(client.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                clientFilter === client.id
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <img src={client.avatar} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
              <span className="truncate">{client.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Redes Sociais Filter */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Rede Social
        </div>
        <div className="grid grid-cols-1 gap-1">
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatformFilter(p.id)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                platformFilter === p.id
                  ? 'bg-purple-50 text-purple-700 font-semibold border border-purple-200/60'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 border border-transparent'
              }`}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Status de Produção
        </div>
        <div className="space-y-1">
          {statuses.map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                statusFilter === s.id
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Summary Pill */}
      <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-500" />
              Agendados:
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{scheduledCount}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Aguardando Aprovação:
            </span>
            <span className="font-bold text-amber-700">{pendingApprovalCount}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
