import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../../lib/utils';

/**
 * Tooltip, no formato shadcn/ui — com as cores que o Orquesia já usa.
 *
 * Mesma decisão do `button.tsx`: a estrutura é a do shadcn (Root, Trigger,
 * Content sobre o Radix, mesma API), **mas a pintura não**. O padrão dele usa
 * `bg-primary text-primary-foreground`, variáveis de tema que este projeto
 * nunca teve — ele usa cor direta do Tailwind, e o roxo vira a cor da agência
 * em tempo de execução (`cssVariables: false` no `components.json`).
 *
 * A bolha é escura nos dois temas, invertida em relação à superfície: no
 * claro a tela é branca e ela é `slate-900`; no escuro a tela é `slate-950` e
 * ela é `slate-800` com borda. Tooltip da cor do fundo desapareceria contra o
 * card, que é o único lugar onde ele aparece.
 *
 * `Provider` entra uma vez, no topo do app: o Radix compartilha por ele o
 * atraso de abertura, e sem isso cada tooltip conta o seu próprio tempo —
 * percorrer uma fileira de ícones faria cada um esperar do zero.
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-lg px-2.5 py-1.5 text-[11px] font-semibold',
        'bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700',
        'shadow-lg select-none',
        'animate-in fade-in-0 zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-slate-800" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * O caso que aparece em toda a tela de conteúdo: um botão só de ícone.
 *
 * Ícone sem rótulo não se explica sozinho — e a regra do projeto é que todo
 * ícone solto tenha tooltip. Embrulhar os três no mesmo componente evita que
 * o quarto nasça sem.
 */
export const ComTooltip: React.FC<{
  texto: string;
  children: React.ReactNode;
  lado?: 'top' | 'right' | 'bottom' | 'left';
}> = ({ texto, children, lado = 'top' }) => (
  <Tooltip>
    {/* `asChild` para o gatilho ser o próprio botão: um <button> dentro de
        outro é HTML inválido e quebra o foco pelo teclado. */}
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={lado}>{texto}</TooltipContent>
  </Tooltip>
);
