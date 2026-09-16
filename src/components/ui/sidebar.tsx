import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

/**
 * As peças de menu da barra lateral, no formato shadcn/ui.
 *
 * ### Por que só as peças de menu, e não o `Sidebar` inteiro
 *
 * O componente completo do shadcn traz um `SidebarProvider` que guarda o
 * estado recolhido **num cookie**. Aqui essa preferência mora em
 * `user_settings`, no banco, com RLS por linha — é a armadilha 4: dado da
 * aplicação não fica no navegador, senão a mesma pessoa abre o celular e
 * encontra a barra num estado e o computador noutro.
 *
 * Adotar o provider significaria ou ter duas fontes para a mesma preferência,
 * ou reescrever a parte dele que interessa. As peças de menu — que são o que
 * substitui os `<button>` escritos à mão — não dependem do provider, então
 * elas entram e o resto fica de fora, de propósito.
 *
 * ### O canto e a altura vieram traduzidos, e as medidas não mudaram
 *
 * O `size` padrão do shadcn é `h-8` — **exatamente os 32px** que o item de
 * menu já tinha. O que precisou de tradução foi o canto (`rounded-md` do
 * shadcn vira o `rounded-xl` de "item de menu" daqui) e a pintura do estado
 * ativo, que sai do roxo que já estava em tela. Nenhum pixel de medida mudou:
 * casca com medida nova faria a mesma pessoa achar que trocou de produto ao
 * clicar num botão.
 */

const variantesDoItem = cva(
  'peer/menu-button w-full flex items-center gap-3 overflow-hidden text-left ' +
    'px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ' +
    'outline-hidden focus-visible:ring-2 focus-visible:ring-ring ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    '[&>svg]:size-4 [&>svg]:shrink-0 [&>span:last-child]:truncate',
  {
    variants: {
      ativo: {
        // A combinação que já estava em tela nos dois menus, levantada por
        // contagem — não é cor nova.
        true:
          'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 ' +
          'border border-purple-100 dark:border-purple-500/20',
        false:
          'border border-transparent ' +
          'text-slate-500 dark:text-slate-400 ' +
          'hover:text-slate-800 dark:hover:text-slate-200 ' +
          'hover:bg-slate-100 dark:hover:bg-slate-800/60',
      },
    },
    defaultVariants: { ativo: false },
  }
);

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-slot="sidebar-menu"
    className={cn('flex w-full min-w-0 flex-col gap-1', className)}
    {...props}
  />
));
SidebarMenu.displayName = 'SidebarMenu';

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-slot="sidebar-menu-item"
    className={cn('group/menu-item relative', className)}
    {...props}
  />
));
SidebarMenuItem.displayName = 'SidebarMenuItem';

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'> &
    VariantProps<typeof variantesDoItem> & {
      asChild?: boolean;
      /** Recolhida, o item vira quadrado e o rótulo some — mas só no desktop. */
      recolhida?: boolean;
    }
>(({ className, ativo, asChild = false, recolhida = false, ...props }, ref) => {
  const Componente = asChild ? Slot : 'button';
  return (
    <Componente
      ref={ref}
      type={asChild ? undefined : 'button'}
      data-slot="sidebar-menu-button"
      // `data-active` é o contrato do shadcn para "selecionado". Peça gerada
      // por `npx shadcn add` estiliza por ele, então ele fica mesmo com a
      // pintura vindo da variante.
      data-active={ativo || undefined}
      className={cn(
        variantesDoItem({ ativo }),
        // No celular a barra é gaveta e abre inteira: um trilho de ícones
        // numa tela onde ela já ocupa tudo não economizaria nada e tiraria os
        // nomes. Por isso o recolhimento é `md:`.
        recolhida && 'md:justify-center md:px-0',
        className
      )}
      {...props}
    />
  );
});
SidebarMenuButton.displayName = 'SidebarMenuButton';

/**
 * A contagem do item — aprovações pendentes, ajustes.
 *
 * `rounded-full` aqui é a exceção escrita do vocabulário de canto: é o papel
 * de badge, o mesmo do `Badges.tsx`.
 */
export const SidebarMenuBadge = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="sidebar-menu-badge"
    className={cn(
      'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 pointer-events-none',
      className
    )}
    {...props}
  />
));
SidebarMenuBadge.displayName = 'SidebarMenuBadge';

/**
 * O ponto que substitui a contagem no trilho.
 *
 * Em 64px o número não cabe ao lado do ícone, então some a contagem e fica o
 * "tem coisa aqui" — que é o que faz a pessoa clicar.
 */
export const SidebarMenuDot: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden
    className={cn(
      'hidden md:block absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-purple-600 ring-2 ring-white dark:ring-slate-900',
      className
    )}
  />
);

export { variantesDoItem };
