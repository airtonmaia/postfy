import React, { useState, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import {
  ThumbsUp, Send, CheckCircle2, AlertTriangle,
  Lightbulb, CalendarClock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Job, JobStatus } from '../../types';
import { definicaoDoTipo } from '../../lib/tiposDeJob';
import { PreviaDaRede } from '../common/PreviaDaRede';
import {
  FormularioDoConteudo,
  type DadosDoConteudo,
} from '../jobs/FormularioDoConteudo';
import { camposVisiveis } from '../../lib/camposDoCanal';
import { deParedeParaUtc, deUtcParaParede } from '../../lib/fusoHorario';
import { safeDateFormat, safeDateTimeFormat } from '../../lib/utils';
import {
  publicaSozinho,
  publicarAgora,
  agendarPublicacao,
  quandoDeveSair,
  listarContas,
} from '../../lib/redes';
import { Button } from '../ui/button';
import { useAviso } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

/** Um conteúdo em branco, como ele nasce. */
const EM_BRANCO: DadosDoConteudo = {
  clientId: '',
  title: '',
  // Campanha saiu do cadastro. O padrão era 'Conteúdo Institucional' e ia
  // junto sem ninguém escolher — todo job nascia carimbado com uma campanha
  // que não existe. Quem precisar dela edita no detalhe do conteúdo.
  canais: ['instagram'],
  format: 'feed',
  priority: 'medium',
  caption: '',
  draft: '',
  // CTA e hashtags saíram do cadastro: enchiam o modal de campos que quase
  // ninguém preenchia na criação, e seguem editáveis no detalhe.
  //
  // O primeiro comentário voltou, agora como campo do Instagram — é onde as
  // hashtags costumam ir, para não poluir a legenda.
  firstComment: '',
  configuracoes: {},
  // Começa vazio: um conteúdo novo não tem mídia. A foto de banco que ficava
  // aqui virava a arte de todo post criado, e quem não reparasse publicava
  // com ela.
  mediaUrls: [],
  storyMediaUrls: [],
  scheduledDate: '',
  // Derivado da data de publicação na hora de salvar: no cadastro ele não é
  // pedido, e por isso o formulário o esconde aqui.
  deadlineApproval: '',
};

export const CreateJobModal: React.FC = () => {
  const {
    isCreateJobModalOpen,
    closeCreateJobModal,
    createJobPreselectedDate,
    createJobTipo,
    clients,
    createJob,
    setSelectedJob,
    generateAiCopy,
  } = usePostfy();

  // O tipo escolhido no menu Adicionar molda o formulário. Quem decide não é
  // o nome do tipo, e sim `pedeArte`: assim um tipo novo não obriga a caçar
  // `if (tipo === 'copy')` espalhado pela tela.
  const tipo = definicaoDoTipo(createJobTipo);

  const { avisar, dialogo } = useAviso();
  const [dados, setDados] = useState<DadosDoConteudo>(EM_BRANCO);
  const mudar = (parcial: Partial<DadosDoConteudo>) =>
    setDados((atual) => ({ ...atual, ...parcial }));

  const [status] = useState<JobStatus>('ideas');
  const [erro, setErro] = useState('');

  // Mora aqui em cima, junto dos outros hooks, e não perto das funções que os
  // usam: abaixo há um `return null` quando a modal está fechada, e hook
  // declarado depois dele só roda em parte das renderizações. O React derruba
  // a tela inteira com "rendered more hooks than during the previous render"
  // (armadilha 8.1) — que foi exatamente o que aconteceu uma vez.
  const [acao, setAcao] = useState<'nenhuma' | 'agendando' | 'publicando'>('nenhuma');
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const ocupado = acao !== 'nenhuma';

  /**
   * A prévia começa fechada **no celular**, e é `false` aqui de propósito.
   *
   * Lado a lado ela não custa nada; empilhada embaixo de um formulário de
   * doze campos, ela é uma tela e meia de espaço vazio — três quadros "a arte
   * aparece aqui" que a pessoa rola antes de chegar ao fim. Quem abre a modal
   * no telefone veio preencher, não conferir.
   *
   * No desktop o `lg:block` ignora este estado: a coluna está sempre lá, e
   * ninguém precisa clicar para ter o que já tinha.
   */
  const [previaAberta, setPreviaAberta] = useState(false);

  // Keep clientId valid if clients list changes
  useEffect(() => {
    if (clients.length > 0 && (!dados.clientId || !clients.some((c) => c.id === dados.clientId))) {
      setDados((atual) => ({ ...atual, clientId: clients[0].id }));
    }
  }, [clients, dados.clientId, isCreateJobModalOpen]);

  // O modal não desmonta ao fechar (só retorna null), então o estado de um
  // job sobrevivia para o próximo — a mídia enviada era o caso mais visível,
  // por ficar fora do reset parcial que só limpava título/legenda/cta.
  // Reseta no momento de abrir, não só depois de criar: cobre "cancelei e
  // abri de novo" também.
  useEffect(() => {
    if (isCreateJobModalOpen) {
      setDados({ ...EM_BRANCO, clientId: clients[0]?.id || '' });
      setErro('');
      setResultado(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateJobModalOpen]);

  // O campo mostra hora de parede **no fuso da agência**, não no do
  // dispositivo. As três variantes anteriores montavam a string com
  // `getTimezoneOffset()`, que é o fuso de quem está com o app aberto — quem
  // agendasse de outro estado veria 10:00 e o post sairia em outro horário.
  useEffect(() => {
    const preSelecionada = createJobPreselectedDate
      ? new Date(createJobPreselectedDate)
      : null;

    if (preSelecionada && !isNaN(preSelecionada.getTime())) {
      setDados((atual) => ({ ...atual, scheduledDate: deUtcParaParede(preSelecionada) }));
      return;
    }

    // Padrão: daqui a três dias, às 10:00 da agência. O dia é calculado no
    // fuso dela também, senão perto da meia-noite cai no dia errado.
    const daquiATresDias = new Date(Date.now() + 3 * 86400000);
    setDados((atual) => ({
      ...atual,
      scheduledDate: `${deUtcParaParede(daquiATresDias).slice(0, 10)}T10:00`,
    }));
  }, [createJobPreselectedDate, isCreateJobModalOpen]);

  const platform = dados.canais[0] || 'instagram';

  // A prévia mostra o perfil de quem vai publicar: é o cliente selecionado.
  const clienteSelecionado = clients.find((c) => c.id === dados.clientId) || clients[0];

  /**
   * A IA só é oferecida quando há título.
   *
   * Ele é o tema que a rota exige, e um botão que responde "informe o tema"
   * é pior que botão ausente: custa o clique e a descoberta. O briefing do
   * cliente entra por dentro, em `generateAiCopy`.
   */
  const gerarTextoComIA = dados.title.trim()
    ? async () => {
        const r = await generateAiCopy({
          theme: dados.title.trim(),
          format: dados.format,
          platform,
          clientId: dados.clientId,
        });
        return r?.caption || '';
      }
    : undefined;

  /**
   * `statusFinal` existe por causa do botão "Enviar para aprovação": ele é o
   * mesmo cadastro, só que nascendo direto na coluna de aprovação — e é o
   * status que dispara o e-mail para o cliente.
   */
  const salvar = (
    e: React.FormEvent,
    statusFinal: JobStatus,
    // O botão de teste precisa do job salvo **com a modal aberta**: é nela
    // que a resposta da Meta aparece. Fechar antes deixaria o resultado sem
    // onde ser mostrado.
    { fecharDepois = true }: { fecharDepois?: boolean } = {}
  ): Job | undefined => {
    e.preventDefault();
    setErro('');
    if (!dados.title.trim()) {
      setErro('Informe o título do conteúdo.');
      return;
    }

    try {
      // O texto do campo é hora de parede no fuso da agência; `datetime-local`
      // sozinho o interpretaria no fuso do navegador.
      let targetDate = new Date();
      if (dados.scheduledDate) {
        const convertida = deParedeParaUtc(dados.scheduledDate);
        if (!isNaN(convertida.getTime())) {
          targetDate = convertida;
        }
      }

      const scheduledTime = targetDate.getTime();
      const scheduledIso = targetDate.toISOString();
      const deadlineProdIso = new Date(Math.max(Date.now(), scheduledTime - 86400000 * 2)).toISOString();
      const deadlineApprIso = new Date(Math.max(Date.now(), scheduledTime - 86400000 * 1)).toISOString();

      // Sem mídia é um estado legítimo: pauta entra antes da arte existir.
      // Em copy e roteiro é mais que legítimo, é o certo — o campo nem aparece,
      // e o que tivesse sobrado de uma abertura anterior não pode ir junto.
      const finalMedia = tipo.pedeArte
        ? dados.mediaUrls.filter((u) => u.trim().length > 0)
        : [];

      // Sem cliente cadastrado não há job possível: 'c-1' era um id inventado
      // que o Postgres recusa, e o conteúdo sumia sem aviso.
      const selectedClientId = dados.clientId && clients.some((c) => c.id === dados.clientId)
        ? dados.clientId
        : clients[0]?.id;

      if (!selectedClientId) {
        setErro('Cadastre um cliente antes de criar conteúdo.');
        return;
      }

      const campos = camposVisiveis(platform, dados.format);

      const newJob = createJob({
        clientId: selectedClientId,
        title: dados.title.trim(),
        tipo: createJobTipo,
        campaign: 'Geral',
        // `platform` é o primeiro da lista: as telas que leem uma rede só
        // continuam funcionando, e `canais` guarda o conjunto completo.
        platform,
        canais: dados.canais,
        format: dados.format,
        priority: dados.priority,
        status: statusFinal,
        caption: dados.caption.trim(),
        // Só o texto de trabalho: quem é publicado é `caption`.
        draft: dados.draft.trim() || undefined,
        // Só quando o formato pede: guardar a arte do story num post de feed
        // deixaria uma mídia órfã que nenhuma tela mostra.
        storyMediaUrls: dados.format === 'feed_story' ? dados.storyMediaUrls : [],
        cta: '',
        hashtags: [],
        firstComment: dados.firstComment.trim(),
        // Só o que a rede escolhida pede: trocar de canal no meio do cadastro
        // deixaria para trás a configuração da rede anterior, e ela iria junto
        // para o banco sem aparecer em tela nenhuma.
        configuracoes: Object.fromEntries(
          campos
            .filter((c) => c.destino === 'config')
            .map((c) => [c.chave, dados.configuracoes[c.chave]])
            .filter(([, v]) => v !== undefined && v !== '' && v !== false)
        ),
        mediaUrls: finalMedia,
        scheduledDate: scheduledIso,
        deadlineProduction: deadlineProdIso,
        deadlineApproval: deadlineApprIso,
      });

      if (fecharDepois) {
        closeCreateJobModal();
        if (newJob) {
          setSelectedJob(newJob);
        }
      }
      return newJob;
    } catch (err) {
      console.error('Erro ao cadastrar conteúdo:', err);
      avisar({
        titulo: 'O conteúdo não foi salvo',
        descricao:
          'O banco recusou a gravação. Confira os campos obrigatórios — cliente, título e data — e tente de novo. Se persistir, o conteúdo pode ter ficado só nesta aba.',
      });
      return undefined;
    }
  };

  /**
   * Agendar: marca a data **e põe na fila de verdade**.
   *
   * Só mudar o status para `scheduled` seria a armadilha que já custou caro —
   * o card ficava em "Agendado", a data passava e nada publicava, porque
   * `publish_queue` não tinha produtor. Um botão escrito "Agendar" que não
   * agenda é pior que não ter o botão.
   *
   * Quando não há conta conectada para aquele cliente, o conteúdo ainda fica
   * agendado: a data é combinada com o cliente de qualquer jeito, e a
   * postagem passa a ser manual. A tela diz isso, em vez de fingir.
   */
  const agendar = async (e: React.FormEvent) => {
    const novo = salvar(e, 'scheduled', { fecharDepois: false });
    if (!novo) return;

    setAcao('agendando');
    setResultado(null);
    try {
      const conta = (await listarContas()).find(
        (c) => publicaSozinho(c.platform) && c.clientId === novo.clientId
      );

      if (!conta) {
        setResultado({
          ok: true,
          texto:
            'Agendado. Este cliente não tem conta conectada, então a postagem ' +
            'na data é sua — conecte a conta dele para o disparo automático.',
        });
        return;
      }

      await agendarPublicacao(conta.workspaceId, novo.id, conta.id, novo.scheduledDate);
      // A janela, e não só a data marcada. O agendador passa de 5 em 5
      // minutos: quem agenda para 15:10 e clica às 15:10:07 perde a passada
      // por sete segundos e espera até 15:15. Sem dizer isso, a espera parece
      // falha — foi o que aconteceu no primeiro teste do caminho agendado.
      setResultado({
        ok: true,
        texto:
          `Na fila para @${conta.accountName}. O agendador passa de 5 em 5 minutos, ` +
          `então deve sair até ${safeDateTimeFormat(quandoDeveSair(novo.scheduledDate))}.`,
      });
    } catch (err) {
      setResultado({
        ok: false,
        texto: err instanceof Error ? err.message : 'Não foi possível agendar.',
      });
    } finally {
      setAcao('nenhuma');
    }
  };

  /**
   * Publicar agora: sai na hora, e a resposta da Meta volta junto.
   *
   * Nasceu como botão temporário de teste e ficou, porque resolve um problema
   * que o caminho normal não resolve: enfileirar e esperar o cron faz a falha
   * aparecer cinco minutos depois, escrita em `last_error`, num canto do
   * banco. Aqui o erro da Meta aparece na tela, com o texto que ela mandou.
   *
   * É a única ação da modal sem volta, e por isso fica longe do primário e
   * com a cor de aviso.
   */
  const publicarImediatamente = async (e: React.FormEvent) => {
    const novo = salvar(e, 'scheduled', { fecharDepois: false });
    if (!novo) return;

    setAcao('publicando');
    setResultado(null);
    try {
      const { conta, externalId } = await publicarAgora(novo.id);
      setResultado({ ok: true, texto: `Publicado em @${conta}. Id na Meta: ${externalId}` });
    } catch (err) {
      setResultado({
        ok: false,
        texto: err instanceof Error ? err.message : 'Falha ao publicar.',
      });
    } finally {
      setAcao('nenhuma');
    }
  };

  return (
    /*
      `Dialog` do shadcn. A tela cheia no celular e o X do canto agora vêm do
      primitivo — eram escritos aqui, e em mais 24 lugares com três posições e
      dois tamanhos diferentes entre si.

      O ganho maior é o que não se vê: trava de foco, `Esc` e bloqueio da
      rolagem do fundo. Num formulário desta altura o terceiro é o que mais
      pesa — rolar até o fim passava a rolar a tela de trás.
    */
    <Dialog
      open={isCreateJobModalOpen}
      onOpenChange={(aberto) => !aberto && closeCreateJobModal()}
    >
      <DialogContent tamanho="editorComPrevia" className="p-0 gap-0">
        {/* O formulário se explica sozinho e a faixa de cabeçalho comia
            altura útil, então o título existe só para o leitor de tela. */}
        <DialogTitle className="sr-only">Novo conteúdo</DialogTitle>

        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0">
        {/* Form */}
        <form onSubmit={(e) => salvar(e, status)} className="flex-1 min-w-0 p-4 sm:p-6 space-y-4">
          {/*
            **O formulário é o mesmo da edição.** Ele mora em
            `components/jobs/FormularioDoConteudo`, e as duas telas o montam
            com o mesmo estado — era este arquivo que tinha campos que a modal
            de detalhe não tinha, e quem criava aqui não conseguia corrigir lá.
          */}
          <FormularioDoConteudo
            valor={dados}
            aoMudar={mudar}
            tipo={tipo}
            clients={clients}
            aoGerarComIA={gerarTextoComIA}
          />

          {erro && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              {erro}
            </p>
          )}

          {/* O resultado fica acima dos botões e não some sozinho: é a única
              prova do que aconteceu, e some junto com a modal se ela fechar. */}
          {resultado && (
            <div
              className={`flex items-start gap-2 text-xs p-3 rounded-xl border ${
                resultado.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
              }`}
            >
              {resultado.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              )}
              <span className="font-semibold leading-relaxed">{resultado.texto}</span>
            </div>
          )}

          {/*
            Buttons

            **No celular cada ação ocupa a linha inteira, na ordem da
            decisão.** Com `flex-wrap justify-end` e o `mr-auto` do Cancelar,
            os cinco botões caíam em três linhas desencontradas — uma com dois,
            uma com dois e uma com um, todas alinhadas à direita e nenhuma
            dizendo qual era a ação principal. Empilhados, a ordem do DOM vira
            a ordem de leitura, e ela já está certa: cancelar, publicar agora,
            ideia, agendar, enviar para aprovação.

            `[&>*]:w-full` alcança os botões sem repetir a classe em cada um —
            e sai sozinho no `sm`, onde a linha volta a ser linha.
          */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="ghost"
              type="button"
              onClick={closeCreateJobModal}
              className="sm:mr-auto"
            >
              Cancelar
            </Button>

            {/* Publicar agora fica **longe** do primário, e com a cor de
                aviso: é a única ação daqui que não tem volta. Encostada no
                botão que a pessoa aperta por reflexo, ela seria apertada por
                reflexo também. */}
            {dados.canais.includes('instagram') && (
              <Button
                type="button"
                onClick={(e) => void publicarImediatamente(e)}
                disabled={ocupado}
                title="Salva e publica imediatamente no Instagram do cliente. Não tem volta."
                className="border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60"
              >
                <Send className="w-3.5 h-3.5" />
                {acao === 'publicando' ? 'Publicando...' : 'Publicar agora'}
              </Button>
            )}

            {/* Ideia é o começo do funil: entra sem data, sem arte e sem
                pedir nada a ninguém. */}
            <Button variant="outline"
              type="button"
              onClick={(e) => salvar(e, 'ideas')}
              disabled={ocupado}
              className="text-slate-700 dark:text-slate-200"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Criar ideia
            </Button>

            {/* Agendar **põe na fila de verdade**, quando há conta conectada.
                Só marcar o status seria a armadilha que já custou caro: o card
                ficava em "Agendado", a data passava e nada publicava. */}
            <Button variant="outline"
              type="button"
              onClick={(e) => void agendar(e)}
              disabled={ocupado}
              className="text-slate-700 dark:text-slate-200"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              {acao === 'agendando' ? 'Agendando...' : 'Agendar'}
            </Button>

            {/* O caminho mais comum de uma agência, e por isso o primário. */}
            <Button
              type="button"
              onClick={(e) => salvar(e, 'for_approval')}
              disabled={ocupado}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              Enviar para aprovação
            </Button>
          </div>
        </form>

        {/* Prévia: como fica na rede escolhida, com o dado deste formulário. */}
        {/* Centralizada na vertical, e com folga no topo: encostada em cima
            ela passava por baixo do botão de fechar. */}
        <aside className="lg:w-[440px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:pt-12 flex flex-col lg:flex-row lg:items-center gap-3">
          {/*
            O botão que abre a prévia **só existe abaixo do `lg`**, que é onde
            ela deixa de ser coluna e vira rodapé. Acima disso ela está sempre
            aberta e um botão para "mostrar" o que já está à vista seria ruído.
          */}
          <Button
            variant="outline"
            type="button"
            onClick={() => setPreviaAberta((v) => !v)}
            className="lg:hidden w-full"
            aria-expanded={previaAberta}
          >
            {previaAberta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {previaAberta ? 'Ocultar prévia' : 'Ver prévia da publicação'}
          </Button>

          <div className={`${previaAberta ? 'flex' : 'hidden'} lg:flex w-full items-center`}>
          <PreviaDaRede
            className="w-full"
            dados={{
              nomeDoPerfil: clienteSelecionado?.name || '',
              avatar: clienteSelecionado?.avatar,
              canais: dados.canais,
              artes: tipo.pedeArte ? dados.mediaUrls : [],
              artesDoStory: dados.format === 'feed_story' ? dados.storyMediaUrls : [],
              legenda: dados.caption,
              localizacao: String(dados.configuracoes.localizacao || '') || undefined,
              dataPrevista: dados.scheduledDate
                ? safeDateFormat(deParedeParaUtc(dados.scheduledDate), {
                    day: '2-digit',
                    month: 'long',
                  })
                : undefined,
            }}
          />
          </div>
        </aside>
        </div>
      </DialogContent>

      {dialogo}
    </Dialog>
  );
};
