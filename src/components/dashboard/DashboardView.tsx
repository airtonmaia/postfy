import React, { useRef, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeTimeFormat } from '../../lib/utils';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Users, 
  ArrowUpRight, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { PlatformBadge, StatusBadge, FormatBadge } from '../common/Badges';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';

export const DashboardView: React.FC = () => {
  const { 
    jobs, 
    clients, 
    agencyHealthScore, 
    setSelectedJob, 
    setActiveTab, 
    openCreateJobModal,
    activityLogs,
    clientFilter,
    currentWorkspace
  } = usePostfy();

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
    }
  }, []);

  const primary = currentWorkspace?.primaryColor || '#9333ea';
  const secondary = currentWorkspace?.secondaryColor || '#ea580c';

  const displayedJobs = clientFilter === 'all' 
    ? jobs 
    : jobs.filter(j => j.clientId === clientFilter);

  const displayedClients = clientFilter === 'all'
    ? clients
    : clients.filter(c => c.id === clientFilter);

  // Metrics
  const pendingJobs = displayedJobs.filter(j => j.status === 'in_production').length;
  const forApprovalJobs = displayedJobs.filter(j => j.status === 'for_approval').length;
  const inAdjustmentJobs = displayedJobs.filter(j => j.status === 'in_adjustment').length;
  const approvedJobs = displayedJobs.filter(j => j.status === 'approved').length;
  const scheduledJobs = displayedJobs.filter(j => j.status === 'scheduled').length;
  const publishedJobs = displayedJobs.filter(j => j.status === 'published').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayJobs = displayedJobs.filter(j => {
    const target = j.scheduledDate ? j.scheduledDate.slice(0, 10) : '';
    return target === todayStr;
  });

  const clientMap = new Map(clients.map(c => [c.id, c]));

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 space-y-6">
      {/* Top Welcome & Agency Health Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Agency Health Card */}
        <div 
          className="lg:col-span-2 text-white rounded-2xl shadow-md relative overflow-hidden flex flex-col"
          style={{
            background: `linear-gradient(to bottom right, ${primary}, ${secondary})`,
            border: `1px solid ${secondary}66`
          }}
        >
          <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${secondary}4D` }} />

          {/* Absolute Background Video on the Right */}
          <div className="absolute inset-y-0 right-0 w-full md:w-[60%] pointer-events-none z-0">
            {/* Fade gradient from left to right to blend with the card background */}
            {/* Added multiple stops to create a smoother transition and eliminate the hard line */}
            <div 
              className="absolute inset-0 z-10 hidden md:block"
              style={{ background: `linear-gradient(to right, ${primary} 0%, ${primary}99 30%, transparent 100%)` }}
            ></div>
            {/* Fade gradient from bottom for mobile */}
            <div 
              className="absolute inset-0 z-10 md:hidden"
              style={{ background: `linear-gradient(to top, ${secondary} 0%, ${secondary}99 40%, transparent 100%)` }}
            ></div>
            <video 
              ref={videoRef}
              src="https://go7.dev.br/banner-video-dark.mp4" 
              loop 
              muted 
              playsInline
              style={{
                filter: 'contrast(1.1) saturate(1.1)',
                mixBlendMode: 'screen'
              }}
              className="w-full h-full object-cover opacity-90 object-[center_top] md:object-right"
            />
          </div>

          {/* Left Content (Text & Indicators) */}
          <div className="relative z-10 flex-1 flex flex-col justify-between p-6 md:w-[65%] lg:w-[70%]">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span 
                    className="p-1.5 rounded-lg border"
                    style={{ backgroundColor: `${secondary}33`, borderColor: `${secondary}4D`, color: '#fff' }}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white opacity-90">
                    Saúde Operacional da Agência
                  </h3>
                </div>
                <span 
                  className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-md backdrop-blur-md text-white shadow-sm border"
                  style={{ backgroundColor: `${secondary}CC`, borderColor: `${secondary}4D` }}
                >
                  Score Algorítmico 0–100
                </span>
              </div>

              <div className="flex items-end gap-5 my-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-white font-mono drop-shadow-md">
                    {agencyHealthScore.total}
                  </span>
                  <span className="text-white/80 font-semibold text-lg drop-shadow-md">/100</span>
                </div>
                <div className="text-xs text-white/80 pb-1 max-w-sm leading-relaxed drop-shadow-sm">
                  Operação com fluxo saudável. Retrabalho sob controle e índice alto de aprovação de primeira versão.
                </div>
              </div>
            </div>

            {/* Sub-indicators */}
            <div 
              className="grid grid-cols-3 gap-3 pt-4 border-t mt-2"
              style={{ borderColor: `${secondary}66` }}
            >
              <div 
                className="backdrop-blur-sm rounded-xl p-3 border"
                style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderColor: `${secondary}4D` }}
              >
                <span className="text-[11px] text-white/70 block mb-0.5">Produção no Prazo</span>
                <span className="text-lg font-bold text-white font-mono">{agencyHealthScore.productionOnTimeRate}%</span>
              </div>
              <div 
                className="backdrop-blur-sm rounded-xl p-3 border"
                style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderColor: `${secondary}4D` }}
              >
                <span className="text-[11px] text-white/70 block mb-0.5">Aprovação 1ª Versão</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">{agencyHealthScore.approvalRateFirstTry}%</span>
              </div>
              <div 
                className="backdrop-blur-sm rounded-xl p-3 border"
                style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderColor: `${secondary}4D` }}
              >
                <span className="text-[11px] text-white/70 block mb-0.5">Índice de Retrabalho</span>
                <span className="text-lg font-bold text-amber-300 font-mono">{agencyHealthScore.reworkIndex}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Insights Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Postfy Insights
              </span>
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                IA Operacional
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">Gargalo identificado em aprovações:</p>
                <p className="text-slate-500 dark:text-slate-400">
                  O cliente <strong>EcoModa Brasil</strong> acumula 6 solicitações de ajuste nesta quinzena. Recomenda-se aprovação de pauta antes da produção.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                <p className="font-bold text-emerald-950">Ponto positivo na semana:</p>
                <p className="text-emerald-800">
                  <strong>Café Aroma Gourmet</strong> aprovou 100% dos carrosséis em menos de 24 horas.
                </p>
              </div>
            </div>
          </div>

          <Button variant="secondary"
            onClick={() => setActiveTab('calendario')}
            className="w-full mt-4"
          >
            Ver Calendário Editorial Completo
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Em Produção</span>
          <span className="text-2xl font-bold text-blue-600 font-mono">{pendingJobs}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Criativos ativos</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-700 block">Para Aprovação</span>
          <span className="text-2xl font-bold text-amber-600 font-mono">{forApprovalJobs}</span>
          <span className="text-[10px] text-amber-600/80 block mt-0.5">Com o cliente</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 block">Pedidos de Ajuste</span>
          <span className="text-2xl font-bold text-rose-600 font-mono">{inAdjustmentJobs}</span>
          <span className="text-[10px] text-rose-600/80 block mt-0.5">Retrabalho</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Aprovados</span>
          <span className="text-2xl font-bold text-emerald-600 font-mono">{approvedJobs}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Prontos</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Agendados</span>
          <span className="text-2xl font-bold text-purple-600 font-mono">{scheduledJobs}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Na fila da API</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Publicados (Mês)</span>
          <span className="text-2xl font-bold text-teal-700 font-mono">{publishedJobs}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Concluídos</span>
        </div>
      </div>

      {/* Grid: Publicações de Hoje + Gargalos por Cliente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publicações de Hoje */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Publicações de Hoje</h4>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {todayJobs.length} postagens programadas
              </span>
            </div>

            {todayJobs.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Nenhuma publicação agendada para hoje. Todas as pautas estão em dia.
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayJobs.map(job => {
                  const client = clientMap.get(job.clientId);
                  const time = safeTimeFormat(job.scheduledDate);

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 hover:bg-purple-50/40 hover:border-purple-200 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0">{time}</span>
                        <PlatformBadge platform={job.platform} showLabel={false} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{job.title}</span>
                      </div>
                      <StatusBadge status={job.status} size="sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Button variant="soft"
            onClick={() => openCreateJobModal()}
            className="w-full mt-4 border-dashed text-purple-600"
          >
            + Agendar Nova Publicação
          </Button>
        </div>

        {/* Clientes & Retrabalho */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Saúde dos Clientes da Agência</h4>
            </div>
            <Button variant="ghost"
              onClick={() => setActiveTab('clientes')}
              className="text-purple-600 hover:underline"
            >
              Ver todos
            </Button>
          </div>

          <div className="space-y-3">
            {displayedClients.map(client => {
              const clientJobs = jobs.filter(j => j.clientId === client.id);
              const totalClientJobs = clientJobs.length;
              const pendingApproval = clientJobs.filter(j => j.status === 'for_approval').length;
              const adjustments = clientJobs.filter(j => j.status === 'in_adjustment').length;

              const healthColors = {
                green: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Saudável', dot: 'bg-emerald-500' },
                yellow: { bg: 'bg-amber-50', text: 'text-amber-800', label: 'Atenção', dot: 'bg-amber-500' },
                red: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Gargalo', dot: 'bg-rose-500' },
              }[client.healthScore];

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:bg-slate-950 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <Avatar nome={client.name} url={client.avatar} tamanho={32} className="border border-slate-200 dark:border-slate-800" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{client.name}</span>
                      <span className="text-[11px] text-slate-400">{client.segment}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                        {pendingApproval} aguardando • {adjustments} ajustes
                      </span>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${healthColors.bg} ${healthColors.text}`}>
                      <span className={`w-2 h-2 rounded-full ${healthColors.dot}`} />
                      {healthColors.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Atividades Recentes (Audit log) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Timeline de Atividades da Operação</h4>
          </div>
          <span className="text-xs text-slate-400">Rastreabilidade em tempo real</span>
        </div>

        <div className="space-y-3">
          {activityLogs.slice(0, 5).map(log => (
            <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">{log.userName}</span>
                <span className="text-slate-500 dark:text-slate-400">{log.action}</span>
                <span className="font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                  {log.target}
                </span>
              </div>
              <span className="text-slate-400 text-[11px] font-mono">
                {safeTimeFormat(log.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
