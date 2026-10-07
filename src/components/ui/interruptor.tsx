import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Liga e desliga — o interruptor do produto.
 *
 * **Ele já existia, escrito à mão numa tela só**: a lista de Automações. As
 * classes aqui são exatamente as de lá, levantadas do código e não
 * inventadas — é a regra de desenho do projeto, e a mesma história das doze
 * alturas de botão: a segunda cópia é onde elas começam a divergir.
 *
 * É `<label>` com um `checkbox` escondido, e não um `<button>`, porque é o que
 * dá de graça o que importa: foco pelo teclado, espaço e enter alternando, e o
 * estado lido por leitor de tela como "caixa de seleção, marcada". Um `div`
 * com `onClick` teria a mesma aparência e nenhuma das três.
 */
export const Interruptor: React.FC<{
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  /** Obrigatório: um interruptor sozinho não diz o que ele liga. */
  rotulo: string;
  className?: string;
}> = ({ ligado, aoMudar, rotulo, className }) => (
  <label className={cn('relative inline-flex items-center cursor-pointer shrink-0', className)}>
    <input
      type="checkbox"
      checked={ligado}
      onChange={(e) => aoMudar(e.target.checked)}
      aria-label={rotulo}
      className="sr-only peer"
    />
    {/*
      A bolinha é um pseudo-elemento, e por isso ela é a exceção nomeada da
      regra do modo escuro: `after:bg-white` não é superfície da tela, é o que
      se move sobre o trilho — e ela é branca nos dois temas, nos dois estados.
    */}
    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
  </label>
);
