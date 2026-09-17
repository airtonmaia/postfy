import React, { useState } from 'react';
import { MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import type { Job } from '../../types';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateTimeFormat } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';

/**
 * O chat do cliente, na tela onde ele aprova.
 *
 * Até aqui o cliente tinha **duas saídas e nenhuma conversa**: aprovar, ou
 * pedir ajuste — e pedir ajuste joga a peça inteira para trás, criando uma
 * versão nova. "A foto está ótima, só troque o horário no texto" não cabia em
 * nenhuma das duas, e virava mensagem no WhatsApp da agência, fora do
 * sistema, sem ficar registrada ao lado do conteúdo de que falava.
 *
 * **É a mesma thread que a agência lê na aba Revisões.** `jobs.comments` é
 * uma lista só, e cada item traz `isClient`; duas listas separadas fariam
 * cada lado ver metade da conversa, que é o pior desfecho possível numa tela
 * cujo propósito é alinhar os dois.
 *
 * Quem grava é a RPC `portal_comentar`, pelo desvio `noPortal` do contexto:
 * no portal não há sessão, então `useColecaoSincronizada` sai cedo e uma
 * escrita normal morreria no estado da aba — a tela mostraria a mensagem e o
 * banco nunca saberia dela (armadilha 10).
 */
export const ConversaComAAgencia: React.FC<{ job: Job }> = ({ job }) => {
  const { addJobComment } = usePostfy();
  // Começa recolhida: o card de aprovação já é alto, e a conversa é o
  // caminho menos usado dos três. O contador no botão é o que impede ela de
  // virar aba esquecida — mensagem nova aparece no número, sem abrir.
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState('');

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    // `true` é a intenção da tela; quem decide de verdade é o banco, dentro
    // da RPC — como parâmetro, quem chamasse escolheria aparecer como a
    // agência dentro da própria thread do cliente.
    addJobComment(job.id, texto.trim(), true);
    setTexto('');
    setAberta(true);
  };

  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="w-full flex items-center gap-2 px-4 h-10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
      >
        <MessageCircle className="w-4 h-4 text-slate-400" />
        <span className="flex-1 text-left">
          Conversar com a agência
          {job.comments.length > 0 && ` (${job.comments.length})`}
        </span>
        {aberta ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {aberta && (
        <div className="px-4 pb-4 space-y-3">
          {job.comments.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {job.comments.map((cm) => (
                <div key={cm.id} className="flex items-start gap-2 text-xs">
                  <Avatar nome={cm.authorName} url={cm.authorAvatar} tamanho={24} />
                  <div
                    className={`flex-1 rounded-xl p-2.5 border ${
                      cm.isClient
                        ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        : 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {cm.authorName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {safeDateTimeFormat(cm.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {cm.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={enviar} className="flex items-center gap-2">
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Uma dúvida, um detalhe..."
              className="flex-1 min-w-0 text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
            />
            <Button
              type="submit"
              disabled={!texto.trim()}
              aria-label="Enviar mensagem para a agência"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </form>

          {/*
            A tela diz o que a mensagem **não** faz. Sem isto, o cliente
            escreveria "troque a foto" aqui e esperaria uma versão nova — a
            agência lê, mas a peça continua aguardando a decisão dele, e os
            dois ficam esperando o outro.
          */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Uma mensagem não pede ajuste nem aprova: o conteúdo continua
            aguardando a sua decisão nos botões acima.
          </p>
        </div>
      )}
    </div>
  );
};
