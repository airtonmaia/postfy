import React, { useState } from 'react';
import { Check, AlertCircle, RotateCcw, Layers, Archive, GripVertical } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { usePostfy } from '../../../context/PostfyContext';
import { atualizarWorkspace } from '../../../lib/db';
import { pode } from '../../../lib/permissions';
import {
  CORES_DA_ETAPA,
  ICONES_DA_ETAPA,
  corDaEtapa,
  etapasDoFluxo,
  reordenarFluxo,
  sanearFluxo,
  type FluxoDeProducao,
} from '../../../lib/fluxoDeProducao';
import { IconeDaEtapa } from '../../common/IconeDaEtapa';
import { FORMATOS_POR_CANAL } from '../../../lib/formatos';
import { NOME_DA_REDE } from '../../../lib/redes';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import type { JobPlatform, JobStatus } from '../../../types';

/**
 * Conteúdos: como **esta** agência chama cada etapa do fluxo.
 *
 * As sete etapas sempre foram fixas no código, e agência nenhuma chama as
 * coisas assim: quem faz vídeo tem "Captação" e "Edição" onde está escrito
 * "Produção"; quem faz tráfego tem "Briefing" onde está "Ideias". O nome
 * errado no quadro não é gosto — é a equipe traduzindo a coluna mentalmente
 * toda vez que olha para ela.
 *
 * ### Por que não dá para acrescentar etapa, e por que a tela diz isso
 *
 * `jobs.status` tem um `check` com os sete valores, e esse `check` é a metade
 * do banco de uma decisão que a tela também carrega. Oferecer um oitavo nome
 * aqui sem valor no `check` é exatamente o que o `feed_story` custou: a
 * gravação roda em segundo plano, o Postgres recusa a linha, e **dez
 * conteúdos sumiram em silêncio** enquanto o histórico de atividade afirmava
 * que tinham sido criados.
 *
 * Esconder essa limitação seria pior que a limitação: quem não a vê conclui
 * que o produto não tem a funcionalidade, em vez de entender que ela custa uma
 * migração. A tela diz, em uma linha, o que dá e o que não dá.
 *
 * ### A lista de formatos é de leitura, e isso também é dito
 *
 * Os formatos não são rótulo: cada um decide o que o publicador manda para a
 * rede — `STORIES` vence `REELS`, story não leva legenda, "Feed + Story" exige
 * a arte vertical. Um formato inventado na tela seria oferecido no cadastro e
 * recusado na publicação, que é a família de bug que este produto mais pagou.
 * Mostrá-los continua valendo: é a resposta para "que formatos existem em cada
 * rede", que hoje só existia abrindo o cadastro.
 */

const TODAS_AS_REDES = Object.keys(FORMATOS_POR_CANAL) as JobPlatform[];

/**
 * Uma etapa que se arrasta — **pela alça, nunca pelo card.**
 *
 * O card tem campo de texto, seletor de cor e fileira de ícones dentro: com o
 * arrasto saindo do corpo, selecionar o nome da etapa com o mouse viraria um
 * gesto de mover, e a pessoa perderia a edição no meio. A alça resolve isso
 * sem `activationConstraint` nenhum — ela não é um alvo que se encosta por
 * acaso.
 *
 * `setActivatorNodeRef` é o que faz o dnd-kit medir o **card** e não a alça ao
 * desenhar o item em movimento: sem ele, o que segue o cursor é um retângulo
 * de 24px, e quem arrasta perde de vista o que está carregando.
 */
