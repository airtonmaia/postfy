import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

/**
 * Botão, no formato shadcn/ui — com as cores que o Orquesia já usa.
 *
 * A estrutura é a do shadcn (cva + Slot + forwardRef, mesma API de `variant`,
 * `size` e `asChild`), então `npx shadcn add <componente>` gera peças que
 * conversam com esta.
 *
 * **As variantes não são as do shadcn.** O padrão dele pinta tudo com
 * variáveis de tema (`--primary`, `--ring`, `--background`) e assume a paleta
 * neutra que o `init` instala. Este projeto nunca teve essas variáveis: ele
 * usa cor direta do Tailwind, e o roxo vira a cor da agência em tempo de
 * execução. Trazer o tema do shadcn trocaria o visual inteiro do produto —
 * é por isso que `components.json` tem `cssVariables: false`.
 *
 * Cada variante abaixo saiu do que já estava em tela, não de gosto: a
 * `primary` é a combinação que aparece em 13 botões do app, e as outras
 * seguem o mesmo levantamento.
 */
const variantesDoBotao = cva(
  // Base comum. `cursor-pointer` porque o projeto marca clicável em todo
  // botão, e `disabled:` aqui evita repetir em cada uso.
  'inline-flex items-center justify-center gap-1.5 font-bold whitespace-nowrap ' +
    'transition cursor-pointer select-none ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1 ' +
    'dark:focus-visible:ring-offset-slate-900 ' +
    '[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Ação principal da tela. */
        primary: 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs',
        /** Roxo suave com borda: ação secundária que ainda é do fluxo. */
        soft:
          'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ' +
          'hover:bg-purple-100 dark:hover:bg-purple-900/50 ' +
          'border border-purple-200 dark:border-purple-800',
        /** Sem fundo até o hover: barras de ação e ícones. */
        ghost:
          'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 ' +
          'hover:bg-slate-100 dark:hover:bg-slate-800',
        /** Neutro com borda, para "Cancelar" e afins. */
        outline:
          'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 ' +
          'hover:bg-slate-50 dark:hover:bg-slate-800',
        /** Apagar e remover. Rosa, como o resto do app. */
        destructive:
          'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40',
      },
      size: {
        sm: 'text-[11px] px-2.5 py-1 rounded-lg',
        md: 'text-xs px-4 py-2 rounded-xl',
        lg: 'text-sm px-5 py-2.5 rounded-xl',
        /** Só ícone: quadrado, sem padding lateral sobrando. */
        icon: 'p-2 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface BotaoProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesDoBotao> {
  /** Renderiza o filho no lugar do <button> — para <a> com cara de botão. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Componente = asChild ? Slot : 'button';
    return (
      <Componente
        ref={ref}
        // `cn` resolve o conflito quando quem usa passa uma classe que
        // disputa com a variante — sem ele as duas ficariam no elemento e
        // venceria a ordem do CSS, não a intenção de quem chamou.
        className={cn(variantesDoBotao({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { variantesDoBotao };
