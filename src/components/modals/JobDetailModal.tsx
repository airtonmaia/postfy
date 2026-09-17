import React, { useState } from 'react';
import { novoId } from '../../lib/sincronizacao';
import { urlDoPortalDaAgencia } from '../../lib/rotas';
import { BotaoDoPortal } from '../common/BotaoDoPortal';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard, safeDateFormat, safeDateTimeFormat, safeTimeFormat } from '../../lib/utils';
import {
  PlatformBadge,
  FormatBadge,
  StatusBadge,
  PriorityBadge,
  VersaoBadge,
  rotuloDaPrioridade,
} from '../common/Badges';
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
import { JobPriority, JobStatus, JobVersion } from '../../types';
import { AiCopyModal } from './AiCopyModal';
import { ApiError } from '../../lib/api';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { FileUpload } from '../ui/file-upload';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsBadge } from '../ui/tabs';
import { MediaUploader } from '../common/MediaUploader';
import { CampoEditavel, DataEditavel } from '../common/CampoEditavel';
import { SeloEditavel } from '../common/SeloEditavel';
import { formatosComuns, rotuloDoFormato } from '../../lib/formatos';
import { publicarAgora } from '../../lib/redes';

/**
 * As prioridades, na ordem em que elas crescem.
 *
 * O rótulo sai do próprio `PriorityBadge`, que é quem já os tinha — repetir a
 * tradução aqui faria "Média" virar "Media" num lado só na primeira pressa.
 */
const PRIORIDADES: JobPriority[] = ['low', 'medium', 'high', 'urgent'];

