import React, { useEffect, useState } from 'react';
import {
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2, Layers,
  ChevronLeft, ChevronRight, Smartphone, Monitor as MonitorIcon,
} from 'lucide-react';
import { Instagram, Facebook, Linkedin, Youtube, Twitter, Music2 } from 'lucide-react';
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
  /**
   * As redes escolhidas em "Selecione canais" — e só elas.
   *
   * Mostrar aba de rede que não foi escolhida seria prever uma publicação
   * que não vai acontecer. Hoje a escolha é de uma rede só, então a barra
   * vem com uma aba; a lista já existe para quando forem várias.
   */
  canais: JobPlatform[];
  /** Todas as artes: o carrossel precisa navegar entre elas. */
  artes: string[];
  legenda: string;
  localizacao?: string;
  /** Data do agendamento, já formatada. Real — não é "Há 1 dia" de mockup. */
  dataPrevista?: string;
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

const ICONE_DA_REDE: Record<JobPlatform, React.FC<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music2,
  youtube: Youtube,
  twitter: Twitter,
};

const NOME_DA_REDE: Record<JobPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
};

/**
 * A prévia em celular ou computador.
 *
 * Mobile é o principal — é onde quase todo mundo vê —, mas no LinkedIn e no
 * YouTube o desktop é comum o bastante para valer a conferida: a mesma
 * legenda quebra em lugares diferentes nas duas larguras.
 */
type Dispositivo = 'mobile' | 'desktop';

