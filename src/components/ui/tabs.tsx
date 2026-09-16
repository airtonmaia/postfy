import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

/**
 * Abas, no formato shadcn/ui — com as medidas que o Orquesia já usava.
 *
 * O produto tinha **cinco barras de abas escritas à mão**, e entre elas três
 * paddings, duas fontes e dois pesos diferentes:
 *
 *   ClientDetail      pb-3            text-sm  bold      gap-2
 *   SettingsView      pb-3            text-sm  bold      gap-2
 *   ApprovalsView     py-3.5 px-4     text-xs  bold      gap-2
 *   ClientPortalView  py-3.5 px-4     text-xs  bold      gap-2
 *   JobDetailModal    py-3   px-4     text-xs  semibold  gap-1.5
 *
 * É a mesma história das doze alturas de botão: cada uma nasceu certa no lugar
 * dela, e ninguém consegue mais dizer qual é o padrão. A diferença é que agora
 * existe a lição — o vocabulário se fecha na contagem, não numa medida nova.
 *
 * **Dois papéis, e eles são reais**, não gosto:
 *
 *   `pagina`  — a aba fica sob o cabeçalho da tela, sem caixa em volta, e o
 *               conteúdo abaixo é a tela inteira. Duas telas.
 *   `painel`  — a aba fica numa barra branca, dentro de um card ou de uma
 *               modal, e recorta o conteúdo daquele painel. Três telas.
 *
 *   `segmentado` — o controle fechado, para alternar **dois textos do mesmo
 *               campo** (Legenda e Rascunho). Não é navegação: os dois lados
 *               são o mesmo assunto, e o sublinhado sob um formulário leria
 *               como se a tela tivesse trocado.
 *
 * **A altura é fixa (`h-*`), não padding vertical** — a mesma regra do botão,
 * e pelo mesmo motivo: com `py-` ela depende também da fonte, e foi assim que
 * `py-3.5 text-xs` e `py-3 text-xs` acabaram a 4px um do outro sem ninguém
 * notar.
 *
 * O canto sai do vocabulário de cinco passos: `rounded-lg` no gatilho
 * segmentado (controle pequeno), `rounded-xl` na caixa que os contém. O
 * shadcn escreve `rounded-md`/`rounded-sm` aqui, e traduzir na entrada é o que
 * evita declarar `--radius-*` — o bug de 649 elementos da 2.29.0.
 */

type Aparencia = 'pagina' | 'painel' | 'segmentado';

/**
 * A aparência viaja por contexto, e não como prop de cada gatilho.
 *
 * Repeti-la em cada `TabsTrigger` é o convite para a sexta barra nascer com
 * metade dos gatilhos num estilo e metade noutro — que é literalmente como as
 * cinco de cima divergiram.
 */
const ContextoDaAparencia = React.createContext<Aparencia>('pagina');

export const Tabs = TabsPrimitive.Root;

const variantesDaLista = cva('flex items-center', {
  variants: {
    aparencia: {
      pagina: 'gap-6 overflow-x-auto no-scrollbar pt-2',
      painel:
        'gap-2 border-b border-slate-200 dark:border-slate-800 ' +
        'bg-white dark:bg-slate-900 px-4 rounded-t-xl overflow-x-auto no-scrollbar',
      /**
       * **Este já existia**, no seletor de enquadramento da Prévia
       * (Feed/Story): `p-1 rounded-xl bg-slate-100` com o item ativo em
       * `bg-white` e `shadow-xs`. A primeira versão desta variante inventou
       * uma borda em volta e a contagem mostrou que não havia nenhuma — a
       * regra do projeto é que variante nova sai do que está em tela.
       */
      segmentado: 'gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit',
    },
  },
  defaultVariants: { aparencia: 'pagina' },
});

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof variantesDaLista>
>(({ className, aparencia = 'pagina', ...props }, ref) => (
  <ContextoDaAparencia.Provider value={aparencia ?? 'pagina'}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(variantesDaLista({ aparencia }), className)}
      {...props}
    />
  </ContextoDaAparencia.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const variantesDoGatilho = cva(
  'group inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap ' +
    'transition cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    '[&_svg]:shrink-0',
  {
    variants: {
      aparencia: {
        // `pb-3` sem topo: a aba encosta no cabeçalho da tela, e o espaço de
        // cima é do container. É o que as duas telas já faziam.
        pagina:
          'pb-3 text-sm border-b-2 border-transparent text-slate-500 ' +
          'hover:text-slate-800 dark:hover:text-slate-200 ' +
          'data-[state=active]:border-purple-600 ' +
          'data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400',
        // 48px, que é o que `py-3.5 px-4 text-xs` dava nas três telas.
        painel:
          'h-12 px-4 text-xs border-b-2 border-transparent text-slate-500 dark:text-slate-400 ' +
          'hover:text-slate-900 dark:hover:text-white ' +
          'data-[state=active]:border-purple-600 ' +
          'data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400',
        /**
         * 32px, a altura do botão `sm` — a unidade de densidade do produto.
         *
         * O seletor da Prévia usava `px-2 py-1.5 text-[11px]`, que dá 27px, e
         * ele sobe para cá. É o único pixel que esta entrega mexe de
         * propósito: com `py-` a altura depende da fonte, que é a causa raiz
         * das cinco barras divergentes, e 27px ao lado de um botão de 32px é
         * mais uma medida solta.
         */
        segmentado:
          'h-8 px-4 text-xs rounded-lg text-slate-500 dark:text-slate-400 ' +
          'hover:text-slate-900 dark:hover:text-white ' +
          'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 ' +
          'data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 ' +
          'data-[state=active]:shadow-xs',
      },
    },
    defaultVariants: { aparencia: 'pagina' },
  }
);

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const aparencia = React.useContext(ContextoDaAparencia);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(variantesDoGatilho({ aparencia }), className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/**
 * O contador ao lado do rótulo — "Arquivos 4", "Aguardando Cliente 3".
 *
 * Ele vira `rounded-md` e não `rounded-xl`: é um chip de 15px de altura, e o
 * CSS corta qualquer raio maior que metade do lado. `rounded-xl`, `rounded-lg`
 * e `rounded-full` renderizam os mesmos 7,5px ali — medido no Chromium —, e
 * trocar a classe sem olhar a altura produz um diff grande e uma tela
 * idêntica.
 */
export const TabsBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="text-[10px] px-1.5 py-0.5 rounded-md font-bold leading-none
      bg-slate-100 dark:bg-slate-800 text-slate-500
      group-data-[state=active]:bg-purple-100 dark:group-data-[state=active]:bg-purple-900/40
      group-data-[state=active]:text-purple-700 dark:group-data-[state=active]:text-purple-300"
  >
    {children}
  </span>
);
