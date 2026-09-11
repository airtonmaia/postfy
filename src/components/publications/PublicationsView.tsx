import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { ConexoesSociais } from './ConexoesSociais';
import { safeDateTimeFormat, safeDateFormat, safeTimeFormat } from '../../lib/utils';
import { 

  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Share2, 
  Instagram, 
  Linkedin, 
  Check, 
  Layers,
  CircleDashed
} from 'lucide-react';
import { PlatformBadge, StatusBadge, FormatBadge } from '../common/Badges';
import {
  publicaSozinho,
  REDES_QUE_PUBLICAM,
  listarFila,
  listarContas,
  agendarPublicacao,
  cancelarPublicacao,
  quandoDeveSair,
  type ItemDaFila,
  type ContaConectada,
} from '../../lib/redes';
import { Client, Job, JobPlatform } from '../../types';

/**
 * Os canais de um conteúdo, separados pelo que de fato acontece na data.
 *
 * `canais` é o conjunto completo (2.18.0) e `platform` é o principal; uma
 * linha antiga não tem `canais`, então ela cai no principal. Sem essa
 * separação a tela dizia "Agendado" para tudo, e para cinco das seis redes
 * isso significava que a peça **não ia ao ar** — o cliente aprovou, a
 * agência confiou na data, e nada aconteceu.
 */
const canaisDoJob = (job: Job): { automaticos: JobPlatform[]; manuais: JobPlatform[] } => {
  const todos = (job.canais?.length ? job.canais : [job.platform]) as JobPlatform[];
  return {
    automaticos: todos.filter(publicaSozinho),
    manuais: todos.filter((c) => !publicaSozinho(c)),
  };
};

