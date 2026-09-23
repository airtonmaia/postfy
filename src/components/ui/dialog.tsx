import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from './button';

/**
 * Modal, no formato shadcn/ui — com o canto do Orquesia e a tela cheia no
 * celular.
 *
 * O produto tinha **25 sobreposições escritas à mão** (`fixed inset-0` com um
 * `div` por cima), e o que faltava nelas não era estilo:
 *
 *   fechavam com Esc            2 de 25
 *   travavam a rolagem do fundo 0 de 25
 *
 * Isso não é detalhe de acabamento. Sem trava de rolagem, rolar dentro da
 * modal no celular rola **a página atrás dela** assim que o conteúdo acaba, e
 * a pessoa perde o lugar onde estava. Sem `Esc`, a única saída é acertar um
 * botão de 32px. E nenhuma delas tinha trava de foco: com a modal aberta o
 * `Tab` passeava pelos campos da tela de trás, que continuavam alcançáveis
 * por quem navega pelo teclado e invisíveis para quem navega pelo olho.
 *
 * O Radix resolve os quatro de graça e devolve o foco ao gatilho ao fechar.
 * Nada disso dá para "lembrar de fazer" em 25 lugares. Medido no Chromium com
 * a modal de conteúdo aberta:
 *
 *   irmãos do diálogo   todos com `aria-hidden="true"`
 *   `body` overflow     `hidden`
 *   40 `Tab` seguidos   **0** saíram do diálogo
 *
 * Note que ele **não** escreve `aria-modal`, e isso é escolha dele, não
 * omissão: esconder o resto da página com `aria-hidden` é mais confiável do
 * que o atributo, que parte dos leitores de tela trata mal. Quem for conferir
 * a acessibilidade daqui procura o `aria-hidden` nos irmãos, não o
 * `aria-modal` no diálogo.
 *
 * ---
 *
 * **Duas traduções na entrada, como toda peça do shadcn:**
 *
 * | o shadcn escreve | vira | por quê |
 * |---|---|---|
 * | `rounded-lg` na superfície | `rounded-2xl` | é o canto de card **e modal** aqui |
 * | `max-w-lg` fixo | a variante `tamanho` | o produto tem modal de recado e modal de editor |
 *
 * **E uma decisão que é do Orquesia, não do shadcn: o celular.** O padrão do
 * shadcn é uma caixa centrada com respiro em volta, e no telefone ela
 * continua sendo uma caixa centrada — perdendo 32px de largura justo onde ela
 * é escassa. Aqui a modal ocupa a tela inteira abaixo do `sm`, e é **o
 * primitivo** que faz isso: deixado a cargo de cada modal, ele seria esquecido
 * na primeira pressa, e esquecer não quebra nada visível no monitor de quem
 * escreve. Mesma lógica do fuso por omissão — o caminho certo é o que não
 * exige lembrar de nada.
 *
 * O canto acompanha a tela cheia: `rounded-2xl` é o canto de uma superfície
 * **sobre** outra, e em tela cheia não há o "sobre" — sobrariam quatro cantos
 * do fundo aparecendo nas quinas do aparelho. É a única exceção ao
 * vocabulário de canto, e vale só abaixo do `sm`.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // O mesmo véu das 25 escritas à mão, levantado por contagem:
      // `bg-slate-900/60 backdrop-blur-xs`.
      'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Os tamanhos são os que já existiam, levantados por contagem nas 25:
 * `max-w-md` (recado), `max-w-lg`/`max-w-2xl` (formulário curto), `max-w-4xl`
 * (editor) e `max-w-6xl` (editor com prévia ao lado). Inventar um sexto é o
 * que a regra de desenho proíbe.
 */
