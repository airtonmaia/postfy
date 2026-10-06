import React, { useState } from 'react';
import { chaveDoDia, diaNoFuso } from '../../lib/fusoHorario';
import { Plus, MoreHorizontal, Clock, Sparkles } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { passaNosFiltros } from '../../lib/filtrosDoConteudo';
import { safeTimeFormat } from '../../lib/utils';
import { Job, Client } from '../../types';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';
import { PreviaNoHover } from '../common/PreviaNoHover';
import { proporcaoDoCriativo } from '../../lib/formatos';
import { Button } from '../ui/button';
import { urlDeExibicao } from '../../lib/midiaDoDrive';
import { corDaEtapa, etapasDoFluxo } from '../../lib/fluxoDeProducao';
import { ConteudosDoDia } from './ConteudosDoDia';

interface MonthViewProps {
  currentDate: Date;
}

export const MonthView: React.FC<MonthViewProps> = ({ currentDate }) => {
  const { 
    jobs, 
    clients, 
    clientFilter, 
    platformFilter, 
    statusFilter,
    formatFilter,
    periodoFiltro,
    intervaloFiltro, 
    setSelectedJob, 
    openCreateJobModal,
    currentWorkspace
  } = usePostfy();

  /* Todos os hooks antes de qualquer return — armadilha 8.1. */
  const [diaAberto, setDiaAberto] = useState<Date | null>(null);

  // O pontinho do celular fala a língua do fluxo da agência: a mesma cor que
  // a coluna do quadro usa para a etapa.
  const etapas = etapasDoFluxo(currentWorkspace.fluxoDeProducao);
  const pontoDaEtapa = (status: string) =>
    corDaEtapa(etapas.find((e) => e.status === status)?.cor ?? "slate").ponto;

  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDaysCount = new Date(year, month, 0).getDate();

  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
  /**
   * Quantas semanas este mês ocupa — 5 ou 6, nunca um número fixo.
   *
   * A grade declarava `grid-rows-5 md:grid-rows-6`, e num mês de cinco
   * semanas (setembro de 2026, por exemplo) a sexta linha existia **vazia**:
   * uma faixa morta no rodapé do calendário, com a cor de célula e tudo, que
   * lê como um dia que não carregou. O `min-h-[600px]` errava do outro lado —
   * numa tela alta as linhas paravam de crescer e sobrava fundo cinza.
   *
   * Com `repeat(semanas, minmax(110px, 1fr))` a grade preenche a altura que
   * tem e continua rolando quando a janela é baixa demais para o piso das
   * linhas.
   */
  const semanas = totalCells / 7;

  // Filter jobs
  /*
    O mesmo recorte do quadro, pela mesma função. Eram cinco cópias deste
    predicado — aqui e nas outras três visões — e elas já tinham divergido: o
    filtro de formato existia só no quadro, então "o que está marcado para
    esta semana em Reels?" tinha resposta numa tela e não na outra.
  */
  const filteredJobs = jobs.filter((job) =>
    passaNosFiltros(job, {
      cliente: clientFilter,
      rede: platformFilter,
      formato: formatFilter,
      periodo: periodoFiltro,
      intervalo: intervaloFiltro,
      status: statusFilter,
    })
  );

  // Helper to test if a job falls on a given date (based on scheduledDate or deadlineProduction)
  const getJobsForDate = (dateObj: Date): Job[] => {
    // A casinha é um rótulo ("14 de setembro"), então a chave sai dos números
    // da grade; quem é convertido para o fuso da agência é o conteúdo. Comparar
    // `getDate()` dos dois lados usava o dia do **dispositivo**: um post das
    // 21:00 em Cuiabá caía na casinha seguinte para quem abrisse de Lisboa.
    const chave = chaveDoDia(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    return filteredJobs.filter(
      (job) => diaNoFuso(job.scheduledDate || job.deadlineProduction) === chave
    );
  };

  const today = new Date();
  const isDateToday = (dateObj: Date) => {
    return (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    );
  };

  // Build grid items
  const gridCells = [];
  for (let i = 0; i < totalCells; i++) {
    let cellDate: Date;
    let isCurrentMonth = true;

    if (i < firstDayIndex) {
      // Days from previous month
      const dayNum = prevMonthDaysCount - (firstDayIndex - 1 - i);
      cellDate = new Date(year, month - 1, dayNum);
      isCurrentMonth = false;
    } else if (i >= firstDayIndex + daysInMonth) {
      // Days from next month
      const dayNum = i - (firstDayIndex + daysInMonth) + 1;
      cellDate = new Date(year, month + 1, dayNum);
      isCurrentMonth = false;
    } else {
      // Days of current month
      const dayNum = i - firstDayIndex + 1;
      cellDate = new Date(year, month, dayNum);
      isCurrentMonth = true;
    }

    const dayJobs = getJobsForDate(cellDate);
    const todayMatch = isDateToday(cellDate);

    gridCells.push({
      date: cellDate,
      isCurrentMonth,
      todayMatch,
      jobs: dayJobs
    });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 py-2.5">
        {daysOfWeek.map((day, idx) => (
          <div key={day} className={`tracking-wide uppercase text-[11px] ${idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        /*
          A altura mínima da linha vira variável para poder mudar no celular:
          110px × 6 semanas são 660px de grade num aparelho de 700, e o mês
          inteiro virava uma rolagem longa de casinhas quase vazias.
        */
        style={{ ['--linhas' as string]: String(semanas) }}
        className="flex-1 grid grid-cols-7 gap-[1px] bg-slate-200 dark:bg-slate-800 overflow-y-auto grid-rows-[repeat(var(--linhas),minmax(64px,1fr))] sm:grid-rows-[repeat(var(--linhas),minmax(110px,1fr))]"
      >
        {gridCells.map((cell, index) => {
          const dateISO = cell.date.toISOString();
          const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

          return (
            <div
              key={index}
              onClick={(e) => {
                // If clicked on empty space of the cell
                if (e.target === e.currentTarget) {
                  openCreateJobModal(dateISO);
                }
              }}
              className={`group relative flex flex-col p-1.5 transition overflow-hidden ${
                cell.isCurrentMonth ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-950/70' : 'bg-slate-50 dark:bg-slate-950/60 text-slate-400'
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-1 pointer-events-none">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition ${
                    cell.todayMatch
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : cell.isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>

                {/* Quick Add button on hover */}
                <Button variant="ghost" size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreateJobModal(dateISO);
                  }}
                  className="opacity-0 group-hover:opacity-100 pointer-events-auto hover:bg-slate-200 dark:text-slate-200"
                  title="Novo conteúdo nesta data"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Jobs inside day */}
              <div className="hidden sm:block flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                {cell.jobs.slice(0, 3).map(job => {
                  const client = clientMap.get(job.clientId);
                  const scheduledTime = safeTimeFormat(job.scheduledDate);

                  return (
                    /**
                     * A arte grande no hover é a mesma peça do portal do
                     * cliente — e é o mesmo componente, não uma segunda
                     * cópia. A agência confere o enquadramento aqui e manda o
                     * link do portal para o cliente: duas prévias que
                     * divergissem mostrariam cortes diferentes da mesma arte,
                     * que é exatamente o que ela existe para responder.
                     */
                    <PreviaNoHover
                      key={job.id}
                      url={job.mediaUrls?.[0]}
                      proporcao={proporcaoDoCriativo(job.platform, job.format)}
                    >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedJob(job);
                      }}
                      className="group/card relative bg-white dark:bg-slate-900 hover:bg-purple-50/40 border border-slate-200 dark:border-slate-800 hover:border-purple-300 rounded-lg p-1.5 shadow-xs transition-all cursor-pointer hover:shadow-sm"
                    >
                      {/* Top line: Platform icon + Time + Client tag */}
                      <div className="flex items-center justify-between gap-1 mb-1 text-[10px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                          <span className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {client?.name.split(' ')[0] || 'Cliente'}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[9px] shrink-0">
                          {scheduledTime}
                        </span>
                      </div>

                      {/* Content preview: Thumbnail if available + Title */}
                      <div className="flex items-center gap-1.5">
                        {job.mediaUrls && job.mediaUrls.length > 0 && (
                          <img
                            src={urlDeExibicao(job.mediaUrls[0])}
                            alt=""
                            className="w-6 h-6 rounded-md object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                          />
                        )}
                        <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-1 group-hover/card:text-purple-900 leading-tight">
                          {job.title}
                        </p>
                      </div>

                      {/* Status indicator bar / pill */}
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <FormatBadge format={job.format} />
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                    </PreviaNoHover>
                  );
                })}

                {/* Overflow count */}
                {cell.jobs.length > 3 && (
                  <Button variant="soft"
                    onClick={(e) => {
                      e.stopPropagation();
                      /*
                        **Ele abre a lista do dia, e antes abria o cadastro.**
                        O comentário aqui dizia "show all jobs for that date" e
                        a chamada era `openCreateJobModal`: o botão prometia
                        ver os outros e abria "criar novo". Quem clicava
                        concluía que as peças tinham sumido.
                      */
                      setDiaAberto(cell.date);
                    }}
                    className="w-full text-center text-purple-600 hover:text-purple-800"
                  >
                    +{cell.jobs.length - 3} mais
                  </Button>
                )}
              </div>

              {/*
                **A casinha do celular: pontinhos e um toque.**

                Sete colunas em 390px dão 55px por dia — não cabe cartão
                nenhum. O que cabe é quantos são e em que etapa estão, na cor
                que a coluna do quadro usa. O resto é a lista do dia, que abre
                com o toque.

                O botão cobre a célula inteira (`absolute inset-0`) de
                propósito: num alvo de 55px, exigir mira no pontinho é exigir
                o que o dedo não faz. E ele some no computador, onde o cartão
                de verdade volta e o clique no vazio continua criando peça.
              */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDiaAberto(cell.date);
                }}
                aria-label={`${cell.date.getDate()}: ${
                  cell.jobs.length === 1 ? '1 conteúdo' : `${cell.jobs.length} conteúdos`
                }`}
                className="sm:hidden absolute inset-0 flex flex-col justify-end items-center gap-1 p-1 cursor-pointer"
              >
                <span className="flex flex-wrap justify-center items-center gap-1 w-full">
                  {cell.jobs.slice(0, 6).map((job) => (
                    <span
                      key={job.id}
                      className={`w-1.5 h-1.5 rounded-full ${pontoDaEtapa(job.status)}`}
                    />
                  ))}
                  {cell.jobs.length > 6 && (
                    <span className="text-[9px] font-bold text-slate-400 leading-none">
                      +{cell.jobs.length - 6}
                    </span>
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/*
        A lista do dia, usada pelos dois caminhos: o toque na casinha do
        celular e o "+N mais" do computador. Uma peça só — duas divergiriam na
        primeira pressa, e aqui divergir é mostrar conjuntos diferentes de
        conteúdo para a mesma data.
      */}
      <ConteudosDoDia
        dia={diaAberto}
        jobs={
          diaAberto
            ? (gridCells.find((c) => c.date.getTime() === diaAberto.getTime())?.jobs ?? [])
            : []
        }
        aoFechar={() => setDiaAberto(null)}
      />
    </div>
  );
};
