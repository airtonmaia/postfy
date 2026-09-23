import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Clock, GripVertical, Pin } from 'lucide-react';
import type { Client, Job, JobStatus } from '../../types';
import { safeDateFormat } from '../../lib/utils';
import { PlatformBadge, FormatBadge, TipoBadge } from '../common/Badges';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
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
 */
export const CartaoDoQuadro: React.FC<{
  job: Job;
  client?: Client;
  aoTrocarStatus?: (status: JobStatus) => void;
  /**
   * O que segue o cursor. Some com o seletor de status e ganha a sombra e a
   * inclinação — é o que dá a sensação de que a peça saiu da coluna.
   */
  flutuando?: boolean;
  /** Solta a posicao fixada. Ausente no card que segue o cursor. */
  aoSoltarPosicao?: () => void;
}> = ({ job, client, aoTrocarStatus, flutuando = false, aoSoltarPosicao }) => (
  <div
    className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/90 p-3.5 space-y-2.5 group ${
      flutuando
        ? 'shadow-2xl border-purple-300 rotate-2 cursor-grabbing'
        : 'shadow-xs hover:bg-slate-50 hover:border-purple-300 transition-all'
    }`}
  >
    {/* Cliente, versão e a alça */}
    <div className="flex items-center justify-between text-xs gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <Avatar nome={client?.name || 'Cliente'} url={client?.avatar} tamanho={16} />
        <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate">
          {client?.name}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/*
          **O card fixado diz que está fixado.** Sem esta marca, uma peça
          parada num lugar que a ordem escolhida não explica parece defeito do
          quadro — e a pessoa não tem como descobrir que foi ela mesma quem
          arrastou aquilo semana passada.

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
               soltá-lo — o mesmo cuidado do seletor de status abaixo. */
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
          **A alça é dica, não o único caminho.** O card inteiro arrasta — é o
          que a pessoa tenta primeiro —, e a alça existe porque um card que se
          move sem nada indicando que ele se move é um card que ninguém tenta
          mover. Ela aparece no hover para não competir com o conteúdo.
        */}
        <GripVertical
          className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-600 ${
            flutuando ? '' : 'opacity-0 group-hover:opacity-100 transition'
          }`}
          aria-hidden
        />
      </div>
    </div>

    {/* Título e prévia */}
    <div className="flex items-start gap-2.5">
      {job.mediaUrls && job.mediaUrls.length > 0 && (
        <img
          src={urlDeExibicao(job.mediaUrls[0])}
          alt=""
          className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
          /* Sem isto o navegador inicia o arrasto nativo da imagem por cima do
             do dnd-kit, e o que segue o cursor é a figura, não o card. */
          draggable={false}
        />
      )}
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition line-clamp-2 leading-tight">
          {job.title}
        </h4>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
          <FormatBadge format={job.format} />
          {/* Conteúdo é a maioria e o padrão: marcar só o que foge disso deixa
              a exceção visível no quadro. */}
          {job.tipo !== 'conteudo' && <TipoBadge tipo={job.tipo} />}
        </div>
      </div>
    </div>

    {/* Datas, comentários e o seletor de status */}
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-2">
        {/* Sem data é um estado legítimo — aprovado antes de alguém marcar
            quando vai ao ar —, e dizê-lo é o que faz a pendência aparecer. */}
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

      {/*
        **O seletor continua, e não é redundância com o arrasto.**

        Ele alcança os sete status; o quadro tem seis colunas, e uma delas
        junta "Aprovado" e "Agendado". Arrastar nunca escolhe entre esses dois
        — quem escolhe é aqui. E há quem prefira o teclado, ou esteja num
        aparelho onde arrastar é desconfortável.

        `onPointerDown` para o sensor de arrasto: sem ele, encostar no seletor
        começa a mover o card em vez de abrir a lista.
      */}
      {!flutuando && aoTrocarStatus && (
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <select
            value={job.status}
            onChange={(e) => aoTrocarStatus(e.target.value as JobStatus)}
            className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-1 py-0.5 text-slate-600 dark:text-slate-400 font-medium cursor-pointer"
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
      )}
    </div>
  </div>
);

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
      className={`cursor-grab active:cursor-grabbing touch-none ${
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
