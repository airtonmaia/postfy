import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import type { Job } from '../../types';
import { buscarEtapasDoJob } from '../../lib/db';
import type { EventoDeEtapa } from '../../lib/historicoDeEtapas';
import { corDaEtapa, etapasDoFluxo } from '../../lib/fluxoDeProducao';
import { usePostfy } from '../../context/PostfyContext';
import { IconeDaEtapa } from '../common/IconeDaEtapa';

/**
 * Por onde a peça já passou e onde ela está — a régua no topo da peça.
 *
 * O seletor de etapa do cabeçalho responde *onde ela está*; ele não responde
 * **por onde ela passou**, que é a pergunta de quem abre uma peça atrasada. A
 * trilha mostra as duas coisas de relance, com o ícone e a cor que a agência
 * escolheu para cada etapa em Configurações → Conteúdos.
 *
 * ### Ela não muda a etapa, e isso foi escolhido
 *
 * Uma régua larga com sete alvos clicáveis, logo acima do conteúdo, convida ao
 * clique errado — e dois desses alvos têm consequência: "Agendado" põe a peça
 * na fila de publicação, e "Publicado" carimba a data. Quem move continua
 * sendo o seletor do cabeçalho e os botões de workflow, que são deliberados.
 *
 * ### O que é marcado como percorrido sai do histórico, nunca da ordem
 *
 * A saída fácil é pintar como "feito" tudo que vem antes da etapa atual na
 * ordem do fluxo. Ela mente no caso que mais importa: uma peça que pulou de
 * Ideias direto para Aprovação apareceria com "Produção" concluída — a tela
 * afirmando um trabalho que ninguém fez.
 *
 * Quem sabe de verdade é `historico_de_etapas`, que guarda uma linha por
 * entrada em etapa. Peça anterior ao registro não tem linha nenhuma: aí a
 * trilha mostra só onde a peça está, **sem nenhum visto**, que é o honesto —
 * é a mesma decisão de não fazer backfill daquela tabela.
 */
export const TrilhaDeEtapas: React.FC<{ job: Job }> = ({ job }) => {
  const { currentWorkspace } = usePostfy();

  /* Todos os hooks antes de qualquer `return` — armadilha 8.1. */
  const [eventos, setEventos] = useState<EventoDeEtapa[] | null>(null);

  /*
    A busca depende de `job.status` além do `job.id`: mover a peça pelo seletor
    do cabeçalho tem de acender a etapa nova na trilha, senão o cabeçalho e a
    régua logo abaixo passam a dizer coisas diferentes.
  */
  useEffect(() => {
    let vivo = true;
    void buscarEtapasDoJob(job.id)
      .then((linhas) => vivo && setEventos(linhas))
      /*
        **Falha de leitura vira "não sei", nunca "não passou por nada".** Sem
        este `[]`, um erro de rede deixaria a trilha pendurada em `null` para
        sempre; com ele, ela desenha o fluxo e a etapa atual, que é o que a
        peça sem histórico também mostra. Erro aqui não merece faixa: a
        resposta completa está na aba Revisões, que tem a dela.
      */
      .catch(() => vivo && setEventos([]));
    return () => {
      vivo = false;
    };
  }, [job.id, job.status]);

  const etapas = etapasDoFluxo(currentWorkspace.fluxoDeProducao);
  const percorridas = new Set((eventos ?? []).map((e) => e.status));

  return (
    /*
      `py-1` no container que rola: o `ring` da etapa atual é desenhado **fora**
      da caixa, e `overflow-x-auto` liga o recorte vertical junto — sem o
      respiro, o anel sai aparado. Mesma lição da faixa de clientes do quadro.
    */
    <div className="flex items-center gap-0 overflow-x-auto no-scrollbar px-4 sm:px-6 py-2">
      {etapas.map((etapa, i) => {
        const cor = corDaEtapa(etapa.cor);
        const atual = etapa.status === job.status;
        const feita = !atual && percorridas.has(etapa.status);

        return (
          <React.Fragment key={etapa.status}>
            {i > 0 && (
              /*
                O traço entre as bolinhas acende só quando a etapa anterior foi
                percorrida: linha cheia de ponta a ponta diria que a peça
                andou por tudo.
              */
              <span
                aria-hidden
                className={`h-px flex-1 min-w-4 ${
                  percorridas.has(etapas[i - 1].status)
                    ? 'bg-emerald-400 dark:bg-emerald-700'
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            )}

            <span
              className="flex flex-col items-center gap-1 shrink-0 w-16"
              title={
                atual
                  ? `A peça está em ${etapa.rotulo}`
                  : feita
                    ? `Já passou por ${etapa.rotulo}`
                    : etapa.rotulo
              }
            >
              <span
                className={`w-7 h-7 rounded-full inline-flex items-center justify-center border shrink-0 ${
                  atual
                    ? `${cor.caixa} ${cor.borda} ring-2 ring-offset-2 ring-purple-600 dark:ring-offset-slate-900`
                    : feita
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                {feita ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <IconeDaEtapa chave={etapa.icone} className="w-3.5 h-3.5" />
                )}
              </span>

              <span
                className={`text-[10px] leading-tight text-center truncate w-full ${
                  atual
                    ? 'font-bold text-slate-900 dark:text-white'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                {etapa.rotulo}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
