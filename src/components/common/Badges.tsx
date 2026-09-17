import React from 'react';
import {
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Twitter,
  Video,
  Layers,
  Image as ImageIcon,
  FileText,
  Smartphone,
  PenLine,
  Clapperboard,
} from 'lucide-react';

import { JobPlatform, JobFormat, JobStatus, JobPriority, JobTipo } from '../../types';
import { Badge, PontoDoBadge, type TomDoBadge } from '../ui/badge';

/**
 * Os selos do domínio: rede, formato, tipo, status e prioridade.
 *
 * **O desenho é do `Badge`; aqui mora só o significado.** Cada selo era um
 * `<span>` com a própria string de classe, e entre os cinco havia três
 * paddings, quatro fontes e dois raios — lado a lado no cabeçalho do conteúdo
 * isso vira uma pílula, um retângulo arredondado e um rótulo sem borda, em
 * quatro alturas. As cores continuam **as mesmas**; o que mudou foi de onde a
 * caixa vem.
 *
 * Nenhum componente daqui escreve padding, altura, fonte ou canto. Se
 * precisar, o lugar é `src/components/ui/badge.tsx` — e aí muda para todos de
 * uma vez, que é o ponto.
 */

const REDES: Record<
  JobPlatform,
  { rotulo: string; tom: TomDoBadge; Icone: React.FC<{ className?: string }>; corDoIcone: string }
> = {
  instagram: { rotulo: 'Instagram', tom: 'rosa', Icone: Instagram, corDoIcone: 'text-pink-600 dark:text-pink-400' },
  linkedin: { rotulo: 'LinkedIn', tom: 'ceu', Icone: Linkedin, corDoIcone: 'text-sky-600 dark:text-sky-400' },
  tiktok: { rotulo: 'TikTok', tom: 'escuro', Icone: Video, corDoIcone: 'text-pink-400' },
  youtube: { rotulo: 'YouTube', tom: 'vermelho', Icone: Youtube, corDoIcone: 'text-red-600 dark:text-red-400' },
  facebook: { rotulo: 'Facebook', tom: 'azul', Icone: Facebook, corDoIcone: 'text-blue-600 dark:text-blue-400' },
  twitter: { rotulo: 'X / Twitter', tom: 'neutro', Icone: Twitter, corDoIcone: 'text-slate-700 dark:text-slate-300' },
};

export const PlatformBadge: React.FC<{
  platform: JobPlatform;
  showLabel?: boolean;
  className?: string;
}> = ({ platform, showLabel = true, className }) => {
  const r = REDES[platform];
  if (!r) return null;

  const { Icone } = r;
  return (
    <Badge tom={r.tom} className={className}>
      <Icone className={r.corDoIcone} />
      {showLabel && r.rotulo}
    </Badge>
  );
};

const FORMATOS: Record<JobFormat, { rotulo: string; tom: TomDoBadge; icone: React.ReactNode }> = {
  carousel: { rotulo: 'Carrossel', tom: 'ambar', icone: <Layers /> },
  reel: { rotulo: 'Reel', tom: 'roxo', icone: <Video /> },
  story: { rotulo: 'Story', tom: 'esmeralda', icone: <Smartphone /> },
  feed: { rotulo: 'Feed', tom: 'azul', icone: <ImageIcon /> },
  /**
   * Duas saídas, um selo. Ele herda o azul do feed de propósito: a peça é um
   * post de feed que **também** vai ao story, e dar cor nova a ela faria o
   * quadro parecer ter um tipo de conteúdo a mais do que tem.
   */
  feed_story: { rotulo: 'Feed + Story', tom: 'azul', icone: <Layers /> },
  video: { rotulo: 'Vídeo Longo', tom: 'rubi', icone: <Video /> },
  article: { rotulo: 'Artigo', tom: 'neutro', icone: <FileText /> },
};

/**
 * `rotulo` troca só o texto, nunca a cor nem o ícone.
 *
 * A mesma coisa tem nome diferente em cada rede: vídeo curto é "Reels" no
 * Instagram e "Short" no YouTube, e é isso que `lib/formatos.ts` guarda. Sem
 * esta porta, o menu que troca o formato na modal de detalhe mostrava "Reel"
 * enquanto a tela de cadastro, do lado, oferecia "Reels" — a mesma escolha com
 * dois nomes, e nenhuma das duas telas errada sozinha.
 */
