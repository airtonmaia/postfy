import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MessageSquare,
  Clock,
  GripVertical,
  Pin,
  History,
  Link2,
  Check,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { Client, Job, JobStatus } from '../../types';
import { dataCompacta, copyToClipboard } from '../../lib/utils';
import { PlatformBadge, FormatBadge, TipoBadge } from '../common/Badges';
import { Badge } from '../ui/badge';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import { useConfirmacao } from '../ui/alert-dialog';
import { usePostfy } from '../../context/PostfyContext';
import { urlDoPortalDaAgencia } from '../../lib/rotas';
import { prazoDoCard } from '../../lib/prazoDoCard';
import { etapasDoFluxo } from '../../lib/fluxoDeProducao';
import { urlDeExibicao } from '../../lib/midiaDoDrive';

/**
 * O card do quadro — **um desenho só**, para a lista e para o que segue o
 * cursor.
 *
 * O `DragOverlay` do dnd-kit precisa desenhar o card fora da coluna enquanto
 * ele é arrastado, e a saída fácil é copiar o JSX para lá. Duas cópias
 * divergem na primeira pressa: é a história das doze alturas de botão e das
 * sete barras de abas. Aqui o custo seria visível de imediato — o card sob o
 * cursor deixaria de parecer o card que a pessoa pegou.
 *
 * ### O título vem antes do cliente, e isso é a correção principal
 *
 * A linha de cima do card era o **nome do cliente**, em negrito, e o título da
 * peça vinha embaixo, menor. Numa coluna de doze cards do mesmo cliente — que
 * é o estado normal de quem filtrou por cliente, e filtrar por cliente é o
 * primeiro gesto de quem abre o quadro — a primeira linha era idêntica em
 * todos: a tela repetia doze vezes a resposta que a pessoa já sabia e punha em
 * segundo plano a única que ela procurava.
 *
 * O cliente continua no card, e com avatar: ele é a resposta certa com o
 * filtro em "Todos os Clientes". Só deixou de ser o que se lê primeiro.
 *
 * ### O que a gaveta resolve
 *
 * Etapa, prazos e quem entregou a última versão **só existiam abrindo a
 * peça** — uma modal inteira, que tira a pessoa do quadro, para responder
 * "quando isso vai ao ar?". A gaveta responde sem sair da coluna, e nasce
 * fechada porque card alto é coluna curta.
 */


const dataCurta = (iso?: string) => (iso ? dataCompacta(iso, { comAno: true }) : 'sem data');

