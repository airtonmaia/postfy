import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateFormat } from '../../lib/utils';
import { PlatformBadge, FormatBadge, PriorityBadge, TipoBadge } from '../common/Badges';
import {
  Plus,
  MoreVertical,
  MessageSquare,
  CheckSquare,
  Clock,
  ArrowRight,
  Filter,
  Search,
  ChevronDown,
  Image as ImageIcon,
  PenLine,
  Clapperboard,
  MailCheck
} from 'lucide-react';
import { Job, JobStatus, Client, JobTipo } from '../../types';
import { Avatar } from '../common/Avatar';
import { TIPOS_DE_JOB } from '../../lib/tiposDeJob';
import { enviarAprovacaoEmLote } from '../../lib/automacoes';

/** Um ícone por tipo. Fica aqui e não no catálogo: lá é dado, aqui é desenho. */
const ICONE_DO_TIPO: Record<JobTipo, React.FC<{ className?: string }>> = {
  conteudo: ImageIcon,
  copy: PenLine,
  roteiro: Clapperboard,
};

export const KanbanBoard: React.FC = () => {
  const { 
    jobs, 
    clients, 
    clientFilter, 
    setClientFilter, 
    platformFilter, 
    setPlatformFilter, 
    moveJobStatus, 
    setSelectedJob, 
    openCreateJobModal,
    currentWorkspace
  } = usePostfy();

  const [search, setSearch] = useState('');
  const [menuDeTipoAberto, setMenuDeTipoAberto] = useState(false);

  /**
   * Aprovação em massa — só existe para quem escolheu agrupar os avisos.
   *
   * Na agência que avisa a cada arte o botão seria ruído: o cliente já foi
   * avisado uma vez por peça, e um segundo aviso repetiria tudo.
   *
   * Ele **exige um cliente selecionado** de propósito. O e-mail vai para uma
   * caixa só; com o filtro em "todos", o lote misturaria clientes e o aviso
   * iria para quem não deveria ver o conteúdo dos outros.
   */
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [avisoDoLote, setAvisoDoLote] = useState<{ ok: boolean; texto: string } | null>(null);
  const agrupaAvisos = currentWorkspace.notificacaoAprovacao === 'lote';

  const dispararLote = async () => {
    if (clientFilter === 'all') {
      setAvisoDoLote({
        ok: false,
        texto: 'Escolha um cliente no filtro acima: o aviso vai para a caixa dele.',
      });
      return;
    }

    setEnviandoLote(true);
    setAvisoDoLote(null);
    try {
      const { enviados, destinatario } = await enviarAprovacaoEmLote(
        currentWorkspace.id,
        clientFilter
      );
      // "Na fila", não "enviado": quem envia é o cron, daqui a alguns minutos
      // (armadilha 9.1). Dizer "enviado" aqui seria afirmar o que ainda não
      // aconteceu.
      setAvisoDoLote({
        ok: true,
        texto: `${enviados} conteúdo(s) no aviso, na fila para ${destinatario}.`,
      });
    } catch (e) {
      setAvisoDoLote({
        ok: false,
        texto: e instanceof Error ? e.message : 'Não foi possível avisar.',
      });
    } finally {
      setEnviandoLote(false);
    }
  };

  /**
   * As colunas, e por que "Aprovado" e "Agendado" viraram uma só.
   *
   * Eram duas etapas que a agência não vive separadas: aprovado é o que pode
   * ir ao ar, agendado é o mesmo com data marcada. O card atravessava a
   * fronteira sem ninguém decidir nada — e duas colunas quase sempre com o
   * mesmo conteúdo ocupavam metade da tela para não dizer nada.
   *
   * **Aprovado sem data continua aqui**, e aparece como "sem data". Segurá-lo
   * na coluna anterior até alguém agendar esconderia justamente o que precisa
   * de atenção: quem aprovou não veria o resultado da própria ação.
   *
   * Cada coluna guarda a lista de status que a alimenta; o status continua
   * distinto no banco, e é ele que o seletor do card muda.
   */
  const columns: {
    id: string;
    title: string;
    statuses: JobStatus[];
    color: string;
    border: string;
  }[] = [
    { id: 'ideas', title: 'Ideias', statuses: ['ideas'], color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', border: 'border-slate-300' },
    { id: 'in_production', title: 'Em Produção', statuses: ['in_production'], color: 'bg-blue-50 text-blue-800', border: 'border-blue-300' },
    { id: 'for_approval', title: 'Para Aprovação', statuses: ['for_approval'], color: 'bg-amber-50 text-amber-900', border: 'border-amber-300' },
    { id: 'in_adjustment', title: 'Em Ajuste', statuses: ['in_adjustment'], color: 'bg-rose-50 text-rose-900', border: 'border-rose-300' },
    { id: 'aprovado_agendado', title: 'Aprovado / Agendado', statuses: ['approved', 'scheduled'], color: 'bg-emerald-50 text-emerald-900', border: 'border-emerald-300' },
    { id: 'published', title: 'Publicado', statuses: ['published'], color: 'bg-teal-50 text-teal-900', border: 'border-teal-300' },
  ];

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (clientFilter !== 'all' && job.clientId !== clientFilter) return false;
    if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!job.title.toLowerCase().includes(q) && !job.caption.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Quadro de Conteúdos (Kanban)</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {filteredJobs.length} jobs ativos
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar no quadro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 w-48"
            />
          </div>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="text-xs p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">Todos os Clientes</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Adicionar: a agência escolhe qual das três entregas vai criar. */}
          <div className="relative">
            <button
              onClick={() => setMenuDeTipoAberto((aberto) => !aberto)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${menuDeTipoAberto ? 'rotate-180' : ''}`}
              />
            </button>

            {menuDeTipoAberto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuDeTipoAberto(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-64 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5">
                  {TIPOS_DE_JOB.map((tipo) => {
                    const Icone = ICONE_DO_TIPO[tipo.valor];
                    return (
                      <button
                        key={tipo.valor}
                        onClick={() => {
                          setMenuDeTipoAberto(false);
                          openCreateJobModal(undefined, tipo.valor);
                        }}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <Icone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-slate-900 dark:text-white">
                            {tipo.rotulo}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            {tipo.descricao}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {avisoDoLote && (
        <div
          className={`mx-6 mt-4 flex items-start gap-2 text-xs p-3 rounded-xl border ${
            avisoDoLote.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
          }`}
        >
          <MailCheck className="w-4 h-4 shrink-0 mt-px" />
          <span className="font-semibold leading-relaxed">{avisoDoLote.texto}</span>
        </div>
      )}

      {/* Kanban Horizontal Scroll Columns */}
      <div className="flex-1 flex overflow-x-auto p-6 gap-4 items-start min-h-0">
        {columns.map(col => {
          const colJobs = filteredJobs.filter(j => col.statuses.includes(j.status));

          return (
            <div
              key={col.id}
              className="w-80 shrink-0 bg-slate-200/70 rounded-2xl p-3 flex flex-col max-h-full border border-slate-300/60 shadow-xs"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${col.color} ${col.border}`}>
                    {col.title}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                    {colJobs.length}
                  </span>
                </div>

                {col.id === 'ideas' && (
                  <button
                    onClick={() => openCreateJobModal()}
                    className="p-1 rounded hover:bg-slate-300 text-slate-600 dark:text-slate-400 transition"
                    title="Adicionar ideia"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}

                {col.id === 'for_approval' && agrupaAvisos && colJobs.length > 0 && (
                  <button
                    onClick={() => void dispararLote()}
                    disabled={enviandoLote}
                    title="Manda um aviso só, com tudo que este cliente tem para aprovar."
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900 text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-60 transition cursor-pointer"
                  >
                    <MailCheck className="w-3 h-3" />
                    {enviandoLote ? 'Enviando...' : 'Aprovação em massa'}
                  </button>
                )}
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {colJobs.map(job => {
                  const client = clientMap.get(job.clientId);

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800/90 hover:border-purple-300 p-3.5 shadow-xs transition-all cursor-pointer space-y-2.5 group"
                    >
                      {/* Top: Client & Platform & Version */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar nome={client?.name || 'Cliente'} url={client?.avatar} tamanho={16} />
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate">
                            {client?.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          v{job.currentVersion}
                        </span>
                      </div>

                      {/* Title & Preview Image */}
                      <div className="flex items-start gap-2.5">
                        {job.mediaUrls && job.mediaUrls.length > 0 && (
                          <img
                            src={job.mediaUrls[0]}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition line-clamp-2 leading-tight">
                            {job.title}
                          </h4>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                            <FormatBadge format={job.format} />
                            {/* Conteúdo é a maioria e o padrão: marcar só o que
                                foge disso deixa a exceção visível no quadro. */}
                            {job.tipo !== 'conteudo' && <TipoBadge tipo={job.tipo} />}
                          </div>
                        </div>
                      </div>

                      {/* Footer: Dates & Comments & Move Next */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          {/* Sem data é um estado legítimo — aprovado antes de
                              alguém marcar quando vai ao ar —, e dizê-lo é o
                              que faz a pendência aparecer. */}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {job.scheduledDate
                              ? safeDateFormat(job.scheduledDate, { day: '2-digit', month: '2-digit' })
                              : 'sem data'}
                          </span>
                          {job.comments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-slate-400" />
                              {job.comments.length}
                            </span>
                          )}
                        </div>

                        {/* Quick move forward button */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={job.status}
                            onChange={(e) => moveJobStatus(job.id, e.target.value as JobStatus)}
                            className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5 text-slate-600 dark:text-slate-400 font-medium"
                          >
                            <option value="ideas">Ideias</option>
                            <option value="in_production">Produção</option>
                            <option value="for_approval">Aprovação</option>
                            <option value="in_adjustment">Ajuste</option>
                            <option value="approved">Aprovado</option>
                            <option value="scheduled">Agendado</option>
                            <option value="published">Publicado</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