export const FormatBadge: React.FC<{ format: JobFormat; rotulo?: string }> = ({
  format,
  rotulo,
}) => {
  const c = FORMATOS[format] || FORMATOS.feed;
  return (
    <Badge tom={c.tom}>
      {c.icone}
      {rotulo ?? c.rotulo}
    </Badge>
  );
};

const TIPOS: Record<JobTipo, { rotulo: string; tom: TomDoBadge; icone: React.ReactNode }> = {
  conteudo: { rotulo: 'Conteúdo', tom: 'neutro', icone: <ImageIcon /> },
  copy: { rotulo: 'Copy', tom: 'indigo', icone: <PenLine /> },
  roteiro: { rotulo: 'Roteiro', tom: 'turquesa', icone: <Clapperboard /> },
};

/**
 * O que está sendo aprovado: conteúdo, copy ou roteiro.
 *
 * Sem este selo, um card de copy e um de arte pronta ficam idênticos no
 * quadro — e a diferença é justamente o que o cliente vai olhar.
 */
export const TipoBadge: React.FC<{ tipo: JobTipo }> = ({ tipo }) => {
  const c = TIPOS[tipo] || TIPOS.conteudo;
  return (
    <Badge tom={c.tom}>
      {c.icone}
      {c.rotulo}
    </Badge>
  );
};

const STATUS: Record<JobStatus, { rotulo: string; tom: TomDoBadge; ponto: string }> = {
  ideas: { rotulo: 'Ideias', tom: 'neutro', ponto: 'bg-slate-400' },
  in_production: { rotulo: 'Em Produção', tom: 'azul', ponto: 'bg-blue-500' },
  for_approval: { rotulo: 'Para Aprovação', tom: 'ambar', ponto: 'bg-amber-500' },
  in_adjustment: { rotulo: 'Em Ajuste', tom: 'rubi', ponto: 'bg-rose-500 animate-pulse' },
  approved: { rotulo: 'Aprovado', tom: 'esmeralda', ponto: 'bg-emerald-500' },
  scheduled: { rotulo: 'Agendado', tom: 'roxo', ponto: 'bg-purple-500' },
  published: { rotulo: 'Publicado', tom: 'turquesa', ponto: 'bg-teal-600' },
};

/**
 * O `size` saiu.
 *
 * Ele tinha dois valores e um só era usado fora do padrão — e era justamente
 * ele que produzia o quarto tamanho de fonte (`text-[10px]`) e a quinta
 * altura. Um selo menor que o vizinho, na mesma linha, não comunica nada além
 * de descuido.
 */
export const StatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => {
  const c = STATUS[status] || STATUS.ideas;
  return (
    <Badge tom={c.tom}>
      <PontoDoBadge className={c.ponto} />
      {c.rotulo}
    </Badge>
  );
};

const PRIORIDADES: Record<JobPriority, { rotulo: string; tom: TomDoBadge }> = {
  low: { rotulo: 'Baixa', tom: 'neutro' },
  medium: { rotulo: 'Média', tom: 'azul' },
  high: { rotulo: 'Alta', tom: 'ambar' },
  urgent: { rotulo: 'Urgente', tom: 'rubi' },
};

/**
 * O nome da prioridade, para quem precisa do texto sem a caixa — o menu que
 * troca a prioridade na modal de detalhe. Sai daqui porque é aqui que ele já
 * existia; uma segunda tradução viraria "Média" num lado e "Media" no outro.
 */
export const rotuloDaPrioridade = (priority: JobPriority): string =>
  (PRIORIDADES[priority] || PRIORIDADES.medium).rotulo;

export const PriorityBadge: React.FC<{ priority: JobPriority }> = ({ priority }) => {
  const c = PRIORIDADES[priority] || PRIORIDADES.medium;
  // `uppercase` fica: prioridade é o único selo que se lê como etiqueta, e é
  // ela que precisa saltar num cabeçalho cheio de selos.
  return (
    <Badge tom={c.tom} className="uppercase tracking-wide">
      {c.rotulo}
    </Badge>
  );
};

/**
 * A versão do conteúdo — "v1", "v2".
 *
 * Estava escrito à mão no cabeçalho da modal, com `font-mono`, `text-xs` e
 * `rounded-md` próprios: o sétimo desenho de selo, na mesma linha dos outros
 * seis. Virou componente porque é selo, e selo tem um desenho só.
 */
export const VersaoBadge: React.FC<{ versao: number }> = ({ versao }) => (
  <Badge tom="neutro" className="font-mono">
    v{versao}
  </Badge>
);
