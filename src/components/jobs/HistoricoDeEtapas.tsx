import React, { useEffect, useState } from 'react';
import { History, AlertCircle, Bot, UserCheck } from 'lucide-react';

import type { Job } from '../../types';
import { buscarEtapasDoJob } from '../../lib/db';
import {
  duracaoLegivel,
  linhaDoTempo,
  type AcontecimentoDoConteudo,
  type EventoDeEtapa,
  type LinhaDoTempo,
} from '../../lib/historicoDeEtapas';
import { estourouOSla, etapasDoFluxo } from '../../lib/fluxoDeProducao';
import { usePostfy } from '../../context/PostfyContext';
import { dataCompacta, safeDateTimeFormat, safeTimeFormat } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import { Badge } from '../ui/badge';

/**
 * A linha do tempo da peça: quem mexeu, quando, e quanto ela ficou parada.
 *
 * **Ela mora na aba Revisões, junto da conversa e das versões**, e isso é a
 * decisão central. "Histórico" tinha duas respostas no produto — o que o
 * cliente pediu e o que a equipe entregou de um lado, por onde a peça passou
 * do outro — e cada uma conta metade da mesma história. A v2 existe porque o
 * cliente pediu ajuste no dia 3; o tempo parado em aprovação explica por que o
 * ajuste só veio no dia 7. Separadas, nenhuma das duas responde "por que esta
 * peça demorou".
 *
 * É a mesma lição das duas listas em Arquivos e das cinco abas que viraram
 * três: duas telas para a mesma pergunta fazem a de baixo ser a que ninguém
 * abre.
 *
 * ### A busca é sob demanda
 *
 * Os eventos não entram na carga inicial nem na persistência por diff — ver
 * `buscarEtapasDoJob`. O efeito depende de `job.status` além do `job.id`:
 * mover a peça pelo seletor da própria modal tem de redesenhar a linha, senão
 * a tela mostra a etapa nova no cabeçalho e a antiga como "em andamento" logo
 * abaixo.
 */

/** O marcador de quem fez — foto da pessoa, ou o ícone de quem não é pessoa. */
const Autor: React.FC<{ acontecimento: AcontecimentoDoConteudo }> = ({ acontecimento }) => {
  if (acontecimento.origem === 'equipe' && acontecimento.porNome) {
    return <Avatar nome={acontecimento.porNome} tamanho={18} />;
  }

  const Icone = acontecimento.origem === 'sistema' ? Bot : UserCheck;
  return (
    <span className="w-[18px] h-[18px] rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
      <Icone className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
    </span>
  );
};

