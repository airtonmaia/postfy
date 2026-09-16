import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Crop } from 'lucide-react';

import { Button } from './button';

/**
 * Recorte quadrado, antes do envio.
 *
 * O avatar é desenhado num quadrado — `Avatar` usa `formato="quadrado"` ou
 * `"circulo"`, os dois com lado igual — e o navegador resolvia isso com
 * `object-cover`, cortando **o centro** da foto. Numa foto de perfil o rosto
 * raramente está no centro geométrico: ficava cortado no queixo, e a única
 * saída era abrir um editor fora do sistema e voltar com outro arquivo.
 *
 * **O recorte acontece antes do upload, e é ele que vai para o R2.** Guardar o
 * original e cortar só na tela pareceria a mesma coisa e não é: o arquivo
 * grande viajaria em toda leitura, e qualquer tela que o desenhasse sem
 * `object-cover` mostraria a foto inteira — inclusive o e-mail, que não tem
 * como recortar nada.
 *
 * **SVG não passa por aqui, de propósito.** Recortá-lo exigiria rasterizar, e
 * um logo em SVG perde exatamente o que faz dele a melhor escolha para marca:
 * escala sem borrar. O `file-upload.tsx` chega a mostrar um selo "SVG
 * Vetorial" para isso. Vetor entra inteiro.
 */

/** O lado do arquivo gerado. 512 cobre o maior uso em tela (avatar de 96px em
 *  telas de densidade 2x e 3x) sem produzir um arquivo grande à toa. */
const LADO_DE_SAIDA = 512;

/** O lado do quadrado em que a pessoa enquadra. */
const LADO_DO_VISOR = 320;

const ZOOM_MAXIMO = 4;

interface Props {
  /** O arquivo escolhido. Vem cru: quem recorta é esta tela. */
  arquivo: File;
  aoConfirmar: (recortado: File) => void;
  aoCancelar: () => void;
}

