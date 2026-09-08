import React from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateTimeFormat, safeDateFormat } from '../../lib/utils';
import { 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Share2, 
  Instagram, 
  Linkedin, 
  Check, 
  Layers 
} from 'lucide-react';
import { PlatformBadge, StatusBadge, FormatBadge } from '../common/Badges';
import { Client } from '../../types';

export const PublicationsView: React.FC = () => {
  const { jobs, clients, setSelectedJob, clientFilter } = usePostfy();

  const displayedJobs = clientFilter === 'all' ? jobs : jobs.filter(j => j.clientId === clientFilter);
  const scheduled = displayedJobs.filter(j => j.status === 'scheduled');
  const published = displayedJobs.filter(j => j.status === 'published');
  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Publicação Automática</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">Fila de Publicações & Conexões</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Motor assíncrono de disparo com verificação de mídia, primeiro comentário e logs de API.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Workers Operando Normalmente
          </span>
        </div>
      </div>

      {/* Network Connections Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
              IG
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Instagram API</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Conectado (Graph API)</span>
            </div>
          </div>
          <Check className="w-4 h-4 text-emerald-500" />
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              IN
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">LinkedIn API</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Conectado (v2)</span>
            </div>
          </div>
          <Check className="w-4 h-4 text-emerald-500" />
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              TT
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">TikTok For Business</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Conectado</span>
            </div>
          </div>
          <Check className="w-4 h-4 text-emerald-500" />
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
              YT
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">YouTube Data API</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Conectado</span>
            </div>
          </div>
          <Check className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      {/* Scheduled Queue */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Fila de Disparos Agendados</h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {scheduled.length} posts na fila
          </span>
        </div>

        {scheduled.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Nenhuma publicação agendada na fila no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scheduled.map(job => {
              const client = clientMap.get(job.clientId);

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 dark:bg-slate-950/70 p-2 rounded-xl transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {job.mediaUrls && job.mediaUrls.length > 0 && (
                      <img src={job.mediaUrls[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}</span>
                        <PlatformBadge platform={job.platform} />
                        <FormatBadge format={job.format} />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">{job.title}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="font-mono font-bold text-purple-600 block">
                        {safeDateTimeFormat(job.scheduledDate)}
                      </span>
                      <span className="text-[10px] text-slate-400">Primeiro comentário incluso</span>
                    </div>
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Published History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Histórico de Publicações Realizadas com Sucesso</h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {published.length} publicações confirmadas
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {published.map(job => {
            const client = clientMap.get(job.clientId);

            return (
              <div key={job.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={job.platform} showLabel={false} />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}: </span>
                    <span className="text-slate-700 dark:text-slate-300">{job.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    Postado em {safeDateFormat(job.scheduledDate)}
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                    200 OK
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
