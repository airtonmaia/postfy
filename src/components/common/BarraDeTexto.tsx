import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  Bold,
  Hash,
  Italic,
  Link2,
  Loader2,
  Smile,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/button';

/**
 * A barra de ferramentas do texto principal.
 *
 * Escrever legenda é a parte do trabalho que mais acontece nesta tela, e ela
 * era um `textarea` pelado: sem contador, sem emoji, sem saber que o texto
 * não cabia na rede escolhida. A pessoa descobria o limite depois de o
 * cliente ter aprovado.
 *
 * Regra que vale para cada botão daqui: **só entra o que faz alguma coisa**.
 * Botão desligado numa barra de edição é pior que barra curta — ele é clicado,
 * não responde, e a pessoa passa a desconfiar dos que funcionam.
 */

/**
 * Negrito e itálico em rede social não são formatação: são outros caracteres.
 *
 * Nenhuma delas aceita marcação na legenda, e o que as agências fazem é
 * trocar as letras pelos equivalentes matemáticos do Unicode. Funciona em
 * todas, sem depender de nada.
 *
 * O custo é real e vale saber: leitor de tela soletra esses caracteres, e
 * busca e hashtag não casam com eles. Por isso a dica do botão diz o que
 * está acontecendo em vez de chamar de "negrito" e pronto.
 */
const ALFABETOS = {
  negrito: { maiuscula: 0x1d5d4, minuscula: 0x1d5ee, digito: 0x1d7ec },
  italico: { maiuscula: 0x1d608, minuscula: 0x1d622, digito: null },
} as const;

const transformar = (texto: string, estilo: keyof typeof ALFABETOS): string => {
  const base = ALFABETOS[estilo];

  return Array.from(texto)
    .map((c) => {
      const codigo = c.codePointAt(0);
      if (codigo === undefined) return c;

      if (c >= 'A' && c <= 'Z') {
        return String.fromCodePoint(base.maiuscula + (codigo - 65));
      }
      if (c >= 'a' && c <= 'z') {
        return String.fromCodePoint(base.minuscula + (codigo - 97));
      }
      // O itálico sem serifa do Unicode não tem dígitos. Deixá-los como
      // estão é melhor que misturar com os do negrito, que têm outro peso.
      if (c >= '0' && c <= '9' && base.digito) {
        return String.fromCodePoint(base.digito + (codigo - 48));
      }
      return c;
    })
    .join('');
};

/**
 * Um punhado de emoji, escolhido para o que uma agência publica.
 *
 * Lista curta e local em vez de biblioteca: um seletor completo são centenas
 * de KB no bundle para um campo em que quase sempre se usa os mesmos vinte.
 */
const EMOJIS = [
  '😀', '😁', '😍', '🥰', '😎', '🤩', '🤔', '😅',
  '🙌', '👏', '👍', '🙏', '💪', '👇', '👉', '✋',
  '🔥', '✨', '⭐', '💡', '🚀', '🎯', '📈', '💰',
  '❤️', '🧡', '💜', '💚', '🎉', '🎁', '🏆', '✅',
  '📌', '📢', '🗓️', '⏰', '📷', '🎬', '🎧', '📝',
  '☕', '🍃', '🌎', '🏠', '🛒', '💼', '🤝', '💬',
];

interface Props {
  valor: string;
  onChange: (valor: string) => void;
  areaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Limite da rede mais apertada entre as escolhidas. */
  limite?: number;
  /** Qual rede impõe esse limite — um número sem dono não diz o que cortar. */
  donoDoLimite?: string;
  /**
   * Gera o texto pela IA. Ausente quando falta o que a IA precisa saber (o
   * título), e nesse caso o botão nem aparece: melhor não oferecer do que
   * oferecer e responder "informe o tema".
   */
  aoGerarComIA?: () => Promise<string>;
}

