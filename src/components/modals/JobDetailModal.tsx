import React, { useState } from 'react';
import { novoId } from '../../lib/sincronizacao';
import { urlDoPortalDaAgencia } from '../../lib/rotas';
import { BotaoDoPortal } from '../common/BotaoDoPortal';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard } from '../../lib/utils';
import { PlatformBadge, FormatBadge, StatusBadge, PriorityBadge } from '../common/Badges';
import { 
  X, 
  Check, 
  AlertCircle, 
  Clock, 
  Send, 
  Upload, 
  Copy, 
  Share2, 
  Layers, 
  History, 
  MessageSquare, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  FileText,
  Trash2,
  Copy as DuplicateIcon,
  ExternalLink,
  Sparkles,
  MessageCircle,
  Play,
  Square,
  Plus,
  Timer
} from 'lucide-react';
import { JobStatus, JobVersion } from '../../types';
import { AiCopyModal } from './AiCopyModal';
import { ApiError } from '../../lib/api';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { FileUpload } from '../ui/file-upload';
import { Avatar } from '../common/Avatar';

const formatSafeDate = (dateStr?: string, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateStr) return 'Não definida';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Data inválida';
    return d.toLocaleString('pt-BR', options || { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return 'Data inválida';
  }
};

export const JobDetailModal: React.FC = () => {
  const { 
    selectedJob, 
    setSelectedJob, 
    clients, 
    moveJobStatus, 
    approveJob, 
    requestAdjustment, 
    addNewJobVersion,
    addJobComment,
    toggleChecklistItem,
    duplicateJob,
    deleteJob,
    visualizarPortalDoCliente,
    updateJob,
    timesheetLogs,
    addTimesheetLog,
    currentUser,
    convertFeedbackToTasks,
    currentWorkspace,
  } = usePostfy();

  const [activeTab, setActiveTab] = useState<'content' | 'versions' | 'comments' | 'checklist' | 'timesheet'>('content');
  const [adjustmentFeedback, setAdjustmentFeedback] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [newVersionCaption, setNewVersionCaption] = useState('');
  const [newVersionMedia, setNewVersionMedia] = useState('');
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // New Modals State
  const [isAiCopyOpen, setIsAiCopyOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isConvertingFeedback, setIsConvertingFeedback] = useState(false);
  const [erroIa, setErroIa] = useState<string | null>(null);

  // Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerNotes, setTimerNotes] = useState('');
  const [manualMinutes, setManualMinutes] = useState(30);

  // Effect for timer
  React.useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else if (!timerRunning && timerSeconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  if (!selectedJob) return null;

  const client = clients.find(c => c.id === selectedJob.clientId);

  const handleCopyApprovalLink = () => {
    // Levava `?portal=<id do cliente>`, e o portal espera o token opaco: o
    // cliente abria numa tela vazia. Agora leva a agência, e quem chega prova
    // quem é pelo código no e-mail — que é o que decide o que ele enxerga.
    const url = urlDoPortalDaAgencia(currentWorkspace.slug, window.location.origin);
    copyToClipboard(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendAdjustment = () => {
    if (!adjustmentFeedback.trim()) return;
    requestAdjustment(selectedJob.id, adjustmentFeedback, 'Cliente');
    setAdjustmentFeedback('');
    setIsAdjusting(false);
  };

  const handleCreateVersion = () => {
    if (!newVersionCaption.trim()) return;
    const media = newVersionMedia.trim() ? [newVersionMedia.trim()] : selectedJob.mediaUrls;
    addNewJobVersion(selectedJob.id, media, newVersionCaption);
    setNewVersionCaption('');
    setNewVersionMedia('');
    setIsCreatingVersion(false);
    setActiveTab('versions');
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addJobComment(selectedJob.id, commentText);
    setCommentText('');
  };

  const handleConvertFeedbackWithAi = async () => {
    if (!selectedJob.lastFeedback) return;
    setIsConvertingFeedback(true);
    setErroIa(null);
    try {
      const res = await convertFeedbackToTasks({
        clientFeedback: selectedJob.lastFeedback,
        jobTitle: selectedJob.title,
        currentCopy: selectedJob.caption
      });

      if (res && res.checklist && res.checklist.length > 0) {
        const newItems = res.checklist.map((c: any, idx: number) => ({
          id: novoId(),
          title: `[${c.role.toUpperCase()}] ${c.item}`,
          completed: false
        }));

        updateJob(selectedJob.id, {
          checklist: [...selectedJob.checklist, ...newItems]
        });
        setSelectedJob({
          ...selectedJob,
          checklist: [...selectedJob.checklist, ...newItems]
        });
        setActiveTab('checklist');
      }
    } catch (err) {
      // Precisa aparecer na tela: as funções de IA propagam erro em vez de
      // devolver texto de exemplo, então sem isto o botão só para de girar.
      setErroIa(
        err instanceof ApiError && err.naoConfigurado
          ? 'A conversão por IA ainda não está configurada neste ambiente.'
          : err instanceof Error
          ? err.message
          : 'Não foi possível converter o feedback. Tente novamente.'
      );
    } finally {
      setIsConvertingFeedback(false);
    }
  };

  const handleApplyAiCopy = (copyData: { caption: string; hook: string; cta: string; hashtags: string[] }) => {
    updateJob(selectedJob.id, {
      caption: copyData.caption,
      cta: copyData.cta,
      hashtags: copyData.hashtags
    });
    setSelectedJob({
      ...selectedJob,
      caption: copyData.caption,
      cta: copyData.cta,
      hashtags: copyData.hashtags
    });
  };

  const handleStopAndSaveTimer = () => {
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    addTimesheetLog({
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      clientId: selectedJob.clientId,
      clientName: client?.name || 'Cliente',
      userId: currentUser.id,
      userName: currentUser.name,
      minutes,
      notes: timerNotes || 'Tempo registrado via timer ao vivo'
    });
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerNotes('');
    setSelectedJob({ ...selectedJob, timesheetMinutes: (selectedJob.timesheetMinutes || 0) + minutes });
  };

  const handleAddManualTime = () => {
    if (manualMinutes <= 0) return;
    addTimesheetLog({
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      clientId: selectedJob.clientId,
      clientName: client?.name || 'Cliente',
      userId: currentUser.id,
      userName: currentUser.name,
      minutes: manualMinutes,
      notes: timerNotes || 'Lançamento manual de horas'
    });
    setTimerNotes('');
    setSelectedJob({ ...selectedJob, timesheetMinutes: (selectedJob.timesheetMinutes || 0) + manualMinutes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar
              nome={client?.name || 'Cliente'}
              url={client?.avatar}
              tamanho={40}
              className="border border-slate-200 dark:border-slate-800"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}</span>
                <span className="text-slate-300">•</span>
                <PlatformBadge platform={selectedJob.platform} />
                <FormatBadge format={selectedJob.format} />
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:text-slate-300">
                  v{selectedJob.currentVersion}
                </span>
                <PriorityBadge priority={selectedJob.priority} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {selectedJob.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Select */}
            <select
              value={selectedJob.status}
              onChange={(e) => moveJobStatus(selectedJob.id, e.target.value as JobStatus)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ideas">Ideias</option>
              <option value="in_production">Em Produção</option>
              <option value="for_approval">Para Aprovação</option>
              <option value="in_adjustment">Em Ajuste</option>
              <option value="approved">Aprovado</option>
              <option value="scheduled">Agendado</option>
              <option value="published">Publicado</option>
            </select>

            <button
              onClick={() => setSelectedJob(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Quick Actions bar */}
        <div className="flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'content'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Conteúdo & Visualização
            </button>

            <button
              onClick={() => setActiveTab('versions')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'versions'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Versões ({selectedJob.versions.length || 1})
            </button>

            <button
              onClick={() => setActiveTab('checklist')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'checklist'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist ({selectedJob.checklist.filter(c => c.completed).length}/{selectedJob.checklist.length})
            </button>

            <button
              onClick={() => setActiveTab('comments')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'comments'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Comentários ({selectedJob.comments.length})
            </button>

            <button
              onClick={() => setActiveTab('timesheet')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'timesheet'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              Timesheet ({selectedJob.timesheetMinutes || 0}m)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWhatsAppOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg transition border border-emerald-200 dark:border-emerald-800"
              title="Disparo direto com mensagem formatada para o WhatsApp do cliente"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleCopyApprovalLink}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition"
              title="Copiar link seguro para o WhatsApp do cliente"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'Copiado!' : 'Link de Aprovação'}</span>
            </button>

            {client && <BotaoDoPortal clientId={client.id} />}
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
          {activeTab === 'content' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Visual Media Preview */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                    Artes & Mídia da Publicação
                  </span>

                  {selectedJob.mediaUrls && selectedJob.mediaUrls.length > 0 ? (
                    <div className="space-y-2">
                      <div className="aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 flex items-center justify-center">
                        <img 
                          src={selectedJob.mediaUrls[0]} 
                          alt="Post preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {selectedJob.mediaUrls.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {selectedJob.mediaUrls.map((url, i) => (
                            <img 
                              key={i} 
                              src={url} 
                              alt={`Slide ${i + 1}`} 
                              className="w-14 h-14 rounded-md object-cover border-2 border-purple-500 shrink-0" 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg border border-dashed border-slate-300 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                      <Layers className="w-10 h-10 mb-2" />
                      <p className="text-xs">Nenhuma imagem cadastrada nesta versão.</p>
                    </div>
                  )}
                </div>

                {/* Workflow dates */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CalendarIcon className="w-3.5 h-3.5 text-purple-500" />
                      Data Agendada:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatSafeDate(selectedJob.scheduledDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Deadline de Aprovação:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatSafeDate(selectedJob.deadlineApproval)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Copy & Details */}
              <div className="space-y-4">
                {/* Status Callout if in adjustment */}
                {selectedJob.status === 'in_adjustment' && selectedJob.lastFeedback && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Ajuste Solicitado pelo Cliente:</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleConvertFeedbackWithAi}
                        disabled={isConvertingFeedback}
                        className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isConvertingFeedback ? 'Convertendo...' : 'Gerar Checklist Técnico com IA'}</span>
                      </button>
                    </div>
                    <p className="italic pl-5 bg-white/60 dark:bg-black/30 p-2 rounded-lg border border-rose-100 dark:border-rose-900">
                      "{selectedJob.lastFeedback}"
                    </p>

                    {erroIa && (
                      <p className="pl-5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        {erroIa}
                      </p>
                    )}
                  </div>
                )}

                {/* Legenda formatada */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Legenda do Post
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAiCopyOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Gerar Copy com IA</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(selectedJob.caption);
                          alert('Legenda copiada para a área de transferência!');
                        }}
                        className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar texto
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-sans">
                    {selectedJob.caption || 'Sem legenda inserida.'}
                  </div>

                  {selectedJob.cta && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Chamada para Ação (CTA):</span>
                      <p className="text-xs font-semibold text-purple-700 bg-purple-50/70 p-2 rounded border border-purple-100">
                        {selectedJob.cta}
                      </p>
                    </div>
                  )}

                  {selectedJob.hashtags && selectedJob.hashtags.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Hashtags:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedJob.hashtags.map((tag, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedJob.firstComment && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Primeiro Comentário:</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/70 p-2 rounded italic">
                        {selectedJob.firstComment}
                      </p>
                    </div>
                  )}
                </div>

                {/* Approval actions toolbar */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Ações de Workflow
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => approveJob(selectedJob.id, 'Agência')}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Aprovar Conteúdo
                    </button>

                    <button
                      onClick={() => setIsAdjusting(true)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Solicitar Ajuste
                    </button>
                  </div>

                  {isAdjusting && (
                    <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200 space-y-2 animate-in fade-in duration-150">
                      <label className="block text-[11px] font-bold text-rose-800">
                        Motivo do ajuste (obrigatório):
                      </label>
                      <textarea
                        rows={2}
                        value={adjustmentFeedback}
                        onChange={(e) => setAdjustmentFeedback(e.target.value)}
                        placeholder="Ex: Trocar o slide 2 para o produto lançamento..."
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-rose-300 rounded focus:ring-2 focus:ring-rose-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsAdjusting(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSendAdjustment}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded"
                        >
                          Confirmar Pedido de Ajuste
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => duplicateJob(selectedJob.id)}
                      className="text-slate-600 dark:text-slate-400 hover:text-purple-600 flex items-center gap-1"
                    >
                      <DuplicateIcon className="w-3.5 h-3.5" />
                      Duplicar Job
                    </button>

                    <button
                      onClick={() => deleteJob(selectedJob.id)}
                      className="text-rose-600 hover:text-rose-800 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Job
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Histórico de Versões & Retrabalho</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhe todas as revisões entregues para este conteúdo.</p>
                </div>

                <button
                  onClick={() => setIsCreatingVersion(!isCreatingVersion)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Nova Versão</span>
                </button>
              </div>

              {isCreatingVersion && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-200 shadow-sm space-y-3 animate-in fade-in">
                  <h5 className="text-xs font-bold text-purple-900">Nova Versão (v{selectedJob.currentVersion + 1})</h5>
                  <div>
                    <FileUpload
                      label="Mídia / Arte Atualizada da Nova Versão"
                      compact
                      imageOnly
                      value={newVersionMedia}
                      onFileSelect={(file) => setNewVersionMedia(file.url)}
                      onFileRemove={() => setNewVersionMedia('')}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Legenda Ajustada:</label>
                    <textarea
                      rows={3}
                      value={newVersionCaption}
                      onChange={(e) => setNewVersionCaption(e.target.value)}
                      placeholder="Insira a legenda com os ajustes aplicados..."
                      className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsCreatingVersion(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateVersion}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded"
                    >
                      Salvar e Enviar para Aprovação
                    </button>
                  </div>
                </div>
              )}

              {/* Version timeline cards */}
              <div className="space-y-3">
                {selectedJob.versions.map((ver, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100 font-mono text-sm">
                      v{ver.versionNumber}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Versão {ver.versionNumber} — Enviada por {ver.submittedBy}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(ver.submittedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {ver.caption}
                      </p>

                      {ver.feedback && (
                        <div className="mt-2 text-xs p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                          <strong>Feedback do Cliente:</strong> {ver.feedback}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Checklist de Produção</h4>
              <div className="space-y-2">
                {selectedJob.checklist.map(item => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 transition cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(selectedJob.id, item.id)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className={`text-xs ${item.completed ? 'line-through text-slate-400 font-medium' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>
                      {item.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col h-96">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Comentários e Alinhamentos</h4>

              {/* Comment list */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
                {selectedJob.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">
                    Nenhum comentário até o momento. Deixe um feedback para a equipe!
                  </p>
                ) : (
                  selectedJob.comments.map(cm => (
                    <div key={cm.id} className="flex items-start gap-2.5 text-xs">
                      <img src={cm.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800/80 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{cm.authorName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(cm.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{cm.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Send comment form */}
              <form onSubmit={handleSendComment} className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  placeholder="Escreva um comentário para a equipe..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </button>
              </form>
            </div>
          )}

          {activeTab === 'timesheet' && (
            <div className="space-y-5">
              {/* Timesheet Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Tempo Total Investido
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-purple-600">
                      {Math.floor((selectedJob.timesheetMinutes || 0) / 60)}h {(selectedJob.timesheetMinutes || 0) % 60}m
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      ({selectedJob.timesheetMinutes || 0} minutos)
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Custo Estimado da Agência
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    R$ {(((selectedJob.timesheetMinutes || 0) / 60) * 85).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Base R$ 85,00/hora de time</span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Rentabilidade do Job
                  </span>
                  <span className="text-2xl font-black text-emerald-600">
                    {(selectedJob.timesheetMinutes || 0) > 180 ? 'Alerta Horas' : 'Excelente Margem'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Dentro do escopo planejado</span>
                </div>
              </div>

              {/* Timer Tracker & Manual Entry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Live Stopwatch Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-purple-600" />
                      Cronômetro ao Vivo
                    </span>
                    {timerRunning && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Gravando
                      </span>
                    )}
                  </div>

                  <div className="text-center py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-4xl font-mono font-black text-slate-900 dark:text-white tracking-widest">
                      {String(Math.floor(timerSeconds / 3600)).padStart(2, '0')}:
                      {String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0')}:
                      {String(timerSeconds % 60).padStart(2, '0')}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={timerNotes}
                    onChange={(e) => setTimerNotes(e.target.value)}
                    placeholder="Descrição da atividade (Ex: Criação da arte 3D...)"
                    className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  />

                  <div className="flex items-center gap-2">
                    {!timerRunning ? (
                      <button
                        type="button"
                        onClick={() => setTimerRunning(true)}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Iniciar Timer</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTimerRunning(false)}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <span>Pausar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={timerSeconds === 0}
                      onClick={handleStopAndSaveTimer}
                      className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>

                {/* Manual Time Entry Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-purple-600" />
                    Lançamento Manual de Horas
                  </span>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                      Tempo em Minutos:
                    </label>
                    <div className="flex items-center gap-2">
                      {[15, 30, 45, 60, 120].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setManualMinutes(mins)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                            manualMinutes === mins
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          +{mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <input
                      type="number"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(Number(e.target.value))}
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                      placeholder="Minutos"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualTime}
                    className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Registrar {manualMinutes} Minutos no Job</span>
                  </button>
                </div>
              </div>

              {/* Timesheet Logs History Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Histórico de Registros de Tempo ({timesheetLogs.filter(t => t.jobId === selectedJob.id).length})
                </span>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {timesheetLogs
                    .filter(t => t.jobId === selectedJob.id)
                    .map(log => (
                      <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200">{log.userName}</strong>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px]">{log.notes || 'Sem descrição'}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-purple-600">{log.minutes} min</span>
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(log.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}

                  {timesheetLogs.filter(t => t.jobId === selectedJob.id).length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Nenhum tempo lançado para este job até o momento.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals */}
      <AiCopyModal
        isOpen={isAiCopyOpen}
        onClose={() => setIsAiCopyOpen(false)}
        clientId={selectedJob.clientId}
        initialTheme={selectedJob.title}
        onApplyCopy={handleApplyAiCopy}
      />

      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        job={selectedJob}
      />
    </div>
  );
};
