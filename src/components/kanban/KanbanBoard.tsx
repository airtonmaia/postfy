import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { usePostfy } from '../../context/PostfyContext';
import {
  Plus,
  Search,
  ChevronDown,
  Image as ImageIcon,
  PenLine,
  Clapperboard,
  MailCheck
} from 'lucide-react';
import { Job, JobStatus, Client, JobTipo } from '../../types';
import { TIPOS_DE_JOB } from '../../lib/tiposDeJob';
import { enviarAprovacaoEmLote } from '../../lib/automacoes';
import { Button } from '../ui/button';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CartaoArrastavel, CartaoDoQuadro } from './CartaoDoQuadro';
import { FiltrosDoQuadro } from './FiltrosDoQuadro';
import {
  ordenarColuna,
  dentroDoPeriodo,
  dataQueOrdena,
  ORDEM_PADRAO,
  PERIODO_PADRAO,
  type ChaveDeOrdem,
  type Periodo,
} from '../../lib/ordemDoQuadro';

interface Coluna {
  id: string;
  title: string;
  statuses: JobStatus[];
  color: string;
  border: string;
}

/**
 * A coluna, e o alvo de soltura que ela é.
 *
 * Componente próprio porque `useDroppable` é um hook: dentro do `.map` das
 * colunas ele rodaria em quantidade variável, que é a armadilha 8.1 com outra
 * roupa.
 *
 * **A lista tem altura mínima mesmo vazia.** Sem ela, a coluna sem card não
 * tem área para soltar nada — e a primeira peça de uma coluna vazia é
 * justamente a que alguém precisa arrastar para lá.
 */
