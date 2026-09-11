import React, { useState, useEffect, useRef } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import {
  X, ThumbsUp, Link as LinkIcon, Send, CheckCircle2, AlertTriangle,
  Instagram, Facebook, Linkedin, Youtube, Twitter, Music2,
} from 'lucide-react';
import { Job, JobPlatform, JobFormat, JobPriority, JobStatus } from '../../types';
import { MediaUploader } from '../common/MediaUploader';
import { definicaoDoTipo } from '../../lib/tiposDeJob';
import { PreviaDaRede } from '../common/PreviaDaRede';
import {
  camposVisiveis,
  limiteMaisApertado,
  type CampoDoCanal,
} from '../../lib/camposDoCanal';
import { CampoDinamico } from '../common/CampoDinamico';
import {
  publicaSozinho,
  publicarAgora,
  COMO_PUBLICA,
  REDES_QUE_PUBLICAM,
} from '../../lib/redes';
import { BarraDeTexto } from '../common/BarraDeTexto';
import { AtalhosDoConteudo } from '../common/AtalhosDoConteudo';

/**
 * Os canais, na ordem em que aparecem.
 *
 * `cor` é a cor de marca de cada rede: é ela que faz o ícone ser reconhecido
 * de relance, sem precisar ler nada. Quando o canal está escolhido, o botão
 * inverte — fundo da marca, ícone branco.
 */
const CANAIS: {
  valor: JobPlatform;
  rotulo: string;
  icone: React.FC<{ className?: string }>;
  cor: string;
  fundo: string;
}[] = [
  { valor: 'instagram', rotulo: 'Instagram', icone: Instagram, cor: 'text-[#E4405F]', fundo: 'bg-[#E4405F]' },
  { valor: 'facebook', rotulo: 'Facebook', icone: Facebook, cor: 'text-[#1877F2]', fundo: 'bg-[#1877F2]' },
  { valor: 'linkedin', rotulo: 'LinkedIn', icone: Linkedin, cor: 'text-[#0A66C2]', fundo: 'bg-[#0A66C2]' },
  { valor: 'tiktok', rotulo: 'TikTok', icone: Music2, cor: 'text-[#010101] dark:text-white', fundo: 'bg-[#010101]' },
  { valor: 'youtube', rotulo: 'YouTube', icone: Youtube, cor: 'text-[#FF0000]', fundo: 'bg-[#FF0000]' },
  { valor: 'twitter', rotulo: 'X / Twitter', icone: Twitter, cor: 'text-[#0F1419] dark:text-white', fundo: 'bg-[#0F1419]' },
];

/**
 * Formato só existe dentro de uma rede.
 *
 * "Story" não existe no YouTube e "Short" não existe no Instagram — oferecer
 * a lista inteira em toda rede deixava escolher combinação que não vai ao ar,
 * e o erro só apareceria na hora de publicar.
 *
 * O rótulo muda com a rede porque a mesma coisa tem nome diferente em cada
 * uma: vídeo curto é Reels no Instagram e Short no YouTube.
 */
const FORMATOS_POR_CANAL: Record<JobPlatform, { valor: JobFormat; rotulo: string }[]> = {
  instagram: [
    { valor: 'feed', rotulo: 'Feed' },
    { valor: 'carousel', rotulo: 'Carrossel' },
    { valor: 'reel', rotulo: 'Reels' },
    { valor: 'story', rotulo: 'Story' },
  ],
  facebook: [
    { valor: 'feed', rotulo: 'Feed' },
    { valor: 'carousel', rotulo: 'Carrossel' },
    { valor: 'reel', rotulo: 'Reels' },
    { valor: 'story', rotulo: 'Story' },
    { valor: 'video', rotulo: 'Vídeo' },
  ],
  linkedin: [
    { valor: 'feed', rotulo: 'Publicação' },
    { valor: 'carousel', rotulo: 'Carrossel' },
    { valor: 'article', rotulo: 'Artigo' },
    { valor: 'video', rotulo: 'Vídeo' },
  ],
  tiktok: [{ valor: 'reel', rotulo: 'Vídeo' }],
  youtube: [
    { valor: 'video', rotulo: 'Vídeo' },
    { valor: 'reel', rotulo: 'Short' },
  ],
  twitter: [
    { valor: 'feed', rotulo: 'Post' },
    { valor: 'video', rotulo: 'Vídeo' },
  ],
};

