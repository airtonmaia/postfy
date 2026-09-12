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
  // `rounded-lg` fica na base, e não em cada `size`: botão pequeno com canto
  // menor que o grande é a inconsistência que esta entrega veio tirar. O valor
  // sai do "Novo Post", que foi a referência pedida — e a 32px de altura,
  // 8px ainda lê como canto, não como pílula.
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap ' +
    'rounded-lg transition cursor-pointer select-none ' +
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
        /**
         * Neutro **preenchido**: a ação secundária que divide espaço com a
         * primária e precisa de peso parecido. "Cancelar" ao lado de "Salvar",
         * "Copiar", "Baixar".
         *
         * Entrou porque a combinação já existia em 11 botões, escrita à mão
         * em cada um — a mesma regra da `primary`: variante nova sai do que
         * está em tela, levantado por contagem, nunca inventada.
         */
        secondary:
          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ' +
          'hover:bg-slate-200 dark:hover:bg-slate-700',
        /**
         * Aprovar. Verde, e só para isso.
         *
         * Eram 11 botões com `bg-emerald-600 hover:bg-emerald-700 text-white`
         * repetido à mão. **Não vira a cor da agência** de propósito: verde
         * aqui não é marca, é o significado "aprovado" — o mesmo do ponto de
         * status e do selo. Trocá-lo pelo roxo do whitelabel apagaria a
         * diferença entre "a ação principal" e "a ação que aprova".
         */
        success:
          'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
        /** Apagar e remover. Rosa, como o resto do app. */
        destructive:
          'text-slate-400 hover:text-destructive hover:bg-destructive/10',
      },
      /**
       * **Altura fixa, não padding vertical.** É a diferença entre ter uma
       * escala e ter uma coincidência.
       *
       * O produto tinha 339 botões escritos à mão, em 60 arquivos, e só entre
       * as doze combinações de padding mais comuns havia **doze alturas
       * diferentes**: `px-4 py-2`, `px-5 py-2`, `px-4 py-2.5`, `px-4 py-1.5`,
       * `px-3.5 py-2`, `px-6 py-2.5`… Cada uma nasceu certa no lugar dela.
       *
       * Com padding vertical a altura depende também da fonte, então dois
       * botões com o mesmo `py-` **não fecham** se um for `text-xs` e o outro
       * `text-sm` — foi exatamente assim que "Novo Post" (30px) e "Novo
       * Conteúdo" (40px) acabaram com 10px de diferença. Com `h-*` a altura é
       * a altura, e `items-center` centraliza o conteúdo sozinho.
       *
       * O `md` é o tamanho de referência, pedido explicitamente: o estilo do
       * "Novo Post" numa versão um pouco maior, na altura do botão do exemplo
       * do shadcn — 36px.
       */
      size: {
        /** Barra de ação densa, dentro de card ou linha de tabela. 32px. */
        sm: 'h-8 px-3 text-xs gap-1.5',
        /** O padrão do produto. 36px. */
        md: 'h-9 px-4 text-sm',
        /** Ação principal de uma tela, e o botão de largura cheia da lateral. */
        lg: 'h-10 px-5 text-sm',
        /** Só ícone: quadrado, na mesma altura do irmão com texto. */
        icon: 'size-9',
        'icon-sm': 'size-8',
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
