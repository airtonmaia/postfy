import React, { useMemo } from 'react';
import { Grid3X3, Film, Layers, ImageOff } from 'lucide-react';
import type { Client, Job } from '../../types';
import { Avatar } from '../common/Avatar';
import { urlDeExibicao } from '../../lib/midiaDoDrive';
import { feedDoCliente } from '../../lib/feedDoInstagram';
import { safeDateFormat } from '../../lib/utils';

/**
 * Como o perfil vai ficar.
 *
 * O cliente aprova **uma peça de cada vez**, e o perfil dele não é uma peça de
 * cada vez: é o conjunto, lido de relance. Duas artes escuras seguidas, três
 * fundos iguais na mesma linha, a foto que some ao lado da vizinha — nada
 * disso aparece na tela de aprovação, e aparece no dia em que as três estão
 * publicadas, quando não volta.
 *
 * A agência já tinha essa simulação (`InstagramGridModal`); o cliente, que é
 * quem aprova, não tinha.
 *
 * **Duas coisas do simulador da agência não vieram junto, de propósito:**
 *
 * - **os números de seguidores e seguindo.** Lá eles são `14.8k` e `482`
 *   escritos à mão, e num painel interno isso passa como enfeite de maquete.
 *   Aqui não: o cliente conhece o número dele, e ver um inventado no próprio
 *   portal é a tela afirmando o que não mediu — na frente de quem sabe a
 *   resposta. O que dá para contar é a quantidade de peças, e é só ela que
 *   aparece.
 * - **o `@` derivado do nome.** `@cristianneserafimdasilvafeuser` sai de
 *   `nome.toLowerCase()`, e quase nunca é o arroba de verdade. Um perfil que
 *   mostra o identificador errado ao próprio dono não é maquete, é erro.
 */

interface Props {
  cliente: Client;
  /** Já recortados para este cliente; o filtro do feed acontece aqui dentro. */
  jobs: Job[];
  aoEscolher: (job: Job) => void;
}

export const FeedDoInstagram: React.FC<Props> = ({ cliente, jobs, aoEscolher }) => {
  const pecas = useMemo(() => feedDoCliente(jobs), [jobs]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
          Prévia do feed
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
          As artes na ordem em que vão entrar no perfil, da mais recente para a mais
          antiga — como o grid do Instagram mostra. Serve para ver o conjunto antes de
          publicar: cores que brigam, duas peças parecidas lado a lado, uma linha que
          escurece demais. Toque numa arte para abri-la.
        </p>
      </div>

      {/*
        A moldura de celular é a mesma do simulador da agência, e o
        `rounded-[40px]` dela é a exceção nomeada do vocabulário de canto: ela
        imita um objeto físico, não é superfície de interface.

        **Maior que a de lá**, porque o propósito é outro: a agência confere de
        relance uma harmonia que já conhece, e o cliente está decidindo. Num
        grid de três colunas, cada degrau de largura vira três artes maiores.
      */}
      <div className="w-full max-w-md lg:max-w-xl mx-auto bg-white dark:bg-black rounded-[40px] p-4 shadow-2xl border-4 border-slate-800">
        <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-4" />

        <div className="px-2 space-y-4">
          <div className="flex items-center gap-5">
            <div className="rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shrink-0">
              <Avatar
                nome={cliente.name}
                url={cliente.avatar}
                tamanho={72}
                className="border-2 border-white dark:border-black"
              />
            </div>

            <div>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white block leading-tight">
                {pecas.length}
              </span>
              <span className="text-xs text-slate-400">
                {pecas.length === 1 ? 'publicação' : 'publicações'}
              </span>
            </div>
          </div>

          <div>
            <strong className="text-sm font-bold text-slate-900 dark:text-white block">
              {cliente.name}
            </strong>
            {cliente.segment && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                {cliente.segment}
              </p>
            )}
            {cliente.website && (
              <span className="text-xs text-blue-500 font-medium truncate block mt-0.5">
                {cliente.website}
              </span>
            )}
          </div>

          <div className="flex justify-around border-t border-slate-100 dark:border-slate-800 pt-2.5 text-slate-900 dark:text-white">
            <Grid3X3 className="w-5 h-5 text-purple-600 border-b-2 border-purple-600 pb-1" />
            <Film className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            <Layers className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          </div>
        </div>

        {/*
          `gap-0.5` porque o Instagram cola as artes: o respiro entre elas muda
          a leitura do conjunto, que é justamente o que se veio olhar.

          **O quadrado do grid acabou — a miniatura do perfil é 4:5.** Uma
          grade quadrada mostraria um corte que não vai existir: com
          `object-cover`, o topo e a base da arte somem na simulação e voltam
          no perfil de verdade. O erro é do tipo que passa despercebido porque
          *parece* o Instagram — só quem compara com o app vê.

          **E a proporção é da grade, não da peça:** `proporcaoDoCriativo`
          devolveria 9:16 para Reels, e o Instagram não faz isso aqui — ele
          recorta tudo para 4:5 no perfil, capa de Reels inclusive. Reaproveitar
          o helper aqui produziria degraus de altura diferentes que o app não
          tem.
        */}
        <div className="grid grid-cols-3 gap-0.5 mt-3 rounded-b-2xl overflow-hidden">
          {pecas.map((job) => {
            /*
              Peça sem arte é estado normal — a pauta entra antes da imagem
              existir, e é isso que o quadrado vazio conta. Pôr foto de banco
              aqui faria a prévia mostrar uma arte que ninguém aprovou.
            */
            const arte = job.mediaUrls?.[0];

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => aoEscolher(job)}
                aria-label={`Abrir ${job.title}`}
                className="aspect-[4/5] relative group overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:z-10"
              >
                {arte ? (
                  <img
                    src={urlDeExibicao(arte)}
                    alt={job.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <ImageOff className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  </span>
                )}

                {/* O selo de formato é o do Instagram: ele diz por que uma
                    arte vai se mexer no perfil e a vizinha não. */}
                {(job.format === 'carousel' || job.format === 'reel') && (
                  <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/55 text-white backdrop-blur-xs">
                    {job.format === 'carousel' ? (
                      <Layers className="w-3 h-3" />
                    ) : (
                      <Film className="w-3 h-3" />
                    )}
                  </span>
                )}

                {/*
                  A data aparece no hover, e não fixa sobre a arte: ela é a
                  informação de quem está conferindo o calendário, e uma tarja
                  em cada quadrado suja exatamente a leitura do conjunto que
                  esta tela existe para dar.
                */}
                <span className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/75 to-transparent text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition">
                  {safeDateFormat(job.scheduledDate, { day: '2-digit', month: '2-digit' })}
                </span>
              </button>
            );
          })}
        </div>

        {pecas.length === 0 && (
          <div className="py-16 px-6 text-center space-y-2">
            <Grid3X3 className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Nenhuma peça de Instagram na agenda ainda. Assim que a agência montar as
              primeiras, elas aparecem aqui na ordem em que vão ao ar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