/**
 * Os formatos que existem em **todas** as redes escolhidas.
 *
 * Instagram e Facebook compartilham feed, carrossel, reel e story; já
 * Instagram e YouTube só compartilham o vídeo curto. Oferecer a união
 * deixaria escolher Story para o YouTube, que não tem — e o erro só
 * apareceria na hora de publicar.
 *
 * Interseção vazia (redes sem nada em comum) cai na lista do canal
 * principal: melhor do que um seletor sem nenhuma opção.
 */
const formatosComuns = (canais: JobPlatform[]): { valor: JobFormat; rotulo: string }[] => {
  const listas = canais.map((c) => FORMATOS_POR_CANAL[c] || []);
  if (!listas.length) return FORMATOS_POR_CANAL.instagram;

  const comuns = listas[0].filter((f) =>
    listas.every((lista) => lista.some((o) => o.valor === f.valor))
  );
  return comuns.length ? comuns : listas[0];
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
    generateAiCopy
  } = usePostfy();

  // O tipo escolhido no menu Adicionar molda o formulário. Quem decide não é
  // o nome do tipo, e sim `pedeArte`: assim um tipo novo não obriga a caçar
  // `if (tipo === 'copy')` espalhado pela tela.
  const tipo = definicaoDoTipo(createJobTipo);

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [title, setTitle] = useState('');
  // Campanha saiu do cadastro. O padrão era 'Conteúdo Institucional' e ia
  // junto sem ninguém escolher — todo job nascia carimbado com uma campanha
  // que não existe. Quem precisar dela edita no detalhe do conteúdo.
  /**
   * Os canais escolhidos. O primeiro é o principal, e é ele que vai para
   * `platform` — a coluna que Kanban, portal e fila de publicação leem.
   */
  const [canais, setCanais] = useState<JobPlatform[]>(['instagram']);
  const platform = canais[0] || 'instagram';
  const [format, setFormat] = useState<JobFormat>('feed');
  const [priority, setPriority] = useState<JobPriority>('medium');
  const [status, setStatus] = useState<JobStatus>('ideas');
  const [caption, setCaption] = useState('');
  // CTA e hashtags saíram do cadastro: enchiam o modal de campos que quase
  // ninguém preenchia na criação, e seguem editáveis no detalhe.
  //
  // O padrão de hashtags era '#Novidade #Marketing', e ele ia junto mesmo sem
  // ninguém digitar nada: conteúdo nascia marcado com tag inventada.
  //
  // O primeiro comentário voltou, agora como campo do Instagram — é onde as
  // hashtags costumam ir, para não poluir a legenda.
  const [firstComment, setFirstComment] = useState('');
  const [configuracoes, setConfiguracoes] = useState<Record<string, unknown>>({});
  // Começa vazio: um conteúdo novo não tem mídia. A foto de banco que ficava
  // aqui virava a arte de todo post criado, e quem não reparasse publicava com
  // ela.
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [erro, setErro] = useState('');

  // O campo de copy e roteiro é desenhado aqui, e não pelo catálogo da rede,
  // então a barra precisa da referência dele para escrever no cursor.
  const areaDoTexto = useRef<HTMLTextAreaElement>(null);

  // Keep clientId valid if clients list changes
  useEffect(() => {
    if (clients.length > 0 && (!clientId || !clients.some(c => c.id === clientId))) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId, isCreateJobModalOpen]);

  // O modal não desmonta ao fechar (só retorna null), então o estado de um
  // job sobrevivia para o próximo — a mídia enviada era o caso mais visível,
  // por ficar fora do reset parcial que só limpava título/legenda/cta.
  // Reseta no momento de abrir, não só depois de criar: cobre "cancelei e
  // abri de novo" também.
  useEffect(() => {
    if (isCreateJobModalOpen) {
      setTitle('');
      setCanais(['instagram']);
      setFormat('feed');
      setPriority('medium');
      setStatus('ideas');
      setCaption('');
      setFirstComment('');
      setConfiguracoes({});
      setMediaUrls([]);
      setErro('');
    }
  }, [isCreateJobModalOpen]);

  useEffect(() => {
    if (createJobPreselectedDate) {
      try {
        const d = new Date(createJobPreselectedDate);
        if (!isNaN(d.getTime())) {
          const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setScheduledDate(isoLocal);
        } else {
          throw new Error('Invalid date');
        }
      } catch {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        d.setHours(10, 0, 0, 0);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setScheduledDate(isoLocal);
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(10, 0, 0, 0);
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setScheduledDate(isoLocal);
    }
  }, [createJobPreselectedDate, isCreateJobModalOpen]);

  /**
   * Trocar de canal pode invalidar o formato escolhido — Story não existe no
   * YouTube. Sem isto o `select` ficava em branco e o job era salvo com um
   * formato que aquela rede não aceita, sem ninguém ver.
   */
  useEffect(() => {
    const disponiveis = formatosComuns(canais);
    if (disponiveis.length && !disponiveis.some((f) => f.valor === format)) {
      setFormat(disponiveis[0].valor);
    }
  }, [canais, format]);

  if (!isCreateJobModalOpen) return null;

  // A prévia mostra o perfil de quem vai publicar: é o cliente selecionado.
  const clienteSelecionado = clients.find((c) => c.id === clientId) || clients[0];

  const formatosDoCanal = formatosComuns(canais);

  /** Clicar num canal liga ou desliga. Nunca deixa a seleção vazia. */
  const alternarCanal = (canal: JobPlatform) => {
    setCanais((atuais) => {
      if (atuais.includes(canal)) {
        const resto = atuais.filter((c) => c !== canal);
        return resto.length ? resto : atuais;
      }
      return [...atuais, canal];
    });
  };
  const campos = camposVisiveis(platform, format);

  // Os acessórios saem da lista e viram ícones na linha do rótulo da legenda.
  const camposEmLinha = campos.filter((c) => !c.atalho);
  const camposEmAtalho = campos.filter((c) => c.atalho);

  /**
   * O limite vem da rede mais apertada entre as escolhidas, não da principal.
   * Com Instagram e X marcados juntos, quem corta é o X.
   */
  const limite = limiteMaisApertado(canais);
  const nomeDoCanal = (canal: JobPlatform) =>
    CANAIS.find((c) => c.valor === canal)?.rotulo || canal;

  /**
   * A IA só é oferecida quando há título.
   *
   * Ele é o tema que a rota exige, e um botão que responde "informe o tema"
   * é pior que botão ausente: custa o clique e a descoberta. O briefing do
   * cliente entra por dentro, em `generateAiCopy`.
   */
  const gerarTextoComIA = title.trim()
    ? async () => {
        const r = await generateAiCopy({
          theme: title.trim(),
          format,
          platform,
          clientId,
        });
        return r?.caption || '';
      }
    : undefined;

  /**
   * Legenda e primeiro comentário têm coluna própria e continuam nela; o
   * resto vive no `jsonb`. Ler e escrever pelo catálogo evita a tela precisar
   * saber onde cada campo mora.
   */
  const valorDoCampo = (campo: CampoDoCanal): unknown => {
    if (campo.destino === 'config') return configuracoes[campo.chave];
    if (campo.chave === 'caption') return caption;
    if (campo.chave === 'firstComment') return firstComment;
    return '';
  };

  const definirCampo = (campo: CampoDoCanal, valor: unknown) => {
    if (campo.destino === 'config') {
      setConfiguracoes((atual) => ({ ...atual, [campo.chave]: valor }));
      return;
    }
    if (campo.chave === 'caption') setCaption(String(valor ?? ''));
    if (campo.chave === 'firstComment') setFirstComment(String(valor ?? ''));
  };

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
    if (!title.trim()) {
      setErro('Informe o título do conteúdo.');
      return;
    }

    try {

      // Safe Date Parsing
      let targetDate = new Date();
      if (scheduledDate) {
        const parsed = new Date(scheduledDate);
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed;
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
        ? mediaUrls.filter(u => u.trim().length > 0)
        : [];

      // Sem cliente cadastrado não há job possível: 'c-1' era um id inventado
      // que o Postgres recusa, e o conteúdo sumia sem aviso.
      const selectedClientId = clientId && clients.some(c => c.id === clientId)
        ? clientId
        : clients[0]?.id;

      if (!selectedClientId) {
        setErro('Cadastre um cliente antes de criar conteúdo.');
        return;
      }

      const newJob = createJob({
        clientId: selectedClientId,
        title: title.trim(),
        tipo: createJobTipo,
        campaign: 'Geral',
        // `platform` é o primeiro da lista: as telas que leem uma rede só
        // continuam funcionando, e `canais` guarda o conjunto completo.
        platform,
        canais,
        format,
        priority,
        status: statusFinal,
        caption: caption.trim(),
        cta: '',
        hashtags: [],
        firstComment: firstComment.trim(),
        // Só o que a rede escolhida pede: trocar de canal no meio do cadastro
        // deixaria para trás a configuração da rede anterior, e ela iria junto
        // para o banco sem aparecer em tela nenhuma.
        configuracoes: Object.fromEntries(
          campos
            .filter((c) => c.destino === 'config')
            .map((c) => [c.chave, configuracoes[c.chave]])
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
      alert('Ocorreu um erro ao cadastrar a postagem. Por favor verifique os dados e tente novamente.');
      return undefined;
    }
  };

  /**
   * TEMPORÁRIO — botão de teste da integração com o Instagram.
   *
   * Existe para responder uma pergunta que nenhuma outra tela responde hoje:
   * *a publicação funciona?* O caminho normal é enfileirar e esperar o cron,
   * e aí a falha aparece cinco minutos depois, escrita em `last_error`, num
   * canto do banco. Aqui a resposta da Meta volta na hora, com o texto dela.
   *
   * Para remover: apague este bloco, o botão marcado no rodapé, e
   * `publicarAgora` em `src/lib/redes.ts`. O caminho de sessão em
   * `api/publicar.ts` some junto.
   */
  const [publicandoAgora, setPublicandoAgora] = useState(false);
  const [resultadoDoTeste, setResultadoDoTeste] = useState<
    { ok: boolean; texto: string } | null
  >(null);

  const testarPublicacao = async (e: React.FormEvent) => {
    const novo = salvar(e, 'scheduled', { fecharDepois: false });
    if (!novo) return;

    setPublicandoAgora(true);
    setResultadoDoTeste(null);
    try {
      const { conta, externalId } = await publicarAgora(novo.id);
      setResultadoDoTeste({
        ok: true,
        texto: `Publicado em @${conta}. Id na Meta: ${externalId}`,
      });
    } catch (err) {
      setResultadoDoTeste({
        ok: false,
        texto: err instanceof Error ? err.message : 'Falha ao publicar.',
      });
    } finally {
      setPublicandoAgora(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Sem faixa de cabeçalho: ela repetia o que o próprio formulário já
            diz e comia altura útil num modal que já rola. Sobra o fechar. */}
        <button
          type="button"
          onClick={closeCreateJobModal}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0">
        {/* Form */}
        <form onSubmit={(e) => salvar(e, status)} className="flex-1 min-w-0 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cliente *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Canais: a logo diz para onde vai sem precisar abrir uma lista. */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Selecione canais
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CANAIS.map((canal) => {
                  const Icone = canal.icone;
                  const ativo = canais.includes(canal.valor);
                  return (
                    <button
                      key={canal.valor}
                      type="button"
                      onClick={() => alternarCanal(canal.valor)}
                      title={`${canal.rotulo} — ${COMO_PUBLICA[canal.valor]}`}
                      aria-label={`${canal.rotulo}. ${COMO_PUBLICA[canal.valor]}`}
                      aria-pressed={ativo}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border transition cursor-pointer ${
                        ativo
                          ? `${canal.fundo} border-transparent text-white shadow-xs`
                          : `bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 ${canal.cor} opacity-60 hover:opacity-100`
                      }`}
                    >
                      <Icone className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/*
                Quem marca LinkedIn precisa saber, aqui, que ninguém vai
                publicar por ele. Descobrir isso na data agendada é tarde: o
                cliente aprovou e a peça não foi ao ar.
              */}
              {canais.some((c) => !publicaSozinho(c)) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-relaxed">
                  {canais.filter((c) => !publicaSozinho(c)).join(', ')}:{' '}
                  <strong>você publica</strong> na data. O disparo automático hoje é só{' '}
                  {REDES_QUE_PUBLICAM.join(', ')}.
                </p>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título do Conteúdo *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 5 Dicas para Escolher o Melhor Café Especial"
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Formato: só o que existe na rede escolhida. */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Formato</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as JobFormat)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {formatosDoCanal.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JobPriority)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scheduled Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Data e Hora de Publicação</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status Inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="ideas">Ideia / Pauta</option>
                <option value="in_production">Em Produção</option>
                <option value="for_approval">Para Aprovação</option>
                <option value="approved">Já Aprovado</option>
                <option value="scheduled">Agendado</option>
              </select>
            </div>
          </div>

          {/* Só quem tem arte pede arte. Copy e roteiro são texto: oferecer
              upload neles seria pedir aprovação de algo que não existe. */}
          {tipo.pedeArte && (
            <div className="pt-1">
              <MediaUploader
                mediaUrls={mediaUrls}
                onChange={setMediaUrls}
                maxFiles={10}
                label="Mídia e criativos"
                /* Buscar a arte de onde ela já está é o próximo passo; hoje
                   não existe. Entram no menu desligadas, dizendo "em breve". */
                origens={[
                  { rotulo: 'Canva', disponivel: false },
                  { rotulo: 'Google Drive', disponivel: false },
                  { rotulo: 'Dropbox', disponivel: false },
                ]}
              />
            </div>
          )}

          {/*
            Os campos vêm do catálogo da rede escolhida. Em copy e roteiro a
            entrega é o próprio texto, então ali vale o campo do tipo e não o
            da rede — um roteiro não tem localização nem capa de Reel.
          */}
          {tipo.pedeArte ? (
            <div className="space-y-4">
              {camposEmLinha.map((campo) => (
                <CampoDinamico
                  key={campo.chave}
                  campo={campo}
                  valor={valorDoCampo(campo)}
                  onChange={(v) => definirCampo(campo, v)}
                  limite={limite?.limite}
                  donoDoLimite={limite ? nomeDoCanal(limite.canal) : undefined}
                  aoGerarComIA={gerarTextoComIA}
                  /* Os acessórios pertencem ao texto principal, então moram
                     na linha do rótulo dele — não numa barra solta que não
                     diria a que campo se referem. */
                  acoes={
                    campo.barra ? (
                      <AtalhosDoConteudo
                        campos={camposEmAtalho}
                        valorDoCampo={valorDoCampo}
                        definirCampo={definirCampo}
                        legenda={caption}
                        canalPrincipal={platform}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {tipo.rotuloDoTexto}
              </label>
              <BarraDeTexto
                valor={caption}
                onChange={(v) => setCaption(String(v))}
                areaRef={areaDoTexto}
                /* O roteiro conta caracteres mas não tem teto: ele não é o
                   texto que vai publicado. */
                limite={tipo.respeitaLimiteDaRede ? limite?.limite : undefined}
                donoDoLimite={
                  tipo.respeitaLimiteDaRede && limite
                    ? nomeDoCanal(limite.canal)
                    : undefined
                }
                aoGerarComIA={gerarTextoComIA}
              />
              <textarea
                ref={areaDoTexto}
                rows={12}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={tipo.exemploDoTexto}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-t-none rounded-lg focus:ring-2 focus:ring-purple-500 leading-relaxed"
              />
            </div>
          )}

          {erro && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              {erro}
            </p>
          )}

          {/* O resultado do teste fica acima dos botões, e não some sozinho:
              é ele a única prova de que a integração publica. */}
          {resultadoDoTeste && (
            <div
              className={`flex items-start gap-2 text-xs p-3 rounded-xl border ${
                resultadoDoTeste.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
              }`}
            >
              {resultadoDoTeste.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              )}
              <span className="font-semibold leading-relaxed">{resultadoDoTeste.texto}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3">
            {/* TEMPORÁRIO — teste da publicação no Instagram. Some quando a
                integração estiver conferida; ver o comentário em
                `testarPublicacao`. Só aparece com Instagram marcado, porque é
                a única rede que o servidor publica. */}
            {canais.includes('instagram') && (
              <button
                type="button"
                onClick={(e) => void testarPublicacao(e)}
                disabled={publicandoAgora}
                title="Salva e publica imediatamente no Instagram do cliente. Não tem volta."
                className="mr-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 disabled:opacity-60 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {publicandoAgora ? 'Publicando...' : 'Publicar agora (teste)'}
              </button>
            )}

            <button
              type="button"
              onClick={closeCreateJobModal}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            {/* Atalho do caminho mais comum: criar já pedindo aprovação. Cai na
                coluna "Para Aprovação" e é o status que avisa o cliente. */}
            <button
              type="button"
              onClick={(e) => salvar(e, 'for_approval')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              Enviar para aprovação
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              Criar conteúdo
            </button>
          </div>
        </form>

        {/* Prévia: como fica na rede escolhida, com o dado deste formulário. */}
        {/* Centralizada na vertical, e com folga no topo: encostada em cima
            ela passava por baixo do botão de fechar. */}
        <aside className="lg:w-[440px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 pt-12 flex items-center">
          <PreviaDaRede
            className="w-full"
            dados={{
              nomeDoPerfil: clienteSelecionado?.name || '',
              avatar: clienteSelecionado?.avatar,
              canais,
              artes: tipo.pedeArte ? mediaUrls : [],
              legenda: caption,
              localizacao: String(configuracoes.localizacao || '') || undefined,
              dataPrevista: scheduledDate
                ? new Date(scheduledDate).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                  })
                : undefined,
            }}
          />
        </aside>
        </div>
      </div>
    </div>
  );
};
