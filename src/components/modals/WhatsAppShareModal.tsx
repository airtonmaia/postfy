import React, { useState, useEffect } from 'react';
import { urlDoPortalDaAgencia } from '../../lib/rotas';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard } from '../../lib/utils';
import { X, Send, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';
import { Job } from '../../types';
import { Button } from '../ui/button';

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
  const { clients, currentWorkspace } = usePostfy();
  const [copied, setCopied] = useState(false);

  // Todos os hooks vêm antes do `return null` lá embaixo, e `message` nascia
  // depois dele. O componente fica montado com `isOpen` falso — quem o
  // renderiza passa a prop, não o monta condicionalmente —, então abrir a
  // modal ia de dois hooks para três e o React derrubava o app inteiro com
  // "rendered more hooks than during the previous render". Compartilhar no
  // WhatsApp simplesmente quebrava a tela.
  const [message, setMessage] = useState('');

  const client = job ? clients.find(c => c.id === job.clientId) : undefined;
  const contact = client?.contacts[0];
  const phone = contact?.phone || client?.phone || '';
  const cleanPhone = phone.replace(/\D/g, '');

  // Era `/#portal-<id>`, um formato que nada no app lê — e com um 'c-1'
  // sobrando dos dados de exemplo. O link nunca abriu portal nenhum.
  const portalLink = urlDoPortalDaAgencia(currentWorkspace.slug, window.location.origin);

  const defaultMessage = job
    ? `Olá, ${contact?.name || client?.name || 'Cliente'}! Tudo bem? 👋

Seu novo conteúdo "${job.title}" (${job.format.toUpperCase()}) já está pronto para sua revisão e aprovação! 🚀

👉 Acesse pelo link abaixo para conferir o criativo e a legenda completa:
${portalLink}

Por favor, aprove ou solicite ajustes por lá para mantermos o cronograma em dia. Qualquer dúvida, estou à disposição! ✨`
    : '';

  // Preenche ao abrir, e a cada conteúdo diferente. Com `useState(texto)` o
  // valor só era lido na primeira renderização: abrir a modal para um segundo
  // conteúdo mostraria a mensagem do primeiro.
  useEffect(() => {
    if (isOpen && job) setMessage(defaultMessage);
    // `job.id` e não `job`: o objeto é recriado a cada render do pai, e o
    // efeito sobrescreveria o que a pessoa estivesse digitando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job?.id]);

  if (!isOpen || !job) return null;

  const handleCopy = async () => {
    await copyToClipboard(message);
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        
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
          <Button variant="ghost" size="icon-sm"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
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
          <Button variant="secondary"
            type="button"
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
          </Button>

          <Button variant="success"
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 active:bg-emerald-800"
          >
            <Send className="w-4 h-4" />
            <span>Abrir no WhatsApp</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
