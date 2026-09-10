import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2, Layers } from 'lucide-react';
import { Instagram, Facebook, Linkedin } from 'lucide-react';
import type { JobPlatform } from '../../types';
import { Avatar } from './Avatar';

/**
 * Como a publicação vai aparecer na rede.
 *
 * Serve para responder antes de publicar a pergunta que hoje só a captura de
 * tela responde: a arte corta na proporção do feed? A legenda cabe? O nome do
 * perfil é o do cliente certo?
 *
 * **Tudo aqui é dado real do formulário** — cliente, arte, legenda. Números de
 * curtida e comentário não existem e por isso não aparecem: inventar "50
 * comentários" numa prévia é a armadilha 9 em miniatura, com o agravante de
 * que a agência mostra esta tela para o cliente.
 */

export interface DadosDaPrevia {
  nomeDoPerfil: string;
  avatar?: string;
  plataforma: JobPlatform;
  arte?: string;
  legenda: string;
}

/** Um quadro do slide: a mesma publicação em um enquadramento da rede. */
interface Quadro {
  chave: string;
  rotulo: string;
  proporcao: string;
}

/**
 * Os enquadramentos que vale a pena conferir em cada rede.
 *
 * Instagram tem dois porque a mesma arte é cortada de formas diferentes no
 * feed e no story — é exatamente aí que a arte perde a cabeça de alguém.
 */
const QUADROS_POR_REDE: Record<JobPlatform, Quadro[]> = {
  instagram: [
    { chave: 'feed', rotulo: 'Feed', proporcao: 'aspect-[4/5]' },
    { chave: 'story', rotulo: 'Story', proporcao: 'aspect-[9/16]' },
  ],
  facebook: [{ chave: 'feed', rotulo: 'Feed', proporcao: 'aspect-[4/5]' }],
  linkedin: [{ chave: 'feed', rotulo: 'Feed', proporcao: 'aspect-[4/5]' }],
  tiktok: [{ chave: 'video', rotulo: 'Vídeo', proporcao: 'aspect-[9/16]' }],
  youtube: [{ chave: 'video', rotulo: 'Vídeo', proporcao: 'aspect-video' }],
  twitter: [{ chave: 'feed', rotulo: 'Post', proporcao: 'aspect-video' }],
};

const ICONE_DA_REDE: Partial<Record<JobPlatform, React.FC<{ className?: string }>>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

const TROCA_DE_QUADRO_MS = 4000;

const Arte: React.FC<{ url?: string; proporcao: string }> = ({ url, proporcao }) => (
  <div className={`${proporcao} w-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center`}>
    {url ? (
      <img src={url} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="flex flex-col items-center gap-1.5 text-slate-400">
        <Layers className="w-7 h-7" />
        <span className="text-[11px]">A arte aparece aqui</span>
      </div>
    )}
  </div>
);

export const PreviaDaRede: React.FC<{ dados: DadosDaPrevia; className?: string }> = ({
  dados,
  className = '',
}) => {
  const quadros = QUADROS_POR_REDE[dados.plataforma] || QUADROS_POR_REDE.instagram;
  const [indice, setIndice] = useState(0);

  // Volta ao primeiro quadro quando a rede muda, senão o índice 1 do Instagram
  // sobreviveria numa rede que só tem um quadro e a tela ficaria vazia.
  useEffect(() => setIndice(0), [dados.plataforma]);

  useEffect(() => {
    if (quadros.length < 2) return;
    const relogio = setInterval(
      () => setIndice((i) => (i + 1) % quadros.length),
      TROCA_DE_QUADRO_MS
    );
    return () => clearInterval(relogio);
  }, [quadros.length]);

  const quadro = quadros[Math.min(indice, quadros.length - 1)];
  const IconeDaRede = ICONE_DA_REDE[dados.plataforma];
  const perfil = dados.nomeDoPerfil || 'sua marca';
  const ehStory = quadro.chave === 'story';

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Prévia
        </span>
        {quadros.length > 1 && (
          <div className="flex items-center gap-1.5">
            {quadros.map((q, i) => (
              <button
                key={q.chave}
                type="button"
                onClick={() => setIndice(i)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer ${
                  i === indice
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {q.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Cabeçalho do perfil */}
        <div className="flex items-center gap-2.5 p-3">
          <Avatar nome={perfil} url={dados.avatar} tamanho={32} formato="circulo" />
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
              {perfil}
            </span>
            {IconeDaRede && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <IconeDaRede className="w-3 h-3" />
                {quadro.rotulo}
              </span>
            )}
          </div>
          <MoreHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <Arte url={dados.arte} proporcao={quadro.proporcao} />

        {/* Story não tem barra de ações nem legenda embaixo: o texto vai por
            cima da arte, e reproduzir a barra do feed ali enganaria. */}
        {!ehStory && (
          <>
            <div className="flex items-center gap-4 px-3 pt-3 text-slate-700 dark:text-slate-300">
              {dados.plataforma === 'facebook' ? (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  <MessageCircle className="w-4 h-4" />
                  <Share2 className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4" />
                  <MessageCircle className="w-4 h-4" />
                  <Send className="w-4 h-4" />
                  <Bookmark className="w-4 h-4 ml-auto" />
                </>
              )}
            </div>

            <div className="px-3 pb-3 pt-2">
              {dados.legenda.trim() ? (
                <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-6">
                  <span className="font-bold text-slate-900 dark:text-white">{perfil} </span>
                  {dados.legenda}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  A legenda aparece aqui conforme você escreve.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
