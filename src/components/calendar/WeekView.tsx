import React from 'react';
import { chaveDoDia, diaNoFuso, horaNoFuso } from '../../lib/fusoHorario';
import { usePostfy } from '../../context/PostfyContext';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';
import { Plus } from 'lucide-react';
import { Job, Client } from '../../types';
import { Button } from '../ui/button';

interface WeekViewProps {
  currentDate: Date;
}

export const WeekView: React.FC<WeekViewProps> = ({ currentDate }) => {
  const { 
    jobs, 
    clients, 
    clientFilter, 
    platformFilter, 
    statusFilter, 
    setSelectedJob, 
    openCreateJobModal 
  } = usePostfy();

  // Calculate start of week (Sunday)
  const currentDayOfWeek = currentDate.getDay();
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDayOfWeek);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const hours = [
    '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'
  ];

  const daysLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (clientFilter !== 'all' && job.clientId !== clientFilter) return false;
    if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    return true;
  });

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Week Header */}
      <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
        <div className="p-3 text-xs font-semibold text-slate-400 text-center border-r border-slate-200 dark:border-slate-800">
          Horário
        </div>
        {weekDays.map((date, index) => {
          const todayMatch = isToday(date);
          return (
            <div
              key={index}
              className={`p-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${
                todayMatch ? 'bg-purple-50/50' : ''
              }`}
            >
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {daysLabels[index]}
              </div>
              <div
                className={`w-7 h-7 mx-auto mt-1 flex items-center justify-center rounded-full text-sm font-bold ${
                  todayMatch ? 'bg-purple-600 text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Week Grid Rows */}
      <div className="flex-1">
        {hours.map((hourStr) => {
          const hourNum = parseInt(hourStr.split(':')[0], 10);

          return (
            <div key={hourStr} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800 min-h-[90px]">
              {/* Hour label */}
              <div className="p-2 text-xs font-mono text-slate-400 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                {hourStr}
              </div>

              {/* 7 Days Columns for this hour bucket */}
              {weekDays.map((dayDate, dayIdx) => {
                const dayY = dayDate.getFullYear();
                const dayM = dayDate.getMonth();
                const dayD = dayDate.getDate();

                // Find jobs that match day and hour approximately (hour +/- 1)
                const matchingJobs = filteredJobs.filter(j => {
                  const quando = j.scheduledDate || j.deadlineProduction;
                  // Dia e hora no fuso da agência: `getHours()` punha o post na
                  // faixa errada da grade para quem estivesse em outro fuso.
                  if (diaNoFuso(quando) === chaveDoDia(dayY, dayM, dayD)) {
                    const jHour = horaNoFuso(quando);
                    return jHour >= hourNum && jHour < hourNum + 2;
                  }
                  return false;
                });

                const dateISO = new Date(dayY, dayM, dayD, hourNum, 0).toISOString();

                return (
                  <div
                    key={dayIdx}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        openCreateJobModal(dateISO);
                      }
                    }}
                    className="p-1.5 border-r border-slate-100 dark:border-slate-800 last:border-r-0 hover:bg-slate-50 dark:bg-slate-950/60 transition relative group"
                  >
                    {/* Add button on hover */}
                    <Button size="icon"
                      onClick={() => openCreateJobModal(dateISO)}
                      className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-purple-600"
                      title="Agendar neste horário"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>

                    {/* Jobs in this slot */}
                    <div className="space-y-1.5">
                      {matchingJobs.map(job => {
                        const client = clientMap.get(job.clientId);

                        return (
                          <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className="bg-white dark:bg-slate-900 hover:bg-purple-50/40 border border-slate-200 dark:border-slate-800 hover:border-purple-300 rounded-lg p-2 shadow-xs transition cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                                {client?.name.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 mb-1">
                              {job.title}
                            </p>
                            <div className="flex items-center justify-between gap-1">
                              <FormatBadge format={job.format} />
                              <StatusBadge status={job.status} size="sm" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
