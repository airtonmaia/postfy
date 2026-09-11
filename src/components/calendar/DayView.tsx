import React from 'react';
import { chaveDoDia, diaNoFuso } from '../../lib/fusoHorario';
import { usePostfy } from '../../context/PostfyContext';
import { safeTimeFormat } from '../../lib/utils';
import { PlatformBadge, FormatBadge, StatusBadge, PriorityBadge } from '../common/Badges';
import { Plus, Clock, CheckCircle2, MessageSquare, AlertCircle, ArrowRight } from 'lucide-react';
import { Job, Client } from '../../types';
import { Avatar } from '../common/Avatar';

interface DayViewProps {
  currentDate: Date;
}

export const DayView: React.FC<DayViewProps> = ({ currentDate }) => {
  const { 
    jobs, 
    clients, 
    clientFilter, 
    platformFilter, 
    statusFilter, 
    setSelectedJob, 
    openCreateJobModal,
    approveJob,
    moveJobStatus
  } = usePostfy();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(currentDate);

  // Filter jobs for this day
  const dayJobs = jobs.filter(job => {
    if (clientFilter !== 'all' && job.clientId !== clientFilter) return false;
    if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;

    // Pelo dia da agência, não pelo do dispositivo — ver MonthView.
    return (
      diaNoFuso(job.scheduledDate || job.deadlineProduction) ===
      chaveDoDia(year, month, day)
    );
  }).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6">
      {/* Day Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Pauta Diária</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white capitalize mt-0.5">
            {formattedDate}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {dayJobs.length === 0 
              ? 'Nenhum conteúdo agendado para esta data.' 
              : `${dayJobs.length} postagens planejadas para este dia.`}
          </p>
        </div>

        <button
          onClick={() => openCreateJobModal(currentDate.toISOString())}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Conteúdo</span>
        </button>
      </div>

      {/* Day Content Timeline */}
      {dayJobs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 text-center p-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Dia Livre de Publicações</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
            Aproveite para planejar novas pautas ou adiantar produções da semana.
          </p>
          <button
            onClick={() => openCreateJobModal(currentDate.toISOString())}
            className="text-xs font-semibold text-purple-600 hover:text-purple-800 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 transition"
          >
            + Agendar Post para Hoje
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dayJobs.map(job => {
            const client = clientMap.get(job.clientId);
            const timeStr = safeTimeFormat(job.scheduledDate);

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-purple-300 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
              >
                {/* Left: Time & Client */}
                <div className="flex items-start gap-4">
                  <div className="text-center shrink-0 w-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-lg py-2">
                    <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white">{timeStr}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Horário</span>
                  </div>

                  {job.mediaUrls && job.mediaUrls.length > 0 && (
                    <img
                      src={job.mediaUrls[0]}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                    />
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Avatar nome={client?.name || 'Cliente'} url={client?.avatar} tamanho={16} />
                        {client?.name}
                      </span>
                      <PlatformBadge platform={job.platform} />
                      <FormatBadge format={job.format} />
                      <StatusBadge status={job.status} />
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white hover:text-purple-600 transition cursor-pointer" onClick={() => setSelectedJob(job)}>
                      {job.title}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xl">
                      {job.caption || 'Sem legenda cadastrada.'}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {job.status === 'for_approval' && (
                    <button
                      onClick={() => approveJob(job.id, 'Gestor da Agência')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprovar
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedJob(job)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition"
                  >
                    Ver Detalhes
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
