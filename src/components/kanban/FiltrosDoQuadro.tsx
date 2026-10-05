import React from 'react';
import { ArrowDownWideNarrow, CalendarRange, Layers, Pin, Share2, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import {
  ORDENS,
  PERIODOS,
  type ChaveDeOrdem,
  type Periodo,
  type IntervaloDeDias,
} from '../../lib/ordemDoQuadro';
import { FORMATOS_POR_CANAL } from '../../lib/formatos';
import { NOME_DA_REDE } from '../../lib/redes';
import type { JobPlatform, User } from '../../types';

/**
 * Todos os formatos que existem, sem repetir.
 *
 * **Derivado de `FORMATOS_POR_CANAL`, nunca escrito à mão.** A tabela é por
 * rede e um formato aparece em várias; o filtro pergunta "qual formato", sem
 * rede no meio. Uma segunda lista aqui deixaria de oferecer o formato novo no
 * dia em que ele entrasse — e um filtro que não oferece esconde conteúdo sem
 * dizer que escondeu.
 */
const FORMATOS = Object.values(FORMATOS_POR_CANAL)
  .flat()
  .filter((f, i, todos) => todos.findIndex((o) => o.valor === f.valor) === i);

/** As redes em pares [valor, rótulo], na ordem em que o domínio as declara. */
const REDES = Object.entries(NOME_DA_REDE) as [JobPlatform, string][];

/**
 * Os dois controles da barra do quadro: a ordem e a janela de datas.
 *
 * **`DropdownMenu` e não `<select>`**, pela mesma razão já escrita no seletor
 * de canais: o nativo abre uma caixa com a fonte e o cinza do sistema
 * operacional, e o produto é whitelabel — "a cara do navegador" é o que ele
 * existe para não mostrar. Aqui pesa mais um motivo: a opção precisa de uma
 * linha de apoio dizendo o que ela faz, e `<option>` não aceita nada além de
 * texto puro.
 *
 * O gatilho **diz o valor escolhido**, em vez de só o nome do filtro. Um
 * botão escrito "Ordenar" não distingue um quadro na ordem padrão de um
 * quadro que alguém deixou por prioridade três dias atrás — e o segundo é
 * exatamente o estado que faz a pessoa achar que o sistema embaralhou tudo.
 */
export const FiltrosDoQuadro: React.FC<{
  ordem: ChaveDeOrdem;
  aoMudarOrdem: (ordem: ChaveDeOrdem) => void;
  periodo: Periodo;
  aoMudarPeriodo: (periodo: Periodo) => void;
  /** As duas pontas do período personalizado, em `YYYY-MM-DD`. */
  intervalo: IntervaloDeDias;
  aoMudarIntervalo: (intervalo: IntervaloDeDias) => void;
  /** `todos` ou um valor de `JobFormat`. */
  formato: string;
  aoMudarFormato: (formato: string) => void;
  /** `all` ou uma `JobPlatform` — o mesmo `platformFilter` do calendário. */
  rede: string;
  aoMudarRede: (rede: string) => void;
  /** `todos`, `ninguem`, ou o id de quem está com a peça. */
  responsavel: string;
  aoMudarResponsavel: (responsavel: string) => void;
  equipe: User[];
  /** Quantos cards estão fixados à mão, em todas as colunas. */
  fixados: number;
  aoSoltarTodos: () => void;
}> = ({
  ordem,
  aoMudarOrdem,
  periodo,
  aoMudarPeriodo,
  intervalo,
  aoMudarIntervalo,
  formato,
  aoMudarFormato,
  rede,
  aoMudarRede,
  responsavel,
  aoMudarResponsavel,
  equipe,
  fixados,
  aoSoltarTodos,
}) => {
  const rotuloDaOrdem = ORDENS.find((o) => o.valor === ordem)?.rotulo ?? 'Data';

  /*
    O gatilho diz o valor escolhido, não o nome do filtro — a mesma razão já
    escrita para a ordem: um botão "Formato" não distingue um quadro inteiro
    de um quadro recortado em Reels três dias atrás, e o segundo é exatamente
    o estado que faz a pessoa concluir que o conteúdo sumiu.
  */
  const rotuloDoFormato =
    formato === 'todos'
      ? 'Qualquer formato'
      : (FORMATOS.find((f) => f.valor === formato)?.rotulo ?? 'Qualquer formato');

  const rotuloDaRede =
    rede === 'all' ? 'Qualquer rede' : (NOME_DA_REDE[rede as JobPlatform] ?? 'Qualquer rede');

  const rotuloDoResponsavel =
    responsavel === 'todos'
      ? 'Qualquer pessoa'
      : responsavel === 'ninguem'
        ? 'Sem responsável'
        : (equipe.find((u) => u.id === responsavel)?.name ?? 'Qualquer pessoa');
  const rotuloDoPeriodo =
    PERIODOS.find((p) => p.valor === periodo)?.rotulo ?? 'Qualquer data';

  return (
    <div className="flex items-center gap-2">
      {/*
        Formato, rede e responsável — os três recortes que a barra não tinha.

        **Todos derivam da fonte única, nenhum tem lista escrita à mão aqui.**
        O formato sai de `FORMATOS_POR_CANAL`, a rede de `NOME_DA_REDE`, e o
        responsável da equipe carregada. Lista literal numa tela de filtro é
        pior que numa tela comum: quando ela diverge, o conteúdo some sem nada
        dizer que sumiu.
      */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={formato === 'todos' ? 'secondary' : 'primary'}
            aria-label={`Formato: ${rotuloDoFormato}`}
          >
            <Layers className="w-3.5 h-3.5" />
            {rotuloDoFormato}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Formato da peça</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={formato} onValueChange={aoMudarFormato}>
            <DropdownMenuRadioItem value="todos">Qualquer formato</DropdownMenuRadioItem>
            {FORMATOS.map((f) => (
              <DropdownMenuRadioItem key={f.valor} value={f.valor}>
                {f.rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={rede === 'all' ? 'secondary' : 'primary'}
            aria-label={`Rede: ${rotuloDaRede}`}
          >
            <Share2 className="w-3.5 h-3.5" />
            {rotuloDaRede}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Rede do conteúdo</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={rede} onValueChange={aoMudarRede}>
            <DropdownMenuRadioItem value="all">Qualquer rede</DropdownMenuRadioItem>
            {REDES.map(([valor, rotulo]) => (
              <DropdownMenuRadioItem key={valor} value={valor}>
                {rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={responsavel === 'todos' ? 'secondary' : 'primary'}
            aria-label={`Responsável: ${rotuloDoResponsavel}`}
          >
            <UserRound className="w-3.5 h-3.5" />
            {rotuloDoResponsavel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Quem está com a peça</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={responsavel} onValueChange={aoMudarResponsavel}>
            <DropdownMenuRadioItem value="todos">Qualquer pessoa</DropdownMenuRadioItem>
            {/* "Sem responsável" é um filtro de verdade, e provavelmente o mais
                útil deles: é a fila do que ninguém pegou. */}
            <DropdownMenuRadioItem value="ninguem">Sem responsável</DropdownMenuRadioItem>
            {equipe.map((u) => (
              <DropdownMenuRadioItem key={u.id} value={u.id}>
                {u.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" aria-label={`Ordenar por ${rotuloDaOrdem}`}>
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            {rotuloDaOrdem}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Ordenar as colunas por</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={ordem}
            onValueChange={(v) => aoMudarOrdem(v as ChaveDeOrdem)}
          >
            {ORDENS.map((o) => (
              <DropdownMenuRadioItem
                key={o.valor}
                value={o.valor}
                descricao={
                  o.valor === 'data'
                    ? 'Do mais próximo para o mais distante'
                    : undefined
                }
              >
                {o.rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          {/*
            O que o quadro não diria sozinho: por que um card continua parado
            num lugar que a ordem escolhida não explica. Sem esta linha, quem
            fixou uma peça semana passada e esqueceu conclui que a ordenação
            está quebrada — e a saída fica escondida dentro de cada card.
          */}
          {fixados > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-[11px] text-muted-foreground leading-snug mb-1.5">
                  <Pin className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                  {fixados === 1
                    ? '1 card está fixado à mão e não segue esta ordem.'
                    : `${fixados} cards estão fixados à mão e não seguem esta ordem.`}
                </p>
                <Button variant="secondary" onClick={aoSoltarTodos} className="w-full">
                  Soltar {fixados === 1 ? 'o card' : 'todos'}
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={periodo === 'todos' ? 'secondary' : 'primary'}
            aria-label={`Período: ${rotuloDoPeriodo}`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            {rotuloDoPeriodo}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Mostrar conteúdo de</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={periodo}
            onValueChange={(v) => aoMudarPeriodo(v as Periodo)}
          >
            {PERIODOS.map((p, i) => (
              <React.Fragment key={p.valor}>
                {/* A virada entre o que já passou e o que está por vir é o
                    único corte da lista. Sem ele, "Já passou" no meio de
                    "Próximos 30 dias" obriga a ler item por item. */}
                {i > 0 && PERIODOS[i - 1].passado && !p.passado && (
                  <DropdownMenuSeparator />
                )}
                <DropdownMenuRadioItem
                  value={p.valor}
                  descricao={
                    p.valor === 'todos'
                      ? 'Inclusive o que ainda não tem data'
                      : undefined
                  }
                >
                  {p.rotulo}
                </DropdownMenuRadioItem>
              </React.Fragment>
            ))}
          </DropdownMenuRadioGroup>

          {/*
            As duas pontas aparecem **só** com "personalizado" escolhido: dois
            campos de data sempre visíveis num menu de atalhos fazem parecer
            que o atalho e o intervalo somam, quando um substitui o outro.

            **`<input type="date">`, e isto é decisão de correção, não de
            pressa.** Ele entrega `YYYY-MM-DD` puro — um dia, não um instante
            —, que é exatamente o que `dentroDoPeriodo` compara e o que
            `diaNoFuso` devolve. Uma grade de calendário desenhada à mão teria
            de produzir uma `Date` e convertê-la, e é aí que mora a armadilha
            8.2: o mesmo intervalo recortaria conteúdo diferente para dois
            membros da equipe em estados diferentes, sem nada parecer errado.
          */}
          {periodo === 'personalizado' && (
            <>
              <DropdownMenuSeparator />
              <div
                className="px-2 py-1.5 space-y-2"
                // O menu fecha ao receber a tecla que o item de menu entende
                // como escolha; o campo de data precisa das setas e dos
                // números para funcionar.
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    De
                  </label>
                  <input
                    type="date"
                    value={intervalo?.de ?? ''}
                    onChange={(e) => aoMudarIntervalo({ ...intervalo, de: e.target.value })}
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Até
                  </label>
                  <input
                    type="date"
                    value={intervalo?.ate ?? ''}
                    onChange={(e) => aoMudarIntervalo({ ...intervalo, ate: e.target.value })}
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                {/* Uma ponta só é um filtro legítimo — "de março em diante" —,
                    então a tela diz o que está valendo em vez de exigir as
                    duas. Sem isso, metade preenchida parece filtro quebrado. */}
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {!intervalo?.de && !intervalo?.ate
                    ? 'Sem data escolhida, o quadro mostra tudo.'
                    : !intervalo?.de
                      ? 'Tudo até a data escolhida.'
                      : !intervalo?.ate
                        ? 'Da data escolhida em diante.'
                        : 'As duas datas entram no período.'}
                </p>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