export const RecorteQuadrado: React.FC<Props> = ({ arquivo, aoConfirmar, aoCancelar }) => {
  /**
   * Todos os hooks aqui em cima, antes de qualquer `return`.
   *
   * Este componente monta e desmonta com a modal do upload, e um `useState`
   * declarado depois de uma guarda rodaria em duas listas diferentes — o React
   * derruba a árvore com o erro #310 (armadilha 8.1).
   */
  const [origem, setOrigem] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [deslocamento, setDeslocamento] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const inicioDoArraste = useRef<{ x: number; y: number } | null>(null);

  // A URL do objeto é revogada no desmonte: sem isso, cada foto aberta deixa
  // um blob preso na memória da aba até o F5.
  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => setOrigem(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  /**
   * A escala em que o lado **menor** da imagem preenche o visor.
   *
   * É o `cover` do CSS escrito à mão, e é o mínimo permitido: abaixo disso
   * sobraria tarja branca dentro do quadrado, e o recorte deixaria de ser um
   * recorte.
   */
  const escalaBase = origem
    ? LADO_DO_VISOR / Math.min(origem.naturalWidth, origem.naturalHeight)
    : 1;
  const escala = escalaBase * zoom;
  const larguraExibida = (origem?.naturalWidth ?? 0) * escala;
  const alturaExibida = (origem?.naturalHeight ?? 0) * escala;

  /**
   * O deslocamento é preso às bordas: a imagem sempre cobre o visor inteiro.
   *
   * Sem isso dá para arrastar a foto para fora e confirmar um quadrado com
   * metade vazia — e o vazio vira preto no canvas, sem nenhum aviso.
   */
  const prender = useCallback(
    (d: { x: number; y: number }) => ({
      x: Math.min(0, Math.max(LADO_DO_VISOR - larguraExibida, d.x)),
      y: Math.min(0, Math.max(LADO_DO_VISOR - alturaExibida, d.y)),
    }),
    [larguraExibida, alturaExibida]
  );

  /**
   * Posiciona ao carregar e a cada mudança de zoom, mantendo o que já estava
   * enquadrado dentro das bordas novas.
   *
   * **Retrato não começa centralizado, e isso é medido, não gosto.** Numa foto
   * 400×700 o centro geométrico fica na altura do peito: o quadrado abre
   * cortando o rosto, e a pessoa tem que arrastar *toda vez* — que é
   * exatamente o atrito que esta tela veio tirar. Foi o que apareceu na
   * primeira renderização no Chromium.
   *
   * A sobra vertical é distribuída em **um terço** acima e dois abaixo, não
   * metade e metade. Não é detecção de rosto — é a regra dos terços, que
   * acerta a maioria dos retratos e erra de perto nos outros. Horizontal
   * continua no meio: aí o centro é o padrão certo.
   */
  useEffect(() => {
    if (!origem) return;
    setDeslocamento((atual) => {
      const ehRetrato = origem.naturalHeight > origem.naturalWidth;
      const sobraVertical = LADO_DO_VISOR - origem.naturalHeight * escalaBase;
      const centralizado =
        atual.x === 0 && atual.y === 0
          ? {
              x: (LADO_DO_VISOR - origem.naturalWidth * escalaBase) / 2,
              y: ehRetrato ? sobraVertical / 3 : sobraVertical / 2,
            }
          : atual;
      return {
        x: Math.min(0, Math.max(LADO_DO_VISOR - larguraExibida, centralizado.x)),
        y: Math.min(0, Math.max(LADO_DO_VISOR - alturaExibida, centralizado.y)),
      };
    });
    // `escalaBase` entra porque ele muda quando a imagem troca.
  }, [origem, escalaBase, larguraExibida, alturaExibida]);

  const aoMover = (e: React.PointerEvent) => {
    if (!arrastando || !inicioDoArraste.current) return;
    const { x, y } = inicioDoArraste.current;
    setDeslocamento(prender({ x: e.clientX - x, y: e.clientY - y }));
  };

  const comecarArraste = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    inicioDoArraste.current = { x: e.clientX - deslocamento.x, y: e.clientY - deslocamento.y };
    setArrastando(true);
  };

  const gerar = () => {
    if (!origem) return;
    setGerando(true);

    const canvas = document.createElement('canvas');
    canvas.width = LADO_DE_SAIDA;
    canvas.height = LADO_DE_SAIDA;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setGerando(false);
      return;
    }

    /**
     * PNG quando a origem pode ter transparência, JPEG no resto.
     *
     * Um logo em PNG com fundo transparente virando JPEG ganha um fundo
     * **preto** — o canvas começa transparente e o JPEG não guarda alfa. Não
     * quebra nada e ninguém vê antes de a marca aparecer num card branco.
     */
    const transparente = /png|webp|gif/.test(arquivo.type);
    if (!transparente) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, LADO_DE_SAIDA, LADO_DE_SAIDA);
    }

    // Do que está no visor para as coordenadas da imagem original.
    const origemX = -deslocamento.x / escala;
    const origemY = -deslocamento.y / escala;
    const ladoNaOrigem = LADO_DO_VISOR / escala;

    ctx.drawImage(
      origem,
      origemX,
      origemY,
      ladoNaOrigem,
      ladoNaOrigem,
      0,
      0,
      LADO_DE_SAIDA,
      LADO_DE_SAIDA
    );

    const tipo = transparente ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        setGerando(false);
        if (!blob) return;
        const nome = arquivo.name.replace(/\.[^.]+$/, '') + (transparente ? '.png' : '.jpg');
        aoConfirmar(new File([blob], nome, { type: tipo }));
      },
      tipo,
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h5 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Crop className="w-4 h-4 text-purple-600" />
            Enquadrar a imagem
          </h5>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Arraste para posicionar e use o zoom. O que estiver dentro do quadrado é o
            que será salvo.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div
            className="relative mx-auto overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 touch-none select-none"
            style={{ width: LADO_DO_VISOR, height: LADO_DO_VISOR }}
            onPointerDown={comecarArraste}
            onPointerMove={aoMover}
            onPointerUp={() => setArrastando(false)}
            onPointerCancel={() => setArrastando(false)}
          >
            {origem && (
              <img
                src={origem.src}
                alt=""
                draggable={false}
                className={arrastando ? 'cursor-grabbing' : 'cursor-grab'}
                style={{
                  position: 'absolute',
                  width: larguraExibida,
                  height: alturaExibida,
                  transform: `translate(${deslocamento.x}px, ${deslocamento.y}px)`,
                  maxWidth: 'none',
                }}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={ZOOM_MAXIMO}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-purple-600 cursor-pointer"
              aria-label="Zoom da imagem"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={() => {
                setZoom(1);
                setDeslocamento({ x: 0, y: 0 });
              }}
              title="Voltar ao enquadramento inicial"
              aria-label="Voltar ao enquadramento inicial"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" type="button" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button type="button" onClick={gerar} disabled={!origem || gerando}>
            {gerando ? 'Recortando...' : 'Usar esta área'}
          </Button>
        </div>
      </div>
    </div>
  );
};
