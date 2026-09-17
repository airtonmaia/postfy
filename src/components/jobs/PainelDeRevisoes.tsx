import React, { useState } from 'react';
import { AlertCircle, Sparkles, Send, Upload, History } from 'lucide-react';
import type { Job } from '../../types';
import { usePostfy } from '../../context/PostfyContext';
import { novoId } from '../../lib/sincronizacao';
import { ApiError } from '../../lib/api';
import { safeDateFormat, safeDateTimeFormat } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FileUpload } from '../ui/file-upload';

/**
 * Revisões: o que o cliente pediu, a conversa sobre isso e o que já foi
 * entregue.
 *
 * Eram **duas abas separadas** — "Comentários" e "Versões" — e o pedido de
 * ajuste do cliente não estava em nenhuma das duas: ele aparecia como um
 * aviso vermelho no meio do formulário, e sumia da vista assim que a peça
 * saía de `in_adjustment`. Quem abrisse o conteúdo depois não tinha onde ler
 * por que a v2 existe.
 *
 * As três coisas são o mesmo ciclo — o cliente pede, a agência responde, uma
 * versão nova sobe — e por isso moram juntas, na ordem em que acontecem.
 *
 * **A conversa é a mesma do portal.** `jobs.comments` é uma lista só, e cada
 * item traz `isClient`; o cliente escreve pela RPC `portal_comentar`, a
 * agência por `addJobComment`. Duas listas separadas fariam cada lado ver
 * metade da conversa — que é o pior desfecho possível numa tela cujo
 * propósito é alinhar os dois.
 */
