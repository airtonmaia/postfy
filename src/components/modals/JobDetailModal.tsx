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
  CheckCircle2,
  MoreHorizontal,
  History,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { JobStatus, Job, JobPlatform, AbaDoConteudo } from '../../types';
import { AiCopyModal } from './AiCopyModal';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsBadge } from '../ui/tabs';
import { TrilhaDeEtapas } from '../jobs/TrilhaDeEtapas';
import { avisosDosCanais, dataJaPassou } from '../../lib/avisosDaPeca';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { useConfirmacao } from '../ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { duracaoLegivel } from '../../lib/historicoDeEtapas';
import { PreviaDaRede } from '../common/PreviaDaRede';
import {
  FormularioDoConteudo,
  type DadosDoConteudo,
  type BlocoDoFormulario,
} from '../jobs/FormularioDoConteudo';
import { AssistenteDoConteudo, type PassoDoConteudo } from '../jobs/AssistenteDoConteudo';
import { useTelaEstreita } from '../../lib/telaEstreita';
import { PainelDeRevisoes } from '../jobs/PainelDeRevisoes';
import { PainelDeCompartilhamento } from '../jobs/PainelDeCompartilhamento';
import { definicaoDoTipo } from '../../lib/tiposDeJob';
import { camposVisiveis } from '../../lib/camposDoCanal';
import { rotuloDoFormato, faltaArteDoStory, AVISO_SEM_ARTE_DE_STORY } from '../../lib/formatos';
import { deParedeParaUtc, deUtcParaParede } from '../../lib/fusoHorario';
import { safeDateFormat } from '../../lib/utils';
import {
  publicarAgora,
  textoDaPublicacao,
  agendarPublicacao,
  textoDoAgendamento,
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
  responsaveis: job.responsaveis || [],
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
    abaDoConteudo,
    setAbaDoConteudo,
    clients,
    users,
    moveJobStatus,
    approveJob,
    requestAdjustment,
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
  const [aba, setAba] = useState<AbaDoConteudo>('conteudo');
  const [dados, setDados] = useState<RascunhoDoConteudo | null>(null);
  const [original, setOriginal] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [acao, setAcao] = useState<'nenhuma' | 'agendando' | 'publicando'>('nenhuma');
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const [feedbackDoAjuste, setFeedbackDoAjuste] = useState('');
  const [iaAberta, setIaAberta] = useState(false);
  /* A prévia nasce fechada: ver abaixo, no botão que a abre. */
  const [previaAberta, setPreviaAberta] = useState(false);
  /* A trilha nasce recolhida: ver abaixo, onde ela é montada. */
  const [trilhaAberta, setTrilhaAberta] = useState(false);
  const estreita = useTelaEstreita();
  /**
   * As redes em que **este cliente** tem conta conectada.
   *
   * Vem de `social_connections`, que não está na carga inicial: é consulta
   * própria, feita ao abrir a peça. Começa vazia e isso é deliberado — o
   * estado "ainda não sei" e o estado "não tem conta" dizem a mesma coisa para
   * quem lê o aviso: *não conte com o disparo automático*. Errar para esse
   * lado custa uma frase a mais; errar para o outro é a peça não sair.
   */
  const [redesConectadas, setRedesConectadas] = useState<JobPlatform[]>([]);
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
    /*
      A aba de abertura vem de quem mandou abrir — o "Ver histórico" do card
      cai em Revisões. E volta para o padrão na mesma passada: sem isso, o
      próximo conteúdo aberto de qualquer outro lugar herdaria a escolha do
      anterior, e a modal abriria numa aba que ninguém pediu.
    */
    setAba(abaDoConteudo);
    setAbaDoConteudo('conteudo');
    setResultado(null);
    setAjustando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  /*
    As contas conectadas **do cliente desta peça**, para o aviso dizer o que
    acontece na data. Depende de `clientId` e não só de `jobId`: trocar o
    cliente no formulário muda a resposta, e um aviso que não acompanha a
    troca é pior que aviso nenhum — ele afirma sobre o cliente anterior.
  */
  const clienteDaPeca = dados?.clientId;
  useEffect(() => {
    if (!clienteDaPeca) {
      setRedesConectadas([]);
      return;
    }
    let vivo = true;
    void listarContas()
      .then((contas) => {
        if (!vivo) return;
        setRedesConectadas(
          contas.filter((c) => c.clientId === clienteDaPeca).map((c) => c.platform)
        );
      })
      // Falha de leitura vale "não tem conta": o aviso mais cauteloso é o que
      // não promete disparo automático.
      .catch(() => vivo && setRedesConectadas([]));
    return () => {
      vivo = false;
    };
  }, [clienteDaPeca]);

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
      responsaveis: dados.responsaveis,
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
   * O seletor de etapa, montado **uma vez**, em um de dois lugares.
   *
   * Ele morava no cabeçalho, e a razão escrita era boa: abaixo do `lg` a
   * coluna da direita vira rodapé, e mudar a etapa passaria a exigir rolar a
   * modal inteira até o fim. Na tela larga, porém, ele ficava longe de tudo
   * que fala da mesma coisa — cliente, canais, formato, responsáveis, datas —,
   * e o cabeçalho é a identidade da peça, não um painel de controle.
   *
   * Então ele muda de casa com a largura, pelo **mesmo** `estreita` que já
   * escolhe entre o assistente e as duas colunas: no computador ele abre a
   * Gestão; no celular continua no cabeçalho, onde se alcança sem rolar. Dois
   * seletores ao mesmo tempo deixariam a pergunta de qual dos dois vale.
   */
  const seletorDeEtapa = (
    <select
      value={selectedJob.status}
      onChange={(e) => moveJobStatus(selectedJob.id, e.target.value as JobStatus)}
      aria-label="Etapa do conteúdo"
      className="w-full min-w-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 cursor-pointer"
    >
      <option value="ideas">Ideias</option>
      <option value="in_production">Em Produção</option>
      <option value="for_approval">Para Aprovação</option>
      <option value="in_adjustment">Em Ajuste</option>
      <option value="approved">Aprovado</option>
      <option value="scheduled">Agendado</option>
      <option value="published">Publicado</option>
    </select>
  );

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

      // Um item por canal marcado, e a escolha da conta mora em
      // `agendarPublicacao`: o `find` que estava aqui pegava uma conta só.
      const resultadoDoAgendamento = await agendarPublicacao(atualizado);
      setResultado(textoDoAgendamento(resultadoDoAgendamento, atualizado.scheduledDate));
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
      /**
       * O texto sai de `textoDaPublicacao`, e ele **nomeia a rede**.
       *
       * Esta tela dizia `Publicado em @conta` — verdadeira sobre a conta e
       * muda sobre onde a peça saiu. Foi assim que um conteúdo marcado só
       * como Facebook apareceu no Instagram com a tela em verde: o servidor
       * escolhia a conta errada, e a frase não tinha como acusar.
       *
       * O `aviso` do story entra no mesmo texto: a peça está no perfil pela
       * metade, e isso não pode ler como sucesso liso.
       */
      setResultado(textoDaPublicacao(await publicarAgora(atualizado.id)));
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

  /**
   * Os passos do celular, derivados do mesmo formulário da tela larga.
   *
   * No computador a tela tem duas colunas — a peça de um lado, a gestão do
   * outro. Abaixo do `lg` as duas viram uma lista só, com doze campos, uma
   * área de upload e duas de texto no meio: rolar isso para trocar a data é o
   * que faz alguém preferir abrir o notebook.
   *
   * A arte entra **só quando o tipo pede arte**: copy e roteiro são texto, e
   * um passo "Arte" vazio é a tela pedindo algo que não existe.
   */
  const camposDoPasso = (blocos: BlocoDoFormulario[]) => (
    <FormularioDoConteudo
      valor={dados}
      aoMudar={mudar}
      tipo={tipo}
      clients={clients}
      equipe={users}
      aoGerarComIA={gerarTextoComIA}
      mostrarDeadline
      avisarAtraso={selectedJob.status !== 'published'}
      blocos={blocos}
      semTitulo
    />
  );

  const passosDoConteudo: PassoDoConteudo[] = [
    {
      chave: 'identificacao',
      rotulo: 'Básico',
      descricao: 'De quem é a peça, onde ela sai e como ela se chama.',
      conteudo: camposDoPasso(['identificacao']),
    },
    ...(tipo.pedeArte
      ? [
          {
            chave: 'arte',
            rotulo: 'Arte',
            descricao: 'As imagens ou os vídeos que vão publicados.',
            conteudo: camposDoPasso(['arte']),
          },
        ]
      : []),
    {
      chave: 'texto',
      rotulo: 'Texto',
      descricao: 'A legenda que vai publicada, e o rascunho que fica aqui dentro.',
      conteudo: camposDoPasso(['texto']),
    },
    {
      chave: 'agenda',
      rotulo: 'Agenda',
      descricao: 'Quando a peça sai, e o prazo combinado com o cliente.',
      conteudo: camposDoPasso(['agenda']),
    },
  ];

  const ocupado = acao !== 'nenhuma';
  const cartao =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs';

  return (
    /*
      **`Dialog` do shadcn, e o que ele traz não é acabamento.**

      Esta modal era uma das 25 sobreposições à mão do produto, e entre as 25
      **duas** fechavam com `Esc` e **nenhuma** travava a rolagem do fundo.

      **O fechar é o do primitivo**, e por isso ele fica onde fica em todas as
      outras: `absolute top-3 right-3`. Esta modal tinha um X próprio, dentro
      da linha do cabeçalho — então ele andava com o conteúdo do cabeçalho e
      ficava num lugar diferente do de qualquer outra tela.

      Usar o do primitivo é seguro aqui porque o `open` é fixo: fechar dispara
      `onOpenChange(false)`, que cai no `fechar()` logo abaixo e **pergunta**
      antes de descartar. A modal só some quando `selectedJob` vira nulo.

      (Era por isto que existia o `semFechar`: supunha-se que o X do primitivo
      fecharia direto, sem passar pela pergunta de "sair sem salvar". Ele não
      fecha — quem fecha é o `open`, e o `open` daqui é fixo.)
    */
    <Dialog open onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent tamanho="editorComPrevia" className="p-0 gap-0">
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
            <div className="p-4 sm:p-5 pr-12 lg:pr-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-950/70">
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
                    **O título é editado aqui, e só aqui.**

                    Ele já tinha sido os dois: editável no cabeçalho, depois
                    somente leitura com o campo "Título do conteúdo" na coluna
                    de gestão. O que não pode é ser os dois ao mesmo tempo —
                    dois campos para o mesmo valor na mesma tela deixam a
                    pergunta de qual deles vale.

                    E entre os dois lugares, este é onde o título é **lido**:
                    corrigir uma palavra ali embaixo, numa coluna que fala de
                    datas e canais, é procurar o campo longe do texto que
                    incomodou.

                    É um `input` sem moldura, com a mesma fonte do título: a
                    alternativa — clicar para virar campo — esconde que dá para
                    editar, que é o estado em que ele já esteve.
                  */}
                  <input
                    type="text"
                    value={dados.title}
                    onChange={(e) => mudar({ title: e.target.value })}
                    placeholder="Sem título"
                    aria-label="Título do conteúdo"
                    className="block w-full bg-transparent border border-transparent rounded-lg -ml-1.5 px-1.5 py-0.5 mt-0.5 text-base font-bold text-slate-900 dark:text-white truncate hover:border-slate-300 dark:hover:border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 outline-hidden transition"
                  />

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
                {/* No celular ele fica aqui, porque a Gestão — onde ele mora na
                    tela larga — vira o passo "Básico" do assistente, atrás de
                    um toque. Ver `seletorDeEtapa`. */}
                {estreita && <div className="flex-1 sm:w-40">{seletorDeEtapa}</div>}
              </div>
            </div>

            {/*
              A trilha fica **entre o cabeçalho e as abas**, e não dentro da
              aba Conteúdo: ela vale para as três. Dentro de uma delas, quem
              abrisse em Revisões — que é o caminho do "Ver histórico" do card
              — perderia de vista onde a peça está, justamente na aba que fala
              de por onde ela passou.
            */}
            {/*
              **A trilha pode ser recolhida, e nasce recolhida.**

              Ela nascia aberta, pelo argumento de que quem nunca a vê não
              descobre que ela existe — e o argumento valia enquanto recolhida
              ela sumia por inteiro, deixando um botão "Ver fluxo" sozinho.
              Agora a faixa recolhida **diz a etapa e há quanto tempo a peça
              está nela**, que é a resposta mais usada da régua: ela não precisa
              estar aberta para informar, e os 60px da fileira de sete bolinhas
              voltam para a arte, numa tela que já estava cheia demais.

              **O estado não é guardado**, de propósito. Guardá-lo exigiria uma
              coluna em `user_settings` (a armadilha 4 proíbe o `localStorage`
              para dado de agência), e preferência que mora no banco e ninguém
              lembra de ter ligado é como a pessoa encontra uma tela sem metade
              do que ela espera. Recolher vale para a sessão, que é o tempo em
              que a pessoa está trabalhando naquela peça.
            */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <TrilhaDeEtapas
                job={selectedJob}
                aberta={trilhaAberta}
                aoAlternar={() => setTrilhaAberta((v) => !v)}
              />
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
                  {estreita ? (
                    /*
                      **No celular a aba Conteúdo vira passos.**

                      Aqui ela precisa de mais que os dois blocos da coluna da
                      esquerda: a gestão, que no computador mora na coluna da
                      direita, no telefone vira um passo — senão ela ficaria
                      numa lista longa embaixo de tudo, que é o que esta
                      entrega veio resolver.

                      E por isso o cartão de Gestão da coluna da direita sai
                      nessa largura: os mesmos campos em dois lugares da mesma
                      tela fariam a pessoa editar um e achar que o outro não
                      salvou.
                    */
                    /*
                      **Sem a barra de ações do assistente**, e isso é a regra
                      de "uma barra de salvar de cada vez": o rodapé da modal
                      agora é fixo em toda largura e já traz o Salvar. Mantê-la
                      aqui daria dois "Salvar alterações" na mesma tela, e a
                      pessoa não teria como saber se são o mesmo.
                    */
                    <AssistenteDoConteudo passos={passosDoConteudo} />
                  ) : (
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
                      equipe={users}
                      aoGerarComIA={gerarTextoComIA}
                      mostrarDeadline
                      avisarAtraso={selectedJob.status !== 'published'}
                      blocos={['arte', 'texto']}
                    />
                  </div>
                  )}
                </TabsContent>

                <TabsContent value="revisoes">
                  <PainelDeRevisoes job={selectedJob} />
                </TabsContent>

                <TabsContent value="compartilhamento">
                  <PainelDeCompartilhamento job={selectedJob} />
                </TabsContent>
              </div>
            </Tabs>

          </div>

          {/* ========================= COLUNA DIREITA ========================= */}
          {/* Abaixo do `lg` ela vira rodapé: no celular a prévia e as ações
              caem embaixo do formulário, na ordem em que se decide. */}
          <aside className="lg:w-[400px] lg:shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 lg:overflow-y-auto p-4 sm:p-5 lg:pt-12 space-y-4">
            {/*
              **A prévia não existia na edição.** Ela responde antes de
              publicar a pergunta que só a captura de tela respondia: a arte
              corta na proporção do feed, a legenda cabe, o perfil é o do
              cliente certo. Quem criava no cadastro tinha isso à vista; quem
              abria a peça no dia seguinte, não.

              O título é dela: escrever "Prévia" aqui em cima punha a palavra
              duas vezes, uma embaixo da outra.
            */}
            {/*
              **A prévia passou a nascer fechada, em toda largura.**

              Ela ocupava o topo inteiro da coluna — uma moldura de celular com
              a arte, a legenda e os ícones da rede —, e empurrava "Ações de
              workflow" e "Sobre a peça" para fora da dobra. Quem abre a peça
              vem decidir sobre ela; conferir o enquadramento é um segundo
              momento, e agora ele custa um clique em vez de a decisão custar
              uma rolagem.

              O botão fica onde a prévia estava, e **continua inline**: uma
              modal sobre modal cobriria a legenda, que é justamente o que se
              relê enquanto se olha a prévia. Foi por isso que o
              compartilhamento deixou de ser modal.
            */}
            <Button
              variant="outline"
              type="button"
              onClick={() => setPreviaAberta((v) => !v)}
              className="w-full"
              aria-expanded={previaAberta}
            >
              {previaAberta ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {previaAberta ? 'Ocultar prévia' : 'Ver prévia da publicação'}
            </Button>

            <div className={previaAberta ? '' : 'hidden'}>
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


            {/*
              **Gestão: tudo que não é a arte nem o texto.**

              Cliente, canais, título, formato, responsáveis, prioridade e as
              datas ficavam acima da arte, empurrando a peça — que é o assunto
              da tela — para baixo da dobra. Aqui eles continuam editáveis e
              deixam a coluna da esquerda com uma coisa só.

              **É o mesmo componente da esquerda, com outro recorte.** Uma
              cópia dos campos aqui divergiria na primeira pressa, e divergir
              num formulário significa um campo que some de um lado sem
              ninguém notar.

              Ele vem **depois** das ações: a gestão tem sete campos, e pô-la
              em cima devolveria o problema que esta entrega veio resolver —
              as ações fora da dobra.
            */}
            {!estreita && (
            <div className={`${cartao} p-4 space-y-3`}>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Gestão
              </span>

              {/*
                **A etapa abre a Gestão**, e é a primeira coisa da coluna: ela
                é o controle mais usado da tela, e no cabeçalho ficava longe de
                tudo que fala da mesma peça. Ver `seletorDeEtapa` para o porquê
                de ele trocar de casa com a largura em vez de existir nos dois
                lugares.
              */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Etapa
                </label>
                {seletorDeEtapa}
              </div>

              <FormularioDoConteudo
                valor={dados}
                aoMudar={mudar}
                tipo={tipo}
                clients={clients}
                equipe={users}
                mostrarDeadline
                avisarAtraso={selectedJob.status !== 'published'}
                blocos={['identificacao', 'agenda']}
                semTitulo
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
            )}

          </aside>
        </div>

        {/*
          **O que o servidor respondeu fica colado no rodapé que disparou.**

          Ele morava no cartão "Ações de workflow", na coluna da direita, junto
          dos botões. Com a ação no rodapé, a resposta dela na outra ponta da
          tela — e, no celular, abaixo de tudo — é uma resposta que ninguém lê:
          a pessoa clica em "Publicar agora" e nada parece acontecer.

          Em linha e não em diálogo, como antes: o erro continua legível
          enquanto a pessoa relê a peça, e num diálogo ele some ao ser
          dispensado.
        */}
        {/*
          **O motivo do ajuste é pedido onde a ação foi disparada.**

          Ele é obrigatório: "pedir ajuste" sem dizer o quê devolve a peça para
          a produção sem nada explicando por quê, e é esse texto que vira o
          `lastFeedback` que a aba Revisões mostra para sempre. Em faixa e não
          em diálogo, pela mesma razão do resultado: ele fica legível enquanto
          a pessoa relê a legenda de que vai falar.
        */}
        {ajustando && (
          <div className="shrink-0 border-t border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 px-4 sm:px-5 py-3 space-y-2">
            <label className="block text-[11px] font-bold text-rose-800 dark:text-rose-300">
              Motivo do ajuste (obrigatório):
            </label>
            <textarea
              rows={2}
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

        {resultado && (
          <div
            className={`shrink-0 px-4 sm:px-5 py-2 text-[11px] font-semibold leading-relaxed border-t ${
              resultado.ok
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
                : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
            }`}
          >
            {resultado.texto}
          </div>
        )}

        {/*
          ======================= RODAPÉ DE AÇÕES =======================

          **Ele é fixo, existe em toda largura e está sempre aqui.**

          A barra de salvar aparecia só quando havia mudança, e só na coluna da
          esquerda; as ações de workflow eram quatro botões empilhados na
          coluna da direita, abaixo da prévia e da gestão. Eram dois lugares
          para a mesma pergunta — *e agora, o que eu faço com esta peça?* —, e
          nenhum dos dois estava à vista o tempo todo.

          Agora é um rodapé só, fora da área que rola, atravessando as duas
          colunas: salvar está sempre a um clique, em qualquer passo e em
          qualquer aba, que é o que se pediu. As outras três ações moram na
          seta ao lado dele — elas são raras perto do salvar, e todas **salvam
          antes de agir**, então o botão principal é o resumo honesto do que a
          seta faz.
        */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-5 py-2.5 flex items-center gap-3">
          {/*
            "Mais ações" guarda o que mexe na peça inteira. Excluir atrás de um
            clique a mais é de propósito: ela ficava solta no fim da coluna da
            direita, que é onde o dedo para ao procurar o fim da página.
          */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                aria-label="Mais ações"
                className="shrink-0"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Mais ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem onSelect={() => duplicateJob(selectedJob.id)}>
                <DuplicateIcon className="w-4 h-4 text-slate-400" />
                Duplicar conteúdo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Exclusão pergunta, e a pergunta diz a consequência — não "tem
                  certeza?". É a regra dos diálogos do projeto. */}
              <DropdownMenuItem
                onSelect={excluir}
                className="text-rose-600 dark:text-rose-400 focus:text-rose-700"
              >
                <Trash2 className="w-4 h-4" />
                Excluir conteúdo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/*
            **O meio diz o estado da gravação, e ele não afirma o que não
            mediu.** Com mudança pendente ele diz que há mudança pendente; sem
            ela, há quanto tempo foi a última alteração — que sai de
            `jobs.updated_at`, carimbada pelo gatilho do banco.
          */}
          <span className="flex-1 min-w-0 text-center text-[11px] leading-tight">
            {sujo ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Alterações não salvas
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden sm:inline font-semibold">Última alteração</span>
                <span>
                  há{' '}
                  {duracaoLegivel(
                    Date.now() -
                      Date.parse(selectedJob.updatedAt || selectedJob.createdAt)
                  )}
                </span>
              </span>
            )}
          </span>

          {/*
            Botão dividido, o mesmo desenho do "Adicionar mídia": a ação comum
            no clique direto, as outras na seta. A emenda é o canto reto do lado
            colado e a linha translúcida na cor do texto — e não uma moldura em
            volta, que faria o par ler como campo de formulário.
          */}
          <div className="flex items-stretch shrink-0">
            <Button
              type="button"
              onClick={() => salvar()}
              /* Desligado sem mudança: um `updateJob` com os mesmos valores
                 escreve no banco e carimba `updated_at` à toa, e a tela passaria
                 a dizer "há menos de 1m" sobre uma alteração que não houve. */
              disabled={salvando || !sujo}
              aria-label="Salvar alterações"
              className="rounded-none rounded-l-lg"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar
              <span className="hidden sm:inline">&nbsp;alterações</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  type="button"
                  disabled={ocupado}
                  aria-label="Outras ações da peça"
                  className="rounded-none rounded-r-lg border-l border-primary-foreground/25"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="top" className="w-72">
                {/*
                  **O que acontece na data, canal por canal — antes do clique.**

                  Isto saía de `textoDoAgendamento`, ou seja, **depois** de a
                  peça já estar na fila: a tela oferecia "Agendar publicação", a
                  peça entrava como agendada, e só então aparecia que aquele
                  cliente não tem conta conectada. No dia, ninguém publica.

                  Ele mora **dentro** do menu porque é aqui que se decide: na
                  coluna da direita ele ficava longe do botão, e no celular,
                  abaixo dele. É a mesma correção que `faltaArteDoStory` já
                  recebeu — a conferência vale onde ainda dá para agir.
                */}
                {avisosDosCanais(dados.canais, redesConectadas).map((a) => (
                  <p
                    key={a.canal}
                    className={`flex items-start gap-1.5 px-2 py-1 text-[11px] leading-relaxed ${
                      a.automatico
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-amber-700 dark:text-amber-400 font-semibold'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                        a.automatico ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {a.texto}
                  </p>
                ))}

                <DropdownMenuLabel>
                  {/*
                    **Toda ação daqui salva antes de agir**, como os botões do
                    cadastro fazem. Publicar o que está no banco enquanto a tela
                    mostra outra coisa é o pior desfecho possível: a legenda que
                    foi ao ar não é a que a pessoa acabou de ler.
                  */}
                  Salvar e…
                </DropdownMenuLabel>

                {/*
                  **A decisão do cliente desceu para cá junto com o resto.**

                  Ela teve cartão próprio na coluna da direita por uma entrega,
                  com o argumento de que aprovar em nome do cliente e devolver
                  para ajuste não são "mais um botão de workflow". O argumento
                  continua certo e a conclusão estava errada: um cartão que só
                  existe enquanto a peça está em aprovação faz a coluna mudar de
                  altura conforme a etapa, e as ações da tela passam a sair de
                  dois lugares de novo — que é o que o rodapé veio acabar.

                  Elas só aparecem **enquanto a peça está com o cliente**, que é
                  quando a decisão existe.
                */}
                {selectedJob.status === 'for_approval' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => approveJob(selectedJob.id, 'Agência')}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold"
                    >
                      <Check className="w-4 h-4" />
                      Aprovar em nome do cliente
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onSelect={() => setAjustando(true)}
                      className="text-rose-600 dark:text-rose-400"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Pedir ajuste
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem
                  onSelect={enviarParaAprovacao}
                  disabled={selectedJob.status === 'for_approval' || ocupado}
                >
                  <Send className="w-4 h-4 text-slate-400" />
                  {selectedJob.status === 'for_approval'
                    ? 'Já está com o cliente'
                    : 'Enviar para aprovação'}
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={() => void agendar()} disabled={ocupado}>
                  <CalendarClock className="w-4 h-4 text-slate-400" />
                  {acao === 'agendando' ? 'Agendando...' : 'Agendar publicação'}
                </DropdownMenuItem>

                {/* Publicar agora fica por último e com a cor de aviso: é a
                    única ação da tela que não tem volta.

                    **Só aparece quando algum canal marcado publica sozinho.**
                    Numa peça só de LinkedIn ele existia e o servidor recusava
                    — botão que promete o que não faz é pior que botão
                    ausente. A condição deriva de `REDES_QUE_PUBLICAM`, nunca
                    de um nome de rede escrito aqui: era `includes('instagram')`
                    no cadastro, e foi isso que escondeu o Facebook depois de
                    ele já publicar. */}
                {dados.canais.some(publicaSozinho) && (
                  <DropdownMenuItem
                    onSelect={() => void publicar()}
                    disabled={ocupado || selectedJob.status === 'published'}
                    className="text-amber-700 dark:text-amber-400 font-semibold"
                  >
                    <Send className="w-4 h-4" />
                    {acao === 'publicando'
                      ? 'Publicando...'
                      : selectedJob.status === 'published'
                        ? 'Já foi publicada'
                        : 'Publicar agora'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