const ColunaDoQuadro: React.FC<{
  col: Coluna;
  children: React.ReactNode;
  vazia: boolean;
  cabecalho: React.ReactNode;
  /** `null` quando nada está sendo arrastado. */
  statusArrastado: JobStatus | null;
}> = ({ col, children, vazia, cabecalho, statusArrastado }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  /*
    Soltar na coluna de onde a peça saiu não muda nada, e a tela diz isso
    antes: o realce só acende onde o gesto tem efeito. Alvo que acende para não
    fazer nada é pior que alvo que não acende.
  */
  const mudaAlgo = statusArrastado !== null && !col.statuses.includes(statusArrastado);
  const realcar = isOver && mudaAlgo;

  return (
    <div
      ref={setNodeRef}
      className={`w-80 shrink-0 rounded-2xl p-3 flex flex-col max-h-full border shadow-xs transition-colors ${
        realcar
          ? 'bg-purple-100/80 dark:bg-purple-950/40 border-purple-400'
          : 'bg-slate-200/70 border-slate-300/60'
      }`}
    >
      {cabecalho}

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-24">
        {children}

        {vazia && (
          <div
            className={`h-20 rounded-xl border border-dashed flex items-center justify-center text-[11px] text-center px-3 leading-relaxed ${
              realcar
                ? 'border-purple-400 text-purple-700 dark:text-purple-300'
                : 'border-slate-300 dark:border-slate-700 text-slate-400'
            }`}
          >
            {realcar ? 'Solte aqui' : 'Nenhum conteúdo nesta etapa'}
          </div>
        )}
      </div>
    </div>
  );
};


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
    updateJob,
    setSelectedJob, 
    openCreateJobModal,
    currentWorkspace
  } = usePostfy();

  const [search, setSearch] = useState('');

  /**
   * Ordem e janela vivem no estado da tela, não em `user_settings`.
   *
   * São escolhas de momento — "me mostra o que vence esta semana" —, não
   * preferências que a pessoa quer encontrar de volta amanhã. Guardá-las no
   * banco faria alguém abrir o quadro num dia qualquer com metade das peças
   * escondidas por um filtro que ela não lembra de ter ligado.
   */
  const [ordem, setOrdem] = useState<ChaveDeOrdem>(ORDEM_PADRAO);
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_PADRAO);

  /** O id do que está sendo arrastado. `null` quando nada está. */
  const [arrastando, setArrastando] = useState<string | null>(null);

  /**
   * **Um gesto, duas ações — e o que as separa são as restrições de ativação.**
   *
   * O card abre a peça no clique e se move no arrasto. Sem restrição, o
   * dnd-kit começa a arrastar já no `pointerdown` e o clique nunca acontece:
   * o quadro deixaria de abrir conteúdo.
   *
   * No mouse a separação é **distância**: alguns pixels de movimento viram
   * arrasto; parado, é clique.
   *
   * No toque é **tempo**, e isso não é preferência. Distância no toque
   * sequestra a rolagem: a coluna rola na vertical e o quadro na horizontal,
   * então qualquer deslize viraria arrasto e o quadro ficaria impossível de
   * percorrer no telefone. Com a pausa de 250 ms, deslizar rola e segurar
   * arrasta — o gesto que todo aplicativo de lista usa.
   *
   * `tolerance` é o quanto o dedo pode tremer durante a pausa sem cancelar:
   * sem folga, ninguém consegue segurar parado o bastante.
   */
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );
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
  const antesDoPeriodo = jobs.filter(job => {
    if (clientFilter !== 'all' && job.clientId !== clientFilter) return false;
    if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!job.title.toLowerCase().includes(q) && !job.caption.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredJobs = antesDoPeriodo.filter((job) => dentroDoPeriodo(job, periodo));

  /**
   * Quantas peças a janela escondeu **por não terem data**.
   *
   * A janela pergunta "o que acontece neste período", e o que não tem data não
   * acontece em período nenhum — então ela some. Sumiço silencioso é a
   * armadilha 9: quem filtra por "este mês" e não encontra a peça que acabou
   * de criar conclui que ela não foi salva. O quadro diz o número.
   */
  const semDataEscondidas =
    periodo === 'todos'
      ? 0
      : antesDoPeriodo.filter((j) => !dataQueOrdena(j)).length;

  const fixados = filteredJobs.filter((j) => j.posicaoFixa != null).length;

  /**
   * Solta todos os cards fixados **do que está em tela**, não da agência
   * inteira: soltar em silêncio a peça de um cliente que o filtro esconde
   * seria desfazer uma decisão que quem clicou não está vendo.
   */
  const soltarTodos = () => {
    for (const job of filteredJobs) {
      if (job.posicaoFixa != null) updateJob(job.id, { posicaoFixa: null });
    }
  };

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

  const jobArrastado = useMemo(
    () => (arrastando ? filteredJobs.find((j) => j.id === arrastando) ?? null : null),
    [arrastando, filteredJobs]
  );

  /**
   * Para onde a coluna leva a peça.
   *
   * Devolve `null` quando soltar não muda nada — soltar na coluna de onde a
   * peça saiu, ou fora de qualquer coluna. Sem esse `null`, arrastar e
   * desistir gravaria um status igual ao que já estava, enchendo o histórico
   * de atividade de linhas que não aconteceram.
   *
   * **A coluna "Aprovado / Agendado" junta dois status, e o arrasto escolhe
   * sempre `approved`.** "Agendado" significa que existe data marcada **e**
   * que a peça está na fila de publicação — e enfileirar é um clique, nunca
   * um efeito de arrastar um card: postagem no perfil do cliente não volta.
   * Quem quer `scheduled` usa o seletor do card, ou o botão "Agendar
   * publicação" na peça, que põe na fila de verdade.
   */
  const statusAoSoltar = (col: Coluna | undefined, job: Job): JobStatus | null => {
    if (!col) return null;
    if (col.statuses.includes(job.status)) return null;
    return col.statuses[0];
  };

  /**
   * Cada coluna já na ordem final: os fixados nos índices deles, o resto
   * fluindo pela chave escolhida.
   *
   * Calculada uma vez e usada nos dois lugares que precisam dela — o desenho
   * e o `onDragEnd`, que converte "soltei em cima deste card" em índice.
   * Recalcular no handler abriria a porta para as duas listas divergirem, e a
   * peça cairia num lugar diferente do que a pessoa viu.
   */
  const jobsPorColuna = useMemo(() => {
    const mapa = new Map<string, Job[]>();
    for (const col of columns) {
      const daColuna = filteredJobs.filter((j) => col.statuses.includes(j.status));
      mapa.set(col.id, ordenarColuna(daColuna, ordem, (j) => clientMap.get(j.clientId)?.name ?? ''));
    }
    return mapa;
  }, [filteredJobs, ordem, clientMap]);

  const aoComecarArrasto = (evento: DragStartEvent) => setArrastando(String(evento.active.id));

  const aoTerminarArrasto = (evento: DragEndEvent) => {
    setArrastando(null);

    const job = jobs.find((j) => j.id === String(evento.active.id));
    if (!job) return;

    const alvo = String(evento.over?.id ?? '');
    if (!alvo) return;

    /*
      O alvo é uma coluna **ou** um card. Com o `useSortable`, soltar em cima
      de outro card devolve o id dele — é isso que dá a posição. Soltar na
      área livre da coluna devolve o id da coluna, e aí o destino é o fim.
    */
    const col =
      columns.find((c) => c.id === alvo) ??
      columns.find((c) => (jobsPorColuna.get(c.id) ?? []).some((j) => j.id === alvo));
    if (!col) return;

    const lista = jobsPorColuna.get(col.id) ?? [];
    const novoStatus = statusAoSoltar(col, job);

    /*
      **Soltar onde a peça já estava não grava nada**, e a regra ficou mais
      larga do que era: antes ela só cobria a coluna, agora cobre a posição.
      Sem isso, pegar um card e devolvê-lo ao mesmo lugar o fixaria — e um
      gesto de desistência viraria uma decisão que o quadro passa a respeitar
      para sempre.
    */
    if (alvo === job.id && !novoStatus) return;

    const indice = lista.findIndex((j) => j.id === alvo);
    const destino = indice >= 0 ? indice : lista.length;

    if (!novoStatus && job.posicaoFixa === destino) return;

    /*
      `moveJobStatus` e não `updateJob` para o status: ele carimba a data de
      publicação quando a peça entra em "Publicado" e dispara o aviso ao
      cliente quando ela entra em "Para Aprovação".
    */
    if (novoStatus) moveJobStatus(job.id, novoStatus);

    /*
      E a posição vai à parte, porque ela não é status: é a decisão de que
      **esta** peça fica **aqui**, e é ela que a ordenação passa a respeitar
      enquanto o resto da coluna continua fluindo por data.
    */
    updateJob(job.id, { posicaoFixa: destino });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Quadro de Conteúdos (Kanban)</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {filteredJobs.length} jobs ativos
          </span>
          {/*
            O que a janela escondeu, dito em vez de sumido. Quem filtra por
            "este mês" e não encontra a peça que acabou de criar conclui que
            ela não foi salva — e a persistência aqui roda em segundo plano,
            então essa conclusão é exatamente a que já custou caro antes.
          */}
          {semDataEscondidas > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
              {semDataEscondidas === 1
                ? '1 sem data, fora desta janela'
                : `${semDataEscondidas} sem data, fora desta janela`}
            </span>
          )}
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

          <FiltrosDoQuadro
            ordem={ordem}
            aoMudarOrdem={setOrdem}
            periodo={periodo}
            aoMudarPeriodo={setPeriodo}
            fixados={fixados}
            aoSoltarTodos={soltarTodos}
          />

          {/* Adicionar: a agência escolhe qual das três entregas vai criar. */}
          <div className="relative">
            <Button
              onClick={() => setMenuDeTipoAberto((aberto) => !aberto)}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${menuDeTipoAberto ? 'rotate-180' : ''}`}
              />
            </Button>

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

      {/*
        **O quadro inteiro fica dentro de um `DndContext`.**

        `pointerWithin` e não o `rectIntersection` padrão: com retângulos, a
        coluna vizinha ganha o alvo assim que o card **encosta** nela, e as
        colunas ficam a 16px uma da outra — soltar na fronteira caía na errada
        com frequência. `pointerWithin` decide pelo ponteiro, que é onde a
        pessoa está olhando.
      */}
      <DndContext
        sensors={sensores}
        collisionDetection={pointerWithin}
        onDragStart={aoComecarArrasto}
        onDragCancel={() => setArrastando(null)}
        onDragEnd={aoTerminarArrasto}
      >
        <div className="flex-1 flex overflow-x-auto p-6 gap-4 items-start min-h-0">
          {columns.map(col => {
            const colJobs = jobsPorColuna.get(col.id) ?? [];

            return (
              <ColunaDoQuadro
                key={col.id}
                col={col}
                vazia={colJobs.length === 0}
                statusArrastado={jobArrastado?.status ?? null}
                cabecalho={
                  <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${col.color} ${col.border}`}>
                        {col.title}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                        {colJobs.length}
                      </span>
                    </div>

                    {col.id === 'ideas' && (
                      <Button variant="ghost" size="icon-sm"
                        onClick={() => openCreateJobModal()}
                        className="hover:bg-slate-300"
                        title="Adicionar ideia"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}

                    {col.id === 'for_approval' && agrupaAvisos && colJobs.length > 0 && (
                      <Button
                        onClick={() => void dispararLote()}
                        disabled={enviandoLote}
                        title="Manda um aviso só, com tudo que este cliente tem para aprovar."
                        className="bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      >
                        <MailCheck className="w-3 h-3" />
                        {enviandoLote ? 'Enviando...' : 'Aprovação em massa'}
                      </Button>
                    )}
                  </div>
                }
              >
                {/*
                  O `SortableContext` é o que dá **posição** ao arrasto: sem
                  ele o dnd-kit só sabe dizer em qual coluna o cursor está, e
                  soltar no meio da lista seria indistinguível de soltar no
                  fim. A estratégia vertical é a que casa com uma coluna.
                */}
                <SortableContext
                  items={colJobs.map((j) => j.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {colJobs.map(job => (
                    <CartaoArrastavel
                      key={job.id}
                      job={job}
                      client={clientMap.get(job.clientId)}
                      aoAbrir={() => setSelectedJob(job)}
                      aoTrocarStatus={(status) => moveJobStatus(job.id, status)}
                      aoSoltarPosicao={() => updateJob(job.id, { posicaoFixa: null })}
                    />
                  ))}
                </SortableContext>
              </ColunaDoQuadro>
            );
          })}
        </div>

        {/*
          **O que segue o cursor sai do fluxo da coluna.**

          Sem o `DragOverlay`, quem se move é o próprio card — e ele fica preso
          dentro do `overflow` da coluna, sumindo atrás da borda assim que
          passa para a de ao lado. O overlay desenha por cima de tudo, e o card
          original fica no lugar, apagado, marcando de onde a peça saiu.
        */}
        <DragOverlay dropAnimation={null}>
          {jobArrastado && (
            <div className="w-72">
              <CartaoDoQuadro
                job={jobArrastado}
                client={clientMap.get(jobArrastado.clientId)}
                flutuando
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
