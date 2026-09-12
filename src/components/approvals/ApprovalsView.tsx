import React, { useState } from 'react';
import { urlDoPortalDaAgencia } from '../../lib/rotas';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateTimeFormat, copyToClipboard } from '../../lib/utils';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Copy, 
  ExternalLink, 
  Share2, 
  Check, 
  ArrowRight,
  Send,
  MessageSquare
} from 'lucide-react';
import { Job, Client } from '../../types';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';

export const ApprovalsView: React.FC = () => {
  const { 
    jobs, 
    clients, 
    approveJob, 
    requestAdjustment, 
    setSelectedJob, 
    openClientPortal,
    clientFilter,
    currentWorkspace,
  } = usePostfy();

  const [activeTab, setActiveTab] = useState<'pending' | 'adjustments' | 'approved'>('pending');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const displayedJobs = clientFilter === 'all'
    ? jobs
    : jobs.filter(j => j.clientId === clientFilter);

  const pendingApprovalJobs = displayedJobs.filter(j => j.status === 'for_approval');
  const inAdjustmentJobs = displayedJobs.filter(j => j.status === 'in_adjustment');
  const approvedJobs = displayedJobs.filter(j => j.status === 'approved' || j.status === 'scheduled');

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  const handleCopyLink = async (job: Job) => {
    // Mesmo conserto do JobDetailModal: o id do cliente não é o token do
    // portal, e o link antigo abria numa tela vazia.
    const link = urlDoPortalDaAgencia(currentWorkspace.slug, window.location.origin);
    await copyToClipboard(link);
    setCopiedId(job.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApproveAll = () => {
    if (pendingApprovalJobs.length === 0) return;
    if (confirm(`Deseja aprovar todos os ${pendingApprovalJobs.length} conteúdos pendentes em lote?`)) {
      pendingApprovalJobs.forEach(j => approveJob(j.id, 'Aprovação em Lote Gestor'));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Central de Aprovação</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            Aprovações & Feedback dos Clientes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Controle revisões, histórico de solicitações de ajuste e libere posts para publicação.
          </p>
        </div>

        {pendingApprovalJobs.length > 0 && (
          <Button variant="success"
            onClick={handleApproveAll}

          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovar Todos em Lote ({pendingApprovalJobs.length})
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 rounded-t-xl">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'pending'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          Aguardando Cliente ({pendingApprovalJobs.length})
        </button>

        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'adjustments'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-500" />
          Pedidos de Ajuste ({inAdjustmentJobs.length})
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'approved'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Aprovados / Prontos ({approvedJobs.length})
        </button>
      </div>

      {/* Content List */}
      <div className="space-y-4">
        {activeTab === 'pending' && (
          pendingApprovalJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum conteúdo aguardando aprovação no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pendingApprovalJobs.map(job => {
                const client = clientMap.get(job.clientId);

                return (
                  <div key={job.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar nome={client?.name || 'Cliente'} url={client?.avatar} tamanho={24} />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{client?.name}</span>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          v{job.currentVersion}
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        {job.mediaUrls && job.mediaUrls.length > 0 && (
                          <img src={job.mediaUrls[0]} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0" />
                        )}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PlatformBadge platform={job.platform} />
                            <FormatBadge format={job.format} />
                          </div>
                          <h4 
                            onClick={() => setSelectedJob(job)} 
                            className="text-sm font-bold text-slate-900 dark:text-white hover:text-purple-600 transition cursor-pointer leading-snug truncate"
                          >
                            {job.title}
                          </h4>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg">
                        {job.caption}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <Button variant="ghost"
                        onClick={() => handleCopyLink(job)}
                        className="dark:bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedId === job.id ? 'Link Copiado!' : 'Copiar Link'}</span>
                      </Button>

                      <div className="flex items-center gap-2">
                        {client && (
                          <Button variant="soft"
                            onClick={() => openClientPortal(client.id)}
                            className="text-purple-600"
                          >
                            Portal
                          </Button>
                        )}

                        <Button variant="success"
                          onClick={() => approveJob(job.id, 'Gestor da Agência')}

                        >
                          <Check className="w-3.5 h-3.5" />
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'adjustments' && (
          inAdjustmentJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum pedido de ajuste em aberto.
            </div>
          ) : (
            <div className="space-y-3">
              {inAdjustmentJobs.map(job => {
                const client = clientMap.get(job.clientId);

                return (
                  <div key={job.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{client?.name}</span>
                        <PlatformBadge platform={job.platform} />
                        <FormatBadge format={job.format} />
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white" onClick={() => setSelectedJob(job)}>
                        {job.title}
                      </h4>

                      {job.lastFeedback && (
                        <div className="text-xs bg-rose-50 text-rose-800 p-3 rounded-xl border border-rose-200 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Motivo do ajuste solicitado:</strong> {job.lastFeedback}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => setSelectedJob(job)}
                      className="shrink-0"
                    >
                      Subir Nova Versão
                    </Button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'approved' && (
          <div className="space-y-3">
            {approvedJobs.map(job => {
              const client = clientMap.get(job.clientId);

              return (
                <div key={job.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    {job.mediaUrls && job.mediaUrls.length > 0 && (
                      <img src={job.mediaUrls[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}</span>
                        <PlatformBadge platform={job.platform} showLabel={false} />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white block">{job.title}</span>
                      <span className="text-[11px] text-slate-400">
                        Agendado para: {safeDateTimeFormat(job.scheduledDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <Button variant="soft" size="icon-sm"
                      onClick={() => setSelectedJob(job)}
                      className="text-slate-400 hover:text-purple-600"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
