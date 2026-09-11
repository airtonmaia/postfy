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
 * **As variantes ainda não são as do shadcn, mas as cores agora são
 * variáveis.** O padrão do shadcn pinta com `--primary`, `--ring`,
 * `--destructive`; o projeto pintava com classe direta (`bg-purple-600`) e
 * dependia da folha de `!important` do `DynamicThemeProvider` para virar a cor
 * da agência. As duas formas chegam na mesma tela, e a diferença só aparece no
 * que vem depois: peça gerada por `npx shadcn add` nasce escrita contra as
 * variáveis, e sem elas cada uma precisaria de tradução à mão — ou nasceria
 * roxa num portal que não é roxo.
 *
 * O valor de cada variável é o que já estava em tela, levantado por contagem
 * (`src/index.css`): `--primary` é o roxo dos 13 botões, `--border` é o
 * `slate-200` das 87 bordas de card. Nada muda de cor aqui — muda de onde a
 * cor vem.
 *
 * **O neutro continua em `slate` de propósito.** `--foreground` é
 * `slate-900` e `--muted-foreground` é `slate-500`; os tons intermediários
 * que estes botões usam (`slate-600`, `slate-700`) não têm variável no
 * conjunto do shadcn, e inventar uma para cada degrau traria de volta o
 * problema que o levantamento resolveu. `baseColor: "slate"` no
 * `components.json` é o que mantém os dois lados na mesma escala.
 */
const variantesDoBotao = cva(
  // Base comum. `cursor-pointer` porque o projeto marca clicável em todo
  // botão, e `disabled:` aqui evita repetir em cada uso.
  'inline-flex items-center justify-center gap-1.5 font-bold whitespace-nowrap ' +
    'transition cursor-pointer select-none ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    // O anel se afasta da **superfície do card**, não do fundo da tela: é
    // sobre card que quase todo botão do produto fica. `ring-offset-background`
    // seria o slate-50 da página, e no escuro o anel ganharia um halo claro
    // em volta.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
    'focus-visible:ring-offset-card ' +
    '[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Ação principal da tela. */
        primary: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs',
        /**
         * Marca suave com borda: ação secundária que ainda é do fluxo.
         *
         * **Esta continua em classe roxa, e é decisão medida.** `bg-primary/10
         * text-primary` seria o equivalente em variável, e no escuro piora: o
         * texto viraria a marca no tom cheio sobre o card escuro — 2,7:1 de
         * contraste, abaixo do mínimo legível. A folha de `!important` já
         * resolve isso melhor, porque ela tem uma linha só para
         * `.dark .text-purple-300` e a manda para o tom claro da marca
         * (9,9:1).
         *
         * Migrar aqui seria trocar algo que funciona por algo que parece mais
         * moderno e lê pior. Sai quando houver variável para o tom claro da
         * marca — hoje não há, e inventar uma é o que a regra de desenho
         * proíbe.
         */
        soft:
          'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ' +
          'hover:bg-purple-100 dark:hover:bg-purple-900/50 ' +
          'border border-purple-200 dark:border-purple-800',
        /** Sem fundo até o hover: barras de ação e ícones. */
        ghost:
          'text-slate-600 dark:text-slate-400 ' +
          'hover:text-purple-600 dark:hover:text-purple-400 ' +
          'hover:bg-slate-100 dark:hover:bg-slate-800',
        /** Neutro com borda, para "Cancelar" e afins. */
        outline:
          'border border-border text-slate-700 dark:text-slate-300 ' +
          'hover:bg-slate-50 dark:hover:bg-slate-800',
        /** Apagar e remover. Rosa, como o resto do app. */
        destructive:
          'text-slate-400 hover:text-destructive hover:bg-destructive/10',
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