export const PainelDeRevisoes: React.FC<{ job: Job }> = ({ job }) => {
  const {
    addJobComment,
    addNewJobVersion,
    updateJob,
    setSelectedJob,
    convertFeedbackToTasks,
  } = usePostfy();

  const [texto, setTexto] = useState('');
  const [criandoVersao, setCriandoVersao] = useState(false);
  const [legendaDaVersao, setLegendaDaVersao] = useState('');
  const [midiaDaVersao, setMidiaDaVersao] = useState('');
  const [convertendo, setConvertendo] = useState(false);
  const [erroIa, setErroIa] = useState<string | null>(null);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    addJobComment(job.id, texto);
    setTexto('');
  };

  const salvarVersao = () => {
    if (!legendaDaVersao.trim()) return;
    const midia = midiaDaVersao.trim() ? [midiaDaVersao.trim()] : job.mediaUrls;
    addNewJobVersion(job.id, midia, legendaDaVersao);
    setLegendaDaVersao('');
    setMidiaDaVersao('');
    setCriandoVersao(false);
  };

  const converterFeedbackComIa = async () => {
    if (!job.lastFeedback) return;
    setConvertendo(true);
    setErroIa(null);
    try {
      const res = await convertFeedbackToTasks({
        clientFeedback: job.lastFeedback,
        jobTitle: job.title,
        currentCopy: job.caption,
      });

      if (res && res.checklist && res.checklist.length > 0) {
        const novos = res.checklist.map((c: any) => ({
          id: novoId(),
          title: `[${c.role.toUpperCase()}] ${c.item}`,
          completed: false,
        }));

        updateJob(job.id, { checklist: [...job.checklist, ...novos] });
        setSelectedJob({ ...job, checklist: [...job.checklist, ...novos] });
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
      setConvertendo(false);
    }
  };

  const cartao =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs';

  return (
    <div className="space-y-4">
      {/*
        O último pedido de ajuste, **sempre que existir** — e não só enquanto
        a peça está em `in_adjustment`. O motivo de a v2 existir continua
        valendo depois de ela subir; era justamente aí que ele sumia.
      */}
      {job.lastFeedback && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Ajuste solicitado pelo cliente</span>
            </div>
            <Button type="button" onClick={converterFeedbackComIa} disabled={convertendo}>
              <Sparkles className="w-3.5 h-3.5" />
              {convertendo ? 'Convertendo...' : 'Gerar checklist técnico com IA'}
            </Button>
          </div>
          <p className="italic pl-5 bg-white/60 dark:bg-black/30 p-2 rounded-lg border border-rose-100 dark:border-rose-900">
            "{job.lastFeedback}"
          </p>
          {erroIa && (
            <p className="pl-5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              {erroIa}
            </p>
          )}
        </div>
      )}

      {/* A conversa */}
      <div className={`${cartao} p-4 sm:p-5 flex flex-col`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Conversa com o cliente
          </h4>
          <span className="text-[11px] text-slate-400">{job.comments.length} mensagens</span>
        </div>

        <div className="flex-1 max-h-96 overflow-y-auto space-y-3 pr-1 mb-3">
          {job.comments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10 leading-relaxed">
              Nada por aqui ainda. O que você escrever aparece para o cliente na
              tela de aprovação dele — e o que ele responder aparece aqui.
            </p>
          ) : (
            job.comments.map((cm) => (
              <div key={cm.id} className="flex items-start gap-2.5 text-xs">
                <Avatar nome={cm.authorName} url={cm.authorAvatar} tamanho={28} />
                <div
                  className={`flex-1 rounded-xl p-2.5 border ${
                    cm.isClient
                      ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {cm.authorName}
                      {/* Quem falou importa aqui mais que em qualquer outra
                          lista: a mesma thread tem os dois lados, e responder
                          achando que era a equipe é o erro caro. */}
                      {cm.isClient && <Badge tom="roxo">Cliente</Badge>}
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
            ))
          )}
        </div>

        <form
          onSubmit={enviar}
          className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
        >
          <input
            type="text"
            placeholder="Responder ao cliente..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="flex-1 min-w-0 text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
          />
          {/* O rótulo some no celular para o campo de texto ficar com a
              largura útil; o `aria-label` fica no lugar dele, senão quem lê
              por leitor de tela ouve um botão sem nome. */}
          <Button type="submit" disabled={!texto.trim()} aria-label="Enviar mensagem">
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar</span>
          </Button>
        </form>
      </div>

      {/* Histórico de versões */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              Versões entregues ({job.versions.length || 1})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cada revisão entregue para este conteúdo.
            </p>
          </div>

          <Button onClick={() => setCriandoVersao((v) => !v)}>
            <Upload className="w-3.5 h-3.5" />
            Subir nova versão
          </Button>
        </div>

        {criandoVersao && (
          <div className={`${cartao} p-4 border-purple-200 dark:border-purple-900 space-y-3`}>
            <h5 className="text-xs font-bold text-purple-900 dark:text-purple-300">
              Nova versão (v{job.currentVersion + 1})
            </h5>
            <FileUpload
              label="Mídia / arte atualizada"
              compact
              imageOnly
              value={midiaDaVersao}
              onFileSelect={(arquivo) => setMidiaDaVersao(arquivo.url)}
              onFileRemove={() => setMidiaDaVersao('')}
            />
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Legenda ajustada:
              </label>
              <textarea
                rows={3}
                value={legendaDaVersao}
                onChange={(e) => setLegendaDaVersao(e.target.value)}
                placeholder="A legenda com os ajustes aplicados..."
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCriandoVersao(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarVersao} disabled={!legendaDaVersao.trim()}>
                Salvar e enviar para aprovação
              </Button>
            </div>
          </div>
        )}

        {job.versions.map((ver, i) => (
          <div key={i} className={`${cartao} p-4 flex items-start gap-4`}>
            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900 font-mono text-sm">
              v{ver.versionNumber}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Versão {ver.versionNumber} — enviada por {ver.submittedBy}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {safeDateFormat(ver.submittedAt)}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {ver.caption}
              </p>

              {ver.feedback && (
                <div className="mt-2 text-xs p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                  <strong>Feedback do cliente:</strong> {ver.feedback}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
