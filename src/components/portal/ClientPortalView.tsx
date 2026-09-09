import React, { useState, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateTimeFormat, safeDateFormat, safeTimeFormat, copyToClipboard } from '../../lib/utils';
import { 
  CheckCircle2,
  Key,
  Receipt,
  FolderOpen, 
  AlertCircle, 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Download, 
  FileText, 
  MessageSquare, 
  Sparkles,
  Layers,
  Send,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Building2,
  Globe,
  Phone,
  Mail,
  Upload,
  Trash2,
  LogOut,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';
import { Job, Client, JobPlatform, JobFormat } from '../../types';
import { ClientPortalLogin } from './ClientPortalLogin';
import { FileUpload } from '../ui/file-upload';

/**
 * Proporção do preview de mídia, pela rede/formato reais do job — não um
 * quadrado ou 16:9 genérico. Vertical (Reels/Stories) vem antes da rede,
 * porque manda mais na proporção do que a plataforma em si.
 */
const proporcaoDoCriativo = (platform: JobPlatform, format: JobFormat): string => {
  if (format === 'story' || format === 'reel') return 'aspect-[9/16]';
  if (format === 'video') return 'aspect-video';
  if (platform === 'tiktok') return 'aspect-[9/16]';
  if (platform === 'youtube') return 'aspect-video';
  // Feed/carrossel: 4:5 é o formato de maior área útil no Instagram e
  // Facebook, e serve como referência razoável para LinkedIn/X também.
  return 'aspect-[4/5]';
};

interface ClientPortalMonthGridProps {
  month: Date;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
}

/** Calendário mensal do portal: só leitura, sem filtro de cliente (a lista já
 * chega recortada) e sem criação de conteúdo — o cliente aprova, não posta. */
const ClientPortalMonthGrid: React.FC<ClientPortalMonthGridProps> = ({ month, jobs, onSelectJob }) => {
  const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ano = month.getFullYear();
  const mes = month.getMonth();

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const indiceDoPrimeiroDia = new Date(ano, mes, 1).getDay();
  const diasDoMesAnterior = new Date(ano, mes, 0).getDate();
  const totalCelulas = Math.ceil((indiceDoPrimeiroDia + diasNoMes) / 7) * 7;

  const hoje = new Date();
  const ehHoje = (d: Date) =>
    d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();

  const jobsDoDia = (d: Date) =>
    jobs.filter((job) => {
      const alvo = new Date(job.scheduledDate || job.deadlineProduction);
      return alvo.getFullYear() === d.getFullYear() && alvo.getMonth() === d.getMonth() && alvo.getDate() === d.getDate();
    });

  const celulas: { data: Date; doMesAtual: boolean; jobs: Job[] }[] = [];
  for (let i = 0; i < totalCelulas; i++) {
    let data: Date;
    let doMesAtual = true;
    if (i < indiceDoPrimeiroDia) {
      data = new Date(ano, mes - 1, diasDoMesAnterior - (indiceDoPrimeiroDia - 1 - i));
      doMesAtual = false;
    } else if (i >= indiceDoPrimeiroDia + diasNoMes) {
      data = new Date(ano, mes + 1, i - (indiceDoPrimeiroDia + diasNoMes) + 1);
      doMesAtual = false;
    } else {
      data = new Date(ano, mes, i - indiceDoPrimeiroDia + 1);
    }
    celulas.push({ data, doMesAtual, jobs: jobsDoDia(data) });
  }

  return (
    // Sem `overflow-hidden`: ele cortaria a prévia grande do hover na borda
    // do calendário, que é justamente onde ela precisa aparecer por inteiro.
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl">
      <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 py-2 rounded-t-2xl">
        {diasDaSemana.map((dia) => (
          <div key={dia}>{dia}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-b-2xl">
        {celulas.map((celula, idx) => (
          <div
            key={idx}
            className={`relative min-h-[100px] sm:min-h-[120px] p-1.5 flex flex-col gap-1 ${
              celula.doMesAtual ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-950/60'
            }`}
          >
            <span
              className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${
                ehHoje(celula.data)
                  ? 'bg-purple-600 text-white'
                  : celula.doMesAtual
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-slate-400'
              }`}
            >
              {celula.data.getDate()}
            </span>

            <div className="flex-1 space-y-1">
              {celula.jobs.slice(0, 3).map((job) => {
                const capa = job.mediaUrls?.[0];
                // Nas duas últimas colunas a prévia abre para a esquerda, ou
                // sairia da tela.
                const abreParaEsquerda = idx % 7 >= 5;

                return (
                  <button
                    key={job.id}
                    onClick={() => onSelectJob(job)}
                    className="group/job relative w-full text-left bg-slate-50 dark:bg-slate-950 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-800 hover:border-purple-300 rounded-lg p-1 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-1.5">
                      {capa ? (
                        <img
                          src={capa}
                          alt=""
                          loading="lazy"
                          className="w-8 h-10 rounded object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-10 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <Layers className="w-3 h-3 text-slate-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                          <span className="text-[9px] font-mono text-slate-400 truncate">
                            {safeTimeFormat(job.scheduledDate)}
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                          {job.title}
                        </p>
                        <div className="mt-0.5">
                          <StatusBadge status={job.status} size="sm" />
                        </div>
                      </div>
                    </div>

                    {/*
                      Prévia grande no hover, na proporção real da rede.
                      `pointer-events-none` porque ela cobre as células
                      vizinhas: sem isso, passar o mouse por cima da prévia
                      bloquearia o clique no dia de baixo.
                    */}
                    {capa && (
                      <div
                        className={`pointer-events-none absolute top-0 z-30 hidden group-hover/job:block ${
                          abreParaEsquerda ? 'right-full mr-2' : 'left-full ml-2'
                        }`}
                      >
                        <div className={`w-44 ${proporcaoDoCriativo(job.platform, job.format)} rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl bg-slate-900`}>
                          <img src={capa} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
              {celula.jobs.length > 3 && (
                <span className="block text-[10px] text-center text-slate-400 font-semibold">
                  +{celula.jobs.length - 3} mais
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ClientPortalView: React.FC = () => {
  const {
    clients,
    portalClientId,
    closeClientPortal,
    entrarNoPortal,
    carregandoPortal,
    erroDoPortal,
    jobs,
    approveJob,
    requestAdjustment,
    currentWorkspace,
    clientMaterials,
    addClientMaterial,
    deleteClientMaterial
  } = usePostfy();

  // Quem está no portal vem do contexto: por token (cliente que entrou com o
  // código) ou por prévia interna (equipe da agência). A tela não decide
  // mais isso sozinha — antes ela comparava telefone contra a lista local, e
  // essa lista só existia quando alguém da agência estava logado no mesmo
  // navegador. Para o cliente de verdade, o portal abria vazio.
  const authenticatedClient: Client | null = portalClientId
    ? clients.find(c => c.id === portalClientId) || null
    : null;

  const [activeTab, setActiveTab] = useState<'approvals' | 'calendar' | 'arquivos' | 'senhas' | 'notas' | 'briefing' | 'materiais'>('approvals');
  const [selectedForReview, setSelectedForReview] = useState<Job | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarPreviewJob, setCalendarPreviewJob] = useState<Job | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Material upload state
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<'photo' | 'video' | 'logo' | 'doc'>('photo');
  const [newMatUrl, setNewMatUrl] = useState('');
  const [newMatNotes, setNewMatNotes] = useState('');

  // Enquanto a RPC do portal não responde, a tela ainda não sabe se há
  // cliente: mostrar o login aqui piscaria a tela de código para quem já
  // entrou e só apertou F5.
  if (!authenticatedClient && carregandoPortal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  if (!authenticatedClient) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <ClientPortalLogin
          workspace={currentWorkspace}
          onLoginSuccess={entrarNoPortal}
        />
      </div>
    );
  }

  const client = authenticatedClient;

  // Filter jobs for THIS client ONLY (Strict Isolation)
  const clientJobs = jobs.filter(j => j.clientId === client.id);
  const pendingApprovals = clientJobs.filter(j => j.status === 'for_approval');
  const upcomingScheduled = clientJobs.filter(j => j.status === 'scheduled' || j.status === 'approved');

  const handleLogout = () => {
    closeClientPortal();
  };

  const handleApprove = (jobId: string) => {
    approveJob(jobId, `${client.contacts[0]?.name || client.name} (Cliente)`);
    if (selectedForReview?.id === jobId) {
      setSelectedForReview(null);
    }
  };

  const handleReject = () => {
    if (!selectedForReview || !feedbackText.trim()) return;
    requestAdjustment(
      selectedForReview.id, 
      feedbackText.trim(), 
      `${client.contacts[0]?.name || client.name} (Cliente)`
    );
    setFeedbackText('');
    setIsRejecting(false);
    setSelectedForReview(null);
  };

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // O e-mail, e não o telefone: é por ele que a pessoa entrou, então é o que
  // confirma "estou na conta certa". O telefone que aparecia aqui vinha com
  // um número inventado quando o cadastro não tinha nenhum.
  const clientEmail = client.email || client.contacts?.[0]?.email || '';
  const clientFullName = client.name || client.contacts?.[0]?.name || 'Cliente';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 overflow-y-auto animate-in fade-in duration-200">
      {/* Client Portal Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentWorkspace.logo ? (
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-0.5 shadow-xs shrink-0">
                <img src={currentWorkspace.logo} alt={currentWorkspace.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-xs shrink-0"
                style={{ backgroundColor: currentWorkspace.primaryColor || '#9333ea' }}
              >
                {(currentWorkspace.name || 'P').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                {currentWorkspace.name || 'Portal do Cliente'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hidden md:inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Acesso Seguro
              </span>
            </div>
          </div>

          {/* Client Authenticated Info & Logout Action */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img 
                src={client.avatar} 
                alt="" 
                className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-xs shrink-0" 
              />
              <div className="hidden sm:block text-right">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block truncate max-w-56">
                  {clientFullName}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold block truncate">
                  {clientEmail}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold transition cursor-pointer"
              title="Sair do Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Falha vinda das RPCs do portal. Aparece porque a aprovação daqui é
            gravada em segundo plano: sem aviso, a tela diria "aprovado" com o
            banco intacto. */}
        {erroDoPortal && (
          <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erroDoPortal}</span>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Área Exclusiva do Cliente</span>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Olá, {clientFullName}! 👋
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Acompanhe suas publicações, aprove conteúdos, acesse pastas de arquivos, notas fiscais e credenciais com total comodidade.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-center min-w-28">
              <span className="block text-2xl font-black font-mono">{pendingApprovals.length}</span>
              <span className="text-[11px] font-bold">Para Aprovar</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-center min-w-28">
              <span className="block text-2xl font-black font-mono">{upcomingScheduled.length}</span>
              <span className="text-[11px] font-bold">Programados</span>
            </div>
          </div>
        </div>

        {/* Portal Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 rounded-t-2xl overflow-x-auto no-scrollbar shadow-xs">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'approvals'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovações
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'calendar'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Cronograma
          </button>

          <button
            onClick={() => setActiveTab('arquivos')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'arquivos'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Arquivos
          </button>

          <button
            onClick={() => setActiveTab('senhas')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'senhas'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            Senhas
          </button>

          <button
            onClick={() => setActiveTab('notas')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'notas'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Notas Fiscais
          </button>

          <button
            onClick={() => setActiveTab('briefing')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'briefing'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Briefing
          </button>

          <button
            onClick={() => setActiveTab('materiais')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'materiais'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            Fotos e Materiais
          </button>
        </div>

        {/* Tab 1: Approvals */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Tudo Aprovado por Aqui!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Não há postagens aguardando sua revisão no momento. Todos os seus posts programados já estão prontos para publicação.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingApprovals.map(job => (
                  <div 
                    key={job.id} 
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    {/* Media Preview — proporção real da rede/formato do post */}
                    <div className={`relative ${proporcaoDoCriativo(job.platform, job.format)} bg-slate-900 flex items-center justify-center overflow-hidden`}>
                      {job.mediaUrls && job.mediaUrls.length > 0 ? (
                        <img 
                          src={job.mediaUrls[0]} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center gap-2 text-xs">
                          <Layers className="w-8 h-8" />
                          <span>Preview do Criativo</span>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <PlatformBadge platform={job.platform} />
                        <FormatBadge format={job.format} />
                      </div>

                      <span className="absolute top-3 right-3 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-xs">
                        v{job.currentVersion}
                      </span>
                    </div>

                    {/* Content text */}
                    <div className="p-5 space-y-3 flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {job.title}
                      </h4>

                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/70 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto font-sans leading-relaxed">
                        {job.caption}
                      </div>

                      {job.cta && (
                        <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold bg-purple-50/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                          👉 {job.cta}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>Previsão de postagem:</span>
                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                          {safeDateTimeFormat(job.scheduledDate)}
                        </strong>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          setSelectedForReview(job);
                          setIsRejecting(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Pedir Ajuste
                      </button>

                      <button
                        onClick={() => handleApprove(job.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovar Agora
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Calendar */}
        {activeTab === 'calendar' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
                {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCalendarMonth(new Date())}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <ClientPortalMonthGrid
              month={calendarMonth}
              jobs={clientJobs}
              onSelectJob={setCalendarPreviewJob}
            />
          </div>
        )}

        {/* Tab 3: Arquivos & Drive */}
        {activeTab === 'arquivos' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Arquivos e Pastas Compartilhadas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Acesse logos oficiais, manuais de marca e pastas do Google Drive.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {(client.files || []).map(file => (
                <div key={file.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900/40">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{file.name}</span>
                      <span className="text-slate-400 text-[11px] block">{file.size} &bull; {file.uploadedAt}</span>
                    </div>
                  </div>
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-purple-600 transition shadow-xs cursor-pointer shrink-0"
                    title="Acessar arquivo"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
              {(client.files || []).length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
                  Nenhum arquivo disponível no momento.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Senhas (Cofre) */}
        {activeTab === 'senhas' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Cofre de Senhas da Empresa</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Credenciais compartilhadas de forma criptografada e segura com sua equipe de marketing.</p>
            </div>
            <div className="space-y-3 pt-2">
              {(client.passwords || []).map(pwd => {
                const isRevealed = revealedPasswords[pwd.id];
                return (
                  <div key={pwd.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-900/40">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{pwd.service}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Usuário: <strong className="text-slate-700 dark:text-slate-300">{pwd.username}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs">
                        <span className="mr-2 text-slate-700 dark:text-slate-300">
                          {isRevealed ? pwd.password : '••••••••••••'}
                        </span>
                        <button 
                          onClick={() => toggleRevealPassword(pwd.id)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white mr-1 cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => handleCopy(pwd.password, pwd.id)}
                          className="text-slate-400 hover:text-purple-600 cursor-pointer"
                        >
                          {copiedId === pwd.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(client.passwords || []).length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma credencial cadastrada.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Notas Fiscais */}
        {activeTab === 'notas' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Notas Fiscais de Prestação de Serviços</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Histórico de NFS-e emitidas para sua empresa pela agência.</p>
            </div>
            <div className="space-y-3 pt-2">
              {(client.invoices || []).map(inv => (
                <div key={inv.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/40">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{inv.number}</span>
                      <span className="text-[11px] text-slate-400">Competência: {inv.monthRef} &bull; Emissão: {inv.issueDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      R$ {inv.value.toLocaleString('pt-BR')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      inv.status === 'pago' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                    }`}>
                      {inv.status}
                    </span>
                    <button 
                      onClick={() => alert(`Baixando comprovante da NFS-e ${inv.number}`)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-purple-600 transition shadow-xs cursor-pointer"
                      title="Baixar NFS-e"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(client.invoices || []).length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma nota fiscal emitida até o momento.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Briefing */}
        {activeTab === 'briefing' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Briefing & Posicionamento da Sua Marca</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Guia de conteúdo, personas e regras editoriais alinhadas com a agência.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-purple-600">Tom de Voz & Personalidade</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {client.briefing?.brandVoice || 'Acolhedor, especialista, dinâmico e focado em alta qualidade.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-purple-600">Público-Alvo & Personas</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {client.briefing?.targetAudience || 'Profissionais liberais, executivos e entusiastas do segmento.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-purple-600">Dores e Desejos Solucionados</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {client.briefing?.painPoints || 'Necessidade de conveniência, confiabilidade e excelência sem atritos.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-purple-600">Concorrentes & Inspirações</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {client.briefing?.competitors || 'Principais marcas nacionais e referências estéticas globais do setor.'}
                </p>
              </div>

              <div className="md:col-span-2 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-1">
                <span className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-400">Regras e Restrições de Marca</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {client.briefing?.brandGuidelines || 'Manter a paleta de cores institucional estrita. Proibido o uso de linguagem informal excessiva ou gírias descontextualizadas.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Client Materials / Photo Upload */}
        {activeTab === 'materiais' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-600" />
                  Central de Envio de Materiais & Fotos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Envie fotos em alta resolução, vídeos brutos, logos vetorizados ou documentos de apoio para a equipe da agência criar suas artes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingMaterial(!isAddingMaterial)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>{isAddingMaterial ? 'Fechar Formulário' : 'Enviar Novo Material'}</span>
              </button>
            </div>

            {/* Material Upload Form */}
            {isAddingMaterial && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMatTitle.trim()) return;
                  addClientMaterial({
                    clientId: client.id,
                    title: newMatTitle.trim(),
                    category: newMatCategory,
                    url: newMatUrl.trim() || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
                    thumbnailUrl: newMatUrl.trim() || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
                    size: '4.2 MB',
                    notes: newMatNotes.trim(),
                    status: 'recebido'
                  });
                  setNewMatTitle('');
                  setNewMatUrl('');
                  setNewMatNotes('');
                  setIsAddingMaterial(false);
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-purple-200 dark:border-purple-900/60 shadow-lg space-y-4 animate-in fade-in duration-200"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  Cadastrar Novo Arquivo ou Fotografia
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Título do Material *
                    </label>
                    <input
                      type="text"
                      required
                      value={newMatTitle}
                      onChange={(e) => setNewMatTitle(e.target.value)}
                      placeholder="Ex: Fotos do Novo Espaço / Café Gourmet"
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Tipo de Conteúdo
                    </label>
                    <select
                      value={newMatCategory}
                      onChange={(e) => setNewMatCategory(e.target.value as any)}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="photo">Fotografia / Imagem do Produto</option>
                      <option value="video">Vídeo Bruto / Depoimento</option>
                      <option value="logo">Logotipo ou Elemento Visual</option>
                      <option value="doc">Documento / PDF de Apoio</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FileUpload
                    label="Foto / Arquivo do Material (ou link da nuvem)"
                    value={newMatUrl}
                    fileName={newMatTitle}
                    onFileSelect={(file) => {
                      setNewMatUrl(file.url);
                      if (!newMatTitle) {
                        setNewMatTitle(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }}
                    onFileRemove={() => setNewMatUrl('')}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Instruções ou Observações para a Agência
                  </label>
                  <textarea
                    rows={2}
                    value={newMatNotes}
                    onChange={(e) => setNewMatNotes(e.target.value)}
                    placeholder="Ex: Favor usar na arte de terça-feira destacando o selo de qualidade."
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMaterial(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs"
                  >
                    Confirmar Envio
                  </button>
                </div>
              </form>
            )}

            {/* Material Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {clientMaterials
                .filter(m => m.clientId === client.id)
                .map((mat) => (
                  <div
                    key={mat.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                  >
                    {/* Thumbnail Preview */}
                    <div className="aspect-video bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
                      {mat.thumbnailUrl ? (
                        <img
                          src={mat.thumbnailUrl}
                          alt={mat.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <FolderOpen className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-xs">
                          {mat.category}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          mat.status === 'utilized'
                            ? 'bg-emerald-500 text-white'
                            : mat.status === 'in_review'
                            ? 'bg-purple-500 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {mat.status === 'utilized' ? 'Utilizado' : mat.status === 'in_review' ? 'Em Uso' : 'Recebido'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {mat.title}
                        </h4>
                        {mat.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            "{mat.notes}"
                          </p>
                        )}
                        <span className="text-[10px] text-slate-400 block mt-2">
                          Enviado em {safeDateFormat(mat.createdAt)} • {mat.size}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <a
                          href={mat.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Abrir</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => deleteClientMaterial(mat.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {clientMaterials.filter(m => m.clientId === client.id).length === 0 && (
                <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
                  <Upload className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium">Nenhum material enviado por este cliente até o momento.</p>
                  <p className="text-[11px] text-slate-500">Clique no botão "Enviar Novo Material" acima para testar o upload.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview do job clicado no calendário: aprova/pede ajuste se ainda
          estiver aguardando aprovação, senão só mostra o conteúdo e o status. */}
      {calendarPreviewJob && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div
              className={`relative ${proporcaoDoCriativo(calendarPreviewJob.platform, calendarPreviewJob.format)} bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 max-h-72`}
            >
              {calendarPreviewJob.mediaUrls && calendarPreviewJob.mediaUrls.length > 0 ? (
                <img src={calendarPreviewJob.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-400 flex flex-col items-center gap-2 text-xs">
                  <Layers className="w-8 h-8" />
                  <span>Preview do Criativo</span>
                </div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <PlatformBadge platform={calendarPreviewJob.platform} />
                <FormatBadge format={calendarPreviewJob.format} />
              </div>
              <button
                onClick={() => setCalendarPreviewJob(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {calendarPreviewJob.title}
                </h4>
                <StatusBadge status={calendarPreviewJob.status} />
              </div>

              {calendarPreviewJob.caption && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/70 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {calendarPreviewJob.caption}
                </div>
              )}

              {calendarPreviewJob.cta && (
                <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold bg-purple-50/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                  👉 {calendarPreviewJob.cta}
                </p>
              )}

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Previsão de postagem:</span>
                <strong className="text-slate-700 dark:text-slate-300 font-mono">
                  {safeDateTimeFormat(calendarPreviewJob.scheduledDate)}
                </strong>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-end gap-3 shrink-0">
              {calendarPreviewJob.status === 'for_approval' ? (
                <>
                  <button
                    onClick={() => {
                      const job = calendarPreviewJob;
                      setCalendarPreviewJob(null);
                      setSelectedForReview(job);
                      setIsRejecting(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Pedir Ajuste
                  </button>
                  <button
                    onClick={() => {
                      handleApprove(calendarPreviewJob.id);
                      setCalendarPreviewJob(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aprovar Agora
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setCalendarPreviewJob(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject/Adjustment Dialog */}
      {isRejecting && selectedForReview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              Solicitar Ajuste no Conteúdo
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Descreva com detalhes o que precisa ser alterado para que nossa equipe produza a nova versão imediatamente.
            </p>
            <textarea
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Ex: Gostaria de trocar a foto do slide 2 e alterar a chamada final para..."
              className="w-full text-xs p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsRejecting(false);
                  setSelectedForReview(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={!feedbackText.trim()}
                onClick={handleReject}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg transition cursor-pointer"
              >
                Enviar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
