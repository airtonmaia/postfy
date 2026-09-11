import React, { useEffect, useState } from 'react';
import { AtSign, Check, MapPin, MessageSquare, X } from 'lucide-react';

import {
  contarHashtags,
  LIMITE_DE_HASHTAGS,
  type CampoDoCanal,
} from '../../lib/camposDoCanal';
import type { JobPlatform } from '../../types';
import { ComTooltip } from '../ui/tooltip';
import { BarraDeTexto } from './BarraDeTexto';

/**
 * Os acessórios do conteúdo, atrás de ícone.
 *
 * Localização, primeiro comentário e marcação ocupavam quase metade da altura
 * do formulário — três campos que a maioria dos conteúdos não usa, empurrando
 * a legenda para fora da tela. Aqui eles viram três ícones na linha do rótulo
 * da legenda, e cada um abre em modal.
 *
 * Duas regras que valem para qualquer ícone que entre depois:
 *
 * 1. **Ícone sozinho tem tooltip.** Ele não se explica, e sem rótulo a pessoa
 *    descobre clicando — o que num formulário significa abrir três modais até
 *    achar o certo.
 * 2. **O preenchido aparece por fora.** Acessório escondido que ninguém vê
 *    preenchido é acessório esquecido: o ícone ganha o ponto da cor da marca
 *    quando tem conteúdo, e é isso que devolve "ah, já pus a localização".
 */

const ICONES = {
  localizacao: MapPin,
  comentario: MessageSquare,
  marcacao: AtSign,
} as const;

interface Props {
  campos: CampoDoCanal[];
  valorDoCampo: (campo: CampoDoCanal) => unknown;
  definirCampo: (campo: CampoDoCanal, valor: unknown) => void;
  /** Para somar as hashtags da legenda com as do primeiro comentário. */
  legenda: string;
  /** Decide qual limite de hashtag vale. */
  canalPrincipal: JobPlatform;
}

export const AtalhosDoConteudo: React.FC<Props> = ({
  campos,
  valorDoCampo,
  definirCampo,
  legenda,
  canalPrincipal,
}) => {
  const [aberto, setAberto] = useState<CampoDoCanal | null>(null);

  // Esc fecha. O modal do atalho fica por cima do modal do conteúdo, e sem
  // isso o Esc fecharia o de baixo — perdendo o formulário inteiro.
  useEffect(() => {
    if (!aberto) return;

    const noEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAberto(null);
    };
    document.addEventListener('keydown', noEsc, true);
    return () => document.removeEventListener('keydown', noEsc, true);
  }, [aberto]);

  if (!campos.length) return null;

  const preenchido = (campo: CampoDoCanal) =>
    String(valorDoCampo(campo) ?? '').trim().length > 0;

  return (
    <>
      <div className="flex items-center gap-1">
        {campos.map((campo) => {
          const Icone = ICONES[campo.atalho!.icone];
          const temConteudo = preenchido(campo);

          return (
            <ComTooltip key={campo.chave} texto={campo.atalho!.dica}>
              <button
                type="button"
                onClick={() => setAberto(campo)}
                aria-label={campo.atalho!.dica}
                className={`relative p-1.5 rounded-lg transition cursor-pointer ${
                  temConteudo
                    ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icone className="w-4 h-4" />
                {temConteudo && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400" />
                )}
              </button>
            </ComTooltip>
          );
        })}
      </div>

      {aberto && (
        <ModalDoAtalho
          campo={aberto}
          valor={String(valorDoCampo(aberto) ?? '')}
          onChange={(v) => definirCampo(aberto, v)}
          onClose={() => setAberto(null)}
          legenda={legenda}
          canalPrincipal={canalPrincipal}
        />
      )}
    </>
  );
};

/**
 * O modal de um acessório.
 *
 * Casca igual à dos outros modais do projeto de propósito — `rounded-2xl`,
 * `bg-slate-900/60` com desfoque, botão de fechar no canto. Medida nova aqui
 * faria a mesma pessoa achar que trocou de produto ao clicar num ícone.
 */
const ModalDoAtalho: React.FC<{
  campo: CampoDoCanal;
  valor: string;
  onChange: (valor: string) => void;
  onClose: () => void;
  legenda: string;
  canalPrincipal: JobPlatform;
}> = ({ campo, valor, onChange, onClose, legenda, canalPrincipal }) => {
  const area = React.useRef<HTMLTextAreaElement>(null);

  /**
   * O contador de hashtag só aparece no primeiro comentário, e soma as da
   * legenda: é assim que a rede conta. Passar as hashtags para o comentário
   * limpa a legenda e **não** aumenta o teto — quem não sabe divide 40 entre
   * os dois campos achando que resolveu.
   */
  const tetoDeHashtags = LIMITE_DE_HASHTAGS[canalPrincipal];
  const mostraHashtags = campo.chave === 'firstComment' && Boolean(tetoDeHashtags);
  const hashtags = mostraHashtags ? contarHashtags(legenda, valor) : 0;
  const passouDasHashtags = Boolean(tetoDeHashtags && hashtags > tetoDeHashtags);

  const classeDeEntrada =
    'w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        /* O clique de dentro não pode fechar: selecionar texto arrastando até
           fora da caixa contaria como clique no fundo e apagaria a edição. */
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {campo.rotulo}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {campo.tipo === 'textoLongo' ? (
            <>
              {/* Sem o botão de IA: ele escreve legenda, e aqui o campo é
                  outro. Botão que preenche o campo errado é pior que ausente. */}
              <BarraDeTexto
                valor={valor}
                onChange={onChange}
                areaRef={area}
              />
              <textarea
                ref={area}
                autoFocus
                rows={campo.linhas ?? 4}
                value={valor}
                onChange={(e) => onChange(e.target.value)}
                placeholder={campo.exemplo}
                className={`${classeDeEntrada} leading-relaxed rounded-t-none`}
              />
            </>
          ) : (
            <input
              autoFocus
              type="text"
              value={valor}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                // O modal vive dentro do <form> do conteúdo. Sem isto, Enter
                // aqui criaria o conteúdo inteiro no meio da edição de um
                // acessório — com o modal ainda aberto por cima.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onClose();
                }
              }}
              placeholder={campo.exemplo}
              className={classeDeEntrada}
            />
          )}

          {mostraHashtags && (
            <p
              className={`text-[11px] ${
                passouDasHashtags
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              <span className="font-semibold">
                {hashtags} de {tetoDeHashtags} hashtags
              </span>{' '}
              — as do primeiro comentário somam com as da legenda.
            </p>
          )}

          {campo.ajuda && (
            <p className="text-[11px] text-slate-400">{campo.ajuda}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          {/* O valor já foi para o formulário a cada tecla; este botão só
              fecha. Chamá-lo de "Salvar" prometeria uma gravação que só
              acontece quando o conteúdo inteiro é criado. */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