export const BarraDeTexto: React.FC<Props> = ({
  valor,
  onChange,
  areaRef,
  limite,
  donoDoLimite,
  aoGerarComIA,
}) => {
  const [painel, setPainel] = useState<'emoji' | 'link' | null>(null);
  const [url, setUrl] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erroDaIA, setErroDaIA] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // Fechar no clique de fora e no Esc: sem isso o painel de emoji fica aberto
  // por cima do texto e some só ao clicar de novo no próprio botão.
  useEffect(() => {
    if (!painel) return;

    const foraDaCaixa = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setPainel(null);
      }
    };
    const noEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPainel(null);
    };

    document.addEventListener('pointerdown', foraDaCaixa);
    document.addEventListener('keydown', noEsc);
    return () => {
      document.removeEventListener('pointerdown', foraDaCaixa);
      document.removeEventListener('keydown', noEsc);
    };
  }, [painel]);

  /**
   * Escreve no cursor, não no fim.
   *
   * Concatenar no fim parece igual e não é: quem está revisando o meio do
   * texto clica no emoji e vê o caractere aparecer a dez linhas de distância.
   */
  const inserir = (texto: string) => {
    const area = areaRef.current;
    if (!area) {
      onChange(valor + texto);
      return;
    }

    const inicio = area.selectionStart ?? valor.length;
    const fim = area.selectionEnd ?? valor.length;
    onChange(valor.slice(0, inicio) + texto + valor.slice(fim));

    // O React só repinta no próximo quadro; mover o cursor antes disso o
    // devolveria para onde o texto antigo terminava.
    requestAnimationFrame(() => {
      area.focus();
      const posicao = inicio + texto.length;
      area.setSelectionRange(posicao, posicao);
    });
  };

  /** Aplica o alfabeto à seleção. Sem seleção não há o que transformar. */
  const estilizar = (estilo: keyof typeof ALFABETOS) => {
    const area = areaRef.current;
    if (!area) return;

    const inicio = area.selectionStart ?? 0;
    const fim = area.selectionEnd ?? 0;
    if (inicio === fim) {
      area.focus();
      return;
    }

    const trecho = transformar(valor.slice(inicio, fim), estilo);
    onChange(valor.slice(0, inicio) + trecho + valor.slice(fim));

    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(inicio, inicio + trecho.length);
    });
  };

  const inserirLink = () => {
    const limpo = url.trim();
    if (!limpo) return;

    // Sem esquema o endereço vira texto solto e nenhuma rede o reconhece.
    const completo = /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
    inserir(completo);
    setUrl('');
    setPainel(null);
  };

  const gerar = async () => {
    if (!aoGerarComIA || gerando) return;
    setGerando(true);
    setErroDaIA(null);
    try {
      const texto = await aoGerarComIA();
      if (texto) onChange(texto);
    } catch (erro) {
      setErroDaIA(
        erro instanceof Error ? erro.message : 'Não foi possível gerar o texto.'
      );
    } finally {
      setGerando(false);
    }
  };

  const usado = Array.from(valor).length;
  const estourou = Boolean(limite && usado > limite);
  const perto = Boolean(limite && !estourou && usado > limite * 0.9);

  const classeDoBotao =
    'p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div ref={caixa} className="relative">
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 border-b-0 rounded-t-lg">
        <button
          type="button"
          onClick={() => estilizar('negrito')}
          title="Negrito — troca as letras selecionadas por caracteres em negrito do Unicode"
          className={classeDoBotao}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => estilizar('italico')}
          title="Itálico — troca as letras selecionadas por caracteres em itálico do Unicode"
          className={classeDoBotao}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

        <button
          type="button"
          onClick={() => inserir('#')}
          title="Hashtag"
          className={classeDoBotao}
        >
          <Hash className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => inserir('@')}
          title="Menção"
          className={classeDoBotao}
        >
          <AtSign className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setPainel(painel === 'link' ? null : 'link')}
          title="Inserir link"
          className={classeDoBotao}
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setPainel(painel === 'emoji' ? null : 'emoji')}
          title="Emoji"
          className={classeDoBotao}
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        {aoGerarComIA && (
          <>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
            <Button variant="soft"
              type="button"
              onClick={gerar}
              disabled={gerando}
              title="Gerar o texto a partir do título e do briefing do cliente"
              className="text-purple-600 dark:text-purple-400"
            >
              {gerando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {gerando ? 'Gerando...' : 'IA'}
            </Button>
          </>
        )}

        {/* O contador encosta à direita; o resto da barra fica à esquerda. */}
        <span className="flex-1" />

        <span
          className={`text-[11px] font-medium tabular-nums ${
            estourou
              ? 'text-rose-600 dark:text-rose-400'
              : perto
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-400'
          }`}
        >
          {usado.toLocaleString('pt-BR')}
          {limite ? ` / ${limite.toLocaleString('pt-BR')}` : ''}
        </span>
      </div>

      {painel === 'emoji' && (
        <div className="absolute right-0 top-full mt-1 z-20 w-64 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg grid grid-cols-8 gap-0.5">
          {EMOJIS.map((emoji) => (
            <Button variant="ghost" size="icon-sm"
              key={emoji}
              type="button"
              onClick={() => {
                inserir(emoji);
                setPainel(null);
              }}
            >
              {emoji}
            </Button>
          ))}
        </div>
      )}

      {painel === 'link' && (
        <div className="absolute right-0 top-full mt-1 z-20 w-72 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg space-y-2">
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              // Enter aqui não pode submeter o formulário do conteúdo inteiro.
              if (e.key === 'Enter') {
                e.preventDefault();
                inserirLink();
              }
            }}
            placeholder="cole ou digite o endereço"
            className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost"
              type="button"
              onClick={() => setPainel(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={inserirLink}
            >
              Inserir
            </Button>
          </div>
        </div>
      )}

      {erroDaIA && (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
          {erroDaIA}
        </p>
      )}

      {estourou && donoDoLimite && (
        <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
          Passou do limite do {donoDoLimite}. O texto será cortado lá.
        </p>
      )}
    </div>
  );
};
