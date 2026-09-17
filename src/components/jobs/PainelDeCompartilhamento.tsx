import React, { useState, useEffect } from 'react';
import { urlDoPortalDaAgencia } from '../../lib/rotas';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard } from '../../lib/utils';
import { Send, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';
import type { Job } from '../../types';
import { Button } from '../ui/button';

/**
 * Compartilhar o conteúdo com o cliente.
 *
 * **Era uma modal chamada "WhatsApp", e virou uma aba chamada
 * "Compartilhamento".** Duas mudanças, e as duas pelo mesmo motivo: o
 * WhatsApp é um dos destinos, não o nome da coisa — o link do portal é o
 * mesmo para quem manda por e-mail, por Telegram ou colando na conversa.
 * Modal sobre modal também custava: para conferir a legenda antes de mandar,
 * era preciso fechar a de compartilhar, ler, e abrir de novo.
 *
 * O painel é filho do conteúdo aberto, então não tem estado próprio de "está
 * aberto" nem `return null` — o que elimina de uma vez a armadilha 8.1 que
 * este arquivo já teve: o `useState(defaultMessage)` declarado depois do
 * `return null` quebrava "compartilhar no WhatsApp" desde que foi escrito.
 */
export const PainelDeCompartilhamento: React.FC<{ job: Job }> = ({ job }) => {
  const { clients, currentWorkspace } = usePostfy();
  const [copiado, setCopiado] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const client = clients.find((c) => c.id === job.clientId);
  const contato = client?.contacts?.[0];
  const telefone = contato?.phone || client?.phone || '';
  const telefoneLimpo = telefone.replace(/\D/g, '');

  // Era `/#portal-<id>`, um formato que nada no app lê — e com um 'c-1'
  // sobrando dos dados de exemplo. O link nunca abriu portal nenhum.
  const linkDoPortal = urlDoPortalDaAgencia(currentWorkspace.slug, window.location.origin);

  const mensagemPadrao =
    `Olá, ${contato?.name || client?.name || 'Cliente'}! Tudo bem? 👋

Seu novo conteúdo "${job.title}" (${(job.format || '').toUpperCase()}) já está pronto para sua revisão e aprovação! 🚀

👉 Acesse pelo link abaixo para conferir o criativo e a legenda completa:
${linkDoPortal}

Por favor, aprove ou solicite ajustes por lá para mantermos o cronograma em dia. Qualquer dúvida, estou à disposição! ✨`;

  // Repõe o texto a cada conteúdo diferente. Com `useState(texto)` o valor só
  // seria lido na primeira renderização: abrir um segundo conteúdo mostraria
  // a mensagem do primeiro.
  useEffect(() => {
    setMensagem(mensagemPadrao);
    // `job.id` e não `job`: o objeto é recriado a cada render do pai, e o
    // efeito sobrescreveria o que a pessoa estivesse digitando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const abrirNoWhatsApp = () => {
    const texto = encodeURIComponent(mensagem);
    const destino = telefoneLimpo
      ? `https://wa.me/${telefoneLimpo}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(destino, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Destinatário */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Destinatário</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {contato?.name ? `${contato.name} (${client?.name})` : client?.name}
          </span>
        </div>
        <div className="sm:text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">WhatsApp</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {telefone || 'Não cadastrado'}
          </span>
        </div>
      </div>

      {/* O link sozinho, para quem vai mandar por outro caminho. */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <span className="text-[10px] uppercase font-bold text-slate-400 block">
          Link do portal do cliente
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-0 truncate text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
            {linkDoPortal}
          </code>
          <Button
            variant="secondary"
            type="button"
            onClick={async () => {
              await copyToClipboard(linkDoPortal);
              setLinkCopiado(true);
              setTimeout(() => setLinkCopiado(false), 2000);
            }}
          >
            {linkCopiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {linkCopiado ? 'Copiado!' : 'Copiar link'}
          </Button>
          <Button variant="outline" type="button" asChild>
            <a href={linkDoPortal} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              Abrir
            </a>
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Quem abrir prova quem é pelo código enviado ao e-mail dele — o link
          sozinho não dá acesso ao conteúdo.
        </p>
      </div>

      {/* Mensagem */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-emerald-500" />
          Mensagem pronta para envio
        </label>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={9}
          className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none leading-relaxed"
        />

        <div className="flex items-center gap-2 flex-col sm:flex-row [&>*]:w-full sm:[&>*]:w-auto">
          <Button
            variant="secondary"
            type="button"
            onClick={async () => {
              await copyToClipboard(mensagem);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
            className="sm:flex-1"
          >
            {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copiado ? 'Copiado!' : 'Copiar texto'}
          </Button>

          <Button
            variant="success"
            type="button"
            onClick={abrirNoWhatsApp}
            className="sm:flex-1 active:bg-emerald-800"
          >
            <Send className="w-4 h-4" />
            Abrir no WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
};
