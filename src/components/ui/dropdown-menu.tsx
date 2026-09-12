import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '../../lib/utils';

/**
 * Menu suspenso, no formato shadcn/ui — com o canto do Orquesia.
 *
 * A pintura já não precisa de tradução: as variáveis (`--popover`,
 * `--accent`, `--muted-foreground`, `--border`) entraram na 2.30.0 com os
 * valores que o produto já usava, então o que vem do shadcn nasce na cor
 * certa e vira a cor da agência sozinho.
 *
 * **O canto é o que precisa de tradução, e ele não vem em variável.** O
 * shadcn escreve `rounded-md` na superfície e `rounded-sm` no item; aqui o
 * vocabulário tem cinco passos medidos e `sm` não é um deles (ver o
 * CLAUDE.md). A conversão segue o papel de cada pedaço:
 *
 *   superfície flutuante → `rounded-xl`, que é o que os dois menus suspensos
 *                          que já existiam usavam;
 *   item de menu         → `rounded-lg`, o controle pequeno.
 *
 * Traduzir aqui, uma vez, é o que evita a saída fácil — declarar `--radius-*`
 * no `@theme inline` e mover os 649 `rounded-*` do projeto de uma vez, que é
 * exatamente o bug que a 2.29.1 consertou.
 *
 * Por que o Radix e não o `useState` + `fixed inset-0` que estava aqui: o
 * menu do produto não fechava com `Esc`, não devolvia o foco ao gatilho, não
 * andava com as setas e ficava preso dentro do `overflow` da barra lateral.
 * São quatro coisas que ninguém escreve à mão de novo a cada menu.
 */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto p-1',
        // O teto é o espaço que sobra na tela, medido pelo Radix. É o que
        // segura a lista quando a agência tem muitas: em vez de o menu
        // crescer para fora da janela, ele rola.
        'max-h-(--radix-dropdown-menu-content-available-height)',
        'origin-(--radix-dropdown-menu-content-transform-origin)',
        'rounded-xl border border-border bg-popover text-popover-foreground shadow-xl',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-inset={inset}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5',
      'text-xs outline-hidden transition',
      'focus:bg-accent focus:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'data-[inset]:pl-8',
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    data-inset={inset}
    className={cn(
      'px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground',
      'data-[inset]:pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
