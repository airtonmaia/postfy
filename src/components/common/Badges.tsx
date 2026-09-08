import React from 'react';
import { 
  Instagram, 
  Linkedin, 
  Youtube, 
  Facebook, 
  Twitter, 
  Video, 
  Layers, 
  Image as ImageIcon, 
  FileText, 
  Smartphone 
} from 'lucide-react';
import { JobPlatform, JobFormat, JobStatus, JobPriority } from '../../types';

export const PlatformBadge: React.FC<{ platform: JobPlatform; showLabel?: boolean; className?: string }> = ({ 
  platform, 
  showLabel = true,
  className = '' 
}) => {
  switch (platform) {
    case 'instagram':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200/70 dark:bg-pink-950/40 dark:text-pink-300 ${className}`}>
          <Instagram className="w-3.5 h-3.5 text-pink-600" />
          {showLabel && 'Instagram'}
        </span>
      );
    case 'linkedin':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 ${className}`}>
          <Linkedin className="w-3.5 h-3.5 text-sky-600" />
          {showLabel && 'LinkedIn'}
        </span>
      );
    case 'tiktok':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white border border-slate-700 ${className}`}>
          <Video className="w-3.5 h-3.5 text-pink-400" />
          {showLabel && 'TikTok'}
        </span>
      );
    case 'youtube':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/70 ${className}`}>
          <Youtube className="w-3.5 h-3.5 text-red-600" />
          {showLabel && 'YouTube'}
        </span>
      );
    case 'facebook':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 ${className}`}>
          <Facebook className="w-3.5 h-3.5 text-blue-600" />
          {showLabel && 'Facebook'}
        </span>
      );
    case 'twitter':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 ${className}`}>
          <Twitter className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
          {showLabel && 'X / Twitter'}
        </span>
      );
    default:
      return null;
  }
};

export const FormatBadge: React.FC<{ format: JobFormat }> = ({ format }) => {
  const configs: Record<JobFormat, { label: string; icon: React.ReactNode; color: string }> = {
    carousel: { label: 'Carrossel', icon: <Layers className="w-3 h-3" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    reel: { label: 'Reel', icon: <Video className="w-3 h-3" />, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    story: { label: 'Story', icon: <Smartphone className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    feed: { label: 'Feed', icon: <ImageIcon className="w-3 h-3" />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    video: { label: 'Vídeo Longo', icon: <Video className="w-3 h-3" />, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    article: { label: 'Artigo', icon: <FileText className="w-3 h-3" />, color: 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800' },
  };

  const c = configs[format] || configs.feed;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: JobStatus; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const configs: Record<JobStatus, { label: string; bg: string; dot: string }> = {
    ideas: { label: 'Ideias', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800', dot: 'bg-slate-400' },
    in_production: { label: 'Em Produção', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    for_approval: { label: 'Para Aprovação', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
    in_adjustment: { label: 'Em Ajuste', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-pulse' },
    approved: { label: 'Aprovado', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    scheduled: { label: 'Agendado', bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
    published: { label: 'Publicado', bg: 'bg-teal-50 text-teal-800 border-teal-200', dot: 'bg-teal-600' },
  };

  const c = configs[status] || configs.ideas;
  const padding = size === 'sm' ? 'px-1.5 py-0.2 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${c.bg} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: JobPriority }> = ({ priority }) => {
  const configs: Record<JobPriority, { label: string; color: string }> = {
    low: { label: 'Baixa', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800' },
    medium: { label: 'Média', color: 'text-blue-600 bg-blue-50' },
    high: { label: 'Alta', color: 'text-amber-600 bg-amber-50' },
    urgent: { label: 'Urgente', color: 'text-rose-600 bg-rose-50 font-bold' },
  };
  const c = configs[priority];
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${c.color}`}>
      {c.label}
    </span>
  );
};
