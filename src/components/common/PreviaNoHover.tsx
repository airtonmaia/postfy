import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A arte grande que aparece ao passar o mouse sobre um card de conteúdo.
 *
 * Existe desde o portal do cliente, onde a prévia nasceu, e agora é a mesma
 * peça no calendário da agência. Duas cópias divergiriam na primeira pressa —
 * e aqui a divergência é visível para o cliente: a agência confere o
 * enquadramento numa tela e manda o link da outra.
 *
 * **A prévia é posicionada em `fixed`, num portal para o `body`, e isso é a
 * decisão central.** No portal ela era `absolute` ao lado do card e funcionava
 * porque não há nada cortando ali — o comentário do arquivo dizia isso com
 * todas as letras ("sem `overflow-hidden`: ele cortaria a prévia"). O
 * calendário da agência é o oposto: a célula corta, a lista de conteúdos do
 * dia rola, e a grade inteira rola. Qualquer um dos três decepa a prévia, e o
 * sintoma é o pior possível — ela aparece **pela metade**, com cara de
 * proposital, sem erro em lugar nenhum.
 *
 * Em `fixed` dentro de um portal não há ancestral que corte: a única
 * referência é a janela, e é dela que vem o desvio de lado e o encosto no
 * rodapé.
 */

/** `w-44`, a largura que a prévia já tinha no portal. */
const LARGURA = 176;
/** O respiro da prévia para o card e para a borda da janela. */
const RESPIRO = 8;

interface PreviaNoHoverProps {
  /** A arte. Sem ela não há prévia, e o filho é renderizado sozinho. */
  url?: string;
  /** Classe de proporção — sai de `proporcaoDoCriativo`, nunca escrita à mão. */
  proporcao: string;
  children: React.ReactNode;
  className?: string;
}

export const PreviaNoHover: React.FC<PreviaNoHoverProps> = ({
  url,
  proporcao,
  children,
  className,
}) => {
  const alvo = useRef<HTMLDivElement>(null);
  const previa = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);
  const aberta = posicao !== null;

  /**
   * Clampa a prévia dentro da janela **depois** de ela existir, porque a
   * altura depende da proporção da rede: 9:16 tem 313px e 16:9 tem 99px na
   * mesma largura. Estimar isso em JS seria repetir a tabela de proporções
   * num segundo lugar, que é o que este componente existe para evitar.
   *
   * `useLayoutEffect` roda antes da pintura, então não há salto visível. E o
   * efeito não entra em laço: ele só chama `setPosicao` quando o valor muda,
   * e o valor corrigido já satisfaz a própria conta.
   */
  useLayoutEffect(() => {
    if (!posicao || !previa.current) return;
    const altura = previa.current.offsetHeight;
    const teto = window.innerHeight - altura - RESPIRO;
    const corrigido = Math.max(RESPIRO, Math.min(posicao.top, teto));
    if (corrigido !== posicao.top) setPosicao({ ...posicao, top: corrigido });
  }, [posicao]);

  const posicionar = () => {
    if (!url || !alvo.current) return;
    const caixa = alvo.current.getBoundingClientRect();
    /**
     * O lado sai do espaço que **sobra na janela**, não da coluna do
     * calendário. A regra por coluna ("as duas últimas abrem para a
     * esquerda") acerta no mês e erra em qualquer outra grade — e erra
     * silenciosamente, porque a prévia continua aparecendo, só que fora da
     * tela.
     */
    const cabeADireita = caixa.right + RESPIRO + LARGURA <= window.innerWidth - RESPIRO;
    setPosicao({
      left: cabeADireita ? caixa.right + RESPIRO : caixa.left - RESPIRO - LARGURA,
      top: caixa.top,
    });
  };

  /**
   * Em `fixed` a prévia não acompanha o card sozinha: rolar a grade com o
   * mouse parado sobre o conteúdo deixaria a arte pendurada no lugar antigo,
   * ao lado de outro dia. É o custo de escapar do recorte, e ele se paga
   * recalculando a posição enquanto ela estiver aberta.
   *
   * O `true` é a fase de captura, e não é detalhe: quem rola aqui é a grade
   * do calendário, não a janela, e evento de rolagem de elemento não sobe.
   */
  useEffect(() => {
    if (!aberta) return;
    const acompanhar = () => posicionar();
    window.addEventListener('scroll', acompanhar, true);
    window.addEventListener('resize', acompanhar);
    return () => {
      window.removeEventListener('scroll', acompanhar, true);
      window.removeEventListener('resize', acompanhar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, url]);

  return (
    <div
      ref={alvo}
      className={className}
      onMouseEnter={posicionar}
      onMouseLeave={() => setPosicao(null)}
    >
      {children}

      {url &&
        posicao &&
        createPortal(
          /**
           * `pointer-events-none` porque ela cobre o que está embaixo: sem
           * isso, passar o mouse por cima da prévia tiraria o clique do card
           * vizinho — e, num portal para o `body`, tiraria o do card que a
           * abriu junto.
           */
          <div
            ref={previa}
            style={{ left: posicao.left, top: posicao.top, width: LARGURA }}
            className="pointer-events-none fixed z-[60] hidden sm:block"
          >
            <div
              className={`w-full ${proporcao} rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl bg-slate-900`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