const EtapaArrastavel: React.FC<{
  status: JobStatus;
  podeMover: boolean;
  children: React.ReactNode;
}> = ({ status, podeMover, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: status, disabled: !podeMover });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border bg-slate-50 dark:bg-slate-950 p-3 flex items-start gap-2 ${
        isDragging
          ? 'border-purple-400 dark:border-purple-700 shadow-lg relative z-10'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {podeMover && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover a etapa ${status}`}
          title="Arraste para mudar a ordem"
          /*
            Afordância minúscula: um punho de 16px ao lado de um card. Qualquer
            degrau da escala de botão é maior que ele — é o terceiro papel que a
            seção de botões nomeia como exceção.

            `touch-none` aqui é a exceção nomeada do projeto: a área é pequena e
            deliberada, e o arrasto começa no toque. Num card que ocupa a
            coluna inteira isso desligaria a rolagem do telefone; numa alça de
            16px, não há o que rolar.
          */
          className="shrink-0 mt-1 p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing touch-none transition"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <div className="flex-1 min-w-0 space-y-3">{children}</div>
    </div>
  );
};

export const SettingsConteudos: React.FC = () => {
  const { currentWorkspace, updateWorkspace, currentUser } = usePostfy();

  /* Todos os hooks antes de qualquer `return` — armadilha 8.1. */
  const [fluxo, setFluxo] = useState<FluxoDeProducao>(() =>
    sanearFluxo(currentWorkspace.fluxoDeProducao)
  );
  const [arquivarApos, setArquivarApos] = useState<string>(
    String(currentWorkspace.arquivarPublicadosAposDias ?? 0)
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mexer na agência é de quem administra a agência. A RLS recusaria de
  // qualquer jeito, com `42501`; dizer aqui evita o erro genérico.
  const podeSalvar = pode(currentUser?.role, 'gerenciar_workspace');

  const etapas = etapasDoFluxo(fluxo);

  const mexer = (status: JobStatus, parcial: Record<string, unknown>) =>
    setFluxo((atual) => {
      const proximo = { ...atual, [status]: { ...(atual[status] ?? {}), ...parcial } };
      // Passa pelo saneador a cada tecla: é ele que descarta nome vazio, cor
      // desconhecida e prazo absurdo, e é dele que sai o que vai ao banco.
      // Validar só no salvar deixaria a tela mostrar "ajustada" numa etapa
      // cujo ajuste vai ser jogado fora.
      return sanearFluxo(proximo);
    });

  /*
    Arrastar pela alça: distância zero não atrapalha, porque a alça não é um
    alvo que se encosta por acaso — e o teclado entra junto, que é o que torna
    a ordem alcançável para quem não usa mouse.
  */
  const sensores = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const aoSoltarEtapa = (evento: DragEndEvent) => {
    const de = String(evento.active.id);
    const para = String(evento.over?.id ?? '');
    if (!para || de === para) return;

    const ordemAtual = etapas.map((e) => e.status);
    const i = ordemAtual.indexOf(de as JobStatus);
    const j = ordemAtual.indexOf(para as JobStatus);
    if (i < 0 || j < 0) return;

    setFluxo((atual) => reordenarFluxo(atual, arrayMove(ordemAtual, i, j)));
  };

  const limpar = (status: JobStatus) =>
    setFluxo((atual) => {
      const proximo = { ...atual };
      delete proximo[status];
      return proximo;
    });

  const diasSalvos = currentWorkspace.arquivarPublicadosAposDias ?? 0;
  const diasAgora = Math.max(0, Math.min(3650, Math.round(Number(arquivarApos) || 0)));
  const mudou =
    JSON.stringify(fluxo) !== JSON.stringify(sanearFluxo(currentWorkspace.fluxoDeProducao)) ||
    diasAgora !== diasSalvos;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      // O banco primeiro, a faixa verde depois — e só se ele confirmar. A
      // ordem invertida é o que fazia a tela de Preferências mentir.
      const mudancas = {
        fluxoDeProducao: fluxo,
        arquivarPublicadosAposDias: diasAgora,
      };
      await atualizarWorkspace(currentWorkspace.id, mudancas);
      updateWorkspace(currentWorkspace.id, mudancas);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const cartao =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs';

  return (
    <form onSubmit={(e) => void salvar(e)} className="space-y-6">
      {salvo && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4" />
          Fluxo salvo. O quadro, os cards e o histórico já usam os nomes novos.
        </div>
      )}

      {erro && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          {erro}
        </div>
      )}

      {/* ---------------------------------------------- Fluxo de produção */}
      <section className={`${cartao} p-4 sm:p-6 space-y-4`}>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            Fluxo de produção
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            O nome, a cor e o prazo de cada etapa. Valem no quadro, no card, no
            histórico da peça e no calendário.
          </p>
          {/*
            A limitação é dita, não escondida. Quem não a vê conclui que o
            produto não tem a funcionalidade; quem a vê entende o que ela
            custa — e é a mesma honestidade da aba Integrações.
          */}
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            As sete etapas são fixas: cada uma tem lugar no quadro, no
            publicador e no fluxo de aprovação, e acrescentar uma passa por
            mudança no banco. O que muda aqui é como elas se chamam e se
            parecem.
          </p>
        </div>

        <div className="space-y-3">
          {/*
            **A ordem das etapas é da agência, e ela é a ordem das colunas.**

            O quadro desenhava sempre Ideias → Produção → Aprovação → Ajuste →
            Aprovado → Agendado → Publicado, que é o fluxo de quem faz post.
            Quem aprova antes de produzir, ou quem trata "Ajuste" como a coluna
            de entrada do dia, lia o quadro de trás para frente toda vez.

            **Arrastar aqui muda o quadro, a trilha da peça e o filtro de
            etapa** — as três leem `etapasDoFluxo`. O que não muda é **quem**
            está na lista: as sete continuam todas lá, porque esconder uma
            coluna é esconder o trabalho que está dentro dela.
          */}
          <DndContext
            sensors={sensores}
            collisionDetection={closestCenter}
            onDragEnd={aoSoltarEtapa}
          >
          <SortableContext
            items={etapas.map((e) => e.status)}
            strategy={verticalListSortingStrategy}
          >
          {etapas.map((etapa) => {
            const cor = corDaEtapa(etapa.cor);

            return (
              <EtapaArrastavel
                key={etapa.status}
                status={etapa.status}
                podeMover={podeSalvar}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2 min-w-0">
                    {/*
                      **O cabeçalho da etapa é a prévia do que vai ao quadro.**
                      Era uma bolinha com a cor; agora é a cor **e** o ícone,
                      no mesmo desenho que a coluna recebe. Escolher um ícone
                      numa fileira e só descobrir como ele ficou abrindo outra
                      tela é o tipo de ida e volta que faz a pessoa desistir de
                      ajustar.
                    */}
                    {/* As medidas são as da coluna do quadro (`w-8`, `border`,
                        ícone de 16px) de propósito: esta é a prévia, e uma
                        prévia em outro tamanho faz escolher o ícone duas
                        vezes — uma aqui e outra depois de abrir o quadro. */}
                    <span
                      className={`w-8 h-8 rounded-full shrink-0 inline-flex items-center justify-center border ${cor.caixa} ${cor.borda}`}
                    >
                      <IconeDaEtapa chave={etapa.icone} className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {etapa.rotulo}
                    </span>
                    {/* De onde se partiu, e só quando o nome mudou: repetir o
                        padrão ao lado de um nome igual a ele é ruído. */}
                    {etapa.rotulo !== etapa.rotuloPadrao && (
                      <Badge tom="neutro">{etapa.rotuloPadrao}</Badge>
                    )}
                  </span>

                  {etapa.ajustada && podeSalvar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => limpar(etapa.status)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Voltar ao padrão
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Nome da etapa
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={fluxo[etapa.status]?.rotulo ?? ''}
                      placeholder={etapa.rotuloPadrao}
                      disabled={!podeSalvar}
                      onChange={(e) => mexer(etapa.status, { rotulo: e.target.value })}
                      className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Cor
                    </label>
                    <div className="flex items-center gap-1.5">
                      {CORES_DA_ETAPA.map((c) => (
                        <button
                          key={c.valor}
                          type="button"
                          disabled={!podeSalvar}
                          onClick={() => mexer(etapa.status, { cor: c.valor })}
                          title={c.rotulo}
                          aria-label={`Cor ${c.rotulo} para a etapa ${etapa.rotulo}`}
                          aria-pressed={etapa.cor === c.valor}
                          className={`w-6 h-6 rounded-lg ${c.ponto} transition cursor-pointer disabled:cursor-not-allowed ${
                            etapa.cor === c.valor
                              ? 'ring-2 ring-offset-1 ring-purple-600 dark:ring-offset-slate-950'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Prazo (dias)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={fluxo[etapa.status]?.slaDias ?? ''}
                      placeholder="—"
                      disabled={!podeSalvar}
                      onChange={(e) => mexer(etapa.status, { slaDias: e.target.value })}
                      className="w-24 text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/*
                  **O ícone tem linha própria, e não é desleixo de layout.**
                  São catorze opções: espremê-las na mesma linha da cor e do
                  prazo faria a fileira rolar na horizontal dentro de um
                  formulário, que é onde ninguém procura por uma barra. Aqui
                  elas quebram em duas linhas e todas ficam à vista.
                */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Ícone
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ICONES_DA_ETAPA.map((i) => {
                      const escolhido = etapa.icone === i.valor;

                      return (
                        <button
                          key={i.valor}
                          type="button"
                          disabled={!podeSalvar}
                          onClick={() => mexer(etapa.status, { icone: i.valor })}
                          title={i.rotulo}
                          aria-label={`Ícone ${i.rotulo} para a etapa ${etapa.rotulo}`}
                          aria-pressed={escolhido}
                          /*
                            A caixa é a mesma do seletor de cor (`w-7`,
                            `rounded-lg`, anel roxo no escolhido): são dois
                            controles da mesma pergunta, e desenhá-los
                            diferente faria a tela parecer dois formulários
                            colados.
                          */
                          className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed ${
                            escolhido
                              ? `${cor.caixa} ${cor.borda} ring-2 ring-offset-1 ring-purple-600 dark:ring-offset-slate-950`
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <IconeDaEtapa chave={i.valor} className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </EtapaArrastavel>
            );
          })}
          </SortableContext>
          </DndContext>
        </div>

        {/*
          **Em branco é "não combinamos prazo", nunca "zero dias".** É a regra
          de `post_metrics` aplicada ao tempo: um SLA que ninguém combinou não
          pode acusar atraso, porque esse aviso vai para a conversa com quem
          fez o trabalho.
        */}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Prazo em branco é "não combinamos" — o histórico da peça só aponta
          estouro onde há prazo escrito.
        </p>
      </section>

      {/* ---------------------------------------------- Arquivar publicados */}
      <section className={`${cartao} p-4 sm:p-6 space-y-3`}>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-purple-600" />
            Arquivar publicados automaticamente
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            A coluna "Publicado" cresce para sempre numa agência em uso. Aqui
            você decide depois de quantos dias a peça entregue sai da vista do
            quadro.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min={0}
            max={3650}
            value={arquivarApos}
            disabled={!podeSalvar}
            onChange={(e) => setArquivarApos(e.target.value)}
            className="w-24 text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">dias</span>
        </div>

        {/*
          **Arquivar aqui é sair da vista, não apagar — e a tela diz qual dos
          dois.** "Arquivar" num produto costuma significar as duas coisas, e a
          diferença é entre uma preferência de tela e perder trabalho
          entregue.
        */}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {diasAgora > 0
            ? `Peça publicada há mais de ${diasAgora} ${diasAgora === 1 ? 'dia' : 'dias'} sai do quadro. Ela continua no banco, no calendário, nos relatórios e na busca — some só da coluna.`
            : 'Zero mantém tudo à vista: nenhuma peça publicada sai do quadro.'}
        </p>
      </section>

      {/* ---------------------------------------------- Formatos (leitura) */}
      <section className={`${cartao} p-4 sm:p-6 space-y-3`}>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Formatos por rede
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            O que o cadastro oferece em cada rede. Esta lista é de leitura:
            cada formato decide o que o publicador manda para a rede — um
            formato inventado aqui seria oferecido no cadastro e recusado na
            publicação.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TODAS_AS_REDES.map((rede) => (
            <div
              key={rede}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3"
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {NOME_DA_REDE[rede]}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {FORMATOS_POR_CANAL[rede].map((f) => (
                  <Badge key={f.valor} tom="neutro">
                    {f.rotulo}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/*
        A barra de salvar só aparece com mudança pendente, como no formulário
        do conteúdo: um botão sempre aceso não distingue "salvei" de "não
        mexi".
      */}
      {mudou && podeSalvar && (
        <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFluxo(sanearFluxo(currentWorkspace.fluxoDeProducao));
              setArquivarApos(String(diasSalvos));
            }}
          >
            Descartar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      )}

      {!podeSalvar && (
        <p className="text-[11px] text-slate-400">
          Só quem administra a agência altera o fluxo de produção.
        </p>
      )}
    </form>
  );
};
