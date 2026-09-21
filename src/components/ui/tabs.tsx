import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

type Aparencia = 'default' | 'pagina' | 'painel' | 'segmentado';

const ContextoDaAparencia = React.createContext<Aparencia>('default');

export const Tabs = TabsPrimitive.Root;

const variantesDaLista = cva('flex items-center', {
  variants: {
    aparencia: {
      default:
        'inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground',
      segmentado:
        'inline-flex h-10 items-center justify-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 w-fit',
      pagina: 'gap-6 overflow-x-auto no-scrollbar pt-2',
      painel:
        'gap-2 border-b border-slate-200 dark:border-slate-800 ' +
        'bg-white dark:bg-slate-900 px-4 rounded-t-xl overflow-x-auto no-scrollbar',
    },
  },
  defaultVariants: { aparencia: 'default' },
});

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof variantesDaLista> {}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, aparencia = 'default', ...props }, ref) => (
  <ContextoDaAparencia.Provider value={aparencia ?? 'default'}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(variantesDaLista({ aparencia }), className)}
      {...props}
    />
  </ContextoDaAparencia.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const variantesDoGatilho = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all ' +
    'cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    '[&_svg]:shrink-0',
  {
    variants: {
      aparencia: {
        default:
          'h-8 px-3 text-xs font-medium rounded-lg ring-offset-background ' +
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs',
        segmentado:
          'h-8 px-4 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 ' +
          'hover:text-slate-900 dark:hover:text-white ' +
          'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 ' +
          'data-[state=active]:text-slate-900 dark:data-[state=active]:text-white ' +
          'data-[state=active]:shadow-xs',
        pagina:
          'pb-3 text-sm font-bold border-b-2 border-transparent text-slate-500 ' +
          'hover:text-slate-800 dark:hover:text-slate-200 ' +
          'data-[state=active]:border-purple-600 ' +
          'data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400',
        painel:
          'h-12 px-4 text-xs font-bold border-b-2 border-transparent text-slate-500 dark:text-slate-400 ' +
          'hover:text-slate-900 dark:hover:text-white ' +
          'data-[state=active]:border-purple-600 ' +
          'data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400',
      },
    },
    defaultVariants: { aparencia: 'default' },
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
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

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
