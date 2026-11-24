import React, { useState, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import {
  ThumbsUp, Send, CheckCircle2, AlertTriangle,
  Lightbulb, CalendarClock, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import { Job, JobStatus } from '../../types';
import { definicaoDoTipo } from '../../lib/tiposDeJob';
import { Avatar } from '../common/Avatar';
import { FormatBadge, PlatformBadge, PriorityBadge } from '../common/Badges';
import { PreviaDaRede } from '../common/PreviaDaRede';
import {
  FormularioDoConteudo,
  type DadosDoConteudo,
} from '../jobs/FormularioDoConteudo';
import { camposVisiveis } from '../../lib/camposDoCanal';
import { deParedeParaUtc, deUtcParaParede } from '../../lib/fusoHorario';
import { safeDateFormat } from '../../lib/utils';
import {
  publicaSozinho,
  publicarAgora,
  textoDaPublicacao,
  agendarPublicacao,
  textoDoAgendamento,
  quandoDeveSair,
  listarContas,
  clienteTemIntegracao,
} from '../../lib/redes';
import { faltaArteDoStory, AVISO_SEM_ARTE_DE_STORY, rotuloDoFormato } from '../../lib/formatos';
import { Button } from '../ui/button';
import { useAviso } from '../ui/alert-dialog';
import { AssistenteDoConteudo, type PassoDoConteudo } from '../jobs/AssistenteDoConteudo';
import { useTelaEstreita } from '../../lib/telaEstreita';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

/** Um conteúdo em branco, como ele nasce. */
const EM_BRANCO: DadosDoConteudo = {
  clientId: '',
  title: '',
  // Ninguém atribuído é um estado legítimo: a peça nasce na pauta e ganha
  // dono quando a agência distribui o trabalho.
  responsaveis: [],
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
    users,
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

  const [erro, setErro] = useState('');

  // Mora aqui em cima, junto dos outros hooks, e não perto das funções que os
  // usam: abaixo há um `return null` quando a modal está fechada, e hook
  // declarado depois dele só roda em parte das renderizações. O React derruba
  // a tela inteira com "rendered more hooks than during the previous render"
  // (armadilha 8.1) — que foi exatamente o que aconteceu uma vez.
  const [acao, setAcao] = useState<'nenhuma' | 'agendando' | 'publicando'>('nenhuma');
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const ocupado = acao !== 'nenhuma';

  const [previaAberta, setPreviaAberta] = useState(false);
  const estreita = useTelaEstreita();

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
      setPreviaAberta(false);
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
        responsaveis: dados.responsaveis,
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

    const contas = await listarContas().catch(() => []);
    const temIntegracao = clienteTemIntegracao(novo.clientId, contas, novo.canais);

    // Feed+story sem a arte vertical não entra na fila: ver `faltaArteDoStory`.
    if (temIntegracao && faltaArteDoStory(novo)) {
      setResultado({ ok: false, texto: AVISO_SEM_ARTE_DE_STORY });
      return;
    }

    setAcao('agendando');
    setResultado(null);
    try {
      if (temIntegracao) {
        const resultadoDoAgendamento = await agendarPublicacao(novo);
        setResultado(textoDoAgendamento(resultadoDoAgendamento, novo.scheduledDate));
      } else {
        setResultado({
          ok: true,
          texto: 'Conteúdo agendado no calendário.',
        });
      }
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

    // Mesma conferência do agendar, e aqui ela pesa mais: o que sai agora não
    // volta.
    if (faltaArteDoStory(novo)) {
      setResultado({ ok: false, texto: AVISO_SEM_ARTE_DE_STORY });
      return;
    }

    setAcao('publicando');
    setResultado(null);
    try {
      /**
       * O texto sai de `textoDaPublicacao`, não daqui.
       *
       * Ele era montado nas duas modais, e as duas diziam `Publicado em
       * @conta` **sem nomear a rede** — que é o que deixou um conteúdo marcado
       * só como Facebook sair no Instagram com a tela parecendo certa. O
       * `aviso` do story entra no mesmo texto, pela mesma razão de sempre:
       * duas cópias divergem na primeira pressa, e esta já tinha divergido.
       */
      setResultado(textoDaPublicacao(await publicarAgora(novo.id)));
    } catch (err) {
      setResultado({
        ok: false,
        texto: err instanceof Error ? err.message : 'Falha ao publicar.',
      });
    } finally {
      setAcao('nenhuma');
    }
  };

  /**
   * Os passos do celular, derivados do mesmo formulário.
   *
   * A arte entra **só quando o tipo pede arte**: copy e roteiro são texto, e
   * um passo "Arte" vazio num assistente de quatro é a tela pedindo algo que
   * não existe — a mesma razão de o upload não aparecer nesses tipos.
   */
  const campos = (
    blocos: Parameters<typeof FormularioDoConteudo>[0]['blocos'],
    semTitulo = false,
  ) => (
    <FormularioDoConteudo
      valor={dados}
      aoMudar={mudar}
      tipo={tipo}
      clients={clients}
      equipe={users}
      aoGerarComIA={gerarTextoComIA}
      blocos={blocos}
      semTitulo={semTitulo}
    />
  );

  const passosDoConteudo: PassoDoConteudo[] = [
    {
      chave: 'identificacao',
      rotulo: 'Básico',
      descricao: 'De quem é a peça, onde ela sai e como ela se chama.',
      conteudo: campos(['identificacao']),
    },
    ...(tipo.pedeArte
      ? [
          {
            chave: 'arte',
            rotulo: 'Arte',
            descricao: 'As imagens ou os vídeos que vão publicados.',
            conteudo: campos(['arte']),
          },
        ]
      : []),
    {
      chave: 'texto',
      rotulo: 'Texto',
      descricao: 'A legenda que vai publicada, e o rascunho que fica aqui dentro.',
      conteudo: campos(['texto']),
    },
    {
      chave: 'agenda',
      rotulo: 'Agenda',
      descricao: 'Quando a peça sai.',
      conteudo: campos(['agenda']),
    },
  ];
  const botoesDeAcao = (
    <>
      <Button variant="ghost"
        type="button"
        onClick={closeCreateJobModal}
        className="lg:mr-auto"
      >
        Cancelar
      </Button>

      {/* Publicar agora fica **longe** do primário, e com a cor de
          aviso: é a única ação daqui que não tem volta. Encostada no
          botão que a pessoa aperta por reflexo, ela seria apertada por
          reflexo também. */}
      {dados.canais.some(publicaSozinho) && (
        <Button
          type="button"
          onClick={(e) => void publicarImediatamente(e)}
          disabled={ocupado}
          title="Salva e publica imediatamente nas contas conectadas do cliente. Não tem volta."
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
    </>
  );

  const cartao =
    'rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900';

  const botaoDaPrevia = (
    <Button
      variant="outline"
      type="button"
      onClick={() => setPreviaAberta((v) => !v)}
      className="w-full"
      aria-expanded={previaAberta}
    >
      {previaAberta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      {previaAberta ? 'Ocultar prévia' : 'Ver prévia da publicação'}
    </Button>
  );

  const previa = previaAberta && (
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
          ? safeDateFormat(deParedeParaUtc(dados.scheduledDate), { day: '2-digit', month: 'long' })
          : undefined,
      }}
    />
  );

  const feedback = (
    <>
      {erro && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          {erro}
        </p>
      )}
      {resultado && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
            resultado.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {resultado.ok ? (
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
          )}
          <span className="font-semibold leading-relaxed">{resultado.texto}</span>
        </div>
      )}
    </>
  );

  return (
    <Dialog
      open={isCreateJobModalOpen}
      onOpenChange={(aberto) => !aberto && closeCreateJobModal()}
    >
      <DialogContent tamanho="editorComPrevia" className="p-0 gap-0">
        <DialogTitle className="sr-only">Novo conteúdo</DialogTitle>

        {estreita ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-4 pr-12 text-sm font-semibold">Novo conteúdo</div>
            {previaAberta && (
              <div className="space-y-4 px-4 pb-4">
                {botaoDaPrevia}
                {previa}
              </div>
            )}
            <div hidden={previaAberta}>
              <AssistenteDoConteudo
                passos={passosDoConteudo}
                acoes={
                  <>
                    {feedback}
                    {botaoDaPrevia}
                    {botoesDeAcao}
                  </>
                }
              />
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => salvar(e, 'ideas')} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <section className="flex min-w-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                  <Avatar nome={clienteSelecionado?.name || 'Cliente'} url={clienteSelecionado?.avatar} tamanho={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{clienteSelecionado?.name}</p>
                    <input
                      type="text"
                      value={dados.title}
                      onChange={(e) => mudar({ title: e.target.value })}
                      placeholder="Título do novo conteúdo"
                      aria-label="Título do conteúdo"
                      aria-required="true"
                      className="block w-full rounded-lg border border-transparent bg-transparent -ml-1.5 px-1.5 py-0.5 text-base font-bold text-slate-900 outline-hidden hover:border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 dark:text-white dark:hover:border-slate-700"
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <PlatformBadge platform={platform} />
                      <FormatBadge format={dados.format} rotulo={rotuloDoFormato(dados.format, platform)} />
                      <PriorityBadge priority={dados.priority} />
                    </div>
                  </div>
                </header>
                <div className="shrink-0 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="inline-flex items-center gap-2 border-b-2 border-purple-500 px-4 py-3 text-xs font-semibold text-purple-700 dark:text-purple-400">
                    <FileText className="h-3.5 w-3.5" />
                    Conteúdo
                  </h2>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950/50">
                  <div className={`${cartao} p-5`}>
                    {campos(['arte', 'texto'], true)}
                  </div>
                </div>
              </section>

              <aside className="w-[400px] shrink-0 space-y-4 overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 pt-12 dark:border-slate-800 dark:bg-slate-950">
                {botaoDaPrevia}
                {previa}
                <section className={`${cartao} space-y-3 p-4`}>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Gestão
                  </h2>
                  {campos(['identificacao', 'agenda'], true)}
                </section>
              </aside>
            </div>

            <footer className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
              {feedback}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {botoesDeAcao}
              </div>
            </footer>
          </form>
        )}
      </DialogContent>

      {dialogo}
    </Dialog>
  );
};
