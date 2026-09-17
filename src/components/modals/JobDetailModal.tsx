import React, { useEffect, useMemo, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateTimeFormat } from '../../lib/utils';
import {
  PlatformBadge,
  FormatBadge,
  PriorityBadge,
  VersaoBadge,
} from '../common/Badges';
import {
  X,
  Check,
  AlertCircle,
  Send,
  Share2,
  FileText,
  Trash2,
  Copy as DuplicateIcon,
  Sparkles,
  CalendarClock,
  CheckSquare,
  Timer,
  History,
  Save,
  RotateCcw,
} from 'lucide-react';
import { JobStatus, Job } from '../../types';
import { AiCopyModal } from './AiCopyModal';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsBadge } from '../ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { useConfirmacao } from '../ui/alert-dialog';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '../ui/accordion';
import { PreviaDaRede } from '../common/PreviaDaRede';
import {
  FormularioDoConteudo,
  type DadosDoConteudo,
} from '../jobs/FormularioDoConteudo';
import { PainelDeRevisoes } from '../jobs/PainelDeRevisoes';
import { PainelDeCompartilhamento } from '../jobs/PainelDeCompartilhamento';
import { PainelDeTimesheet } from '../jobs/PainelDeTimesheet';
import { definicaoDoTipo } from '../../lib/tiposDeJob';
import { camposVisiveis } from '../../lib/camposDoCanal';
import { rotuloDoFormato, faltaArteDoStory, AVISO_SEM_ARTE_DE_STORY } from '../../lib/formatos';
import { deParedeParaUtc, deUtcParaParede } from '../../lib/fusoHorario';
import { safeDateFormat } from '../../lib/utils';
import {
  publicarAgora,
  agendarPublicacao,
  quandoDeveSair,
  listarContas,
  publicaSozinho,
} from '../../lib/redes';

/**
 * O que o editor guarda enquanto a pessoa mexe.
 *
 * É o formulário compartilhado **mais** o que só existe depois de a peça
 * existir: CTA, hashtags e campanha saíram do cadastro de propósito (enchiam
 * a tela de campo que quase ninguém preenche na criação) e continuam aqui,
 * atrás de "Mais opções".
 */
interface RascunhoDoConteudo extends DadosDoConteudo {
  cta: string;
  /** Texto separado por espaço: é como a pessoa escreve e cola hashtag. */
  hashtags: string;
  campaign: string;
}

/** A peça do banco, como o formulário a vê. */
const doJob = (job: Job): RascunhoDoConteudo => ({
  clientId: job.clientId,
  title: job.title || '',
  // `canais` é o conjunto; `platform` é o primeiro dele. Peça antiga tem só
  // `platform`, e sem este `||` o editor abriria sem canal nenhum marcado.
  canais: job.canais?.length ? job.canais : [job.platform],
  format: job.format,
  priority: job.priority,
  caption: job.caption || '',
  draft: job.draft || '',
  firstComment: job.firstComment || '',
  configuracoes: job.configuracoes || {},
  mediaUrls: job.mediaUrls || [],
  storyMediaUrls: job.storyMediaUrls || [],
  // Hora de parede no fuso da **agência**. O `datetime-local` interpreta no
  // fuso do navegador, então converter aqui é o que impede o colega de outro
  // estado de ver — e gravar — outro horário (armadilha 8.2).
  scheduledDate: job.scheduledDate ? deUtcParaParede(new Date(job.scheduledDate)) : '',
  deadlineApproval: job.deadlineApproval ? deUtcParaParede(new Date(job.deadlineApproval)) : '',
  cta: job.cta || '',
  hashtags: (job.hashtags || []).join(' '),
  campaign: job.campaign || '',
});

/** Texto solto vira a lista que o banco guarda, com a `#` na volta. */
const hashtagsDaLinha = (texto: string): string[] =>
  texto
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#*/, ''))
    .filter(Boolean)
    .map((t) => `#${t}`);

