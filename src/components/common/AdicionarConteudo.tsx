import React from 'react';
import { Plus, ChevronDown, Image as ImageIcon, PenLine, Clapperboard } from 'lucide-react';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { usePostfy } from '../../context/PostfyContext';
import { TIPOS_DE_JOB } from '../../lib/tiposDeJob';
import type { JobTipo } from '../../types';

/**
 * O botão de criar peça — **o mesmo no quadro e no calendário.**
 *
 * Eram dois: o quadro tinha "Adicionar" com as três entregas do catálogo
 * (conteúdo, copy, roteiro), e o calendário tinha "Novo Post", que criava
 * sempre um conteúdo. Duas telas que são **visões da mesma coisa** — a troca
 * entre elas é um botão ao lado deste — oferecendo coisas diferentes para a
 * mesma ação: quem criasse pelo calendário não descobria que copy e roteiro
 * existem, e o nome "Post" ainda prometia outra coisa que o produto não chama
 * assim em lugar nenhum.
 *
 * É a história das doze alturas de botão e das sete barras de abas, e por isso
 * a resposta é a de sempre: um componente, montado nos dois lugares. Duas
 * cópias divergem na primeira pressa, e divergir *aqui* significa uma tela
 * oferecendo um tipo de peça que a outra não oferece.
 *
 * **O menu é o primitivo, não um `fixed inset-0` com `onClick`.** O que havia
 * no quadro era um captador de clique à mão, sem `Esc`, sem trava de foco e
 * sem navegação por teclado — as três coisas que o `DropdownMenu` traz de
 * graça.
 */
export const AdicionarConteudo: React.FC<{
  /**
   * A data que a peça nova já nasce marcando.
   *
   * O calendário passa o dia que está aberto: criar olhando para outubro e a
   * peça nascer em hoje é a tela ignorando o contexto em que o clique
   * aconteceu. O quadro não passa nada — ali não há data em foco, e inventar
   * uma seria pior.
   */
  dataSugerida?: string;
}> = ({ dataSugerida }) => {
  const { openCreateJobModal } = usePostfy();

  /** Um ícone por tipo. Fica aqui e não no catálogo: lá é dado, aqui é desenho. */
  const ICONE_DO_TIPO: Record<JobTipo, React.FC<{ className?: string }>> = {
    conteudo: ImageIcon,
    copy: PenLine,
    roteiro: Clapperboard,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="btn-header-add-content">
          <Plus className="w-3.5 h-3.5" />
          Adicionar
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {TIPOS_DE_JOB.map((tipo) => {
          const Icone = ICONE_DO_TIPO[tipo.valor];
          return (
            <DropdownMenuItem
              key={tipo.valor}
              onSelect={() => openCreateJobModal(dataSugerida, tipo.valor)}
              className="items-start gap-3 px-3 py-2.5"
            >
              <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Icone className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  {tipo.rotulo}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                  {tipo.descricao}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
