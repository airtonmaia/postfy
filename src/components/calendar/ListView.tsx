import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateFormat, safeTimeFormat } from '../../lib/utils';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';
import { 
  Search, 
  Calendar as CalendarIcon, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { Job, Client } from '../../types';
import { Avatar } from '../common/Avatar';

export const ListView: React.FC = () => {
  const { 
    jobs, 
    clients, 
    clientFilter, 
    platformFilter, 
    statusFilter, 
    setSelectedJob, 
    approveJob 
  } = usePostfy();

  const [searchQuery, setSearchQuery] = useState('');

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (clientFilter !== 'all' && job.clientId !== clientFilter) return false;
    if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = job.title.toLowerCase().includes(q);
      const matchCaption = job.caption.toLowerCase().includes(q);
      const matchCampaign = job.campaign?.toLowerCase().includes(q);
      if (!matchTitle && !matchCaption && !matchCampaign) return false;
    }

    return true;
  }).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6">
      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por título, campanha ou texto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {filteredJobs.length} postagens encontradas
        </span>
      </div>

      {/* List Table / Cards */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            Nenhuma postagem encontrada com os filtros selecionados.
          </div>
        ) : (
          filteredJobs.map(job => {
            const client = clientMap.get(job.clientId);
            const dateStr = safeDateFormat(job.scheduledDate, { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = safeTimeFormat(job.scheduledDate);

            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 p-4 shadow-xs transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer"
              >
                {/* Left: Thumbnail & Client & Details */}
                <div className="flex items-start gap-4 min-w-0">
                  {job.mediaUrls && job.mediaUrls.length > 0 ? (
                    <img
                      src={job.mediaUrls[0]}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <CalendarIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Avatar nome={client?.name || 'Cliente'} url={client?.avatar} tamanho={16} />
                        {client?.name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <PlatformBadge platform={job.platform} />
                      <FormatBadge format={job.format} />
                      <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        v{job.currentVersion}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {job.title}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xl">
                      {job.caption || 'Sem legenda cadastrada.'}
                    </p>
                  </div>
                </div>

                {/* Right: Date, Status & Action */}
                <div className="flex items-center gap-4 shrink-0 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dateStr} às {timeStr}</span>
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={job.status} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {job.status === 'for_approval' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approveJob(job.id, 'Gestor da Agência');
                        }}
                        className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                        title="Aprovar Conteúdo"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    <div className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
