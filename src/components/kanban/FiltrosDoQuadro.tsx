import React from 'react';
import { ArrowDownWideNarrow, CalendarRange, Pin } from 'lucide-react';
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
} from '../../lib/ordemDoQuadro';

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
  /** Quantos cards estão fixados à mão, em todas as colunas. */
  fixados: number;
  aoSoltarTodos: () => void;
}> = ({ ordem, aoMudarOrdem, periodo, aoMudarPeriodo, fixados, aoSoltarTodos }) => {
  const rotuloDaOrdem = ORDENS.find((o) => o.valor === ordem)?.rotulo ?? 'Data';
  const rotuloDoPeriodo =
    PERIODOS.find((p) => p.valor === periodo)?.rotulo ?? 'Qualquer data';

  return (
    <div className="flex items-center gap-2">
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
            {PERIODOS.map((p) => (
              <DropdownMenuRadioItem
                key={p.valor}
                value={p.valor}
                descricao={
                  p.valor === 'todos'
                    ? 'Inclusive o que ainda não tem data'
                    : undefined
                }
              >
                {p.rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