const paraIso = (parede: string): string | undefined => {
  if (!parede) return undefined;
  const d = deParedeParaUtc(parede);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

export const JobDetailModal: React.FC = () => {
  const {
    selectedJob,
    setSelectedJob,
    clients,
    moveJobStatus,
    approveJob,
    requestAdjustment,
    toggleChecklistItem,
    duplicateJob,
    deleteJob,
    updateJob,
    currentUser,
    generateAiCopy,
  } = usePostfy();

  /*
    **Todos os hooks aqui em cima, antes do `return null`.**

    O React exige a mesma lista de hooks em toda renderização; declarar um
    depois da guarda faz a modal rodar dois conjuntos diferentes e derruba a
    árvore com o erro #310, que em produção chega minificado (armadilha 8.1).
  */
  const [aba, setAba] = useState<'conteudo' | 'revisoes' | 'compartilhamento'>('conteudo');
  const [dados, setDados] = useState<RascunhoDoConteudo | null>(null);
  const [original, setOriginal] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [acao, setAcao] = useState<'nenhuma' | 'agendando' | 'publicando'>('nenhuma');
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const [feedbackDoAjuste, setFeedbackDoAjuste] = useState('');
  const [iaAberta, setIaAberta] = useState(false);
  const { pedir, dialogo } = useConfirmacao();

  const jobId = selectedJob?.id;

  /**
   * O rascunho nasce do job **e é reposto quando outro conteúdo abre**.
   *
   * `useState(doJob(job))` seria lido só na primeira renderização: a modal
   * fica montada, então abrir um segundo conteúdo mostraria os campos do
   * primeiro. É a mesma armadilha 8.1 que quebrava o compartilhamento.
   *
   * A dependência é `jobId`, não o objeto: ele é recriado a cada render do
   * contexto, e o efeito apagaria o que a pessoa estivesse digitando.
   */
  useEffect(() => {
    if (!selectedJob) {
      setDados(null);
      return;
    }
    const inicial = doJob(selectedJob);
    setDados(inicial);
    setOriginal(JSON.stringify(inicial));
    setAba('conteudo');
    setResultado(null);
    setAjustando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const sujo = useMemo(
    () => Boolean(dados) && JSON.stringify(dados) !== original,
    [dados, original]
  );

  if (!selectedJob || !dados) return null;

  const client = clients.find((c) => c.id === dados.clientId);
  const tipo = definicaoDoTipo(selectedJob.tipo);
  const platform = dados.canais[0] || selectedJob.platform;

  const mudar = (parcial: Partial<RascunhoDoConteudo>) =>
    setDados((atual) => (atual ? { ...atual, ...parcial } : atual));

  /**
   * **Nada é gravado enquanto a pessoa digita.**
   *
   * A alternativa — salvar a cada tecla, ou no `blur` de cada campo — grava
   * o que ela ainda estava escrevendo quando clicou fora para reler a peça.
   * No conteúdo que vai ao perfil do cliente isso publica um rascunho, e o
   * que sai no perfil do cliente não volta. Por isso a gravação é sempre um
   * clique: o "Salvar alterações" da barra, ou um dos botões do workflow, que
   * salvam antes de agir — exatamente como o cadastro faz.
   */
  const salvar = (): Job | undefined => {
    if (!selectedJob) return undefined;

    const campos = camposVisiveis(platform, dados.format);

    const mudancas: Partial<Job> = {
      clientId: dados.clientId,
      title: dados.title.trim(),
      // `platform` é o primeiro da lista: as telas que leem uma rede só
      // continuam funcionando, e `canais` guarda o conjunto completo.
      platform,
      canais: dados.canais,
      format: dados.format,
      priority: dados.priority,
      caption: dados.caption,
      draft: dados.draft,
      firstComment: dados.firstComment,
      cta: dados.cta,
      hashtags: hashtagsDaLinha(dados.hashtags),
      campaign: dados.campaign,
      // Só o que a rede escolhida pede: trocar de canal aqui deixaria para
      // trás a configuração da rede anterior, e ela iria junto para o banco
      // sem aparecer em tela nenhuma.
      configuracoes: Object.fromEntries(
        campos
          .filter((c) => c.destino === 'config')
          .map((c) => [c.chave, dados.configuracoes[c.chave]])
          .filter(([, v]) => v !== undefined && v !== '' && v !== false)
      ),
      mediaUrls: dados.mediaUrls,
      // Só quando o formato pede: guardar a arte do story num post de feed
      // deixaria uma mídia órfã que nenhuma tela mostra.
      storyMediaUrls: dados.format === 'feed_story' ? dados.storyMediaUrls : [],
      scheduledDate: paraIso(dados.scheduledDate),
      deadlineApproval: paraIso(dados.deadlineApproval),
    };

    setSalvando(true);
    updateJob(selectedJob.id, mudancas);
    // O contexto só devolve o job novo no próximo render; o estado local já é
    // a verdade que a tela mostra, então a marca de "sem mudanças" sai daqui.
    setOriginal(JSON.stringify(dados));
    setSelectedJob({ ...selectedJob, ...mudancas } as Job);
    setSalvando(false);
    return { ...selectedJob, ...mudancas } as Job;
  };

  const descartar = () => {
    setDados(doJob(selectedJob));
  };

  /**
   * Fechar com alteração pendente **pergunta**.
   *
   * O `Esc` e o clique fora são caminhos de um toque, e o formulário guarda o
   * trabalho de quem acabou de reescrever uma legenda. Fechar calado aqui é a
   * perda silenciosa que a tela não tem como desfazer.
   */
  const fechar = () => {
    if (!sujo) {
      setSelectedJob(null);
      return;
    }
    pedir({
      titulo: 'Sair sem salvar?',
      descricao:
        'As alterações que você fez neste conteúdo ainda não foram gravadas — ' +
        'legenda, arte, datas e o que mais estiver mudado voltam ao que estava antes.',
      rotuloConfirmar: 'Sair sem salvar',
      rotuloCancelar: 'Continuar editando',
      destrutivo: true,
      aoConfirmar: () => setSelectedJob(null),
    });
  };

  const enviarParaAprovacao = () => {
    salvar();
    /**
     * Só muda o status. Quem avisa o cliente é `dispararAutomacoes`, pelo
     * evento `conteudo_aguardando_aprovacao` — e ele respeita a preferência de
     * "cada" ou "lote" da agência, que é a razão de a checagem morar lá e não
     * aqui (armadilha 9.2).
     */
    updateJob(selectedJob.id, { status: 'for_approval' });
    setResultado({ ok: true, texto: 'Enviado para aprovação do cliente.' });
  };

  /**
   * Agendar **põe na fila de verdade**.
   *
   * Só marcar o status como `scheduled` é a armadilha que já custou caro: o
   * card ficava em "Agendado", a data passava e nada publicava, porque a
   * `publish_queue` não tinha produtor. O editor não tinha este botão — só o
   * cadastro —, então uma peça reagendada depois de criada nunca voltava para
   * a fila.
   */
  const agendar = async () => {
    const atualizado = salvar();
    if (!atualizado) return;

    /**
     * Feed+story sem a arte vertical **não entra na fila**.
     *
     * O servidor já não substitui pela arte do feed — ele publica o feed e
     * deixa o motivo em `last_error` —, mas descobrir ali é tarde: o feed já
     * está no perfil e a peça ficou pela metade. Aqui ainda dá para subir a
     * arte.
     */
    if (faltaArteDoStory(atualizado)) {
      setResultado({ ok: false, texto: AVISO_SEM_ARTE_DE_STORY });
      return;
    }

    setAcao('agendando');
    setResultado(null);
    try {
      updateJob(selectedJob.id, { status: 'scheduled' });

      const conta = (await listarContas()).find(
        (c) => publicaSozinho(c.platform) && c.clientId === atualizado.clientId
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

      await agendarPublicacao(
        conta.workspaceId,
        atualizado.id,
        conta.id,
        atualizado.scheduledDate
      );
      setResultado({
        ok: true,
        texto:
          `Na fila para @${conta.accountName}. O agendador passa de 5 em 5 minutos, ` +
          `então deve sair até ${safeDateTimeFormat(quandoDeveSair(atualizado.scheduledDate))}.`,
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

  const publicar = async () => {
    const atualizado = salvar();
    if (!atualizado) return;

    // Mesma conferência do agendar, e aqui ela pesa mais: o que sai agora não
    // volta.
    if (faltaArteDoStory(atualizado)) {
      setResultado({ ok: false, texto: AVISO_SEM_ARTE_DE_STORY });
      return;
    }

    setAcao('publicando');
    setResultado(null);
    try {
      const { conta, aviso } = await publicarAgora(atualizado.id);
      /**
       * `aviso` é o caso do feed que saiu e do story que não. Ele não pode ler
       * como sucesso liso: a peça está no perfil pela metade, e é isso que a
       * tela precisa dizer.
       */
      setResultado(
        aviso ? { ok: false, texto: aviso } : { ok: true, texto: `Publicado em @${conta}.` }
      );
    } catch (e) {
      /**
       * A falha traz o motivo que o servidor deu. "Publicado" sem conferir
       * seria a tela afirmando o que não aconteceu — e publicação no perfil do
       * cliente é o pior lugar para isso.
       */
      setResultado({
        ok: false,
        texto: e instanceof Error ? e.message : 'Falha ao publicar.',
      });
    } finally {
      setAcao('nenhuma');
    }
  };

  const registrarAjuste = () => {
    if (!feedbackDoAjuste.trim()) return;
    requestAdjustment(selectedJob.id, feedbackDoAjuste, 'Cliente');
    setFeedbackDoAjuste('');
    setAjustando(false);
    setAba('revisoes');
  };

  const excluir = () => {
    pedir({
      titulo: 'Excluir este conteúdo?',
      descricao:
        'A peça sai do quadro, do calendário e do portal do cliente, com as ' +
        'versões, os comentários e as horas lançadas nela. Publicações já ' +
        'agendadas para ela são canceladas.',
      rotuloConfirmar: 'Excluir conteúdo',
      destrutivo: true,
      aoConfirmar: () => {
        deleteJob(selectedJob.id);
        setSelectedJob(null);
      },
    });
  };

  /**
   * A IA só é oferecida quando há título: ele é o tema que a rota exige, e um
   * botão que responde "informe o tema" custa o clique e a descoberta.
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

  const ocupado = acao !== 'nenhuma';
  const feitos = selectedJob.checklist.filter((c) => c.completed).length;
  const cartao =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs';

  return (
    /*
      **`Dialog` do shadcn, e o que ele traz não é acabamento.**

      Esta modal era uma das 25 sobreposições à mão do produto, e entre as 25
      **duas** fechavam com `Esc` e **nenhuma** travava a rolagem do fundo.

      `semFechar` porque o X desta mora no cabeçalho, ao lado do seletor de
      status — e o do primitivo fecharia direto, sem passar pela pergunta de
      "sair sem salvar".
    */
    <Dialog open onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent tamanho="editorComPrevia" semFechar className="p-0 gap-0">
        {/* O título é desenhado no cabeçalho. Aqui ele existe para o leitor de
            tela: sem `DialogTitle` o Radix sobe o diálogo sem nome. */}
        <DialogTitle className="sr-only">{selectedJob.title || 'Conteúdo'}</DialogTitle>

        {/*
          **Quem rola muda com a largura, e isso não é detalhe.**

          No `lg` são duas colunas, cada uma com a própria rolagem — é o que
          mantém o cabeçalho e as abas fixos enquanto o formulário rola.
          Abaixo disso elas viram uma pilha, e a rolagem é **uma só**, aqui.

          A primeira versão manteve as duas rolagens no celular, e o efeito
          foi o pior possível: com `shrink-0` valendo em coluna, a prévia
          segurava os 1208px dela inteiros dentro de 844 de tela, o
          `overflow-hidden` cortava o resto, e **o formulário simplesmente não
          aparecia** — a modal abria na prévia, sem barra de rolagem e sem
          pista de que havia um formulário acima. Medido no Chromium em 390px.
          Por isso `shrink-0` e as rolagens internas são todos `lg:`.
        */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
          {/* ======================= COLUNA PRINCIPAL ======================= */}
          <div className="flex-1 min-w-0 flex flex-col lg:min-h-0">
            {/*
              Header — **empilha no celular.**

              Era `flex items-center justify-between gap-4`: a identidade e os
              controles disputavam os 390px, e quem perdia era a identidade.
            */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-950/70">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <Avatar
                  nome={client?.name || 'Cliente'}
                  url={client?.avatar}
                  tamanho={40}
                  className="border border-slate-200 dark:border-slate-800"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {client?.name}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Atualizado em {safeDateTimeFormat(selectedJob.updatedAt || selectedJob.createdAt)}
                    </span>
                  </div>

                  {/*
                    **O título aqui é leitura, e o campo mora no formulário.**

                    Ele já era editável neste cabeçalho, por clique; agora que
                    a aba Conteúdo tem o campo "Título do conteúdo" do
                    cadastro, dois editores para o mesmo valor deixariam a
                    pergunta "qual dos dois vale" — e um deles guardaria o
                    texto de antes.
                  */}
                  <span className="block text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                    {dados.title || 'Sem título'}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {/* Os selos refletem o **rascunho**, não o que está gravado:
                        trocar o formato no campo abaixo precisa aparecer aqui
                        na hora, senão a linha diria o contrário do campo. */}
                    <PlatformBadge platform={platform} />
                    <FormatBadge
                      format={dados.format}
                      rotulo={rotuloDoFormato(dados.format, platform)}
                    />
                    <VersaoBadge versao={selectedJob.currentVersion} />
                    <PriorityBadge priority={dados.priority} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/*
                  O seletor de status fica **no cabeçalho, não na coluna da
                  direita**, embora o desenho a peça ali: abaixo do `lg` a
                  coluna vira rodapé, e mudar o status passaria a exigir rolar
                  a modal inteira até o fim. É o controle mais usado da tela.
                */}
                <select
                  value={selectedJob.status}
                  onChange={(e) => moveJobStatus(selectedJob.id, e.target.value as JobStatus)}
                  className="flex-1 sm:flex-none min-w-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="ideas">Ideias</option>
                  <option value="in_production">Em Produção</option>
                  <option value="for_approval">Para Aprovação</option>
                  <option value="in_adjustment">Em Ajuste</option>
                  <option value="approved">Aprovado</option>
                  <option value="scheduled">Agendado</option>
                  <option value="published">Publicado</option>
                </select>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={fechar}
                  aria-label="Fechar conteúdo"
                  className="dark:text-slate-300 hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <Tabs
              value={aba}
              onValueChange={(v) => setAba(v as typeof aba)}
              className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden"
            >
              {/*
                **A ordem é a do documento: Conteúdo, Revisões,
                Compartilhamento.** "WhatsApp" virou "Compartilhamento" porque
                o WhatsApp é um dos destinos, não o nome da coisa — e deixou de
                ser modal sobre modal, que obrigava a fechar para reler a
                legenda antes de mandar.

                `min-w-0` é o que faz a faixa rolar: o `min-width:auto` padrão
                de um filho de flex impede que ele encolha abaixo do conteúdo,
                e a lista sumia por baixo do vizinho em vez de virar faixa
                rolável. Medido em 390px.
              */}
              <div className="px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <TabsList
                  aparencia="painel"
                  className="flex-1 min-w-0 border-b-0 px-0 rounded-none bg-transparent dark:bg-transparent"
                >
                  <TabsTrigger value="conteudo">
                    <FileText className="w-3.5 h-3.5" />
                    Conteúdo
                  </TabsTrigger>
                  <TabsTrigger value="revisoes">
                    <History className="w-3.5 h-3.5" />
                    Revisões
                    {/* O selo conta o que **espera resposta**: a conversa com o
                        cliente. Versão não conta — ela é histórico, e um número
                        que não cai ao ser lido treina a pessoa a ignorá-lo. */}
                    {selectedJob.comments.length > 0 && (
                      <TabsBadge>{selectedJob.comments.length}</TabsBadge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="compartilhamento">
                    <Share2 className="w-3.5 h-3.5" />
                    Compartilhamento
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* `p-6` custava 48px dos 390 do aparelho, e o que sobrava era o
                  que espremia os cards de dentro. */}
              <div className="lg:flex-1 lg:overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/50">
                <TabsContent value="conteudo">
                  <div className={`${cartao} p-4 sm:p-5`}>
                    {/*
                      **É o mesmo formulário do cadastro**, montado do mesmo
                      componente. Era aqui que a edição ficava para trás:
                      cliente e canais não dava para trocar, a arte do story
                      não tinha campo, os campos da rede não existiam e o
                      contador de caracteres não contava.
                    */}
                    <FormularioDoConteudo
                      valor={dados}
                      aoMudar={mudar}
                      tipo={tipo}
                      clients={clients}
                      aoGerarComIA={gerarTextoComIA}
                      mostrarDeadline
                    >
                      {/* "Mais opções": o que só existe depois de a peça
                          existir. */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Campanha
                        </label>
                        <input
                          type="text"
                          value={dados.campaign}
                          onChange={(e) => mudar({ campaign: e.target.value })}
                          placeholder="Ex: Lançamento de verão"
                          className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Chamada para ação (CTA)
                        </label>
                        <input
                          type="text"
                          value={dados.cta}
                          onChange={(e) => mudar({ cta: e.target.value })}
                          placeholder="Ex: Comente EU QUERO para receber o link"
                          className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Hashtags
                        </label>
                        {/* A lista viaja como texto separado por espaço: é como
                            a pessoa escreve hashtag e como ela cola de outro
                            lugar. A `#` é acrescentada na volta — quem digita
                            "verao" espera uma hashtag, não um erro silencioso
                            na publicação. */}
                        <input
                          type="text"
                          value={dados.hashtags}
                          onChange={(e) => mudar({ hashtags: e.target.value })}
                          placeholder="#verao #promo #novidade"
                          className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white font-mono"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={() => setIaAberta(true)}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Gerar copy completa com IA
                      </Button>
                    </FormularioDoConteudo>
                  </div>

                  {/*
                    Checklist e timesheet são o **processo interno**, não a
                    peça. Eram duas abas próprias, e disputavam a barra com as
                    três que o documento pediu; recolhidas aqui embaixo elas
                    continuam a um clique, com a contagem à vista para não
                    virarem aba esquecida.
                  */}
                  <Accordion type="single" collapsible className="mt-4 space-y-3">
                    <AccordionItem value="checklist" className={`${cartao} p-4 sm:p-5 block`}>
                      <AccordionTrigger>
                        <CheckSquare className="w-4 h-4 text-slate-400" />
                        Checklist de produção ({feitos}/{selectedJob.checklist.length})
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        {selectedJob.checklist.length === 0 && (
                          <p className="text-xs text-slate-400">
                            Sem itens. O botão "Gerar checklist técnico com IA", na aba
                            Revisões, transforma o pedido do cliente em tarefas.
                          </p>
                        )}
                        {selectedJob.checklist.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 border border-slate-100 dark:border-slate-800 transition cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => toggleChecklistItem(selectedJob.id, item.id)}
                              className="w-4 h-4 rounded-md accent-purple-600 cursor-pointer"
                            />
                            <span
                              className={`text-xs ${
                                item.completed
                                  ? 'line-through text-slate-400 font-medium'
                                  : 'text-slate-800 dark:text-slate-200 font-semibold'
                              }`}
                            >
                              {item.title}
                            </span>
                          </label>
                        ))}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="timesheet" className={`${cartao} p-4 sm:p-5 block`}>
                      <AccordionTrigger>
                        <Timer className="w-4 h-4 text-slate-400" />
                        Horas neste conteúdo ({selectedJob.timesheetMinutes || 0}m)
                      </AccordionTrigger>
                      <AccordionContent>
                        <PainelDeTimesheet job={selectedJob} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                <TabsContent value="revisoes">
                  <PainelDeRevisoes job={selectedJob} />
                </TabsContent>

                <TabsContent value="compartilhamento">
                  <PainelDeCompartilhamento job={selectedJob} />
                </TabsContent>
              </div>
            </Tabs>

            {/*
              **A barra de salvar só existe quando há o que salvar.**

              Fixa no rodapé da coluna e fora da área que rola: um botão de
              salvar que exige rolar até o fim de um formulário de doze campos
              é um botão que a pessoa não encontra — e o trabalho dela fica
              sem gravar sem que nada avise.
            */}
            {sujo && (
              <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 sm:mr-auto">
                  Alterações não salvas
                </span>
                <div className="flex items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                  <Button variant="ghost" type="button" onClick={descartar}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Descartar
                  </Button>
                  <Button type="button" onClick={() => salvar()} disabled={salvando}>
                    <Save className="w-3.5 h-3.5" />
                    Salvar alterações
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ========================= COLUNA DIREITA ========================= */}
          {/* Abaixo do `lg` ela vira rodapé: no celular a prévia e as ações
              caem embaixo do formulário, na ordem em que se decide. */}
          <aside className="lg:w-[400px] lg:shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 lg:overflow-y-auto p-4 sm:p-5 space-y-4">
            {/*
              **A prévia não existia na edição.** Ela responde antes de
              publicar a pergunta que só a captura de tela respondia: a arte
              corta na proporção do feed, a legenda cabe, o perfil é o do
              cliente certo. Quem criava no cadastro tinha isso à vista; quem
              abria a peça no dia seguinte, não.

              O título é dela: escrever "Prévia" aqui em cima punha a palavra
              duas vezes, uma embaixo da outra.
            */}
            <div>
              <PreviaDaRede
                className="w-full"
                dados={{
                  nomeDoPerfil: client?.name || '',
                  avatar: client?.avatar,
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

            {/* Ações de workflow */}
            <div className={`${cartao} p-4 space-y-3`}>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Ações de workflow
              </span>

              {/*
                **Toda ação daqui salva antes de agir**, como os botões do
                cadastro fazem. Publicar o que está no banco enquanto a tela
                mostra outra coisa é o pior desfecho possível: a legenda que
                foi ao ar não é a que a pessoa acabou de ler.
              */}
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={enviarParaAprovacao}
                  disabled={selectedJob.status === 'for_approval' || ocupado}
                  title={
                    selectedJob.status === 'for_approval'
                      ? 'Esta peça já está com o cliente'
                      : 'Salva e manda para o cliente aprovar no portal'
                  }
                >
                  <Send className="w-4 h-4" />
                  Enviar para aprovação
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void agendar()}
                  disabled={ocupado}
                  className="text-slate-700 dark:text-slate-200"
                  title="Salva e põe na fila de publicação, na data marcada"
                >
                  <CalendarClock className="w-4 h-4" />
                  {acao === 'agendando' ? 'Agendando...' : 'Agendar publicação'}
                </Button>

                {/* Publicar agora fica por último e com a cor de aviso: é a
                    única ação da tela que não tem volta. */}
                <Button
                  onClick={() => void publicar()}
                  disabled={ocupado || selectedJob.status === 'published'}
                  title={
                    selectedJob.status === 'published'
                      ? 'Esta peça já foi publicada'
                      : 'Salva e publica no perfil conectado do cliente, agora. Não tem volta.'
                  }
                  className="border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60"
                >
                  <Send className="w-4 h-4" />
                  {acao === 'publicando' ? 'Publicando...' : 'Publicar agora'}
                </Button>
              </div>

              {/* O que o servidor respondeu, com o texto que ele mandou.
                  Em linha e não em diálogo: o erro continua legível enquanto a
                  pessoa relê a peça, e num diálogo ele some ao ser dispensado. */}
              {resultado && (
                <p
                  className={`text-[11px] font-semibold p-2 rounded-lg border leading-relaxed ${
                    resultado.ok
                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
                      : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                  }`}
                >
                  {resultado.texto}
                </p>
              )}

              {/* As decisões do cliente, no momento em que elas existem. */}
              {selectedJob.status === 'for_approval' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="success"
                    onClick={() => approveJob(selectedJob.id, 'Agência')}
                    className="active:bg-emerald-800"
                  >
                    <Check className="w-4 h-4" />
                    Aprovar
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => setAjustando(true)}
                    className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Pedir ajuste
                  </Button>
                </div>
              )}

              {ajustando && (
                <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900 space-y-2">
                  <label className="block text-[11px] font-bold text-rose-800 dark:text-rose-300">
                    Motivo do ajuste (obrigatório):
                  </label>
                  <textarea
                    rows={3}
                    value={feedbackDoAjuste}
                    onChange={(e) => setFeedbackDoAjuste(e.target.value)}
                    placeholder="Ex: Trocar o slide 2 para o produto lançamento..."
                    className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setAjustando(false)}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={registrarAjuste}
                      className="bg-rose-600 text-white"
                    >
                      Confirmar pedido
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Metadados: o que a tela sabe e não se edita. */}
            <div className={`${cartao} p-4 grid grid-cols-2 gap-3 text-xs`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Responsável
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentUser.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Versão atual
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  v{selectedJob.currentVersion}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Criado em
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {safeDateTimeFormat(selectedJob.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Última atualização
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {safeDateTimeFormat(selectedJob.updatedAt || selectedJob.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => duplicateJob(selectedJob.id)}>
                <DuplicateIcon className="w-3.5 h-3.5" />
                Duplicar
              </Button>

              {/* Exclusão pergunta, e a pergunta diz a consequência — não "tem
                  certeza?". É a regra dos diálogos do projeto. */}
              <Button variant="destructive" onClick={excluir} className="text-rose-600">
                <Trash2 className="w-3.5 h-3.5" />
                Excluir conteúdo
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>

      {/*
        As sub-modais ficam **fora** do `DialogContent`, dentro do `Dialog`.
        Aninhadas no conteúdo elas herdariam a trava de foco dele: o `Tab`
        dentro da modal de IA continuaria circulando pelos campos desta, atrás.
      */}
      <AiCopyModal
        isOpen={iaAberta}
        onClose={() => setIaAberta(false)}
        clientId={dados.clientId}
        initialTheme={dados.title}
        /* Cai no **rascunho**, não no banco: é uma sugestão, e gravá-la direto
           publicaria um texto que ninguém leu. Quem grava continua sendo o
           "Salvar alterações". */
        onApplyCopy={(copy) =>
          mudar({
            caption: copy.caption,
            cta: copy.cta,
            hashtags: (copy.hashtags || []).join(' '),
          })
        }
      />

      {dialogo}
    </Dialog>
  );
};
