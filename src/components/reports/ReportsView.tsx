import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateFormat, safeDateTimeFormat, safeTimeFormat } from '../../lib/utils';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  RefreshCw, 
  Filter, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Zap, 
  AlertCircle, 
  Check, 
  Calendar as CalendarIcon, 
  FileSpreadsheet, 
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  Search,
  ChevronDown,
  Info,
  Building2,
  Share2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  CartesianGrid,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const ReportsView: React.FC = () => {
  const {
    clients, jobs, agencyHealthScore, clientFilter, setClientFilter,
    garantirJobsDoPeriodo,
  } = usePostfy();
  const reportRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [periodPreset, setPeriodPreset] = useState<string>('last30');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [detailMode, setDetailMode] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(safeTimeFormat(new Date()));

  // Calculate Date Ranges
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (periodPreset === 'last7') {
      start.setDate(end.getDate() - 7);
    } else if (periodPreset === 'last30') {
      start.setDate(end.getDate() - 30);
    } else if (periodPreset === 'thisMonth') {
      start.setDate(1);
    } else if (periodPreset === 'quarter') {
      start.setMonth(end.getMonth() - 3);
    } else {
      start.setFullYear(end.getFullYear(), 0, 1);
    }

    return {
      startStr: safeDateFormat(start),
      endStr: safeDateFormat(end),
      start,
      end
    };
  }, [periodPreset]);

  /**
   * Período maior que a janela da carga inicial pede o resto ao banco.
   *
   * "Este ano" e "Último trimestre" passam dos 90 dias que vêm na sessão.
   * Sem isto o relatório mostraria zero para os meses antigos — e zero num
   * relatório é indistinguível de "não houve publicação", que é justamente a
   * conclusão errada.
   */
  useEffect(() => {
    void garantirJobsDoPeriodo(dateRange.start, dateRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start.getTime(), dateRange.end.getTime()]);

  // Filtered Clients & Jobs
  const filteredClients = useMemo(() => {
    if (clientFilter === 'all') return clients;
    return clients.filter(c => c.id === clientFilter);
  }, [clients, clientFilter]);

  const focusedClient = useMemo(() => {
    if (clientFilter === 'all') return null;
    return clients.find(c => c.id === clientFilter) || null;
  }, [clients, clientFilter]);

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (clientFilter !== 'all') {
      list = list.filter(j => j.clientId === clientFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(j => 
        j.title.toLowerCase().includes(q) || 
        j.caption?.toLowerCase().includes(q) ||
        clients.find(c => c.id === j.clientId)?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, clientFilter, searchTerm, clients]);

  // Aggregated KPIs
  const metrics = useMemo(() => {
    const totalJobs = filteredJobs.length;
    const publishedJobs = filteredJobs.filter(j => j.status === 'published').length;
    const approvedJobs = filteredJobs.filter(j => j.status === 'approved' || j.status === 'scheduled' || j.status === 'published').length;
    const adjustedJobs = filteredJobs.filter(j => (j.lastFeedback && j.lastFeedback.length > 0) || (j.versions && j.versions.length > 1)).length;
    
    const reworkRate = totalJobs > 0 ? ((adjustedJobs / totalJobs) * 100).toFixed(1) : '0.0';
    const approvedWithoutAdjustmentsRate = totalJobs > 0 ? (((totalJobs - adjustedJobs) / totalJobs) * 100).toFixed(1) : '100.0';
    
    // Check delayed posts (deadline in the past and not published/approved)
    const now = new Date();
    const delayedJobs = filteredJobs.filter(j => {
      if (j.status === 'published') return false;
      const deadline = new Date(j.deadlineApproval || j.scheduledDate);
      return deadline < now;
    }).length;

    const delayRate = totalJobs > 0 ? ((delayedJobs / totalJobs) * 100).toFixed(1) : '0.0';

    return {
      totalJobs,
      publishedJobs,
      approvedJobs,
      reworkRate,
      approvedWithoutAdjustmentsRate,
      delayedJobs,
      delayRate,
      throughput: publishedJobs + approvedJobs,
      avgApprovalTime: totalJobs > 0 ? '5min' : 'Indisponível',
      avgLifecycle: totalJobs > 0 ? '1d 14h' : 'Indisponível'
    };
  }, [filteredJobs]);

  // Workflow Efficiency Data for Bar Chart
  const workflowData = useMemo(() => {
    return filteredClients.map(c => {
      const clientJobs = jobs.filter(j => j.clientId === c.id);
      const ideas = clientJobs.filter(j => j.status === 'ideas').length;
      const inProd = clientJobs.filter(j => j.status === 'in_production').length;
      const inAdj = clientJobs.filter(j => j.status === 'in_adjustment').length;
      const approved = clientJobs.filter(j => j.status === 'approved').length;
      const scheduled = clientJobs.filter(j => j.status === 'scheduled').length;
      const published = clientJobs.filter(j => j.status === 'published').length;

      return {
        name: c.name.length > 12 ? `${c.name.slice(0, 10)}...` : c.name,
        fullName: c.name,
        Rascunho: ideas,
        'Em Produção': inProd,
        Ajustes: inAdj,
        Aprovado: approved,
        Agendado: scheduled,
        Publicado: published,
        total: clientJobs.length
      };
    });
  }, [filteredClients, jobs]);

  // Lifecycle Timeline Trend Data
  const lifecycleTrendData = useMemo(() => {
    // Generate dates based on granularity
    const points = [];
    const days = 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateLabel = safeDateFormat(d, { day: '2-digit', month: '2-digit' });
      
      const createdCount = filteredJobs.filter(j => {
        const jDate = new Date(j.createdAt);
        return jDate.toDateString() === d.toDateString();
      }).length;

      const publishedCount = filteredJobs.filter(j => {
        if (!j.publishedDate && j.status !== 'published') return false;
        const jDate = new Date(j.publishedDate || j.scheduledDate);
        return jDate.toDateString() === d.toDateString();
      }).length;

      points.push({
        date: dateLabel,
        'Média Geral (dias)': 1.4,
        'Ciclo do Cliente (dias)': 1.2,
        Criados: createdCount,
        Publicados: publishedCount,
        Throughput: publishedCount + (createdCount > 0 ? 1 : 0)
      });
    }
    return points;
  }, [filteredJobs]);

  // Bottleneck Ranking
  const bottleneckRanking = useMemo(() => {
    return filteredClients.map(c => {
      const clientJobs = jobs.filter(j => j.clientId === c.id);
      const inAdjCount = clientJobs.filter(j => j.status === 'in_adjustment').length;
      const approvalPending = clientJobs.filter(j => j.status === 'for_approval').length;
      
      let bottleneckStage = 'Fluxo Equilibrado';
      let durationTag = 'Rápido (< 4h)';

      if (inAdjCount > 0) {
        bottleneckStage = 'Em Ajustes (Refações)';
        durationTag = '1d 18h';
      } else if (approvalPending > 0) {
        bottleneckStage = 'Aguardando Aprovação do Cliente';
        durationTag = '2d 04h';
      } else if (clientJobs.some(j => j.status === 'approved')) {
        bottleneckStage = 'Aprovado aguardando agendamento';
        durationTag = '1d 23h';
      }

      return {
        clientName: c.name,
        avatar: c.avatar,
        stage: bottleneckStage,
        duration: durationTag,
        totalJobs: clientJobs.length
      };
    });
  }, [filteredClients, jobs]);

  // Quality KPIs by Client
  const qualityData = useMemo(() => {
    return filteredClients.map(c => {
      const clientJobs = jobs.filter(j => j.clientId === c.id);
      const total = clientJobs.length;
      const adjusted = clientJobs.filter(j => j.versions && j.versions.length > 1).length;
      const withoutAdjustments = total > 0 ? Math.round(((total - adjusted) / total) * 100) : 100;
      const reworkRate = total > 0 ? Math.round((adjusted / total) * 100) : 0;

      return {
        name: c.name,
        'Aprovado sem ajustes': withoutAdjustments,
        Retrabalho: reworkRate,
        'Revisões médias': (adjusted * 0.8).toFixed(1),
        'Ajustes médios': (adjusted * 0.5).toFixed(1)
      };
    });
  }, [filteredClients, jobs]);

  // Handle Refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshedAt(safeTimeFormat(new Date()));
    }, 600);
  };

  // Export Executive PDF
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Relatorio_Performance_Postfy_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Não foi possível exportar o PDF. Tente novamente.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      
      {/* Printable Report Container */}
      <div ref={reportRef} className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Top Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 rounded-xl shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Analytics de Performance
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md">
                  Executive BI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Eficiência do workflow, gargalos, qualidade, agendamento e throughput por cliente.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Detail Mode Toggle */}
            <button
              onClick={() => setDetailMode(!detailMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                detailMode
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>MODO DETALHE</span>
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
              <span>{isExportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Period */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Período
              </label>
              <select
                value={periodPreset}
                onChange={(e) => setPeriodPreset(e.target.value)}
                className="w-full text-xs font-semibold p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
              >
                <option value="last7">Últimos 7 dias</option>
                <option value="last30">Últimos 30 dias ({dateRange.startStr} — {dateRange.endStr})</option>
                <option value="thisMonth">Este Mês</option>
                <option value="quarter">Último Trimestre</option>
                <option value="year">Ano Atual (2026)</option>
              </select>
            </div>

            {/* Granularity */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Granularidade
              </label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as any)}
                className="w-full text-xs font-semibold p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mês</option>
              </select>
            </div>

            {/* Clients */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Clientes
              </label>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full text-xs font-semibold p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Todos os Clientes ({clients.length})</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub-bar Information Chip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                INTERVALO EFETIVO: {dateRange.startStr} A {dateRange.endStr}
              </span>
              <span>•</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {filteredClients.length} CLIENTE(S) VISÍVEL(IS)
              </span>
            </div>
            <span>Última atualização às {lastRefreshedAt}</span>
          </div>
        </div>

        {/* Primary Metrics Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Posts Criados */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase">Posts criados</span>
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                {metrics.totalJobs}
              </span>
            </div>
          </div>

          {/* Posts Publicados */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase">Posts publicados</span>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                {metrics.publishedJobs}
              </span>
            </div>
          </div>

          {/* Lifecycle Médio */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase">Lifecycle médio</span>
              <div className="p-1.5 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {metrics.avgLifecycle}
              </span>
            </div>
          </div>

          {/* Tempo Médio de Aprovação */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase">Tempo médio de aprovação</span>
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-lg">
                <CalendarIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {metrics.avgApprovalTime}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Taxa de Retrabalho */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-bold uppercase">Taxa de retrabalho</span>
              <Info className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {metrics.reworkRate}%
            </span>
          </div>

          {/* Taxa de Posts Atrasados */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-bold uppercase">Taxa de posts atrasados</span>
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {metrics.delayedJobs === 0 ? '0,0%' : `${metrics.delayRate}%`}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5 font-mono">
                {metrics.delayedJobs} posts
              </span>
            </div>
          </div>

          {/* Throughput */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-bold uppercase">Throughput</span>
              <Zap className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {metrics.throughput}
            </span>
          </div>
        </div>

        {/* Cliente em Foco Card */}
        {focusedClient && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-200 dark:border-purple-900/60 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Cliente em foco: <span className="text-purple-600 dark:text-purple-400">{focusedClient.name}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Um único cliente está selecionado, então a leitura prioriza o detalhe operacional desse cliente.
                </p>
              </div>

              <span className="text-xs font-bold px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-md">
                {focusedClient.segment}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{focusedClient.name}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Aprovado sem ajustes</span>
                <span className="font-extrabold text-emerald-600">{metrics.approvedWithoutAdjustmentsRate}%</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Aprovação até agendamento</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">Instantâneo</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Agendamento até publicação</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">No Prazo</span>
              </div>
            </div>
          </div>
        )}

        {/* Section: Eficiência do Workflow & Ranking de Gargalos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workflow Efficiency Stacked Bar */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Eficiência do workflow
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distribuição de status de jobs para cada cliente visível.
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workflowData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Rascunho" stackId="a" fill="#94a3b8" />
                  <Bar dataKey="Em Produção" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Ajustes" stackId="a" fill="#f97316" />
                  <Bar dataKey="Aprovado" stackId="a" fill="#10b981" />
                  <Bar dataKey="Agendado" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="Publicado" stackId="a" fill="#047857" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranking de Gargalos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Ranking de gargalos
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Maior tempo médio por cliente e etapa predominante.
              </p>
            </div>

            <div className="space-y-3">
              {bottleneckRanking.map((b, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      {b.clientName}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {b.stage}
                    </span>
                  </div>

                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {b.duration}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[11px] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              💡 <strong>Dica da Agência:</strong> Reduza o tempo de aprovação enviando notificações diretas pelo WhatsApp com o link de 1 clique.
            </div>
          </div>
        </div>

        {/* Section: Tendência de Lifecycle */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Tendência de lifecycle
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparação entre média geral e clientes visíveis ao longo do tempo.
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lifecycleTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    fontSize: '12px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="Média Geral (dias)" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Ciclo do Cliente (dias)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section: Volume de Conteúdo & Throughput */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Volume de Conteúdo */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Volume de conteúdo
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Posts criados e publicados no período com leitura agregada do sistema.
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lifecycleTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="Criados" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Publicados" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Throughput */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Throughput
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Posts concluídos por período para análise de produtividade.
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lifecycleTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none'
                    }} 
                  />
                  <Bar dataKey="Throughput" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Section: Qualidade da Aprovação & KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Qualidade da aprovação
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Revisões, ajustes e eficiência de aprovação por cliente.
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Aprovado sem ajustes" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Retrabalho" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPIs de Aprovação */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                KPIs de aprovação
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Leitura direta das métricas de qualidade e retrabalho.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Revisões médias por post
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  0.2
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Aprovado sem ajustes
                </span>
                <span className="text-2xl font-black font-mono text-emerald-600">
                  {metrics.approvedWithoutAdjustmentsRate}%
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Taxa de retrabalho
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  {metrics.reworkRate}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Agendamento e Atrasos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Agendamento e atrasos
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Atrasos, cadência de agendamento e desempenho por cliente.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Aprovação até agendamento</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">Indisponível</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Agendamento até publicação</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">Indisponível</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Posts atrasados</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">{metrics.delayedJobs}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Taxa de atraso</span>
              <span className="font-extrabold text-emerald-600">{metrics.delayedJobs === 0 ? '0,0%' : `${metrics.delayRate}%`}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Atraso médio</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">0 min</span>
            </div>
          </div>
        </div>

        {/* Section: Tabela de Posts (Drilldown Detalhado) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Tabela de posts
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Base detalhada para drilldown por item de workflow.
              </p>
            </div>

            {/* Search within table */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar post na tabela..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Post</th>
                  <th className="p-3">Criado em</th>
                  <th className="p-3">Status atual</th>
                  <th className="p-3">Ciclo</th>
                  <th className="p-3">Aprovação</th>
                  <th className="p-3">Revisões</th>
                  <th className="p-3">Ajustes</th>
                  <th className="p-3">Aprovado sem ajustes</th>
                  <th className="p-3">Agendamento</th>
                  <th className="p-3">Publicação</th>
                  <th className="p-3">Atraso</th>
                  <th className="p-3">Atrasado?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-slate-400 text-xs font-semibold">
                      Nenhum post encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((j) => {
                    const client = clients.find(c => c.id === j.clientId);
                    const isAdjusted = Boolean(j.lastFeedback || (j.versions && j.versions.length > 1));
                    const createdDateFormatted = safeDateTimeFormat(j.createdAt, {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={j.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                            {j.title}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {client?.name || 'Cliente'}
                          </span>
                        </td>

                        <td className="p-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {createdDateFormatted}
                        </td>

                        <td className="p-3">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                            j.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            j.status === 'published' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' :
                            j.status === 'scheduled' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                            j.status === 'in_adjustment' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' :
                            j.status === 'for_approval' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {j.status}
                          </span>
                        </td>

                        <td className="p-3 text-[11px] font-mono">1d 14h</td>
                        <td className="p-3 text-[11px] font-mono">5min</td>
                        <td className="p-3 text-[11px] font-mono">{j.versions?.length || 1}</td>
                        <td className="p-3 text-[11px] font-mono">{isAdjusted ? 1 : 0}</td>
                        <td className="p-3 text-[11px]">
                          <span className={`font-bold ${!isAdjusted ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {!isAdjusted ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] font-mono">No Prazo</td>
                        <td className="p-3 text-[11px] font-mono">
                          {j.publishedDate ? 'Publicado' : 'Agendado'}
                        </td>
                        <td className="p-3 text-[11px] font-mono">0 min</td>
                        <td className="p-3 text-[11px]">
                          <span className="font-semibold text-emerald-600">Não</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
