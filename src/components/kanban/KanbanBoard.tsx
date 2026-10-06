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
  Pin,
  Plus,
  Search,
  ChevronDown,
  Image as ImageIcon,
  PenLine,
  Clapperboard,
  MailCheck,
  SlidersHorizontal
} from 'lucide-react';
import { Job, JobStatus, Client, JobTipo, JobPlatform } from '../../types';
import { TIPOS_DE_JOB } from '../../lib/tiposDeJob';
import { enviarAprovacaoEmLote } from '../../lib/automacoes';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CartaoArrastavel, CartaoDoQuadro } from './CartaoDoQuadro';
import { corDaEtapa, etapasDoFluxo } from '../../lib/fluxoDeProducao';
import { AlternarVisaoDoWorkflow } from '../common/AlternarVisaoDoWorkflow';
import { BarraDeFiltrosDoConteudo } from '../common/BarraDeFiltrosDoConteudo';
import { IconeDaEtapa } from '../common/IconeDaEtapa';
import { passaNosFiltros } from '../../lib/filtrosDoConteudo';
import { ClientesDoQuadro } from './ClientesDoQuadro';
import { faltaArteDoStory, AVISO_SEM_ARTE_DE_STORY } from '../../lib/formatos';
import { agendarPublicacao, textoDoAgendamento } from '../../lib/redes';
import { useConfirmacao } from '../ui/alert-dialog';
import { dataCompacta } from '../../lib/utils';
import {
  ordenarColuna,
  dentroDoPeriodo,
  dataQueOrdena,
  ORDEM_PADRAO,
  type IntervaloDeDias,
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
  icone: string;
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
      /*
        **A coluna precisa do par escuro, e a falta dele não some sozinha.**
        Ela era `bg-slate-200/70` sem `dark:`, então no modo escuro as seis
        colunas ficavam **brancas** — faixas claras no meio de uma tela preta,
        com os cards escuros por cima. Aparecia mais nas colunas curtas, onde
        sobra fundo à mostra, e menos nas cheias, onde os cards cobrem quase
        tudo: o mesmo defeito lido como "algumas colunas estão erradas".

        O realce de soltura ao lado já trazia o par desde sempre — o estado
        normal era o que não tinha. É o caso comum: a variante excepcional é
        escrita com atenção, e o fundo de todo dia passa batido.
      */
      className={`w-80 shrink-0 rounded-2xl p-3 flex flex-col max-h-full border shadow-xs transition-colors ${
        realcar
          ? 'bg-purple-100/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700'
          : 'bg-slate-200/70 dark:bg-slate-900/60 border-slate-300/60 dark:border-slate-800'
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
    currentWorkspace,
    formatFilter,
    periodoFiltro,
    intervaloFiltro
  } = usePostfy();


  /**
   * Ordem e janela vivem no estado da tela, não em `user_settings`.
   *
   * São escolhas de momento — "me mostra o que vence esta semana" —, não
   * preferências que a pessoa quer encontrar de volta amanhã. Guardá-las no
   * banco faria alguém abrir o quadro num dia qualquer com metade das peças
   * escondidas por um filtro que ela não lembra de ter ligado.
   */
  /*
    A ordem deixou de ter controle na barra, a pedido, e por isso virou
    constante em vez de estado: um `useState` cujo setter ninguém chama é a
    classe do `trial_ends_at` — parece uma regra e não é. O quadro ordena
    por data, que é o padrão e o que a coluna sugere.
  */
  const ordem: ChaveDeOrdem = ORDEM_PADRAO;
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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

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
  const { pedir, dialogo } = useConfirmacao();
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const agrupaAvisos = currentWorkspace.notificacaoAprovacao === 'lote';

  /*
    As etapas como **esta** agência as chama (Configurações → Conteúdos). O
    nome e a cor da coluna saem daqui; o agrupamento dos status, não.
  */
  const etapasDaAgencia = etapasDoFluxo(currentWorkspace.fluxoDeProducao);
  const etapaPor = (status: JobStatus) =>
    etapasDaAgencia.find((e) => e.status === status) ?? etapasDaAgencia[0];

  /**
   * A peça publicada já saiu da vista do quadro?
   *
   * **Zero e nulo valem "nunca"**, e isso não é tolerância a dado ruim: um
   * campo numérico zerado por engano apagaria a coluna inteira, e o estado
   * seguinte seria a pessoa concluindo que o sistema perdeu as publicações.
   *
   * A data é a de publicação, com recuo na de agendamento: peça marcada como
   * publicada à mão não tem `publishedDate`, e sem o recuo ela nunca
   * arquivaria — a limpeza funcionaria só para o que saiu pela fila.
   */
  const diasParaArquivar = currentWorkspace.arquivarPublicadosAposDias ?? 0;
  const arquivada = (job: Job): boolean => {
    if (diasParaArquivar <= 0 || job.status !== 'published') return false;
    const quando = job.publishedDate || job.scheduledDate;
    if (!quando) return false;
    const t = Date.parse(quando);
    if (Number.isNaN(t)) return false;
    return Date.now() - t > diasParaArquivar * 24 * 60 * 60 * 1000;
  };

  const dispararLote = async () => {
    if (clientFilter === 'all') {
      setAviso({
        ok: false,
        texto: 'Escolha um cliente no filtro acima: o aviso vai para a caixa dele.',
      });
      return;
    }

    setEnviandoLote(true);
    setAviso(null);
    try {
      const { enviados, destinatario } = await enviarAprovacaoEmLote(
        currentWorkspace.id,
        clientFilter
      );
      // "Na fila", não "enviado": quem envia é o cron, daqui a alguns minutos
      // (armadilha 9.1). Dizer "enviado" aqui seria afirmar o que ainda não
      // aconteceu.
      setAviso({
        ok: true,
        texto: `${enviados} conteúdo(s) no aviso, na fila para ${destinatario}.`,
      });
    } catch (e) {
      setAviso({
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
  const columns: Coluna[] = ([
    { id: 'ideas', statuses: ['ideas'] },
    { id: 'in_production', statuses: ['in_production'] },
    { id: 'for_approval', statuses: ['for_approval'] },
    { id: 'in_adjustment', statuses: ['in_adjustment'] },
    /*
      **'Aprovado' e 'Agendado' são colunas separadas, e o que os separava
      antes era um atalho.**

      Eles dividiam uma coluna porque arrastar não pode enfileirar publicação:
      'Agendado' significa que a peça está na `publish_queue` e vai ao ar
      sozinha, e postagem no perfil do cliente não volta. Juntá-los resolvia
      isso **escondendo a etapa** — o quadro tinha seis colunas para sete
      etapas, e a peça agendada ficava misturada com a que ninguém mandou
      publicar, que são estados bem diferentes para quem olha o quadro.

      O que a separação exige é que o gesto **pergunte**: soltar aqui abre a
      confirmação do agendamento, e quem enfileira é a confirmação. A regra
      continua inteira — enfileirar é um clique —, e o clique passou a ser o
      "Agendar publicação" do diálogo.
    */
    { id: 'approved', statuses: ['approved'] },
    { id: 'scheduled', statuses: ['scheduled'] },
    { id: 'published', statuses: ['published'] },
  ] as { id: string; statuses: JobStatus[] }[]).map((c) => ({
    ...c,
    /*
      **O título e a cor vêm do fluxo da agência**, não de um literal: quem
      renomeia "Produção" para "Edição" em Configurações precisa ver "Edição"
      no quadro. Duas fontes para o mesmo nome é como a coluna e o card
      passariam a chamar a mesma etapa de coisas diferentes.
    */
    title: c.statuses.map((st) => etapaPor(st).rotulo).join(' / '),
    color: corDaEtapa(etapaPor(c.statuses[0]).cor).caixa,
    border: corDaEtapa(etapaPor(c.statuses[0]).cor).borda,
    icone: etapaPor(c.statuses[0]).icone,
  }));

  // Filter jobs
  /*
    **O recorte é o mesmo do calendário, e agora por construção.** O predicado
    estava escrito cinco vezes — aqui e nas quatro visões do calendário — e já
    tinha divergido: o filtro de formato existia só no quadro. Todas chamam
    `passaNosFiltros`, então um filtro novo nasce valendo nas cinco.
  */
  const filtros = {
    cliente: clientFilter,
    rede: platformFilter,
    formato: formatFilter,
    periodo: periodoFiltro,
    intervalo: intervaloFiltro,
  };

  // Sem a janela de datas: é deste conjunto que sai a contagem das peças
  // escondidas **por não terem data**, logo abaixo.
  const antesDoPeriodo = jobs.filter((job) =>
    passaNosFiltros(job, { ...filtros, periodo: 'todos' as Periodo })
  );

  const filteredJobs = antesDoPeriodo
    .filter((job) => passaNosFiltros(job, filtros))
    /*
      **Arquivar aqui é sair da vista, não apagar.** A coluna "Publicado"
      cresce para sempre numa agência em uso, e a peça entregue continua no
      banco, no calendário, nos relatórios e na busca — some só da coluna.

      O recorte vale apenas para `published`: esconder uma peça **aberta** por
      idade seria o quadro omitindo trabalho que ainda precisa ser feito, e a
      pessoa concluiria que ela foi perdida.
    */
    .filter((job) => !arquivada(job));

  const semDataEscondidas =
    periodoFiltro === 'todos'
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
   * **"Agendado" é o único destino que o arrasto não grava sozinho.** Ele
   * significa que a peça está na `publish_queue` e vai ao ar sozinha, e
   * postagem no perfil do cliente não volta: um gesto não pode decidir isso.
   * Quem trata esse destino é `aoTerminarArrasto`, abrindo a confirmação —
   * aqui ele devolve o status como qualquer outro, porque esta função só
   * responde "para onde a peça foi".
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

  /**
   * O agendamento que o arrasto pede e a confirmação decide.
   *
   * Três recusas antes da pergunta, e nenhuma é zelo:
   *
   * - **sem data não há agendamento.** `quandoDeveSair` trata data no passado
   *   como *agora* — é a regra do "agendei para agora" —, então uma peça sem
   *   data entraria na fila para sair na primeira passada do cron. Arrastar um
   *   card publicaria no perfil do cliente em cinco minutos;
   * - **falta a arte do story** é a conferência que mora antes da ação: o
   *   publicador não substitui mais pela arte do feed, mas descobrir lá é
   *   tarde — o feed já está no ar e a peça ficou pela metade;
   * - e o diálogo **nomeia a consequência**, que é a razão de `descricao` ser
   *   obrigatória: "tem certeza?" não ajuda ninguém a decidir.
   */
  const pedirAgendamento = (job: Job) => {
    if (!job.scheduledDate) {
      setAviso({
        ok: false,
        texto:
          'Esta peça não tem data de publicação. Abra o conteúdo e marque a data antes de ' +
          'agendar — sem ela, a fila entenderia "agora" e o disparo sairia na próxima passada.',
      });
      return;
    }

    if (faltaArteDoStory(job)) {
      setAviso({ ok: false, texto: AVISO_SEM_ARTE_DE_STORY });
      return;
    }

    pedir({
      titulo: `Agendar "${job.title}"?`,
      descricao:
        `A peça entra na fila de publicação e vai ao ar sozinha em ` +
        `${dataCompacta(job.scheduledDate, { comAno: true })}, nas contas conectadas deste ` +
        'cliente. Publicação feita não volta — até lá, dá para tirar da fila em Publicações.',
      rotuloConfirmar: 'Agendar publicação',
      aoConfirmar: () => void agendar(job),
    });
  };

  const agendar = async (job: Job) => {
    setAviso(null);
    try {
      /*
        O status primeiro, e `moveJobStatus` e não `updateJob`: é ele que
        carimba o histórico da etapa como qualquer outra mudança. Se a fila
        recusar depois, o aviso diz o que não entrou — e a peça em "Agendado"
        sem item na fila aparece na tela de Publicações, que é onde se olha.
      */
      moveJobStatus(job.id, 'scheduled');
      setAviso(textoDoAgendamento(await agendarPublicacao(job), job.scheduledDate));
    } catch (err) {
      setAviso({
        ok: false,
        texto: err instanceof Error ? err.message : 'Não foi possível agendar.',
      });
    }
  };

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

    /*
      **Soltar em "Agendado" não grava nada: ele pergunta.**

      Gravar `scheduled` aqui seria a tela afirmando que a peça está na fila
      quando ela não está — a "fila de mentira" que este produto já teve, com
      o card dizendo "Agendado", a data passando e nada publicando. E
      enfileirar direto seria pior: um gesto de arrastar publicaria no perfil
      do cliente, e o que sai não volta.

      Então o gesto abre a confirmação, e é ela que faz as duas coisas — muda
      o status **e** põe na fila —, pelo mesmo caminho do botão "Agendar
      publicação" da peça. A posição também não é gravada: ela viria antes de
      a peça ter entrado na coluna.
    */
    if (novoStatus === 'scheduled') {
      pedirAgendamento(job);
      return;
    }

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
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Workflow de conteúdo</h3>
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

          {/*
            **Os cards fixados e a saída para soltá-los.**

            Isto morava dentro do menu "Ordenar", que saiu da barra — e sair
            levaria junto o **único** caminho de soltar um card fixado. Quem
            fixou uma peça semana passada e esqueceu veria o quadro numa ordem
            que a data não explica, concluiria que a ordenação está quebrada, e
            a saída estaria escondida dentro de cada card.

            "Sempre há porta de saída" é regra deste projeto, e tirar um
            controle não pode levar embora a única que existe. Aqui ela fica
            mais à vista do que estava: era preciso abrir um menu para ver que
            havia cards fixados.
          */}
          {fixados > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Pin className="w-3 h-3" />
              {fixados === 1 ? '1 card fixado' : `${fixados} cards fixados`}
              <button
                type="button"
                onClick={soltarTodos}
                className="font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
              >
                Soltar
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/*
            Cliente, formato, rede e data — a mesma barra que o calendário usa.
            Ela lê e escreve no contexto, então o recorte sobrevive à troca de
            visão: filtrar por Reels no quadro e encontrar o calendário sem o
            filtro é a tela escondendo conteúdo sem dizer que escondeu.
          */}
          {/*
            **No celular ela vira gaveta, e isso é altura, não gosto.** Os
            quatro filtros ocupavam duas linhas de 42px no telefone — 84px que
            saíam direto do espaço dos cards, numa tela em que só cabiam dois.
            A gaveta devolve as duas linhas e monta a **mesma** peça: versão
            reduzida para o celular divergiria na primeira pressa.
          */}
          <div className="hidden sm:flex">
            <BarraDeFiltrosDoConteudo />
          </div>

          <Button
            variant="secondary"
            className="sm:hidden"
            onClick={() => setFiltrosAbertos(true)}
            aria-label="Abrir os filtros do quadro"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
          </Button>

          {/* A troca de visão fica colada no Adicionar, à direita: ela não é
              um filtro, é a escolha de qual tela se está olhando. No meio dos
              filtros, lia como mais um recorte do mesmo conteúdo. */}
          <AlternarVisaoDoWorkflow />

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

      {/* Os clientes em faixa, logo abaixo do cabeçalho: clicar na foto filtra
          o quadro. Ela mexe no mesmo `clientFilter` do seletor acima — dois
          controles, um estado só, então eles não têm como divergir. */}
      <ClientesDoQuadro
        clientes={clients}
        selecionado={clientFilter}
        aoSelecionar={setClientFilter}
      />

      {aviso && (
        <div
          className={`mx-6 mt-4 flex items-start gap-2 text-xs p-3 rounded-xl border ${
            aviso.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
          }`}
        >
          <MailCheck className="w-4 h-4 shrink-0 mt-px" />
          <span className="font-semibold leading-relaxed">{aviso.texto}</span>
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
        <div className="flex-1 flex overflow-x-auto p-3 sm:p-6 gap-3 sm:gap-4 items-start min-h-0">
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
                    {/*
                      **O ícone é um disco, e o título saiu do selo.**

                      A primeira versão pôs o ícone **dentro** do selo colorido,
                      para não inventar uma forma que o produto não tem. A
                      decisão foi revista a pedido, com a referência na mão, e o
                      que ela mostra é melhor por um motivo que só aparece em
                      tela: o disco dá ao ícone o dobro do tamanho, e num ícone
                      de 12px dentro de um selo não dá para distinguir uma
                      lâmpada de uma paleta — que é justamente o que escolher o
                      ícone deveria resolver.

                      Com o disco carregando a cor, o título vira texto comum:
                      pintar os dois repetiria a mesma informação duas vezes, e
                      o nome da etapa é o que se lê primeiro.
                    */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-full shrink-0 inline-flex items-center justify-center border ${col.color} ${col.border}`}
                      >
                        <IconeDaEtapa chave={col.icone} className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                          {col.title}
                        </span>
                        {/* A contagem era um número solto ao lado do selo, e
                            número sem unidade ao lado de um nome lê como
                            versão. Com a palavra, ele responde a pergunta que
                            a pessoa faz ao olhar a coluna: quantas peças. */}
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          {colJobs.length} {colJobs.length === 1 ? 'item' : 'itens'}
                        </span>
                      </span>
                    </div>

                    {col.id === 'ideas' && (
                      <Button variant="ghost" size="icon-sm"
                        onClick={() => openCreateJobModal()}
                        className="hover:bg-slate-300 dark:hover:bg-slate-800"
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

      {/*
        A gaveta dos filtros, só no celular. Ela monta a **mesma**
        `BarraDeFiltrosDoConteudo` da barra de cima, empilhada — o estado mora
        no contexto, então o que se escolhe aqui já está escolhido quando ela
        fecha, e vale igual no calendário.
      */}
      <Dialog open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <DialogContent className="sm:hidden">
          <DialogHeader>
            <DialogTitle>Filtros do quadro</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <BarraDeFiltrosDoConteudo empilhada />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sem isto na árvore o diálogo não existe, e soltar um card em "Agendado"
          não faria nada: sem erro, sem pergunta, sem pista. É a falha silenciosa
          que o hook de confirmação carrega, e nada local a acusa. */}
      {dialogo}
    </div>
  );
};