const formatSafeDate = (dateStr?: string, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateStr) return 'Não definida';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Data inválida';
    // Delega para o helper compartilhado, que leva o fuso da agência. Esta
    // cópia existia só pelos textos de fallback, e por isso ficou de fora da
    // correção de fuso sem ninguém notar.
    return safeDateTimeFormat(d, options);
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
  const [abaDoTexto, setAbaDoTexto] = useState<'legenda' | 'rascunho'>('legenda');
  const [publicando, setPublicando] = useState(false);
  /**
   * O que a Meta respondeu, em linha e não em diálogo.
   *
   * É o mesmo desenho do "Publicar agora" da modal de cadastro, de propósito:
   * é a mesma ação, com a mesma resposta. E aviso de sucesso não é caso de
   * `useAviso` — "deu certo" não merece uma caixa que precisa ser fechada; o
   * erro fica em texto justamente para continuar legível enquanto a pessoa
   * relê a peça.
   */
  const [resultadoDaPublicacao, setResultadoDaPublicacao] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);
  const [commentText, setCommentText] = useState('');
  // "Copiado!" é confirmação de que deu certo — merece um ícone que muda por
  // dois segundos, não uma caixa que a pessoa precisa fechar para seguir.
  const [legendaCopiada, setLegendaCopiada] = useState(false);
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

  /**
   * Os formatos que cabem nas redes desta peça.
   *
   * Sai de `lib/formatos.ts`, a mesma tabela que o cadastro usa: oferecer aqui
   * a lista inteira deixaria trocar uma peça do YouTube para "Story", que não
   * existe lá — e o erro só apareceria na hora de publicar.
   */
  const formatosDaPeca = formatosComuns(selectedJob.canais?.length ? selectedJob.canais : [selectedJob.platform]);

  const handleCopyApprovalLink = () => {
    // Levava `?portal=<id do cliente>`, e o portal espera o token opaco: o
    // cliente abria numa tela vazia. Agora leva a agência, e quem chega prova
    // quem é pelo código no e-mail — que é o que decide o que ele enxerga.
    const url = urlDoPortalDaAgencia(currentWorkspace.slug, window.location.origin);
    copyToClipboard(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEnviarParaAprovacao = () => {
    if (!selectedJob) return;
    /**
     * Só muda o status. Quem avisa o cliente é `dispararAutomacoes`, pelo
     * evento `conteudo_aguardando_aprovacao` — e ele respeita a preferência de
     * "cada" ou "lote" da agência, que é a razão de a checagem morar lá e não
     * aqui (armadilha 9.2).
     */
    updateJob(selectedJob.id, { status: 'for_approval' });
  };

  const handlePublicarAgora = async () => {
    if (!selectedJob) return;
    setPublicando(true);
    setResultadoDaPublicacao(null);
    try {
      const { conta, aviso } = await publicarAgora(selectedJob.id);
      /**
       * `aviso` é o caso do feed que saiu e do story que não. Ele não pode ler
       * como sucesso liso: a peça está no perfil pela metade, e é isso que a
       * tela precisa dizer.
       */
      setResultadoDaPublicacao(
        aviso
          ? { ok: false, texto: aviso }
          : { ok: true, texto: `Publicado em @${conta}.` }
      );
    } catch (e) {
      /**
       * A falha traz o motivo que o servidor deu. "Publicado" sem conferir
       * seria a tela afirmando o que não aconteceu — e publicação no perfil do
       * cliente é o pior lugar para isso.
       */
      setResultadoDaPublicacao({
        ok: false,
        texto: e instanceof Error ? e.message : 'Falha ao publicar.',
      });
    } finally {
      setPublicando(false);
    }
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
    /*
      **No celular a modal ocupa a tela inteira, e isso é decisão.**

      Centrada com `p-4` em volta, ela perdia 32px de largura dos 390 que o
      aparelho tem — e esta modal é um editor denso, com selo, seletor de
      status, abas e duas colunas. O que sobrava espremia tudo: o nome do
      cliente quebrava em três linhas e o título virava "D..".

      O canto sai junto: `rounded-2xl` é o canto de uma superfície **sobre**
      outra, e em tela cheia não há o "sobre" — o arredondado deixaria quatro
      cantos do fundo aparecendo. É a única exceção ao vocabulário de canto, e
      ela vale só abaixo do `sm`.
    */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-full sm:h-auto max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/*
          Header — **empilha no celular.**

          Era `flex items-center justify-between gap-4`: a identidade e os
          controles disputavam os 390px, e quem perdia era a identidade. O
          seletor de status sozinho levava 290px.
        */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-950/70">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Avatar
              nome={client?.name || 'Cliente'}
              url={client?.avatar}
              tamanho={40}
              className="border border-slate-200 dark:border-slate-800"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}</span>
                <span className="text-slate-300">•</span>

                {/* A rede fica de leitura: trocá-la muda o que a peça pode
                    ser (formato, limite de texto, campos do canal) e pode
                    deixar uma arte de 9:16 num feed 4:5. É decisão do
                    cadastro, não um clique no cabeçalho. */}
                <PlatformBadge platform={selectedJob.platform} />

                <SeloEditavel
                  valor={selectedJob.format}
                  rotulo="Formato"
                  opcoes={formatosDaPeca.map((f) => ({
                    valor: f.valor,
                    rotulo: f.rotulo,
                    // O nome que **esta rede** dá ao formato: "Reels" no
                    // Instagram, "Short" no YouTube. Sem isto o menu dizia
                    // "Reel" enquanto o cadastro, do lado, oferecia "Reels".
                    amostra: <FormatBadge format={f.valor} rotulo={f.rotulo} />,
                  }))}
                  aoTrocar={(f) => updateJob(selectedJob.id, { format: f })}
                >
                  <FormatBadge
                    format={selectedJob.format}
                    rotulo={rotuloDoFormato(selectedJob.format, selectedJob.platform)}
                  />
                </SeloEditavel>

                <VersaoBadge versao={selectedJob.currentVersion} />

                <SeloEditavel
                  valor={selectedJob.priority}
                  rotulo="Prioridade"
                  opcoes={PRIORIDADES.map((p) => ({
                    valor: p,
                    rotulo: rotuloDaPrioridade(p),
                    amostra: <PriorityBadge priority={p} />,
                  }))}
                  aoTrocar={(p) => updateJob(selectedJob.id, { priority: p })}
                >
                  <PriorityBadge priority={selectedJob.priority} />
                </SeloEditavel>
              </div>

              {/* O título vira campo ao ser clicado, como a legenda. Ele era o
                  único dado do cabeçalho que exigia abrir outra tela para
                  corrigir um erro de digitação. */}
              <CampoEditavel
                valor={selectedJob.title}
                tipo="texto"
                vazio="Sem título. Clique para dar um."
                placeholder="O título do conteúdo"
                className="-ml-1.5 px-1.5 py-0.5 mt-0.5"
                aoSalvar={(t) => updateJob(selectedJob.id, { title: t })}
              >
                <span className="block text-base font-bold text-slate-900 dark:text-white truncate">
                  {selectedJob.title || 'Sem título'}
                </span>
              </CampoEditavel>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Select — no celular ele toma a largura da linha; no
                desktop volta a caber pelo próprio conteúdo. */}
            <select
              value={selectedJob.status}
              onChange={(e) => moveJobStatus(selectedJob.id, e.target.value as JobStatus)}
              className="flex-1 sm:flex-none min-w-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ideas">Ideias</option>
              <option value="in_production">Em Produção</option>
              <option value="for_approval">Para Aprovação</option>
              <option value="in_adjustment">Em Ajuste</option>
              <option value="approved">Aprovado</option>
              <option value="scheduled">Agendado</option>
              <option value="published">Publicado</option>
            </select>

            <Button variant="ghost" size="icon-sm"
              onClick={() => setSelectedJob(null)}
              className="dark:text-slate-300 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/*
          Navigation Tabs & Quick Actions bar

          **`min-w-0` na lista de abas é o que faz ela rolar.** Sem ele, o
          `justify-between` espremia a lista até 146px de 868px de conteúdo — e
          como ela é filha de um flex, o `min-width:auto` padrão impedia que
          ela encolhesse de forma controlada: as abas sumiam por baixo do botão
          ao lado em vez de virar uma faixa rolável. Medido em 390px.
        */}
        <div className="flex items-center gap-2 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <TabsList
            aparencia="painel"
            className="flex-1 min-w-0 border-b-0 px-0 rounded-none bg-transparent dark:bg-transparent"
          >
            <TabsTrigger value="content">
              <FileText className="w-3.5 h-3.5" />
              Conteúdo &amp; Visualização
            </TabsTrigger>
            <TabsTrigger value="versions">
              <History className="w-3.5 h-3.5" />
              Versões ({selectedJob.versions.length || 1})
            </TabsTrigger>
            <TabsTrigger value="checklist">
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist ({selectedJob.checklist.filter(c => c.completed).length}/{selectedJob.checklist.length})
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="w-3.5 h-3.5" />
              Comentários ({selectedJob.comments.length})
            </TabsTrigger>
            <TabsTrigger value="timesheet">
              <Timer className="w-3.5 h-3.5" />
              Timesheet ({selectedJob.timesheetMinutes || 0}m)
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setIsWhatsAppOpen(true)}
              aria-label="Compartilhamento"
              className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-800"
              title="Disparo direto com mensagem formatada para o WhatsApp do cliente"
            >
              <Share2 className="w-3.5 h-3.5" />
              {/*
                "Compartilhamento" e não "WhatsApp": o botão abre a tela de
                compartilhar, e o WhatsApp é um dos destinos dela, não o nome
                dela.

                **O rótulo some no celular, o ícone fica.** Ele levava 180px
                dos 390 e era o que espremia as cinco abas ao lado. Não vira
                `size="icon"` de propósito: aquele tamanho é um quadrado fixo
                e o texto escaparia para fora da área clicável — aqui o botão
                só encolhe até o ícone, e o `aria-label` mantém o nome para
                quem lê por leitor de tela.
              */}
              <span className="hidden sm:inline">Compartilhamento</span>
            </Button>

            {/*
              **"Portal do Cliente" e "Copiar link" saíram desta barra.**

              Os dois levam para fora do conteúdo que está aberto: um abre a
              prévia do portal inteiro, o outro copia um endereço. Numa barra
              cujo resto é ação **sobre esta peça**, eles competiam com
              "aprovar" e "publicar" pelo mesmo olhar — e o portal continua a
              um clique na ficha do cliente, que é onde ele pertence.
            */}
          </div>
        </div>

        {/* Tab Content Body */}
        {/* `p-6` custava 48px dos 390 do aparelho, e o que sobrava era o que
            espremia os cards de dentro. */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/50">
          <TabsContent value="content">
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
                    /*
                      **Onde dizia "Nenhuma imagem cadastrada nesta versão" agora
                      dá para cadastrar.**

                      A frase estava certa e não servia para nada: ela informava
                      a falta e deixava a pessoa procurar outra tela para
                      resolvê-la. O campo de envio no mesmo lugar responde à
                      mesma pergunta e resolve.
                    */
                    <MediaUploader
                      mediaUrls={selectedJob.mediaUrls || []}
                      onChange={(urls) => updateJob(selectedJob.id, { mediaUrls: urls })}
                      maxFiles={10}
                      label=""
                      helperText="Nenhuma arte nesta versão ainda. Envie aqui."
                    />
                  )}
                </div>

                {/* Workflow dates */}
                {/*
                  **As duas datas ficam uma embaixo da outra, e isso foi
                  medido.** Lado a lado dentro desta coluna sobram ~195px por
                  cartão: o rótulo quebra em três linhas e a data — que é a
                  informação — sai como "20/09/...". Empilhadas, cada uma tem a
                  largura da coluna e cabe inteira, com o "Editar" ao lado.
                */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-col gap-2">
                  <DataEditavel
                    rotulo="Data agendada"
                    valorIso={selectedJob.scheduledDate}
                    formatar={formatSafeDate}
                    Icone={CalendarIcon}
                    corDoIcone="text-purple-500"
                    aoSalvar={(iso) => updateJob(selectedJob.id, { scheduledDate: iso })}
                  />
                  <DataEditavel
                    rotulo="Deadline de aprovação"
                    valorIso={selectedJob.deadlineApproval}
                    formatar={formatSafeDate}
                    Icone={Clock}
                    corDoIcone="text-amber-500"
                    aoSalvar={(iso) => updateJob(selectedJob.id, { deadlineApproval: iso })}
                  />
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
                      <Button
                        type="button"
                        onClick={handleConvertFeedbackWithAi}
                        disabled={isConvertingFeedback}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isConvertingFeedback ? 'Convertendo...' : 'Gerar Checklist Técnico com IA'}</span>
                      </Button>
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
                  {/* `flex-wrap`: com os dois botões na mesma linha o título
                      quebrava em "LEGENDA / DO POST" em vez de a linha
                      dobrar. */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Legenda do Post
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => setIsAiCopyOpen(true)}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Gerar Copy com IA</span>
                      </Button>
                      <Button variant="ghost"
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(selectedJob.caption);
                          setLegendaCopiada(true);
                          setTimeout(() => setLegendaCopiada(false), 2000);
                        }}
                        className="text-purple-600 hover:underline"
                      >
                        {legendaCopiada ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {legendaCopiada ? 'Copiado!' : 'Copiar texto'}
                      </Button>
                    </div>
                  </div>
                  {/*
                    **A legenda e o rascunho dividem o lugar, como no cadastro.**

                    São os dois textos da mesma peça, e só um é publicado — por
                    isso a aba é `segmentado` e não sublinhado: o sublinhado, sob
                    um painel, leria como se a tela tivesse trocado.

                    Clicar no texto abre a edição, que é o que o documento pediu.
                    Antes a legenda era só leitura aqui: corrigir uma vírgula
                    exigia outra tela.
                  */}
                  <Tabs
                    value={abaDoTexto}
                    onValueChange={(v) => setAbaDoTexto(v as 'legenda' | 'rascunho')}
                    className="space-y-2"
                  >
                    <TabsList aparencia="segmentado">
                      <TabsTrigger value="legenda">Legenda</TabsTrigger>
                      <TabsTrigger value="rascunho">
                        Rascunho
                        {(selectedJob.draft || '').trim() !== '' && <TabsBadge>1</TabsBadge>}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="legenda">
                      <CampoEditavel
                        valor={selectedJob.caption || ''}
                        tipo="textoLongo"
                        linhas={8}
                        vazio="Sem legenda inserida. Clique para escrever."
                        placeholder="O texto que acompanha a publicação..."
                        className="bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800/80 max-h-56 overflow-y-auto"
                        aoSalvar={(texto) => updateJob(selectedJob.id, { caption: texto })}
                      />
                    </TabsContent>

                    <TabsContent value="rascunho">
                      <CampoEditavel
                        valor={selectedJob.draft || ''}
                        tipo="textoLongo"
                        linhas={8}
                        vazio="Sem rascunho. Clique para escrever."
                        placeholder="Rascunho da legenda, ideias de gancho, o que o cliente pediu na reunião."
                        className="bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800/80 max-h-56 overflow-y-auto"
                        aoSalvar={(texto) => updateJob(selectedJob.id, { draft: texto })}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Fica só aqui dentro: não entra na publicação nem aparece na prévia.
                      </p>
                    </TabsContent>
                  </Tabs>

                  {/*
                    **CTA, hashtags e primeiro comentário aparecem sempre, e
                    não só quando já têm valor.**

                    Eles eram `{campo && (...)}`: vazios, sumiam da tela — e o
                    que some não pode ser preenchido. Era o mesmo problema da
                    frase "nenhuma imagem cadastrada": a tela informava a falta
                    e mandava procurar outra tela para resolvê-la.
                  */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      Chamada para Ação (CTA)
                    </span>
                    <CampoEditavel
                      valor={selectedJob.cta || ''}
                      vazio="Sem CTA. Clique para escrever."
                      placeholder="Ex: Comente EU QUERO para receber o link"
                      className="p-2 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900"
                      aoSalvar={(t) => updateJob(selectedJob.id, { cta: t })}
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      Hashtags
                    </span>
                    {/*
                      **A lista viaja como texto separado por espaço.**

                      É como a pessoa escreve hashtag, e é como ela cola de
                      outro lugar. A `#` é acrescentada na volta: quem digita
                      "verao" espera uma hashtag, não um erro silencioso na
                      publicação.
                    */}
                    <CampoEditavel
                      valor={(selectedJob.hashtags || []).join(' ')}
                      vazio="Sem hashtags. Clique para escrever."
                      placeholder="#verao #promo #novidade"
                      aoSalvar={(texto) =>
                        updateJob(selectedJob.id, {
                          hashtags: texto
                            .split(/[\s,]+/)
                            .map((t) => t.trim().replace(/^#*/, ''))
                            .filter(Boolean)
                            .map((t) => `#${t}`),
                        })
                      }
                    >
                      {selectedJob.hashtags && selectedJob.hashtags.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {selectedJob.hashtags.map((tag, i) => (
                            <Badge key={i} tom="neutro" className="font-mono">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="block text-xs text-slate-400 italic">
                          Sem hashtags. Clique para escrever.
                        </span>
                      )}
                    </CampoEditavel>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      Primeiro Comentário
                    </span>
                    <CampoEditavel
                      valor={selectedJob.firstComment || ''}
                      tipo="textoLongo"
                      linhas={3}
                      vazio="Sem primeiro comentário. Clique para escrever."
                      placeholder="O que vai no primeiro comentário do post — hashtags, link, crédito."
                      className="p-2 bg-slate-100 dark:bg-slate-800/70"
                      aoSalvar={(t) => updateJob(selectedJob.id, { firstComment: t })}
                    />
                  </div>
                </div>

                {/* Approval actions toolbar */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Ações de Workflow
                  </span>

                  {/*
                    **Duas ações principais, e elas são as do fluxo.**

                    Antes eram "Aprovar Conteúdo" e "Solicitar Ajuste" no lugar
                    de destaque — e essas duas são o que o **cliente** decide,
                    no portal. A agência, olhando a peça pronta, decide outra
                    coisa: mandar para o cliente ou pôr no ar.

                    As de aprovação continuam, logo abaixo e **só quando
                    significam algo**: com a peça aguardando o cliente. Fora
                    desse momento elas eram quatro botões disputando o mesmo
                    olhar com os dois que importam.
                  */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleEnviarParaAprovacao}
                      disabled={selectedJob.status === 'for_approval'}
                      title={
                        selectedJob.status === 'for_approval'
                          ? 'Esta peça já está com o cliente'
                          : 'Manda para o cliente aprovar no portal'
                      }
                    >
                      <Send className="w-4 h-4" />
                      Enviar para aprovação
                    </Button>

                    <Button
                      variant="success"
                      onClick={handlePublicarAgora}
                      disabled={publicando || selectedJob.status === 'published'}
                      title={
                        selectedJob.status === 'published'
                          ? 'Esta peça já foi publicada'
                          : 'Publica no perfil conectado do cliente, agora'
                      }
                    >
                      <Send className="w-4 h-4" />
                      {publicando ? 'Publicando...' : 'Publicar agora'}
                    </Button>
                  </div>

                  {/*
                    O que a Meta respondeu, com o texto que ela mandou.

                    Enfileirar e esperar o cron faz a falha aparecer cinco
                    minutos depois, escrita em `last_error`, num canto do
                    banco. Aqui ela aparece na tela.
                  */}
                  {resultadoDaPublicacao && (
                    <p
                      className={`text-[11px] font-semibold p-2 rounded-lg border ${
                        resultadoDaPublicacao.ok
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
                          : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                      }`}
                    >
                      {resultadoDaPublicacao.texto}
                    </p>
                  )}

                  {/* As decisões do cliente, no momento em que elas existem. */}
                  {selectedJob.status === 'for_approval' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="success"
                        onClick={() => approveJob(selectedJob.id, 'Agência')}
                        className="active:bg-emerald-800"
                      >
                        <Check className="w-4 h-4" />
                        Aprovar pelo cliente
                      </Button>

                      <Button variant="destructive"
                        onClick={() => setIsAdjusting(true)}
                        // O par escuro faltava: no modo escuro o botão ficava
                        // com o rosa claro do modo claro, do lado de um verde
                        // escuro — o único elemento da modal sem par.
                        className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {/* "Registrar ajuste pedido" não cabia na metade da
                            grade: a base tem `whitespace-nowrap`, então o
                            texto escapava para fora da área clicável — o que
                            a pessoa lê deixava de ser o que ela clica. */}
                        Registrar ajuste
                      </Button>
                    </div>
                  )}

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
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost"
                          onClick={() => setIsAdjusting(false)}
                          className="hover:bg-slate-200"
                        >
                          Cancelar
                        </Button>
                        <Button variant="destructive"
                          onClick={handleSendAdjustment}
                          className="bg-rose-600 text-white"
                        >
                          Confirmar Pedido de Ajuste
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <Button variant="ghost"
                      onClick={() => duplicateJob(selectedJob.id)}
                    >
                      <DuplicateIcon className="w-3.5 h-3.5" />
                      Duplicar Job
                    </Button>

                    <Button variant="destructive"
                      onClick={() => deleteJob(selectedJob.id)}
                      className="text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Job
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="versions">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Histórico de Versões & Retrabalho</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhe todas as revisões entregues para este conteúdo.</p>
                </div>

                <Button
                  onClick={() => setIsCreatingVersion(!isCreatingVersion)}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Nova Versão</span>
                </Button>
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
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost"
                      onClick={() => setIsCreatingVersion(false)}
                      className="dark:bg-slate-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateVersion}
                    >
                      Salvar e Enviar para Aprovação
                    </Button>
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
                          {safeDateFormat(ver.submittedAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {ver.caption}
                      </p>

                      {ver.feedback && (
                        <div className="mt-2 text-xs p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                          <strong>Feedback do Cliente:</strong> {ver.feedback}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="checklist">
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
                      className="w-4 h-4 rounded-md text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className={`text-xs ${item.completed ? 'line-through text-slate-400 font-medium' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>
                      {item.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments">
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
                            {safeTimeFormat(cm.createdAt)}
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
                <Button
                  type="submit"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="timesheet">
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
                      <Button
                        type="button"
                        onClick={() => setTimerRunning(true)}
                        className="flex-1"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Iniciar Timer</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => setTimerRunning(false)}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <span>Pausar</span>
                      </Button>
                    )}

                    <Button variant="success"
                      type="button"
                      disabled={timerSeconds === 0}
                      onClick={handleStopAndSaveTimer}

                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Salvar</span>
                    </Button>
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
                      {/* Escolha entre opções, não ação: o roxo aqui quer dizer
                          "selecionado". A variante vai na prop em vez de numa
                          string condicional, para o tamanho continuar vindo da
                          escala — era `py-1.5`, que não fechava com nenhum
                          outro botão da modal. */}
                      {[15, 30, 45, 60, 120].map(mins => (
                        <Button
                          key={mins}
                          variant={manualMinutes === mins ? 'primary' : 'outline'}
                          type="button"
                          onClick={() => setManualMinutes(mins)}
                        >
                          +{mins}m
                        </Button>
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

                  <Button
                    type="button"
                    onClick={handleAddManualTime}
                    className="w-full bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white"
                  >
                    <Check className="w-4 h-4" />
                    <span>Registrar {manualMinutes} Minutos no Job</span>
                  </Button>
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
                            {safeDateFormat(log.createdAt)}
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
          </TabsContent>
        </div>
      </Tabs>

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
