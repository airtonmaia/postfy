import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronUp } from 'lucide-react';

import type { Job } from '../../types';
import { buscarEtapasDoJob } from '../../lib/db';
import { duracaoLegivel, type EventoDeEtapa } from '../../lib/historicoDeEtapas';
import { corDaEtapa, etapasDoFluxo } from '../../lib/fluxoDeProducao';
import { usePostfy } from '../../context/PostfyContext';
import { IconeDaEtapa } from '../common/IconeDaEtapa';

/**
 * Por onde a peça já passou e onde ela está — a régua no topo da peça.
 *
 * O seletor de etapa responde *onde ela está*; ele não responde **por onde ela
 * passou**, que é a pergunta de quem abre uma peça atrasada. A trilha mostra as
 * duas coisas de relance, com o ícone e a cor que a agência escolheu para cada
 * etapa em Configurações → Conteúdos.
 *
 * ### Recolhida ela continua respondendo, com uma linha
 *
 * A primeira versão sumia por inteiro quando recolhida, e sobrava um botão
 * "Ver fluxo" sozinho: quem recolheu perdia junto a resposta mais usada da
 * régua — *em que etapa isto está?* —, e a faixa virava um controle que não
 * informa nada. Recolhida ela diz a etapa atual e **há quanto tempo a peça
 * está nela**, que é o número que decide a conversa com o cliente.
 *
 * O tempo sai do histórico, nunca de `updated_at`: aquela coluna é a última
 * edição de qualquer campo, inclusive de uma vírgula na legenda. Sem linha no
 * histórico — o acervo anterior ao registro — a faixa mostra só a etapa, **sem
 * número nenhum**. É a regra de `post_metrics`: nulo é "não medi".
 *
 * ### Ela não muda a etapa, e isso foi escolhido
 *
 * Uma régua larga com sete alvos clicáveis, logo acima do conteúdo, convida ao
 * clique errado — e dois desses alvos têm consequência: "Agendado" põe a peça
 * na fila de publicação, e "Publicado" carimba a data. Quem move continua
 * sendo o seletor da coluna de gestão e os botões do rodapé, que são
 * deliberados.
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
export const TrilhaDeEtapas: React.FC<{
  job: Job;
  aberta: boolean;
  aoAlternar: () => void;
}> = ({ job, aberta, aoAlternar }) => {
  const { currentWorkspace } = usePostfy();

  /* Todos os hooks antes de qualquer `return` — armadilha 8.1. */
  const [eventos, setEventos] = useState<EventoDeEtapa[] | null>(null);

  /*
    A busca depende de `job.status` além do `job.id`: mover a peça pelo seletor
    da coluna de gestão tem de acender a etapa nova na trilha, senão a régua e
    o seletor passam a dizer coisas diferentes.
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

  const etapaAtual = etapas.find((e) => e.status === job.status);

  /**
   * Há quanto tempo a peça está onde está — ou nada, quando ninguém mediu.
   *
   * A entrada é a **última** linha do histórico com a etapa de agora: uma peça
   * que voltou para ajuste duas vezes tem duas, e a primeira diria um tempo que
   * não é o da estadia atual.
   */
  const entradaNaEtapa = (eventos ?? [])
    .filter((e) => e.status === job.status)
    .map((e) => Date.parse(e.entrouEm))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const tempoNaEtapa = entradaNaEtapa ? duracaoLegivel(Date.now() - entradaNaEtapa) : null;

  if (!aberta) {
    const cor = etapaAtual ? corDaEtapa(etapaAtual.cor) : null;

    return (
      <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2">
        {etapaAtual && cor && (
          <>
            <span
              className={`w-7 h-7 rounded-full inline-flex items-center justify-center border shrink-0 ${cor.caixa} ${cor.borda}`}
            >
              <IconeDaEtapa chave={etapaAtual.icone} className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Etapa:{' '}
              <strong className="font-bold text-slate-900 dark:text-white">
                {etapaAtual.rotulo}
              </strong>
            </span>
          </>
        )}

        {/* O número só aparece quando o histórico tem a linha: "há 0m nesta
            etapa" numa peça anterior ao registro seria a tela afirmando uma
            medição que não existe. */}
        {tempoNaEtapa && (
          <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            há {tempoNaEtapa} nesta etapa
          </span>
        )}

        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={false}
          className="ml-auto shrink-0 text-[11px] font-semibold text-purple-600 dark:text-purple-300 hover:text-purple-700 transition cursor-pointer inline-flex items-center gap-1"
        >
          Ver fluxo completo
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end px-4 sm:px-6 pt-2 -mb-1">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded
          /* Afordância pequena e discreta: ela não disputa com o conteúdo, e o
             rótulo diz para onde o clique leva. */
          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-purple-600 transition cursor-pointer inline-flex items-center gap-1"
        >
          Ocultar fluxo
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>

      {/*
        `py-2` no container que rola: o `ring` da etapa atual é desenhado
        **fora** da caixa, e `overflow-x-auto` liga o recorte vertical junto —
        sem o respiro, o anel sai aparado. Mesma lição da faixa de clientes do
        quadro.
      */}
      <div className="flex items-center gap-0 overflow-x-auto no-scrollbar px-4 sm:px-6 py-2">
        {etapas.map((etapa, i) => {
          const cor = corDaEtapa(etapa.cor);
          const atual = etapa.status === job.status;
          const feita = !atual && percorridas.has(etapa.status);

          return (
            <React.Fragment key={etapa.status}>
              {i > 0 && (
                /*
                  O traço entre as bolinhas acende só quando a etapa anterior
                  foi percorrida: linha cheia de ponta a ponta diria que a peça
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
    </div>
  );
};
