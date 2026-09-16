import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import { cn } from '../../lib/utils';
import { variantesDoBotao } from './button';

/**
 * Diálogo de confirmação, no formato shadcn/ui — com o canto do Orquesia.
 *
 * Ele substitui `window.confirm()`, e o motivo não é estético:
 *
 * - **A caixa do navegador não tem a marca da agência.** O produto é
 *   whitelabel; um cinza do Chrome no meio do portal do cliente diz que a
 *   página é de outra pessoa, que é o oposto do que o whitelabel existe para
 *   fazer.
 * - **Ela trava a aba inteira.** `confirm()` é síncrono: nada pinta, nada
 *   responde, e no celular alguns navegadores a suprimem — aí a confirmação
 *   simplesmente não aparece e a ação **não acontece**, sem erro nenhum.
 * - **Ela não cabe a explicação.** "Tem certeza?" é a pergunta errada. O que
 *   decide é a consequência — "as publicações agendadas serão canceladas",
 *   "em uso em três conteúdos" —, e um `confirm()` só tem uma linha.
 *
 * O canto vem traduzido na entrada, como toda peça do shadcn: o `rounded-lg`
 * que ele usa na superfície vira `rounded-2xl`, que é o canto de card **e
 * modal** aqui (ver o vocabulário no CLAUDE.md). Declarar `--radius-*` para
 * resolver isso é o bug de 649 elementos da 2.29.1.
 *
 * `AlertDialogAction` e `AlertDialogCancel` reusam `variantesDoBotao`, então
 * o botão do diálogo tem a mesma altura e o mesmo acabamento do resto do
 * produto — sem isso ele nasceria com a escala do shadcn, 36px ao lado dos
 * 32px de todo mundo.
 */

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto',
        'rounded-2xl border border-slate-200 dark:border-slate-800',
        'bg-white dark:bg-slate-900 p-6 shadow-xl',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

export const AlertDialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('flex flex-col gap-2', className)} {...props} />;
AlertDialogHeader.displayName = 'AlertDialogHeader';

export const AlertDialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  // Invertido no celular: numa coluna, a ação destrutiva embaixo do polegar é
  // a que mais erra. Cancelar fica por último, que é onde o dedo repousa.
  <div
    className={cn(
      'flex flex-col-reverse gap-2 pt-5 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-base font-bold tracking-tight text-slate-900 dark:text-white',
      className
    )}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn(
      'text-xs leading-relaxed text-slate-600 dark:text-slate-400',
      className
    )}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    /** Vermelho cheio. O padrão para o que apaga, remove ou desconecta. */
    destrutivo?: boolean;
  }
>(({ className, destrutivo = false, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      // `destructive` do botão é o ícone de lixeira (texto rosa, sem fundo) —
      // errado para a ação principal de um diálogo, que precisa de peso. Daí
      // a base neutra mais o vermelho cheio por cima.
      variantesDoBotao({ variant: destrutivo ? 'secondary' : 'primary' }),
      destrutivo && 'bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600',
      className
    )}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(variantesDoBotao({ variant: 'outline' }), className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

/**
 * O caso que aparece em todas as telas: uma pergunta, uma consequência, duas
 * saídas.
 *
 * Existe para que o desvio de `window.confirm()` seja uma troca de uma linha
 * por um componente controlado, e não sete montagens à mão do mesmo diálogo —
 * que é como as doze alturas de botão nasceram.
 *
 * **A descrição é obrigatória**, e isso é a decisão: `confirm()` cabia só a
 * pergunta, e "Tem certeza?" não é o que faz alguém decidir. O que decide é o
 * que acontece depois — quantas publicações são canceladas, quem perde
 * acesso, em quantos conteúdos a mídia está.
 */
export const DialogoDeConfirmacao: React.FC<{
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao: React.ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  destrutivo?: boolean;
  aoConfirmar: () => void;
}> = ({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  rotuloCancelar = 'Cancelar',
  destrutivo = true,
  aoConfirmar,
}) => (
  <AlertDialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{titulo}</AlertDialogTitle>
        <AlertDialogDescription>{descricao}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{rotuloCancelar}</AlertDialogCancel>
        <AlertDialogAction destrutivo={destrutivo} onClick={aoConfirmar}>
          {rotuloConfirmar}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/** O que a pergunta precisa dizer. `aoConfirmar` pode ser assíncrono. */
export interface PedidoDeConfirmacao {
  titulo: string;
  descricao: React.ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  destrutivo?: boolean;
  aoConfirmar: () => void | Promise<void>;
}

/**
 * Trocar `window.confirm()` em uma linha, sem montar o diálogo à mão.
 *
 * `confirm()` é uma expressão: `if (!confirm(...)) return;` e o resto da
 * função segue embaixo. Um diálogo é assíncrono por natureza — a resposta
 * chega noutro render —, então a conversão quebra a função em duas, e fazer
 * isso à mão em cada tela é como nasceram as doze alturas de botão.
 *
 * Aqui a função original vira o `aoConfirmar` e nada mais muda:
 *
 *     const { pedir, dialogo } = useConfirmacao();
 *     ...
 *     pedir({ titulo, descricao, aoConfirmar: async () => { ...o corpo... } });
 *     ...
 *     return (<>{...a tela...}{dialogo}</>);
 *
 * **O hook fica no topo do componente**, antes de qualquer `return` — hook
 * depois de `return null` derruba a árvore inteira com o erro #310, e nada
 * local acusa (armadilha 8.1).
 */
export const useConfirmacao = () => {
  const [pedido, setPedido] = React.useState<PedidoDeConfirmacao | null>(null);

  const dialogo = pedido ? (
    <DialogoDeConfirmacao
      aberto
      aoFechar={() => setPedido(null)}
      titulo={pedido.titulo}
      descricao={pedido.descricao}
      rotuloConfirmar={pedido.rotuloConfirmar}
      rotuloCancelar={pedido.rotuloCancelar}
      destrutivo={pedido.destrutivo}
      aoConfirmar={() => {
        // Fecha antes de executar: a ação costuma ser assíncrona, e manter o
        // diálogo aberto durante a chamada convida o segundo clique — que
        // dispara a exclusão duas vezes.
        setPedido(null);
        void pedido.aoConfirmar();
      }}
    />
  ) : null;

  return { pedir: setPedido, dialogo };
};

/**
 * O primo do `alert()`: uma coisa aconteceu, tem uma saída só.
 *
 * Separado de `useConfirmacao` de propósito — aviso com botão "Cancelar" ao
 * lado convida a pessoa a procurar qual dos dois desfaz o que já aconteceu.
 *
 * Vale para **falha que interrompe**: o conteúdo que não salvou, o PDF que
 * não saiu. Confirmação de que deu certo não entra aqui: "copiado!" merece um
 * ícone que muda por dois segundos, não uma caixa que precisa ser fechada.
 */
export const useAviso = () => {
  const [aviso, setAviso] = React.useState<{
    titulo: string;
    descricao: React.ReactNode;
  } | null>(null);

  const dialogo = aviso ? (
    <AlertDialog open onOpenChange={(v) => !v && setAviso(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{aviso.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{aviso.descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setAviso(null)}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { avisar: setAviso, dialogo };
};
