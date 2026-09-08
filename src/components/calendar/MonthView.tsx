import React from 'react';
import { Plus, MoreHorizontal, Clock, Sparkles } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { safeTimeFormat } from '../../lib/utils';
import { Job, Client } from '../../types';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';

interface MonthViewProps {
  currentDate: Date;
}

export const MonthView: React.FC<MonthViewProps> = ({ currentDate }) => {
  const { 
    jobs, 
    clients, 
    clientFilter, 
    platformFilter, 
    statusFilter, 
    setSelectedJob, 
    openCreateJobModal 
  } = usePostfy();

  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDaysCount = new Date(year, month, 0).getDate();

  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (clientFilter !== 'all' && job.clientId !== clientFilter) return false;
    if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    return true;
  });

  // Helper to test if a job falls on a given date (based on scheduledDate or deadlineProduction)
  const getJobsForDate = (dateObj: Date): Job[] => {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();

    return filteredJobs.filter(job => {
      const targetDate = new Date(job.scheduledDate || job.deadlineProduction);
      return (
        targetDate.getFullYear() === y &&
        targetDate.getMonth() === m &&
        targetDate.getDate() === d
      );
    });
  };

  const today = new Date();
  const isDateToday = (dateObj: Date) => {
    return (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    );
  };

  // Build grid items
  const gridCells = [];
  for (let i = 0; i < totalCells; i++) {
    let cellDate: Date;
    let isCurrentMonth = true;

    if (i < firstDayIndex) {
      // Days from previous month
      const dayNum = prevMonthDaysCount - (firstDayIndex - 1 - i);
      cellDate = new Date(year, month - 1, dayNum);
      isCurrentMonth = false;
    } else if (i >= firstDayIndex + daysInMonth) {
      // Days from next month
      const dayNum = i - (firstDayIndex + daysInMonth) + 1;
      cellDate = new Date(year, month + 1, dayNum);
      isCurrentMonth = false;
    } else {
      // Days of current month
      const dayNum = i - firstDayIndex + 1;
      cellDate = new Date(year, month, dayNum);
      isCurrentMonth = true;
    }

    const dayJobs = getJobsForDate(cellDate);
    const todayMatch = isDateToday(cellDate);

    gridCells.push({
      date: cellDate,
      isCurrentMonth,
      todayMatch,
      jobs: dayJobs
    });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 py-2.5">
        {daysOfWeek.map((day, idx) => (
          <div key={day} className={`tracking-wide uppercase text-[11px] ${idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 gap-[1px] bg-slate-200 min-h-[600px] overflow-y-auto">
        {gridCells.map((cell, index) => {
          const dateISO = cell.date.toISOString();
          const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

          return (
            <div
              key={index}
              onClick={(e) => {
                // If clicked on empty space of the cell
                if (e.target === e.currentTarget) {
                  openCreateJobModal(dateISO);
                }
              }}
              className={`group relative flex flex-col p-1.5 transition min-h-[110px] md:min-h-[125px] overflow-hidden ${
                cell.isCurrentMonth ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-950/70' : 'bg-slate-50 dark:bg-slate-950/60 text-slate-400'
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-1 pointer-events-none">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition ${
                    cell.todayMatch
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : cell.isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>

                {/* Quick Add button on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreateJobModal(dateISO);
                  }}
                  className="opacity-0 group-hover:opacity-100 pointer-events-auto p-1 rounded hover:bg-slate-200 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition cursor-pointer"
                  title="Novo conteúdo nesta data"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Jobs inside day */}
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                {cell.jobs.slice(0, 3).map(job => {
                  const client = clientMap.get(job.clientId);
                  const scheduledTime = safeTimeFormat(job.scheduledDate);

                  return (
                    <div
                      key={job.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedJob(job);
                      }}
                      className="group/card relative bg-white dark:bg-slate-900 hover:bg-purple-50/40 border border-slate-200 dark:border-slate-800 hover:border-purple-300 rounded-lg p-1.5 shadow-xs transition-all cursor-pointer hover:shadow-sm"
                    >
                      {/* Top line: Platform icon + Time + Client tag */}
                      <div className="flex items-center justify-between gap-1 mb-1 text-[10px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                          <span className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {client?.name.split(' ')[0] || 'Cliente'}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[9px] shrink-0">
                          {scheduledTime}
                        </span>
                      </div>

                      {/* Content preview: Thumbnail if available + Title */}
                      <div className="flex items-center gap-1.5">
                        {job.mediaUrls && job.mediaUrls.length > 0 && (
                          <img
                            src={job.mediaUrls[0]}
                            alt=""
                            className="w-6 h-6 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                          />
                        )}
                        <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-1 group-hover/card:text-purple-900 leading-tight">
                          {job.title}
                        </p>
                      </div>

                      {/* Status indicator bar / pill */}
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <FormatBadge format={job.format} />
                        <StatusBadge status={job.status} size="sm" />
                      </div>
                    </div>
                  );
                })}

                {/* Overflow count */}
                {cell.jobs.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Show all jobs for that date in detail
                      openCreateJobModal(dateISO);
                    }}
                    className="w-full text-center py-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition"
                  >
                    +{cell.jobs.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
