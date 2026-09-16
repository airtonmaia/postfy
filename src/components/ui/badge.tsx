import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

/**
 * Badge, no formato shadcn/ui — com as cores que o Orquesia já usa.
 *
 * O produto tinha **cinco desenhos de badge** e, entre eles, três paddings,
 * quatro tamanhos de fonte e dois raios:
 *
 *   PlatformBadge    px-2   py-0.5  text-xs      rounded-full
 *   FormatBadge      px-1.5 py-0.5  text-[11px]  rounded-md
 *   TipoBadge        px-1.5 py-0.5  text-[11px]  rounded-md
 *   StatusBadge md   px-2   py-0.5  text-xs      rounded-full
 *   StatusBadge sm   px-1.5 py-0.2  text-[10px]  rounded-full
 *   PriorityBadge    px-1.5 py-0.5  text-[10px]  rounded-md
 *   "v1" (à mão)     px-2   py-0.5  text-xs      rounded-md
 *
 * Lado a lado no cabeçalho do conteúdo, isso vira uma pílula, um retângulo
 * arredondado, um retângulo e um rótulo sem borda — quatro alturas, na mesma
 * linha. É a mesma história das doze alturas de botão e das sete barras de
 * abas, e a resposta é a mesma.
 *
 * **A altura é fixa (`h-5`), não padding vertical.** Com `py-` ela depende
 * também da fonte, e aqui havia quatro fontes: foi assim que os `py-0.5`
 * renderizaram quatro alturas diferentes sem ninguém escrever uma medida
 * errada.
 *
 * **O canto é `rounded-md`, e ele vem do próprio shadcn.** Também é o que o
 * vocabulário do projeto já reserva para "chip e badge retangular" — e é o
 * único passo que **lê diferente** num chip de 20px: o CSS corta qualquer raio
 * maior que metade do lado, então `rounded-lg`, `rounded-xl` e `rounded-full`
 * renderizariam os mesmos 10px ali. Escolher entre eles seria diff sem
 * mudança em tela.
 *
 * **A cor é `tom`, não `className`.** Um escape por classe convidaria o
 * próximo a passar padding junto — e a altura volta a divergir na primeira
 * pressa. Os doze tons abaixo são os que já estavam em tela, levantados por
 * contagem; nenhum foi inventado.
 */
const variantesDoBadge = cva(
  'inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap border ' +
    'h-5 px-2 rounded-md text-[11px] font-semibold leading-none ' +
    // O ícone acompanha a caixa: num badge de 20px, um `w-4` encosta nas duas
    // bordas e empurra o texto.
    '[&_svg]:shrink-0 [&_svg]:w-3 [&_svg]:h-3',
  {
    variants: {
      tom: {
        neutro:
          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ' +
          'border-slate-200 dark:border-slate-700',
        /** O preto do TikTok, que é a marca dele. */
        escuro: 'bg-slate-900 text-white border-slate-700',
        rosa:
          'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 ' +
          'border-pink-200/70 dark:border-pink-900',
        ceu:
          'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ' +
          'border-sky-200/70 dark:border-sky-900',
        vermelho:
          'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ' +
          'border-red-200/70 dark:border-red-900',
        azul:
          'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ' +
          'border-blue-200 dark:border-blue-900',
        indigo:
          'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ' +
          'border-indigo-200 dark:border-indigo-800',
        turquesa:
          'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 ' +
          'border-teal-200 dark:border-teal-800',
        ambar:
          'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ' +
          'border-amber-200 dark:border-amber-900',
        /** Ajuste pedido, urgente: o que precisa puxar o olho. */
        rubi:
          'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ' +
          'border-rose-200 dark:border-rose-900',
        /** Aprovado. Verde aqui é significado, não marca. */
        esmeralda:
          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ' +
          'border-emerald-200 dark:border-emerald-900',
        roxo:
          'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ' +
          'border-purple-200 dark:border-purple-900',
      },
    },
    defaultVariants: { tom: 'neutro' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof variantesDoBadge> {}

export const Badge: React.FC<BadgeProps> = ({ className, tom, ...props }) => (
  <span className={cn(variantesDoBadge({ tom }), className)} {...props} />
);

export type TomDoBadge = NonNullable<VariantProps<typeof variantesDoBadge>['tom']>;

/**
 * O ponto colorido do status, dentro do badge.
 *
 * Fica aqui, e não solto em `Badges.tsx`, porque o tamanho dele é do desenho
 * do badge: num chip de 20px um ponto de 8px vira o elemento principal.
 */
export const PontoDoBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', className)} />
);

export { variantesDoBadge };
