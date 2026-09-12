import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Filter,
  Layers,
  Columns,
  List,
  Clock,
  Instagram
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { CalendarViewMode } from '../../types';
import { InstagramGridModal } from './InstagramGridModal';
import { Button } from '../ui/button';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onChangeDate: (date: Date) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrev,
  onNext,
  onToday,
  onChangeDate
}) => {
  const { 
    calendarView, 
    setCalendarView, 
    clients, 
    clientFilter, 
    setClientFilter,
    openCreateJobModal
  } = usePostfy();

  const [isGridModalOpen, setIsGridModalOpen] = useState(false);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentMonthName = monthNames[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  const viewOptions: { id: CalendarViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'month', label: 'Mês', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
    { id: 'week', label: 'Semana', icon: <Columns className="w-3.5 h-3.5" /> },
    { id: 'day', label: 'Dia', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'list', label: 'Lista', icon: <List className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/* Left: Month Navigation & Today */}
      <div className="flex items-center gap-3">
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{currentMonthName}</span>
            <span className="text-slate-400 font-normal text-base">{currentYear}</span>
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <Button size="icon-sm"
            id="btn-cal-prev"
            onClick={onPrev}
            className="hover:bg-white dark:bg-slate-900 dark:text-white"
            title="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm"
            id="btn-cal-today"
            onClick={onToday}
            className="text-slate-700 dark:text-slate-300 hover:bg-white dark:bg-slate-900"
          >
            Hoje
          </Button>
          <Button size="icon-sm"
            id="btn-cal-next"
            onClick={onNext}
            className="hover:bg-white dark:bg-slate-900 dark:text-white"
            title="Próximo"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Right: Client selector, View Switcher & Action button */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Client quick filter */}
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1"
          >
            <option value="all">Todos os Clientes</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* View Switcher: Month, Week, Day, List */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
          {viewOptions.map(view => {
            const isActive = calendarView === view.id;
            return (
              <button
                key={view.id}
                id={`btn-cal-view-${view.id}`}
                onClick={() => setCalendarView(view.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-purple-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                }`}
              >
                {view.icon}
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>

        {/* Instagram Visual Grid Preview Button */}
        <Button
          id="btn-header-instagram-grid"
          onClick={() => setIsGridModalOpen(true)}
          className="bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 hover:opacity-95"
          title="Simulador visual de feed 3x3 do Instagram"
        >
          <Instagram className="w-3.5 h-3.5" />
          <span>Grid Instagram</span>
        </Button>

        {/* Add Content Button */}
        <Button
          id="btn-header-add-content"
          onClick={() => openCreateJobModal(currentDate.toISOString())}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Post</span>
        </Button>
      </div>

      <InstagramGridModal
        isOpen={isGridModalOpen}
        onClose={() => setIsGridModalOpen(false)}
        initialClientId={clientFilter !== 'all' ? clientFilter : undefined}
      />
    </div>
  );
};
