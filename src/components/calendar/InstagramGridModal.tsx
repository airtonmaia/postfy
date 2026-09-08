import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { 
  X, 
  Instagram, 
  Grid3X3, 
  Film, 
  Layers, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Job } from '../../types';

interface InstagramGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClientId?: string;
}

export const InstagramGridModal: React.FC<InstagramGridModalProps> = ({
  isOpen,
  onClose,
  initialClientId
}) => {
  const { clients, jobs, setSelectedJob } = usePostfy();
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId || clients[0]?.id || ''
  );
  const [previewJob, setPreviewJob] = useState<Job | null>(null);

  if (!isOpen) return null;

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  // Filter client's Instagram jobs sorted by publish date descending
  const clientJobs = jobs
    .filter(j => j.clientId === selectedClientId && (j.platform === 'instagram' || !j.platform))
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  // Fill up to at least 9 or 12 grid cells for realistic 3x3 layout
  const gridCells = [...clientJobs];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-xs">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Simulador Visual de Feed (Grid 3x3)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                  Instagram
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualize a harmonia estética, paleta de cores e ordem dos posts antes de publicar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Client selector */}
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-start justify-center bg-slate-100 dark:bg-slate-950">
          
          {/* Simulated Smartphone Shell */}
          <div className="w-full max-w-sm mx-auto bg-white dark:bg-black rounded-[40px] p-3.5 shadow-2xl border-4 border-slate-800 dark:border-slate-800 shrink-0">
            {/* Phone Notch */}
            <div className="w-28 h-4 bg-slate-800 dark:bg-slate-800 rounded-full mx-auto mb-3" />

            {/* Instagram Profile Header */}
            <div className="px-2 py-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  @{currentClient?.name.toLowerCase().replace(/\s+/g, '')}
                </span>
                <span className="text-[11px] text-slate-400">•••</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                    <img
                      src={currentClient?.avatar}
                      alt=""
                      className="w-full h-full rounded-full object-cover border-2 border-white dark:border-black"
                    />
                  </div>
                </div>

                <div className="flex-1 flex justify-around text-center">
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                      {clientJobs.length}
                    </span>
                    <span className="text-[10px] text-slate-400">posts</span>
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white block">14.8k</span>
                    <span className="text-[10px] text-slate-400">seguidores</span>
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white block">482</span>
                    <span className="text-[10px] text-slate-400">seguindo</span>
                  </div>
                </div>
              </div>

              <div>
                <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                  {currentClient?.name}
                </strong>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-tight">
                  {currentClient?.briefing?.brandVoice || `${currentClient?.segment} • Especialistas em excelência e posicionamento digital.`}
                </p>
                {currentClient?.website && (
                  <span className="text-[10px] text-blue-500 font-medium truncate block mt-0.5">
                    {currentClient.website}
                  </span>
                )}
              </div>

              {/* Action Tabs Bar */}
              <div className="flex justify-around border-t border-slate-100 dark:border-slate-800 pt-2 text-slate-900 dark:text-white">
                <Grid3X3 className="w-4 h-4 text-purple-600 border-b-2 border-purple-600 pb-0.5" />
                <Film className="w-4 h-4 text-slate-400" />
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* 3x3 Grid of Posts */}
            <div className="grid grid-cols-3 gap-1 mt-2 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 p-0.5">
              {gridCells.map((job) => {
                const isSelected = previewJob?.id === job.id;
                const mediaUrl = job.mediaUrls[0] || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';

                return (
                  <div
                    key={job.id}
                    onClick={() => setPreviewJob(job)}
                    className={`aspect-square relative group cursor-pointer overflow-hidden rounded-md transition ${
                      isSelected ? 'ring-2 ring-purple-600' : ''
                    }`}
                  >
                    <img
                      src={mediaUrl}
                      alt={job.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Format Badge Top Right */}
                    <div className="absolute top-1 right-1">
                      {job.format === 'carousel' && (
                        <div className="p-1 rounded-sm bg-black/60 text-white backdrop-blur-xs">
                          <Layers className="w-2.5 h-2.5" />
                        </div>
                      )}
                      {job.format === 'reels' && (
                        <div className="p-1 rounded-sm bg-black/60 text-white backdrop-blur-xs">
                          <Film className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Status Pill Bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[9px] text-white">
                      <span className="truncate max-w-[80%] font-medium">
                        {new Date(job.scheduledDate).getDate()}/{new Date(job.scheduledDate).getMonth() + 1}
                      </span>
                      {job.status === 'published' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                      {job.status === 'scheduled' && <Clock className="w-2.5 h-2.5 text-blue-400" />}
                    </div>
                  </div>
                );
              })}

              {gridCells.length === 0 && (
                <div className="col-span-3 py-16 text-center text-xs text-slate-400">
                  Nenhum post agendado para o Instagram deste cliente.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Post Inspector */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 w-full">
            {previewJob ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
                      Post Selecionado na Grade
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {previewJob.title}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Data prevista: <strong>{new Date(previewJob.scheduledDate).toLocaleDateString('pt-BR')} às {new Date(previewJob.scheduledDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedJob(previewJob);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Editar no Kanban
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-square">
                    <img
                      src={previewJob.mediaUrls[0] || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Formato & Status</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                          {previewJob.format}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold uppercase text-[10px]">
                          {previewJob.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Legenda (Copy)</span>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto whitespace-pre-line text-[11px] leading-relaxed">
                        {previewJob.caption || 'Sem legenda cadastrada ainda.'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Hashtags</span>
                      <div className="flex flex-wrap gap-1">
                        {previewJob.hashtags?.map((tag, i) => (
                          <span key={i} className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 space-y-3">
                <Grid3X3 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Clique em qualquer quadrado do smartphone
                </h5>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Selecione um post na grade para inspecionar criativo, legenda, chamada para ação e data programada de publicação.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
