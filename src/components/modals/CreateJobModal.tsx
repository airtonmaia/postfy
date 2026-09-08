import React, { useState, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { X, Plus, Sparkles, Image, Calendar, Layers } from 'lucide-react';
import { JobPlatform, JobFormat, JobPriority, JobStatus } from '../../types';
import { MediaUploader } from '../common/MediaUploader';

export const CreateJobModal: React.FC = () => {
  const { 
    isCreateJobModalOpen, 
    closeCreateJobModal, 
    createJobPreselectedDate, 
    clients, 
    createJob,
    setSelectedJob
  } = usePostfy();

  const [clientId, setClientId] = useState(clients[0]?.id || 'c-1');
  const [title, setTitle] = useState('');
  const [campaign, setCampaign] = useState('Conteúdo Institucional');
  const [platform, setPlatform] = useState<JobPlatform>('instagram');
  const [format, setFormat] = useState<JobFormat>('feed');
  const [priority, setPriority] = useState<JobPriority>('medium');
  const [status, setStatus] = useState<JobStatus>('ideas');
  const [caption, setCaption] = useState('');
  const [cta, setCta] = useState('');
  const [hashtagsStr, setHashtagsStr] = useState('#Novidade #Marketing');
  const [firstComment, setFirstComment] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
  ]);
  const [scheduledDate, setScheduledDate] = useState('');

  // Keep clientId valid if clients list changes
  useEffect(() => {
    if (clients.length > 0 && (!clientId || !clients.some(c => c.id === clientId))) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId, isCreateJobModalOpen]);

  useEffect(() => {
    if (createJobPreselectedDate) {
      try {
        const d = new Date(createJobPreselectedDate);
        if (!isNaN(d.getTime())) {
          const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setScheduledDate(isoLocal);
        } else {
          throw new Error('Invalid date');
        }
      } catch {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        d.setHours(10, 0, 0, 0);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setScheduledDate(isoLocal);
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(10, 0, 0, 0);
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setScheduledDate(isoLocal);
    }
  }, [createJobPreselectedDate, isCreateJobModalOpen]);

  if (!isCreateJobModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor informe o título do conteúdo.');
      return;
    }

    try {
      const tags = hashtagsStr.split(' ').map(t => t.trim()).filter(t => t.length > 0);

      // Safe Date Parsing
      let targetDate = new Date();
      if (scheduledDate) {
        const parsed = new Date(scheduledDate);
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed;
        }
      }

      const scheduledTime = targetDate.getTime();
      const scheduledIso = targetDate.toISOString();
      const deadlineProdIso = new Date(Math.max(Date.now(), scheduledTime - 86400000 * 2)).toISOString();
      const deadlineApprIso = new Date(Math.max(Date.now(), scheduledTime - 86400000 * 1)).toISOString();

      const filteredMedia = mediaUrls.filter(u => u.trim().length > 0);
      const finalMedia = filteredMedia.length > 0 
        ? filteredMedia 
        : ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'];

      const selectedClientId = clientId && clients.some(c => c.id === clientId) 
        ? clientId 
        : (clients[0]?.id || 'c-1');

      const newJob = createJob({
        clientId: selectedClientId,
        title: title.trim(),
        campaign: campaign.trim() || 'Geral',
        platform,
        format,
        priority,
        status,
        caption: caption.trim(),
        cta: cta.trim(),
        hashtags: tags,
        firstComment: firstComment.trim(),
        mediaUrls: finalMedia,
        scheduledDate: scheduledIso,
        deadlineProduction: deadlineProdIso,
        deadlineApproval: deadlineApprIso,
      });

      // Reset form fields
      setTitle('');
      setCaption('');
      setCta('');
      setFirstComment('');

      closeCreateJobModal();
      if (newJob) {
        setSelectedJob(newJob);
      }
    } catch (err) {
      console.error('Erro ao cadastrar conteúdo:', err);
      alert('Ocorreu um erro ao cadastrar a postagem. Por favor verifique os dados e tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Novo Conteúdo</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Planejar Postagem / Job</h3>
          </div>
          <button
            onClick={closeCreateJobModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cliente *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Campaign */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Campanha / Tema</label>
              <input
                type="text"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="Ex: Lançamento Inverno 2025"
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título do Conteúdo *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 5 Dicas para Escolher o Melhor Café Especial"
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Platform */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rede Social</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as JobPlatform)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
                <option value="twitter">X / Twitter</option>
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Formato</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as JobFormat)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="feed">Feed Estático</option>
                <option value="carousel">Carrossel (Múltiplas Telas)</option>
                <option value="reel">Reel / Vídeo Curto</option>
                <option value="story">Story</option>
                <option value="video">Vídeo Longo</option>
                <option value="article">Artigo / Newsletter</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JobPriority)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scheduled Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Data e Hora de Publicação</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status Inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="ideas">Ideia / Pauta</option>
                <option value="in_production">Em Produção</option>
                <option value="for_approval">Para Aprovação</option>
                <option value="approved">Já Aprovado</option>
                <option value="scheduled">Agendado</option>
              </select>
            </div>
          </div>

          {/* Media Uploader (Multi-files & Drag-and-drop) */}
          <div className="pt-1">
            <MediaUploader 
              mediaUrls={mediaUrls} 
              onChange={setMediaUrls} 
              maxFiles={10} 
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Legenda Proposta</label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Digite aqui o texto que acompanhará a publicação..."
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CTA */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Chamada para Ação (CTA)</label>
              <input
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Ex: Clique no link da bio..."
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hashtags</label>
              <input
                type="text"
                value={hashtagsStr}
                onChange={(e) => setHashtagsStr(e.target.value)}
                placeholder="#tag1 #tag2..."
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeCreateJobModal}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-sm shadow-purple-200 transition"
            >
              Criar Conteúdo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