export const HistoricoDeEtapas: React.FC<{ job: Job }> = ({ job }) => {
  /* Todos os hooks antes de qualquer `return` — armadilha 8.1. */
  const { currentWorkspace } = usePostfy();
  const [eventos, setEventos] = useState<EventoDeEtapa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setErro(null);

    buscarEtapasDoJob(job.id)
      .then((linhas) => {
        // Sem a guarda, abrir dois conteúdos em sequência deixa a resposta
        // lenta do primeiro sobrescrever a do segundo — e a tela mostra a
        // linha do tempo da peça errada, sem nada indicando a troca.
        if (vivo) setEventos(linhas);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setEventos([]);
        setErro(e instanceof Error ? e.message : 'Erro desconhecido');
      });

    return () => {
      vivo = false;
    };
  }, [job.id, job.status]);

  const etapas = etapasDoFluxo(currentWorkspace.fluxoDeProducao);
  const slaDe = (status: string) => etapas.find((e) => e.status === status)?.slaDias;

  const dados: LinhaDoTempo | null = eventos
    ? linhaDoTempo(eventos, job.status, new Date(), etapas)
    : null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <History className="w-4 h-4 text-slate-400" />
        Histórico de etapas
      </h4>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-4">
        Quem mexeu na peça, quando, e quanto tempo ela ficou em cada lugar.
      </p>

      {/*
        **Versão, criação e última alteração moram aqui, e não numa caixa
        própria.**

        Elas eram o cartão "Sobre a peça", no fim da coluna da direita: três
        datas soltas ocupando um cartão inteiro ao lado dos campos que se
        editam, na coluna que mais disputa espaço com a arte. São metadados —
        o que a tela sabe e não se edita — e a pergunta que elas respondem é a
        mesma deste painel: *o que aconteceu com esta peça, e quando?*

        A linha de baixo conta o percurso; esta conta as pontas dele. Separadas,
        quem queria saber "quando isto foi criado" procurava em dois lugares.
      */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
        <div>
          <dt className="text-[10px] uppercase font-bold text-slate-400">Versão atual</dt>
          <dd className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            v{job.currentVersion}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase font-bold text-slate-400">Criado em</dt>
          <dd className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {safeDateTimeFormat(job.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase font-bold text-slate-400">
            Última atualização
          </dt>
          {/*
            `updated_at` é carimbada pelo gatilho do banco, e cai para
            `created_at` quando a peça nunca foi editada — mostrar vazio ali
            faria parecer que a leitura falhou.
          */}
          <dd className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {safeDateTimeFormat(job.updatedAt || job.createdAt)}
          </dd>
        </div>
      </dl>

      {!dados ? (
        <p className="text-xs text-slate-400 py-6 text-center">Carregando…</p>
      ) : (
        <>
          {/*
            **Erro não vira "nenhuma etapa".** Sem este aviso, a lista vazia
            diria com cara de certo que a peça nunca mudou de etapa — a mesma
            frase que a Biblioteca não pode mostrar depois de uma leitura que
            falhou.
          */}
          {erro && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
              <span className="flex items-center gap-1.5 font-bold mb-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Não foi possível ler o histórico desta peça
              </span>
              <p className="pl-5 leading-snug">
                A lista abaixo mostra só o que falta pela frente. {erro}
              </p>
            </div>
          )}

          {/*
            **Sem registro é dito, não escondido.** O registro começa na
            primeira mudança de etapa depois que o gatilho passou a existir, e o
            acervo anterior não tem nada — inventar "entrou na etapa atual no
            dia em que foi criada" seria afirmar uma duração que ninguém mediu,
            num número que a agência leva para a reunião com o cliente.
          */}
          {!erro && !dados.medido && (
            <p className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Esta peça é anterior ao registro de etapas, então o que já
              aconteceu com ela não foi medido. A partir da próxima mudança de
              etapa, cada passo entra aqui com o autor e o horário.
            </p>
          )}

          <ol className="space-y-0">
            {dados.acontecimentos.map((a) => (
              <li key={a.id} className="flex gap-3">
                {/* A coluna do marcador: o ponto e a linha que liga ao
                    próximo. */}
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className={`w-2.5 h-2.5 mt-1 rounded-full ${
                      a.emAndamento ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                  <span className="w-px flex-1 min-h-6 bg-slate-200 dark:bg-slate-800" />
                </div>

                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex items-start gap-1.5 flex-wrap">
                    {/*
                      A frase inteira numa linha só, e o nome dentro dela: "Enviado
                      para aprovação por Airton Maia" se lê de uma vez. Separar o
                      autor numa coluna à direita obrigaria a juntar as duas
                      metades a cada linha, que é o que a versão anterior fazia.
                    */}
                    <Autor acontecimento={a} />
                    <span className="text-xs font-bold text-slate-900 dark:text-white min-w-0">
                      {a.frase}
                    </span>
                    {a.emAndamento && <Badge tom="esmeralda">Em andamento</Badge>}
                  </div>

                  <div className="mt-0.5 pl-[26px] space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <p>
                      {dataCompacta(a.entrouEm, { comAno: true })} às {safeTimeFormat(a.entrouEm)}
                    </p>
                    <p>
                      Ficou{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {duracaoLegivel(a.duracaoMs)}
                      </span>{' '}
                      em {a.emAndamento ? 'andamento nesta etapa' : 'seguida nesta etapa'}
                      {/*
                        **O estouro só aparece onde há prazo combinado.** Sem
                        SLA escrito em Configurações → Conteúdos, a tela cala:
                        um atraso acusado sobre um prazo que ninguém combinou
                        vai para a conversa com quem fez o trabalho, e é a
                        regra de `post_metrics` aplicada ao tempo.
                      */}
                      {estourouOSla(a.duracaoMs, slaDe(a.status)) && (
                        <span className="ml-1.5 inline-flex">
                          <Badge tom="rubi">
                            Passou do prazo de {slaDe(a.status)}d
                          </Badge>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}

            {/*
              O que ainda não aconteceu, apagado. Sem isto, uma peça em produção
              e uma peça publicada desenham listas do mesmo tamanho, e some de
              vista o quanto falta.
            */}
            {dados.pendentes.map((p, i) => (
              <li key={p.status} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-2.5 h-2.5 mt-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                  {i < dados.pendentes.length - 1 && (
                    <span className="w-px flex-1 min-h-5 bg-slate-200 dark:bg-slate-800" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-3">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-600">
                    {p.rotulo}
                  </span>
                  <p className="text-[11px] italic text-slate-400 dark:text-slate-600">
                    Ainda não iniciada
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/*
            O total é a **soma do que foi medido**, e por isso ele some quando
            não há medição: um "Tempo total: 0m" embaixo da lista afirmaria que
            a peça foi feita instantaneamente.
          */}
          {dados.medido && (
            <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Tempo total registrado</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {duracaoLegivel(dados.totalMs)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