const LARGURA: Record<Dispositivo, string> = {
  mobile: 'max-w-[320px]',
  desktop: 'max-w-[520px]',
};

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
  const canais = dados.canais.length ? dados.canais : (['instagram'] as JobPlatform[]);
  const [canalAtivo, setCanalAtivo] = useState<JobPlatform>(canais[0]);
  const [indice, setIndice] = useState(0);
  const [dispositivo, setDispositivo] = useState<Dispositivo>('mobile');
  const [pagina, setPagina] = useState(0);

  // Tirar um canal da seleção não pode deixar a prévia num canal que já não
  // existe: ela cairia numa aba invisível.
  useEffect(() => {
    if (!canais.includes(canalAtivo)) setCanalAtivo(canais[0]);
  }, [canais, canalAtivo]);

  const quadros = QUADROS_POR_REDE[canalAtivo] || QUADROS_POR_REDE.instagram;
  const artes = dados.artes.filter(Boolean);
  const total = Math.max(artes.length, 1);

  // Volta ao primeiro quadro quando a rede muda, senão o índice 1 do Instagram
  // sobreviveria numa rede que só tem um quadro e a tela ficaria vazia.
  useEffect(() => setIndice(0), [canalAtivo]);

  // Apagar a última arte deixaria a página apontando para o que não existe.
  useEffect(() => {
    setPagina((p) => Math.min(p, total - 1));
  }, [total]);

  const quadro = quadros[Math.min(indice, quadros.length - 1)];
  const IconeDaRede = ICONE_DA_REDE[canalAtivo];
  const perfil = dados.nomeDoPerfil || 'sua marca';
  const ehStory = quadro.chave === 'story';

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-bold text-slate-900 dark:text-white">Prévia</span>

        <div className="flex items-center gap-1">
          {/* Celular ou computador: a mesma legenda quebra em pontos
              diferentes nas duas larguras. */}
            {([
              { valor: 'mobile' as const, Icone: Smartphone, rotulo: 'Celular' },
              { valor: 'desktop' as const, Icone: MonitorIcon, rotulo: 'Computador' },
            ]).map(({ valor, Icone, rotulo }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setDispositivo(valor)}
                title={rotulo}
                aria-label={rotulo}
                aria-pressed={dispositivo === valor}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                  dispositivo === valor
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icone className="w-3.5 h-3.5" />
              </button>
            ))}
        </div>
      </div>

      {/* Abas de rede: só as escolhidas em canais. */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {canais.map((canal) => {
          const Icone = ICONE_DA_REDE[canal];
          const ativo = canal === canalAtivo;
          return (
            <button
              key={canal}
              type="button"
              onClick={() => setCanalAtivo(canal)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px transition whitespace-nowrap cursor-pointer ${
                ativo
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {Icone && <Icone className="w-3.5 h-3.5" />}
              {NOME_DA_REDE[canal]}
            </button>
          );
        })}
      </div>

      {/* Enquadramento: a mesma arte corta diferente no feed e no story. */}
      {quadros.length > 1 && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {quadros.map((q, i) => (
            <button
              key={q.chave}
              type="button"
              onClick={() => setIndice(i)}
              className={`flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg transition cursor-pointer ${
                i === indice
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {q.rotulo}
            </button>
          ))}
        </div>
      )}

      <div className={`mx-auto w-full ${LARGURA[dispositivo]} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs`}>
        {/* Cabeçalho do perfil */}
        <div className="flex items-center gap-2.5 p-3">
          <Avatar nome={perfil} url={dados.avatar} tamanho={32} formato="circulo" />
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
              {perfil}
            </span>
            {/* A localização ocupa a linha de baixo do perfil, como na rede. */}
            <span className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
              {dados.localizacao ? (
                dados.localizacao
              ) : (
                <>
                  {IconeDaRede && <IconeDaRede className="w-3 h-3" />}
                  {quadro.rotulo}
                </>
              )}
            </span>
          </div>
          <MoreHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="relative">
          <Arte url={artes[pagina]} proporcao={quadro.proporcao} />

          {/* Carrossel: sem poder virar a página, a prévia só mostrava a
              primeira arte — e é justamente a terceira que costuma estar
              com a proporção errada. */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPagina((p) => (p - 1 + total) % total)}
                aria-label="Arte anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900/80 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPagina((p) => (p + 1) % total)}
                aria-label="Próxima arte"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900/80 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="absolute top-2 right-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/70 text-white">
                {pagina + 1} / {total}
              </span>
            </>
          )}
        </div>

        {/* Story não tem barra de ações nem legenda embaixo: o texto vai por
            cima da arte, e reproduzir a barra do feed ali enganaria. */}
        {!ehStory && (
          <>
            {/* Bolinhas do carrossel, entre a arte e as ações, como na rede. */}
            {total > 1 && (
              <div className="flex items-center justify-center gap-1 pt-2">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      i === pagina ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 px-3 pt-3 text-slate-700 dark:text-slate-300">
              {canalAtivo === 'facebook' ? (
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

            <div className="px-3 pb-3 pt-2 space-y-1">
              {/*
                Moldura da rede, não dado do post.

                A linha de curtidas e a de comentários são desenho: é o que
                faz o quadro ser lido como Instagram em vez de como um card
                genérico. Nenhum número sai daqui — não existe post publicado
                para ter métrica, e um "436 curtidas" no meio da prévia seria
                lido como promessa na frente do cliente.
              */}
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Curtido por <strong className="font-bold text-slate-900 dark:text-white">sua audiência</strong> e outras pessoas
              </span>

              {dados.legenda.trim() ? (
                <>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-3">
                    <span className="font-bold text-slate-900 dark:text-white">{perfil} </span>
                    {dados.legenda}
                  </p>
                  {/* "Ver mais" aparece quando a rede vai cortar de verdade.
                      O Instagram corta por volta de 125 caracteres. */}
                  {dados.legenda.length > 125 && (
                    <span className="block text-[11px] text-slate-400">Ver mais</span>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  A legenda aparece aqui conforme você escreve.
                </p>
              )}

              <span className="block text-[11px] text-slate-400">
                Ver todos os comentários
              </span>

              {/* A data é a do agendamento — esta é real, vem do formulário. */}
              {dados.dataPrevista && (
                <span className="block text-[10px] uppercase tracking-wide text-slate-400 pt-0.5">
                  {dados.dataPrevista}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
