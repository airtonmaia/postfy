import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

/**
 * Accordion do shadcn, com o canto traduzido na entrada.
 *
 * O shadcn não arredonda nada aqui — o desenho dele é uma lista com divisor.
 * O que vale neste projeto é o vocabulário de cinco passos: o gatilho é um
 * **controle**, então `rounded-xl`, como item de menu e botão.
 *
 * **Sem as classes `animate-accordion-*`.** Elas dependem de keyframes que o
 * `shadcn init` instala no tema, e este projeto não tem esse bloco — classe
 * que não existe não vira propriedade, e `tsc`, vitest e `vite build` ficariam
 * os três verdes com a seção abrindo seca. É a armadilha 0: melhor não
 * prometer a animação do que escrevê-la sem efeito.
 */

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className = '', ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={className} {...props} />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className = '', children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={
        'flex flex-1 items-center gap-1.5 h-8 px-2 -ml-2 rounded-xl ' +
        'text-xs font-bold text-slate-700 dark:text-slate-300 ' +
        'hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ' +
        '[&[data-state=open]>svg]:rotate-180 ' +
        className
      }
      {...props}
    >
      <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200" />
      {children}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className = '', children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} className="overflow-hidden" {...props}>
    <div className={`pt-3 ${className}`}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
