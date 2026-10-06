import React from 'react';
import { Plus, Clock } from 'lucide-react';

import { usePostfy } from '../../context/PostfyContext';
import { safeTimeFormat, dataCompacta } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import { PlatformBadge, FormatBadge, StatusBadge } from '../common/Badges';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { urlDeExibicao } from '../../lib/midiaDoDrive';
import type { Job } from '../../types';

/**
 * O que está marcado para um dia — a lista inteira, numa tela que cabe.
 *
 * ### Dois problemas, a mesma peça
 *
 * **No celular a casinha do mês tem 55px de largura.** Sete colunas em 390px
 * não dão espaço para nada: o cartão do conteúdo era desenhado em tamanho de
 * computador, com selo de rede, horário, miniatura, título, formato e status.
 * Com um post por dia ele já saía cortado; com dois, o segundo ficava dentro
 * de uma área de rolagem de poucos pixels — **invisível e sem como tocar**.
 *
 * **E o "+N mais" do computador abria o cadastro.** O comentário ao lado dele
 * dizia *"Show all jobs for that date in detail"* e a chamada era
 * `openCreateJobModal`: o botão prometia ver os outros três e abria "criar
 * novo". É a família do `trial_ends_at` na interface — o rótulo descreve o que
 * não acontece, e quem clica conclui que o sistema perdeu as peças.
 *
 * Os dois querem a mesma coisa: **a lista do dia**. Uma peça só, usada pelos
 * dois caminhos, em vez de uma tela de celular e um popover de computador que
 * divergiriam na primeira pressa.
 *
 * ### Criar entra aqui dentro, e isso é a troca honesta
 *
 * No celular, tocar na casinha passou a abrir esta lista — antes tocava-se no
 * vazio da célula para criar. Sem o botão aqui, a mudança **tiraria** o
 * caminho de criar num dia específico do telefone inteiro. Ele fica no topo,
 * já com a data.
 */
export const ConteudosDoDia: React.FC<{
  /** A data aberta, ou `null` com a lista fechada. */
  dia: Date | null;
  jobs: Job[];
  aoFechar: () => void;
}> = ({ dia, jobs, aoFechar }) => {
  const { clients, setSelectedJob, openCreateJobModal } = usePostfy();

  return (
    <Dialog open={Boolean(dia)} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {/*
        **O `{dia && ...}` fica, e não é redundante com o `open`.** JSX avalia
        os filhos na criação do elemento, não na renderização: `dia.toISOString()`
        rodaria com a lista fechada — que é o estado normal dela — e derrubaria
        a tela inteira. O `open` decide se abre; a guarda decide se o conteúdo
        chega a existir.
      */}
      {dia && (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dataCompacta(dia.toISOString(), { comAno: true })}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-3 overflow-y-auto">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                aoFechar();
                openCreateJobModal(dia.toISOString());
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Novo conteúdo neste dia
            </Button>

            {jobs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 leading-relaxed">
                Nada marcado para este dia.
              </p>
            ) : (
              jobs.map((job) => {
                const client = clients.find((c) => c.id === job.clientId);

                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      aoFechar();
                      setSelectedJob(job);
                    }}
                    /*
                      Card clicável, não `Button`: ele tem conteúdo em bloco —
                      miniatura, título em duas linhas, selos — e altura
                      própria. A escala de altura fixa do `Button` cortaria o
                      card inteiro, que é o erro dos nove cards migrados por
                      engano.
                    */
                    className="w-full text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-purple-300 rounded-xl p-3 transition cursor-pointer flex items-start gap-3"
                  >
                    {job.mediaUrls && job.mediaUrls.length > 0 && (
                      <img
                        src={urlDeExibicao(job.mediaUrls[0])}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                      />
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                        {job.title}
                      </span>

                      <span className="flex items-center gap-1.5 min-w-0">
                        <Avatar
                          nome={client?.name || 'Cliente'}
                          url={client?.avatar}
                          tamanho={16}
                        />
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                          {client?.name}
                        </span>
                      </span>

                      <span className="flex items-center gap-1 flex-wrap">
                        <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                        <FormatBadge format={job.format} />
                        <StatusBadge status={job.status} />
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                          <Clock className="w-3 h-3" />
                          {safeTimeFormat(job.scheduledDate)}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
};