export const CartaoDoQuadro: React.FC<{
  job: Job;
  client?: Client;
  aoTrocarStatus?: (status: JobStatus) => void;
  /**
   * O que segue o cursor. Some com os controles e ganha a sombra e a
   * inclinação — é o que dá a sensação de que a peça saiu da coluna.
   */
  flutuando?: boolean;
  /** Solta a posicao fixada. Ausente no card que segue o cursor. */
  aoSoltarPosicao?: () => void;
}> = ({ job, client, aoTrocarStatus, flutuando = false, aoSoltarPosicao }) => {
  /*
    Todos os hooks aqui em cima, antes de qualquer `return`: é a armadilha 8.1,
    e aqui ela seria cara — este componente é montado dezenas de vezes por
    coluna, e o erro #310 derruba a árvore inteira.
  */
  const [aberto, setAberto] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const { pedir, dialogo } = useConfirmacao();
  const { setSelectedJob, setAbaDoConteudo, duplicateJob, deleteJob, currentWorkspace } =
    usePostfy();

  // As etapas como **esta** agência as chama (Configurações → Conteúdos).
  // Lista própria aqui faria o card e a coluna do quadro darem nomes
  // diferentes à mesma etapa.
  const etapas = etapasDoFluxo(currentWorkspace.fluxoDeProducao);

  const prazo = prazoDoCard(job);
  const ultimaVersao = job.versions?.length ? job.versions[job.versions.length - 1] : undefined;

  const abrir = (aba: 'conteudo' | 'revisoes') => {
    setAbaDoConteudo(aba);
    setSelectedJob(job);
  };

  const copiarLink = async () => {
    const ok = await copyToClipboard(
      urlDoPortalDaAgencia(currentWorkspace.slug, window.location.origin)
    );
    if (!ok) return;
    setLinkCopiado(true);
    window.setTimeout(() => setLinkCopiado(false), 2000);
  };

  const excluir = () =>
    pedir({
      titulo: `Excluir "${job.title}"?`,
      // A descrição é obrigatória no diálogo justamente para ele não virar um
      // "tem certeza?": o que decide é a consequência, não a pergunta.
      descricao:
        'A peça sai do quadro com as versões, os comentários e o histórico dela. ' +
        'Se estiver na fila de publicação, o disparo é cancelado junto.',
      rotuloConfirmar: 'Excluir',
      destrutivo: true,
      aoConfirmar: () => deleteJob(job.id),
    });

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/90 p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2.5 group ${
        flutuando
          ? 'shadow-2xl border-purple-300 rotate-2 cursor-grabbing'
          : 'shadow-xs hover:bg-slate-50 hover:border-purple-300 transition-all'
      }`}
    >
      {/* Título, versão e a alça */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition line-clamp-2 leading-tight min-w-0">
          {job.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {/*
            **O card fixado diz que está fixado.** Sem esta marca, uma peça
            parada num lugar que a ordem escolhida não explica parece defeito
            do quadro — e a pessoa não tem como descobrir que foi ela mesma
            quem arrastou aquilo semana passada.

            Clicar solta. É `Button` com `size="icon-sm"` e não um `<button>` à
            mão: a escala existe justamente para não nascer a décima terceira
            altura, e ícone sem rótulo é o caso que o `icon-sm` atende.
          */}
          {job.posicaoFixa != null && !flutuando && aoSoltarPosicao && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Fixado nesta posição. Clique para soltar."
              aria-label="Soltar a posição deste card"
              /* Sem isto, encostar no botão começa a arrastar o card em vez de
                 soltá-lo — o mesmo cuidado da barra de ações abaixo. */
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                aoSoltarPosicao();
              }}
              className="text-purple-600 dark:text-purple-400"
            >
              <Pin className="w-3 h-3" />
            </Button>
          )}
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            v{job.currentVersion}
          </span>
          {/*
            **A alça é dica, não o único caminho.** O card inteiro arrasta — é
            o que a pessoa tenta primeiro —, e a alça existe porque um card que
            se move sem nada indicando que ele se move é um card que ninguém
            tenta mover. Ela aparece no hover para não competir com o conteúdo.
          */}
          <GripVertical
            className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-600 ${
              flutuando ? '' : 'opacity-0 group-hover:opacity-100 transition'
            }`}
            aria-hidden
          />
        </div>
      </div>

      {/* Prévia, cliente e os selos */}
      <div className="flex items-start gap-2.5">
        {job.mediaUrls && job.mediaUrls.length > 0 && (
          <img
            src={urlDeExibicao(job.mediaUrls[0])}
            alt=""
            className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
            /* Sem isto o navegador inicia o arrasto nativo da imagem por cima
               do do dnd-kit, e o que segue o cursor é a figura, não o card. */
            draggable={false}
          />
        )}
        {/*
          **Cliente e selos dividem a linha.** Eram duas linhas, e duas linhas
          por card custam 34px num telefone onde só cabiam dois cards. O nome
          é o que cede (`truncate`): os selos têm largura fixa e pequena, e
          cortar o nome do cliente é barato onde a foto já o identifica.
        */}
        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar nome={client?.name || 'Cliente'} url={client?.avatar} tamanho={16} />
            <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] truncate">
              {client?.name}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap shrink-0">
            <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
            <FormatBadge format={job.format} />
            {/* Conteúdo é a maioria e o padrão: marcar só o que foge disso
                deixa a exceção visível no quadro. */}
            {job.tipo !== 'conteudo' && <TipoBadge tipo={job.tipo} />}
          </div>
        </div>
      </div>

      {/* Data, comentários e o prazo que está apertando */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          {/* Sem data é um estado legítimo — aprovado antes de alguém marcar
              quando vai ao ar —, e dizê-lo é o que faz a pendência aparecer. */}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {job.scheduledDate ? dataCompacta(job.scheduledDate) : 'sem data'}
          </span>
          {job.comments.length > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-slate-400" />
              {job.comments.length}
            </span>
          )}
        </div>

        {/*
          **O aviso de prazo fica no card fechado, nunca dentro da gaveta.**
          Alerta que exige um clique para aparecer não é alerta: quem não
          desconfia que a peça está vencendo é justamente quem não vai abrir.
        */}
        {prazo && (
          <Badge tom={prazo.tom === 'vencido' ? 'rubi' : 'ambar'}>
            <Clock />
            {prazo.texto}
          </Badge>
        )}
      </div>

      {/*
        **Daqui para baixo, clicar não abre a peça.**

        O card inteiro é clicável (`aoAbrir`, no invólucro arrastável) e
        arrastável. Cada controle aqui dentro precisa parar o clique **e** o
        `pointerdown`: sem o primeiro, usar o controle abre a modal por cima;
        sem o segundo, encostar nele começa a arrastar o card em vez de
        acioná-lo. Parar os dois num container só, e não em cada botão, é o que
        impede o próximo botão de nascer sem a proteção — que é exatamente como
        o seletor de etapa já tinha nascido errado uma vez.
      */}
      {!flutuando && (
        <div
          className="pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/*
            **Uma linha só, e isto é altura de card.**

            Eram duas: as ações numa e a gaveta noutra, cada uma com 32px de
            botão. Num telefone o quadro mostrava **dois** cards, e essa
            segunda linha valia um terço de um terceiro. Juntar as duas devolve
            36px por card sem tirar nada da tela.

            O rótulo "Ver histórico" some abaixo do `sm` — é ele que não cabe —,
            e o `aria-label` fica no lugar: rótulo que some no celular sem nome
            para o leitor de tela é trocar um problema de espaço por um de
            acesso.
          */}
          <div className="flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] px-2"
              onClick={() => abrir('revisoes')}
              title="Versões entregues, pedidos de ajuste e a conversa com o cliente"
              aria-label="Ver o histórico deste conteúdo"
            >
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">Ver histórico</span>
            </Button>

            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={copiarLink}
                title="Copiar o link do portal do cliente"
                aria-label="Copiar o link do portal do cliente"
              >
                {linkCopiado ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => duplicateJob(job.id)}
                title="Duplicar este conteúdo"
                aria-label="Duplicar este conteúdo"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={excluir}
                title="Excluir este conteúdo"
                aria-label="Excluir este conteúdo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>

              {/*
                **A gaveta é um botão cinza, não um link.** Na variante
                `ghost` ela era texto solto: sem fundo, sem borda e sem nada em
                volta, ela lia como rótulo — e rótulo ninguém clica.

                O cinza é a `secondary`, que o produto já usa em ação
                secundária e saiu de contagem, não de gosto. Cor nova aqui
                competiria com o selo de prazo logo acima, que é o que precisa
                saltar no card.
              */}
              <Button
                variant="secondary"
                size="sm"
                className="text-[11px] ml-1"
                onClick={() => setAberto((a) => !a)}
                aria-expanded={aberto}
              >
                {aberto ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                {aberto ? 'Recolher' : 'Detalhes'}
              </Button>
            </div>
          </div>

          {aberto && (
            <div className="pt-1 space-y-2 text-[11px]">
              {/*
                **A etapa é um seletor, e ele não é redundância com o arrasto.**

                Ele alcança as sete etapas; o quadro tem seis colunas, e uma
                delas junta "Aprovado" e "Agendado". Arrastar nunca escolhe
                entre esses dois — quem escolhe é aqui. E há quem prefira o
                teclado, ou esteja num aparelho onde arrastar é desconfortável.

                O `onPointerDown` repetido aqui é cinto: o container acima já
                para o evento, e manter a parada colada no seletor é o que
                sobrevive ao dia em que alguém mover este bloco de lugar.
              */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Etapa atual</span>
                {aoTrocarStatus ? (
                  <div onPointerDown={(e) => e.stopPropagation()}>
                    <select
                      value={job.status}
                      onChange={(e) => aoTrocarStatus(e.target.value as JobStatus)}
                      aria-label="Etapa atual do conteúdo"
                      className="text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-0.5 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer"
                    >
                      {etapas.map((etapa) => (
                        <option key={etapa.status} value={etapa.status}>
                          {etapa.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    {etapas.find((e) => e.status === job.status)?.rotulo ?? job.status}
                  </span>
                )}
              </div>

              {/*
                **Quem entregou a versão que está no ar — e só quando existe.**

                A tentação aqui era um campo "Responsável", e ele seria mentira:
                `designerId`, `copywriterId` e `socialMediaId` estão no schema
                desde a primeira migração e **nada no produto escreve neles** —
                a mesma família do `trial_ends_at`. A modal de detalhe já cai
                nessa armadilha hoje: ela rotula `currentUser.name` como
                "Responsável", o que mostra quem está olhando a tela, não quem
                fez a peça.

                O que existe de verdade é `versions[].submittedBy`, carimbado
                com o nome de quem mandou para aprovação. Peça que ninguém
                entregou ainda não mostra linha nenhuma — tela vazia é melhor
                que tela que afirma o que não mediu.
              */}
              {ultimaVersao && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Avatar nome={ultimaVersao.submittedBy || 'Equipe'} tamanho={16} />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {ultimaVersao.submittedBy}
                    </span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">
                    entregou a v{ultimaVersao.versionNumber}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Agendado</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {dataCurta(job.scheduledDate)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Criado</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {dataCurta(job.createdAt)}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-[11px]"
                onClick={() => abrir('conteudo')}
              >
                <ExternalLink className="w-3 h-3" />
                Abrir conteúdo completo
              </Button>
            </div>
          )}
        </div>
      )}

      {dialogo}
    </div>
  );
};

/**
 * O card na coluna: arrastável, clicável, e as duas coisas sem se atrapalhar.
 *
 * **O clique que abre a peça e o arrasto que a move partem do mesmo gesto.**
 * O que os separa é a restrição de ativação dos sensores (ver `KanbanBoard`):
 * no mouse, o arrasto só começa depois de alguns pixels; no toque, depois de
 * uma pausa. Sem isso, ou o card não abre, ou a rolagem da coluna vira
 * arrasto.
 *
 * Enquanto o card está sendo arrastado ele fica **no lugar, apagado**, em vez
 * de sumir: o buraco marca de onde a peça saiu, e sem ele a coluna encolhe
 * debaixo do cursor.
 */
export const CartaoArrastavel: React.FC<{
  job: Job;
  client?: Client;
  aoAbrir: () => void;
  aoTrocarStatus: (status: JobStatus) => void;
  aoSoltarPosicao: () => void;
}> = ({ job, client, aoAbrir, aoTrocarStatus, aoSoltarPosicao }) => {
  /**
   * `useSortable` e não `useDraggable`: o card passou a poder ser solto
   * **numa posição**, não só numa coluna.
   *
   * Ele é construído em cima do `useDraggable`, então as restrições de
   * ativação dos sensores continuam valendo — que é o que separa o clique que
   * abre a peça do arrasto que a move, e o que impede o deslize de sequestrar
   * a rolagem no telefone.
   */
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id, data: { status: job.status } });

  return (
    <div
      ref={setNodeRef}
      /*
        O transform é o que abre o buraco para o card que está chegando. Sem
        ele a lista fica parada e não há como saber onde a peça vai cair — o
        `DragOverlay` mostra o que você segura, não onde vai encostar.
      */
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      {...attributes}
      onClick={aoAbrir}
      /* O rótulo do botão que o dnd-kit monta por baixo: sem ele, quem navega
         por teclado ouve "arrastável" e nada mais. */
      aria-label={`${job.title}. Arraste para mudar de coluna ou de posição.`}
      /*
        **`touch-manipulation`, nunca `touch-none` — e esta linha era o bug
        mais caro do celular.**

        `touch-action: none` desliga a rolagem do navegador **no elemento**. Os
        cards ocupam praticamente toda a área da coluna, então o dedo encostava
        sempre num deles: o quadro simplesmente não rolava no telefone, nem na
        vertical nem na horizontal. Sem erro, sem barra, sem pista.

        O comentário dos sensores já dizia, havia meses, que "deslizar rola e
        segurar arrasta" — e a medição que o acompanha mediu o **arrasto**,
        não a rolagem. Era verdade sobre metade do gesto.

        `none` é a recomendação do dnd-kit para arrasto que começa no toque,
        em que o navegador não pode competir com o gesto. Com restrição de
        ativação por **tempo**, a recomendação é outra: `manipulation`. O
        navegador rola enquanto o `delay` não vence — e a `tolerance` cancela
        o arrasto justamente quando o dedo deslizou, que é o que separa os
        dois gestos.
      */
      className={`cursor-grab active:cursor-grabbing touch-manipulation ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <CartaoDoQuadro
        job={job}
        client={client}
        aoTrocarStatus={aoTrocarStatus}
        aoSoltarPosicao={aoSoltarPosicao}
      />
    </div>
  );
};
