import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { X, Send, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';
import { Job } from '../../types';

interface WhatsAppShareModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  job,
  isOpen,
  onClose
}) => {
  const { clients } = usePostfy();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !job) return null;

  const client = clients.find(c => c.id === job.clientId);
  const contact = client?.contacts[0];
  const phone = contact?.phone || client?.phone || '';
  const cleanPhone = phone.replace(/\D/g, '');

  const portalLink = `${window.location.origin}/#portal-${client?.id || 'c-1'}`;

  const defaultMessage = `Olá, ${contact?.name || client?.name || 'Cliente'}! Tudo bem? 👋

Seu novo conteúdo "${job.title}" (${job.format.toUpperCase()}) já está pronto para sua revisão e aprovação! 🚀

👉 Acesse pelo link abaixo para conferir o criativo e a legenda completa:
${portalLink}

Por favor, aprove ou solicite ajustes por lá para mantermos o cronograma em dia. Qualquer dúvida, estou à disposição! ✨`;

  const [message, setMessage] = useState(defaultMessage);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    const targetUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Enviar Link via WhatsApp
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Disparo rápido de notificação de aprovação com link direto.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client & Target */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Destinatário</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {contact?.name ? `${contact.name} (${client?.name})` : client?.name}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">WhatsApp</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {phone || 'Não cadastrado'}
            </span>
          </div>
        </div>

        {/* Message Editor */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
            Mensagem Pronta para Envio
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            className="w-full text-xs p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none leading-relaxed"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Abrir no WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