export const PublicationsView: React.FC = () => {
  const { jobs, clients, setSelectedJob, clientFilter } = usePostfy();

  /**
   * A fila de verdade, e as contas conectadas.
   *
   * A tela chamava de "fila de disparos" a lista de jobs com status
   * `scheduled` — que não é fila nenhuma: `publish_queue` é outra tabela, e
   * **nada no app inseria nela**. `agendarPublicacao` existia sem nenhum
   * chamador, então o agendador nunca publicou coisa alguma, nem no
   * Instagram. O card ficava "Agendado" e a data passava em branco.
   */
  const [fila, setFila] = useState<ItemDaFila[]>([]);
  const [contas, setContas] = useState<ContaConectada[]>([]);
  const [enfileirando, setEnfileirando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregarFila = async () => {
    try {
      const [itens, conectadas] = await Promise.all([listarFila(), listarContas()]);
      setFila(itens);
      setContas(conectadas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler a fila.');
    }
  };

  useEffect(() => {
    void recarregarFila();
  }, []);

  const naFila = new Map(fila.map((i) => [i.jobId, i]));

  /** A conta conectada que publica este conteúdo, se houver. */
  const contaDoJob = (job: Job): ContaConectada | undefined =>
    contas.find((c) => publicaSozinho(c.platform) && c.clientId === job.clientId);

  const enfileirar = async (job: Job) => {
    const conta = contaDoJob(job);
    if (!conta) return;

    setEnfileirando(job.id);
    setErro(null);
    try {
      await agendarPublicacao(conta.workspaceId, job.id, conta.id, job.scheduledDate);
      await recarregarFila();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível agendar.');
    } finally {
      setEnfileirando(null);
    }
  };

  const tirarDaFila = async (id: string) => {
    setErro(null);
    try {
      await cancelarPublicacao(id);
      await recarregarFila();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível tirar da fila.');
    }
  };

  const displayedJobs = clientFilter === 'all' ? jobs : jobs.filter(j => j.clientId === clientFilter);
  const scheduled = displayedJobs.filter(j => j.status === 'scheduled');
  const published = displayedJobs.filter(j => j.status === 'published');
  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Agendamento</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">Fila de Publicações</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Planejamento do que vai ao ar e quando. O Instagram publica sozinho na
            data quando a conta do cliente está conectada; as outras redes você
            publica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* O que o servidor consegue fazer hoje, derivado de REDES_QUE_PUBLICAM. */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <CircleDashed className="w-3.5 h-3.5" />
            Disparo automático: {REDES_QUE_PUBLICAM.join(', ')}
          </span>
        </div>
      </div>

      {/*
        Este bloco exibia "Instagram API — Conectado (Graph API)", "LinkedIn v2",
        TikTok e YouTube como conectados, além de "Workers Operando Normalmente".
        Nada disso existia: era marcação estática. Publicar de verdade exige
        OAuth com cada rede e uma fila de disparo no servidor.
      */}
      <ConexoesSociais />

      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          {erro}
        </div>
      )}

      {/* Scheduled Queue */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Fila de Disparos Agendados</h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {scheduled.length} posts na fila
          </span>
        </div>

        {scheduled.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Nenhuma publicação agendada na fila no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scheduled.map(job => {
              const client = clientMap.get(job.clientId);

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 dark:bg-slate-950/70 p-2 rounded-xl transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {job.mediaUrls && job.mediaUrls.length > 0 && (
                      <img src={job.mediaUrls[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}</span>
                        <PlatformBadge platform={job.platform} />
                        <FormatBadge format={job.format} />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">{job.title}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="font-mono font-bold text-purple-600 block">
                        {safeDateTimeFormat(job.scheduledDate)}
                      </span>
                      {(() => {
                        // O que vai acontecer nesta data, canal a canal. Era
                        // "Publicação manual" para todos, inclusive para o
                        // Instagram, que é o único que o servidor publica.
                        const { automaticos, manuais } = canaisDoJob(job);
                        if (automaticos.length === 0) {
                          return (
                            <span className="text-[10px] text-slate-400">
                              Você publica ({manuais.join(', ')})
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] text-slate-400">
                            {automaticos.join(', ')} automático
                            {manuais.length > 0 && ` • ${manuais.join(', ')} por você`}
                          </span>
                        );
                      })()}
                    </div>
                    {(() => {
                      const item = naFila.get(job.id);
                      const conta = contaDoJob(job);
                      const { automaticos } = canaisDoJob(job);

                      // Já na fila: o que importa é o que o servidor fez com
                      // ele, não o status do card.
                      if (item) {
                        // Enquanto não foi ao ar, dá para tirar da fila. Sem
                        // isso o único jeito de desmarcar seria no banco — e
                        // uma fila sem porta de saída é a mesma armadilha do
                        // bloqueio sem saída.
                        const podeTirar = item.status === 'pendente' || item.status === 'falhou';
                        return (
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${
                                item.status === 'publicado'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  : item.status === 'falhou'
                                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                              }`}
                              title={item.lastError || undefined}
                            >
                              {item.status === 'pendente'
                                ? `sai até ${safeTimeFormat(quandoDeveSair(item.scheduledFor))}`
                                : item.status}
                            </span>
                            {podeTirar && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void tirarDaFila(item.id);
                                }}
                                disabled={enfileirando === job.id}
                                className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              >
                                tirar da fila
                              </button>
                            )}
                          </div>
                        );
                      }

                      // Dá para publicar sozinho e há conta conectada: o
                      // botão é explícito de propósito. Enfileirar sozinho ao
                      // arrastar o card para "Agendado" publicaria no perfil
                      // do cliente sem ninguém ter decidido isso — e postagem
                      // publicada não volta.
                      if (automaticos.length > 0 && conta) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void enfileirar(job);
                            }}
                            disabled={enfileirando === job.id}
                            // Qual perfil vai receber o post, por extenso:
                            // publicar na conta errada não tem volta.
                            title={`Publica em @${conta.accountName} em ${safeDateTimeFormat(job.scheduledDate)}`}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-[11px] font-bold transition cursor-pointer shrink-0"
                          >
                            {enfileirando === job.id ? 'Colocando...' : 'Publicar na data'}
                          </button>
                        );
                      }

                      if (automaticos.length > 0 && !conta) {
                        return (
                          <span
                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 px-2"
                            title="Conecte a conta deste cliente abaixo para o disparo automático."
                          >
                            conta não conectada
                          </span>
                        );
                      }

                      return <StatusBadge status={job.status} size="sm" />;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Published History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Histórico de Publicações</h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {published.length} marcadas como publicadas
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {published.map(job => {
            const client = clientMap.get(job.clientId);

            return (
              <div key={job.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={job.platform} showLabel={false} />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{client?.name}: </span>
                    <span className="text-slate-700 dark:text-slate-300">{job.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    Postado em {safeDateFormat(job.scheduledDate)}
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                    Publicado
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