const variantesDoConteudo = cva(
  'fixed z-50 flex flex-col bg-white dark:bg-slate-900 shadow-2xl ' +
    'text-slate-800 dark:text-slate-200 ' +
    // Celular: a tela inteira, sem canto e sem borda.
    'inset-0 w-full h-full max-h-full rounded-none border-0 ' +
    // Do `sm` para cima: a caixa centrada de sempre.
    'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 ' +
    'sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800 ' +
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 ' +
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  {
    variants: {
      tamanho: {
        recado: 'sm:max-w-md',
        formulario: 'sm:max-w-lg',
        largo: 'sm:max-w-2xl',
        editor: 'sm:max-w-4xl',
        editorComPrevia: 'sm:max-w-6xl',
      },
    },
    defaultVariants: { tamanho: 'formulario' },
  }
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof variantesDoConteudo> {
  /**
   * Some com o X do canto. Para a modal que já desenha o próprio fechar
   * dentro de um cabeçalho — a de conteúdo faz isso, ao lado do seletor de
   * status.
   */
  semFechar?: boolean;
}

/**
 * Janela de terceiro aberta por cima de uma modal nossa.
 *
 * **O seletor do Google Drive abria e não deixava clicar em nada.** O Radix
 * torna a modal *modal* de três formas ao mesmo tempo: põe
 * `pointer-events: none` no `body` (só o conteúdo da modal volta a receber
 * clique), prende o foco dentro dela, e fecha ao primeiro clique de fora.
 * Uma janela que o Google injeta direto no `body` cai nas três — ela aparece,
 * e o clique não chega nela.
 *
 * O sintoma engana: a janela está **visível e por cima**, então parece um
 * problema de z-index. Não é; é o clique que não atravessa.
 *
 * Isto não é uma exceção para o Google. Vale para qualquer coisa que abra
 * fora da árvore do React em cima de uma modal, e por isso a regra mora no
 * primitivo — repetida em cada tela, a próxima nasceria sem ela.
 */
const SELETOR_DE_FORA = '.picker-dialog, .picker-dialog-bg, .picker, iframe[src*="docs.google.com"]';

const veioDeJanelaDeFora = (alvo: EventTarget | null): boolean =>
  alvo instanceof Element && Boolean(alvo.closest(SELETOR_DE_FORA));

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, tamanho, semFechar = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(variantesDoConteudo({ tamanho }), className)}
      /*
        Clicar no seletor do Google é "clicar fora" para o Radix, e fechar a
        modal de conteúdo ali perderia o formulário inteiro — com a pessoa no
        meio de escolher a arte. O `preventDefault` vale **só** para a janela
        de fora: clique no fundo continua fechando, que é o que a tecla Esc e
        o clique fora existem para fazer.
      */
      onPointerDownOutside={(evento) => {
        if (veioDeJanelaDeFora(evento.target)) evento.preventDefault();
        props.onPointerDownOutside?.(evento);
      }}
      onInteractOutside={(evento) => {
        if (veioDeJanelaDeFora(evento.target)) evento.preventDefault();
        props.onInteractOutside?.(evento);
      }}
      /*
        Sem isto o campo de busca do seletor não recebe o que se digita: a
        trava de foco do Radix puxa o cursor de volta para a modal a cada
        tecla.
      */
      onFocusOutside={(evento) => {
        if (veioDeJanelaDeFora(evento.target)) evento.preventDefault();
        props.onFocusOutside?.(evento);
      }}
      {...props}
    >
      {children}

      {!semFechar && (
        <DialogPrimitive.Close asChild>
          {/*
            O fechar é o `Button` do produto, não um `<button>` solto: assim
            ele tem a altura, o canto e o foco visível de todos os outros. Era
            escrito à mão em cada uma das 25, e entre elas havia três posições
            e dois tamanhos diferentes.
          */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fechar"
            className="absolute top-3 right-3 z-10 dark:text-slate-300 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * O cabeçalho não rola com o corpo.
 *
 * Nas modais à mão isso era feito com `flex flex-col overflow-hidden` no
 * container e `flex-1 overflow-y-auto` no corpo — a mesma string copiada em
 * cada uma. Aqui as três peças já vêm encaixadas: cabeçalho e rodapé fixos,
 * corpo rolando entre eles.
 */
export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      'shrink-0 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70',
      className
    )}
    {...props}
  />
);

/** O corpo: é ele que rola, e o `min-h-0` é o que permite isso num flex. */
export const DialogBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('flex-1 min-h-0 overflow-y-auto p-4 sm:p-6', className)} {...props} />;

/**
 * O rodapé empilha no celular, na ordem da decisão.
 *
 * Com `flex-wrap justify-end`, cinco botões caem em três linhas
 * desencontradas e nenhuma diz qual é a principal — foi o que aconteceu no
 * cadastro de conteúdo. Empilhados, a ordem do DOM vira a ordem de leitura.
 */
export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      'shrink-0 p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800',
      'flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3',
      '[&>*]:w-full sm:[&>*]:w-auto',
      className
    )}
    {...props}
  />
);

/**
 * `DialogTitle` é **obrigatório** para o Radix: sem ele o diálogo sobe sem
 * nome acessível e o console avisa. Quando o título é desenhado de outro
 * jeito — a modal de conteúdo mostra avatar, selos e o título editável —, o
 * lugar dele é o `DialogTitle` com `sr-only`, nunca a ausência.
 */
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-bold text-slate-900 dark:text-white', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-slate-500 dark:text-slate-400', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { variantesDoConteudo };
