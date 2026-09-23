import React, { useState, useEffect, useMemo } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard, safeDateFormat, safeDateTimeFormat, safeTimeFormat } from '../../lib/utils';
import { 
  CheckCircle2,
  Key,
  Receipt,
  FolderOpen, 
  AlertCircle, 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Download, 
  FileText, 
  MessageSquare, 
  Sparkles,
  Layers,
  Send,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Building2,
  Globe,
  Phone,
  Mail,
  Upload,
  Trash2,
  LogOut,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Users,
  Plus,
  Save,
  X
} from 'lucide-react';
import { PlatformBadge, FormatBadge, StatusBadge, TipoBadge } from '../common/Badges';
import { PreviaNoHover } from '../common/PreviaNoHover';
import { proporcaoDoCriativo } from '../../lib/formatos';
import { definicaoDoTipo } from '../../lib/tiposDeJob';
import {
  Job, Client, ClientFile, ClientBriefing, ClientUserRole,
} from '../../types';
import {
  tokenGuardado,
  listarUsuariosDoPortal,
  criarUsuarioPeloPortal,
  removerUsuarioPeloPortal,
  type UsuarioListadoNoPortal,
} from '../../lib/portal';
import { ClientPortalLogin } from './ClientPortalLogin';
import { ConversaComAAgencia } from './ConversaComAAgencia';
import { FileUpload } from '../ui/file-upload';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import { useConfirmacao } from '../ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../ui/dialog';
import { urlDeExibicao } from '../../lib/midiaDoDrive';

/** Os dois enquadramentos de "Feed + Story", na ordem em que a peça sai. */
const QUADROS_DO_CRIATIVO = [
  { chave: 'feed', rotulo: 'Feed', proporcao: 'aspect-[4/5]' },
  { chave: 'story', rotulo: 'Story', proporcao: 'aspect-[9/16]' },
] as const;

type QuadroDoCriativo = (typeof QUADROS_DO_CRIATIVO)[number]['chave'];

/**
 * As duas artes de "Feed + Story", uma aba para cada.
 *
 * O cliente aprova **o que vai ao ar**, e em feed+story vai ao ar duas coisas:
 * a arte 4:5 do feed e a 9:16 do story. Mostrar só a primeira faria ele
 * aprovar metade da peça sem saber — e a metade que ele não viu é a que sai
 * vertical, que é onde o corte errado aparece.
 *
 * **Elas eram lado a lado, e a decisão foi revista.** Metade da largura do
 * card para cada uma dá duas miniaturas de ~200px numa tela onde o que se
 * julga é a arte; o seletor é o mesmo da Prévia da agência (Feed/Story), e a
 * aba não esconde a segunda arte — ela a **nomeia**, no mesmo lugar onde a
 * agência está acostumada a alternar. A omissão que a versão lado a lado
 * evitava continua evitada: as duas abas estão sempre à vista, e a que está
 * sem arte diz isso antes de ser aberta.
 *
 * Três coisas que não são detalhe:
 *
 * - **A arte ocupa a largura inteira do card, na proporção dela.** A primeira
 *   versão com abas fixou a altura do bloco (`aspect-[9/8]`, a mesma que o par
 *   lado a lado ocupava) e centralizou a arte dentro, para a grade não refluir
 *   ao trocar de aba. Em tela isso virou uma faixa preta dos dois lados de
 *   cada card, e o custo real ficou do lado errado: quem abre esta tela vem
 *   **julgar a arte**, e ela estava menor e emoldurada para poupar um
 *   reajuste de altura que acontece só quando alguém clica na aba. Agora o
 *   quadro é o da aba — 4:5 no feed, 9:16 no story —, a imagem preenche o
 *   card e a linha se reajusta quando a aba muda. O corte continua honesto:
 *   `object-cover` na proporção que a rede vai usar.
 * - **O seletor fica embaixo da arte, nunca por cima dela.** A manchete da
 *   peça mora no rodapé do criativo (é onde ela está em toda arte que passou
 *   por aqui), e um controle flutuando ali cobriria justamente o texto que o
 *   cliente precisa ler para aprovar. Ele desceu para a faixa branca do card,
 *   que é o que permite a arte ir de borda a borda.
 * - **A aba sem arte avisa antes de ser aberta.** Sem o sinal, o cliente
 *   aprovaria vendo só o feed sem nunca saber que o story ficou vazio — que
 *   é o desfecho que a versão lado a lado existia para impedir, e o único
 *   que a aba poderia reintroduzir.
 */
const CriativoDeFeedEStory: React.FC<{
  feed?: string;
  story?: string;
  /**
   * `preencher` — a arte ocupa a largura toda e o card cresce com ela. É o
   * card da aba Aprovações, onde a arte é o assunto da tela.
   *
   * `caber` — a arte se ajusta a uma altura máxima. É a prévia do calendário,
   * que abre **dentro de uma modal**: ali o story a 9:16 na largura do
   * diálogo passaria de 800px de altura e empurraria a legenda e os botões
   * para fora da tela. Preencher e caber não são a mesma decisão porque o
   * espaço disponível não é o mesmo.
   */
  encaixe?: 'preencher' | 'caber';
}> = ({ feed, story, encaixe = 'preencher' }) => {
  const [quadro, setQuadro] = useState<QuadroDoCriativo>('feed');
  const arteDoQuadro: Record<QuadroDoCriativo, string | undefined> = { feed, story };
  const emTela = QUADROS_DO_CRIATIVO.find((q) => q.chave === quadro) ?? QUADROS_DO_CRIATIVO[0];
  const url = arteDoQuadro[emTela.chave];

  /**
   * Dois irmãos, não um bloco: a arte vai de borda a borda e o seletor fica
   * na faixa branca do card, embaixo dela. Envolvê-los num container só
   * obrigaria a escolher entre emoldurar a arte e cobrir a manchete dela.
   */
  const arte = (
    <div
      className={
        encaixe === 'preencher'
          ? `w-full ${emTela.proporcao} overflow-hidden bg-slate-900`
          : `h-full ${emTela.proporcao} overflow-hidden bg-slate-900`
      }
    >
      {url ? (
        <img src={urlDeExibicao(url)} alt={`Arte do ${emTela.rotulo}`} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-400 text-[11px] text-center px-2">
          <Layers className="w-6 h-6" />
          {/* Diz qual das duas falta, com nome: "Preview do Criativo"
              não distinguiria a que está pendente. */}
          <span>Sem arte de {emTela.rotulo}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {encaixe === 'preencher' ? (
        arte
      ) : (
        <div className="h-72 flex items-center justify-center bg-slate-900">{arte}</div>
      )}

      <div className="flex justify-center py-2 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <Tabs value={quadro} onValueChange={(v) => setQuadro(v as QuadroDoCriativo)}>
          <TabsList aparencia="segmentado">
            {QUADROS_DO_CRIATIVO.map(({ chave, rotulo }) => (
              <TabsTrigger key={chave} value={chave}>
                {rotulo}
                {!arteDoQuadro[chave] && (
                  <AlertCircle className="w-3 h-3 text-amber-500" aria-label="sem arte" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </>
  );
};

interface ClientPortalMonthGridProps {
  month: Date;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
}

/** Calendário mensal do portal: só leitura, sem filtro de cliente (a lista já
 * chega recortada) e sem criação de conteúdo — o cliente aprova, não posta. */
const ClientPortalMonthGrid: React.FC<ClientPortalMonthGridProps> = ({ month, jobs, onSelectJob }) => {
  const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ano = month.getFullYear();
  const mes = month.getMonth();

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const indiceDoPrimeiroDia = new Date(ano, mes, 1).getDay();
  const diasDoMesAnterior = new Date(ano, mes, 0).getDate();
  const totalCelulas = Math.ceil((indiceDoPrimeiroDia + diasNoMes) / 7) * 7;

  const hoje = new Date();
  const ehHoje = (d: Date) =>
    d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();

  const jobsDoDia = (d: Date) =>
    jobs.filter((job) => {
      const alvo = new Date(job.scheduledDate || job.deadlineProduction);
      return alvo.getFullYear() === d.getFullYear() && alvo.getMonth() === d.getMonth() && alvo.getDate() === d.getDate();
    });

  const celulas: { data: Date; doMesAtual: boolean; jobs: Job[] }[] = [];
  for (let i = 0; i < totalCelulas; i++) {
    let data: Date;
    let doMesAtual = true;
    if (i < indiceDoPrimeiroDia) {
      data = new Date(ano, mes - 1, diasDoMesAnterior - (indiceDoPrimeiroDia - 1 - i));
      doMesAtual = false;
    } else if (i >= indiceDoPrimeiroDia + diasNoMes) {
      data = new Date(ano, mes + 1, i - (indiceDoPrimeiroDia + diasNoMes) + 1);
      doMesAtual = false;
    } else {
      data = new Date(ano, mes, i - indiceDoPrimeiroDia + 1);
    }
    celulas.push({ data, doMesAtual, jobs: jobsDoDia(data) });
  }

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl">
      <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 py-2 rounded-t-2xl">
        {diasDaSemana.map((dia) => (
          <div key={dia}>{dia}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-b-2xl">
        {celulas.map((celula, idx) => (
          <div
            key={idx}
            className={`relative min-h-[100px] sm:min-h-[120px] p-1.5 flex flex-col gap-1 ${
              celula.doMesAtual ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-950/60'
            }`}
          >
            <span
              className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${
                ehHoje(celula.data)
                  ? 'bg-purple-600 text-white'
                  : celula.doMesAtual
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-slate-400'
              }`}
            >
              {celula.data.getDate()}
            </span>

            <div className="flex-1 space-y-1">
              {celula.jobs.slice(0, 3).map((job) => {
                const capa = job.mediaUrls?.[0];

                return (
                  /**
                   * A prévia grande do hover é a mesma do calendário da
                   * agência, e por isso é um componente só: divergir aqui
                   * mostraria cortes diferentes da mesma arte nas duas telas.
                   * O lado para onde ela abre saiu da coluna e passou a sair
                   * do espaço que sobra na janela, que é o que a regra por
                   * coluna aproximava.
                   */
                  <PreviaNoHover
                    key={job.id}
                    url={capa}
                    proporcao={proporcaoDoCriativo(job.platform, job.format)}
                  >
                  <button
                    onClick={() => onSelectJob(job)}
                    className="group/job relative w-full text-left bg-slate-50 dark:bg-slate-950 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-800 hover:border-purple-300 rounded-lg p-1 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-1.5">
                      {capa ? (
                        <img
                          src={capa}
                          alt=""
                          loading="lazy"
                          className="w-8 h-10 rounded-md object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-10 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <Layers className="w-3 h-3 text-slate-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <PlatformBadge platform={job.platform} showLabel={false} className="px-1 py-0" />
                          <span className="text-[9px] font-mono text-slate-400 truncate">
                            {safeTimeFormat(job.scheduledDate)}
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                          {job.title}
                        </p>
                        <div className="mt-0.5">
                          <StatusBadge status={job.status} />
                        </div>
                      </div>
                    </div>

                  </button>
                  </PreviaNoHover>
                );
              })}
              {celula.jobs.length > 3 && (
                <span className="block text-[10px] text-center text-slate-400 font-semibold">
                  +{celula.jobs.length - 3} mais
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

type AbaDoPortal =
  | 'approvals'
  | 'calendar'
  | 'arquivos'
  | 'senhas'
  | 'notas'
  | 'briefing'
  | 'materiais'
  | 'usuarios';

/** Ordem e rótulo das abas do portal. O papel decide quais aparecem. */
const ABAS_DO_PORTAL: { id: AbaDoPortal; rotulo: string; icone: typeof CheckCircle2 }[] = [
  { id: 'approvals', rotulo: 'Aprovações', icone: CheckCircle2 },
  { id: 'calendar', rotulo: 'Cronograma', icone: CalendarIcon },
  { id: 'arquivos', rotulo: 'Arquivos', icone: FolderOpen },
  { id: 'senhas', rotulo: 'Senhas', icone: Key },
  { id: 'notas', rotulo: 'Notas Fiscais', icone: Receipt },
  { id: 'briefing', rotulo: 'Briefing', icone: FileText },
  { id: 'materiais', rotulo: 'Fotos e Materiais', icone: Upload },
  { id: 'usuarios', rotulo: 'Usuários', icone: Users },
];

/**
 * Os campos do briefing, na ordem em que a tela os mostra.
 *
 * `monthlyGoals` fica de fora: ele existe no tipo mas nunca teve lugar nesta
 * tela, e abrir um campo aqui sem a agência olhar para ele do outro lado
 * seria pedir um texto que ninguém lê.
 */
const CAMPOS_DO_BRIEFING: {
  id: keyof Omit<ClientBriefing, 'updatedAt'>;
  rotulo: string;
  dica: string;
  largo?: boolean;
}[] = [
  { id: 'brandVoice', rotulo: 'Tom de Voz & Personalidade', dica: 'Como a marca fala: próxima, técnica, bem-humorada?' },
  { id: 'targetAudience', rotulo: 'Público-Alvo & Personas', dica: 'Quem você quer alcançar, com idade, cargo e contexto.' },
  { id: 'painPoints', rotulo: 'Dores e Desejos Solucionados', dica: 'O problema que o cliente tem antes de procurar você.' },
  { id: 'competitors', rotulo: 'Concorrentes & Inspirações', dica: 'Marcas que você admira e as que disputam o mesmo cliente.' },
  { id: 'brandGuidelines', rotulo: 'Regras e Restrições de Marca', dica: 'O que nunca pode aparecer: cores, palavras, temas.', largo: true },
];

export const ClientPortalView: React.FC = () => {
  const {
    clients,
    portalClientId,
    closeClientPortal,
    entrarNoPortal,
    carregandoPortal,
    erroDoPortal,
    jobs,
    approveJob,
    requestAdjustment,
    currentWorkspace,
    clientMaterials,
    addClientMaterial,
    deleteClientMaterial,
    portalUsuario,
    addClientPassword,
    deleteClientPassword,
    addClientFile,
    deleteClientFile,
    updateClientBriefing
  } = usePostfy();

  // Quem está no portal vem do contexto: por token (cliente que entrou com o
  // código) ou por prévia interna (equipe da agência). A tela não decide
  // mais isso sozinha — antes ela comparava telefone contra a lista local, e
  // essa lista só existia quando alguém da agência estava logado no mesmo
  // navegador. Para o cliente de verdade, o portal abria vazio.
  const authenticatedClient: Client | null = portalClientId
    ? clients.find(c => c.id === portalClientId) || null
    : null;

  /**
   * Aprovador: só aprova.
   *
   * `portalUsuario` é `null` na prévia interna — quem está olhando ali é a
   * equipe da agência, que não é usuária do cliente e já enxerga tudo na
   * ficha dele. Por isso a pergunta é "é aprovador?", e não "é editor?":
   * ausência de papel não pode virar restrição.
   */
  const ehAprovador = portalUsuario?.papel === 'aprovador';

  /**
   * `usuarios` só existe para um editor de verdade: ela depende do token da
   * sessão do portal, que a prévia interna não tem. A equipe da agência
   * gerencia esses acessos na ficha do cliente, onde a RLS já a autoriza.
   */
  const abasVisiveis = useMemo(
    () =>
      ABAS_DO_PORTAL.filter((a) => {
        if (ehAprovador) return a.id === 'approvals' || a.id === 'calendar';
        if (a.id === 'usuarios') return portalUsuario?.papel === 'editor';
        return true;
      }),
    // Memoizado porque a lista é dependência do efeito abaixo: um array novo
    // a cada render faria o efeito rodar em todo render, sem nunca ter o que
    // fazer.
    [ehAprovador, portalUsuario?.papel]
  );

  const [activeTab, setActiveTab] = useState<AbaDoPortal>('approvals');
  const { pedir, dialogo } = useConfirmacao();

  // O papel chega depois dos dados. Se a aba aberta deixar de existir (a
  // pessoa era editora, virou aprovadora), a tela cairia num branco — nenhum
  // bloco casaria com `activeTab`.
  useEffect(() => {
    if (!abasVisiveis.some((a) => a.id === activeTab)) setActiveTab('approvals');
  }, [abasVisiveis, activeTab]);

  const [selectedForReview, setSelectedForReview] = useState<Job | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarPreviewJob, setCalendarPreviewJob] = useState<Job | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Material upload state
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<'photo' | 'video' | 'logo' | 'doc'>('photo');
  const [newMatUrl, setNewMatUrl] = useState('');
  const [newMatNotes, setNewMatNotes] = useState('');

  // O que o editor escreve pelo portal.
  const podeEditar = !ehAprovador;

  const [mostrarFormArquivo, setMostrarFormArquivo] = useState(false);
  const [novoArqNome, setNovoArqNome] = useState('');
  const [novoArqCategoria, setNovoArqCategoria] =
    useState<ClientFile['category']>('identidade_visual');
  const [novoArqUrl, setNovoArqUrl] = useState('');
  const [novoArqTamanho, setNovoArqTamanho] = useState('');

  const [mostrarFormSenha, setMostrarFormSenha] = useState(false);
  const [novaSenhaServico, setNovaSenhaServico] = useState('');
  const [novaSenhaUsuario, setNovaSenhaUsuario] = useState('');
  const [novaSenhaValor, setNovaSenhaValor] = useState('');
  const [novaSenhaNotas, setNovaSenhaNotas] = useState('');

  const [briefingEmEdicao, setBriefingEmEdicao] = useState<Partial<ClientBriefing> | null>(null);

  const [usuariosDoPortal, setUsuariosDoPortal] = useState<UsuarioListadoNoPortal[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null);
  const [novoUsuEmail, setNovoUsuEmail] = useState('');
  const [novoUsuNome, setNovoUsuNome] = useState('');
  const [novoUsuPapel, setNovoUsuPapel] = useState<ClientUserRole>('aprovador');

  const tokenDoPortal = tokenGuardado();

  /**
   * A lista de usuários não vem em `portal_dados`: ela só interessa a quem
   * abrir esta aba, e é a única coisa da tela que muda sem a pessoa agir
   * (outro editor pode ter convidado alguém).
   */
  const recarregarUsuarios = async () => {
    if (!tokenDoPortal) return;
    setCarregandoUsuarios(true);
    try {
      setUsuariosDoPortal(await listarUsuariosDoPortal(tokenDoPortal));
      setErroUsuarios(null);
    } catch (e) {
      setErroUsuarios(e instanceof Error ? e.message : 'Não foi possível carregar os usuários.');
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios') void recarregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Enquanto a RPC do portal não responde, a tela ainda não sabe se há
  // cliente: mostrar o login aqui piscaria a tela de código para quem já
  // entrou e só apertou F5.
  if (!authenticatedClient && carregandoPortal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  if (!authenticatedClient) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <ClientPortalLogin
          workspace={currentWorkspace}
          onLoginSuccess={entrarNoPortal}
        />
      </div>
    );
  }

  const client = authenticatedClient;

  // Filter jobs for THIS client ONLY (Strict Isolation)
  const clientJobs = jobs.filter(j => j.clientId === client.id);
  const pendingApprovals = clientJobs.filter(j => j.status === 'for_approval');
  const upcomingScheduled = clientJobs.filter(j => j.status === 'scheduled' || j.status === 'approved');

  const handleLogout = () => {
    closeClientPortal();
  };

  const handleApprove = (jobId: string) => {
    approveJob(jobId, `${client.contacts[0]?.name || client.name} (Cliente)`);
    if (selectedForReview?.id === jobId) {
      setSelectedForReview(null);
    }
  };

  const handleReject = () => {
    if (!selectedForReview || !feedbackText.trim()) return;
    requestAdjustment(
      selectedForReview.id, 
      feedbackText.trim(), 
      `${client.contacts[0]?.name || client.name} (Cliente)`
    );
    setFeedbackText('');
    setIsRejecting(false);
    setSelectedForReview(null);
  };

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // As três escritas do editor passam pelas mesmas funções do contexto que a
  // agência usa. Quem desvia para a RPC quando não há sessão é o contexto —
  // esta tela não precisa saber se está no portal ou na prévia interna.
  const salvarArquivo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoArqNome.trim() || !novoArqUrl.trim()) return;
    addClientFile(client.id, {
      name: novoArqNome.trim(),
      category: novoArqCategoria,
      url: novoArqUrl.trim(),
      // O tamanho vem do upload; colado como link, não há o que medir — e
      // inventar "1.5 MB" é a armadilha de a tela afirmar o que não mediu.
      size: novoArqTamanho || '—',
    });
    setNovoArqNome('');
    setNovoArqUrl('');
    setNovoArqTamanho('');
    setMostrarFormArquivo(false);
  };

  const salvarSenha = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSenhaServico.trim() || !novaSenhaValor.trim()) return;
    addClientPassword(client.id, {
      service: novaSenhaServico.trim(),
      username: novaSenhaUsuario.trim(),
      password: novaSenhaValor,
      notes: novaSenhaNotas.trim() || undefined,
    });
    setNovaSenhaServico('');
    setNovaSenhaUsuario('');
    setNovaSenhaValor('');
    setNovaSenhaNotas('');
    setMostrarFormSenha(false);
  };

  const salvarBriefing = () => {
    if (!briefingEmEdicao) return;
    updateClientBriefing(client.id, briefingEmEdicao);
    setBriefingEmEdicao(null);
  };

  const criarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenDoPortal) return;
    const email = novoUsuEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      setErroUsuarios('Informe um e-mail válido.');
      return;
    }
    try {
      await criarUsuarioPeloPortal(tokenDoPortal, {
        email,
        nome: novoUsuNome.trim() || undefined,
        papel: novoUsuPapel,
      });
      setNovoUsuEmail('');
      setNovoUsuNome('');
      setNovoUsuPapel('aprovador');
      setErroUsuarios(null);
      await recarregarUsuarios();
    } catch (erro) {
      setErroUsuarios(
        erro instanceof Error ? erro.message : 'Não foi possível criar o usuário.'
      );
    }
  };

  const removerUsuario = (id: string, email: string) => {
    if (!tokenDoPortal) return;
    pedir({
      titulo: 'Remover o acesso ao portal?',
      descricao: `${email} deixa de entrar neste portal. O que já foi aprovado continua registrado.`,
      rotuloConfirmar: 'Remover acesso',
      aoConfirmar: () => removerDeVez(id),
    });
  };

  const removerDeVez = async (id: string) => {
    if (!tokenDoPortal) return;
    try {
      await removerUsuarioPeloPortal(tokenDoPortal, id);
      setErroUsuarios(null);
      await recarregarUsuarios();
    } catch (erro) {
      setErroUsuarios(
        erro instanceof Error ? erro.message : 'Não foi possível remover o usuário.'
      );
    }
  };

  // O e-mail, e não o telefone: é por ele que a pessoa entrou, então é o que
  // confirma "estou na conta certa". O telefone que aparecia aqui vinha com
  // um número inventado quando o cadastro não tinha nenhum.
  const clientEmail = client.email || client.contacts?.[0]?.email || '';
  const clientFullName = client.name || client.contacts?.[0]?.name || 'Cliente';

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 overflow-y-auto animate-in fade-in duration-200">
      {/* Client Portal Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentWorkspace.logo ? (
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-0.5 shadow-xs shrink-0">
                <img src={currentWorkspace.logo} alt={currentWorkspace.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-xs shrink-0"
                style={{ backgroundColor: currentWorkspace.primaryColor || '#9333ea' }}
              >
                {(currentWorkspace.name || 'P').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                {currentWorkspace.name || 'Portal do Cliente'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hidden md:inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Acesso Seguro
              </span>
            </div>
          </div>

          {/* Client Authenticated Info & Logout Action */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar
                nome={client.name}
                url={client.avatar}
                tamanho={32}
                formato="quadrado"
                className="border border-slate-200 dark:border-slate-800 shadow-xs"
              />
              <div className="hidden sm:block text-right">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block truncate max-w-56">
                  {clientFullName}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold block truncate">
                  {clientEmail}
                </span>
              </div>
            </div>

            <Button variant="destructive"
              onClick={handleLogout}
              className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              title="Sair do Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 space-y-6"
      >
        {/* Falha vinda das RPCs do portal. Aparece porque a aprovação daqui é
            gravada em segundo plano: sem aviso, a tela diria "aprovado" com o
            banco intacto. */}
        {erroDoPortal && (
          <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erroDoPortal}</span>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Área Exclusiva do Cliente</span>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Olá, {clientFullName}! 👋
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Acompanhe suas publicações, aprove conteúdos, acesse pastas de arquivos, notas fiscais e credenciais com total comodidade.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-center min-w-28">
              <span className="block text-2xl font-black font-mono">{pendingApprovals.length}</span>
              <span className="text-[11px] font-bold">Para Aprovar</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-center min-w-28">
              <span className="block text-2xl font-black font-mono">{upcomingScheduled.length}</span>
              <span className="text-[11px] font-bold">Programados</span>
            </div>
          </div>
        </div>

        {/* Portal Tabs Bar */}
        {/*
          Lista, e não sete botões iguais copiados: as abas agora dependem do
          papel, e sete condicionais espalhadas seriam sete lugares para
          esquecer uma. O que o aprovador não vê aqui ele também não recebe
          do banco — esconder aba com o dado já no navegador seria a tela
          mentindo sobre o que entregou.
        */}
        {/* Portal Tabs Bar - Estilo Nativo shadcn */}
        <div className="flex items-center overflow-x-auto no-scrollbar">
          <TabsList className="h-10 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs gap-1">
            {abasVisiveis.map((aba) => {
              const Icone = aba.icone;
              return (
                <TabsTrigger key={aba.id} value={aba.id} className="h-8 px-3 rounded-lg text-xs font-semibold gap-2">
                  <Icone className="w-4 h-4" />
                  {aba.rotulo}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab 1: Approvals */}
        <TabsContent value="approvals">
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Tudo Aprovado por Aqui!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Não há postagens aguardando sua revisão no momento. Todos os seus posts programados já estão prontos para publicação.
                </p>
              </div>
            ) : (
              /*
                Quatro colunas a partir do `xl`, três no `lg`. Abaixo de
                1280px o card de quatro colunas fica com ~230px, e a legenda —
                que é o outro lado da decisão de aprovar — passa a caber em
                três palavras por linha.
              */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {pendingApprovals.map(job => (
                  <div 
                    key={job.id} 
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    {/*
                      Copy e roteiro não têm arte, e a moldura vazia com
                      "Preview do Criativo" prometia uma imagem que nunca vai
                      existir — o cliente ficaria esperando a arte para
                      aprovar. Neles a faixa é só a identificação do que é.
                    */}
                    <div
                      className={`relative overflow-hidden ${
                        definicaoDoTipo(job.tipo).pedeArte
                          ? job.format === 'feed_story'
                            ? // Empilha a arte e o seletor dela. As duas
                              // etiquetas continuam `absolute` em relação a
                              // este bloco, e caem sobre o topo da arte.
                              'flex flex-col bg-slate-900'
                            : `flex items-center justify-center ${proporcaoDoCriativo(job.platform, job.format)} bg-slate-900`
                          : 'flex items-center justify-center py-4 bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {definicaoDoTipo(job.tipo).pedeArte && job.format === 'feed_story' && (
                        <CriativoDeFeedEStory
                          feed={job.mediaUrls?.[0]}
                          story={job.storyMediaUrls?.[0]}
                        />
                      )}

                      {definicaoDoTipo(job.tipo).pedeArte &&
                        job.format !== 'feed_story' &&
                        (job.mediaUrls && job.mediaUrls.length > 0 ? (
                          <img
                            src={urlDeExibicao(job.mediaUrls[0])}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-400 flex flex-col items-center gap-2 text-xs">
                            <Layers className="w-8 h-8" />
                            <span>Preview do Criativo</span>
                          </div>
                        ))}

                      <div
                        className={`flex items-center gap-1.5 ${
                          definicaoDoTipo(job.tipo).pedeArte ? 'absolute top-3 left-3' : ''
                        }`}
                      >
                        <PlatformBadge platform={job.platform} />
                        <FormatBadge format={job.format} />
                        {!definicaoDoTipo(job.tipo).pedeArte && <TipoBadge tipo={job.tipo} />}
                      </div>

                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                          definicaoDoTipo(job.tipo).pedeArte
                            ? 'absolute top-3 right-3 bg-slate-900/80 text-white backdrop-blur-xs'
                            : 'absolute top-1/2 right-3 -translate-y-1/2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        v{job.currentVersion}
                      </span>
                    </div>

                    {/* Content text */}
                    <div className="p-5 space-y-3 flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {job.title}
                      </h4>

                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/70 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto font-sans leading-relaxed">
                        {job.caption}
                      </div>

                      {job.cta && (
                        <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold bg-purple-50/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                          👉 {job.cta}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>Previsão de postagem:</span>
                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                          {safeDateTimeFormat(job.scheduledDate)}
                        </strong>
                      </div>
                    </div>

                    {/*
                      **O terceiro caminho.** Aprovar joga a peça para a
                      frente e pedir ajuste joga para trás, criando uma versão
                      nova — "a foto está ótima, só troque o horário no texto"
                      não cabia em nenhum dos dois, e virava mensagem no
                      WhatsApp da agência, longe do conteúdo de que falava.
                    */}
                    <ConversaComAAgencia job={job} />

                    {/* Actions Toolbar */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between gap-3">
                      <Button variant="destructive"
                        onClick={() => {
                          setSelectedForReview(job);
                          setIsRejecting(true);
                        }}
                        className="flex-1 bg-rose-50 text-rose-700 border border-rose-200"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Pedir Ajuste
                      </Button>

                      <Button variant="success"
                        onClick={() => handleApprove(job.id)}
                        className="flex-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovar Agora
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Calendar */}
        <TabsContent value="calendar">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
                {safeDateFormat(calendarMonth, { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost"
                  onClick={() => setCalendarMonth(new Date())}
                >
                  Hoje
                </Button>
                <Button variant="secondary" size="icon-sm"
                  onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="text-slate-500"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="secondary" size="icon-sm"
                  onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="text-slate-500"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ClientPortalMonthGrid
              month={calendarMonth}
              jobs={clientJobs}
              onSelectJob={setCalendarPreviewJob}
            />
          </div>
        </TabsContent>

        {/* Tab 3: Arquivos & Drive */}
        <TabsContent value="arquivos">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Arquivos e Pastas Compartilhadas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Logos oficiais, manuais de marca e pastas na nuvem.</p>
              </div>
              {podeEditar && !mostrarFormArquivo && (
                <Button
                  onClick={() => setMostrarFormArquivo(true)}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Anexar Arquivo
                </Button>
              )}
            </div>

            {podeEditar && mostrarFormArquivo && (
              <form
                onSubmit={salvarArquivo}
                className="p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-slate-50 dark:bg-slate-950 space-y-4 animate-in fade-in"
              >
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">Anexar arquivo</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Nome</label>
                    <input
                      type="text"
                      placeholder="Ex: Manual da marca 2026"
                      value={novoArqNome}
                      onChange={(e) => setNovoArqNome(e.target.value)}
                      className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Categoria</label>
                    <select
                      value={novoArqCategoria}
                      onChange={(e) => setNovoArqCategoria(e.target.value as ClientFile['category'])}
                      className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800 cursor-pointer"
                    >
                      <option value="identidade_visual">Identidade visual</option>
                      <option value="briefing">Briefing</option>
                      <option value="fotos">Fotos</option>
                      <option value="videos">Vídeos</option>
                      <option value="documentos">Documentos</option>
                      <option value="contratos">Contratos</option>
                    </select>
                  </div>
                </div>
                <FileUpload
                  label="Arquivo (ou link da nuvem)"
                  value={novoArqUrl}
                  fileName={novoArqNome}
                  fileSize={novoArqTamanho}
                  onFileSelect={(file) => {
                    setNovoArqUrl(file.url);
                    setNovoArqTamanho(file.size);
                    // O nome do arquivo é o melhor palpite de título, e só
                    // preenche o campo vazio: sobrescrever o que a pessoa
                    // digitou seria perder o texto dela.
                    if (!novoArqNome.trim()) setNovoArqNome(file.name.replace(/\.[^/.]+$/, ''));
                  }}
                  onFileRemove={() => {
                    setNovoArqUrl('');
                    setNovoArqTamanho('');
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => setMostrarFormArquivo(false)}
                    className="dark:hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                  >
                    Anexar
                  </Button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {(client.files || []).map(file => (
                <div key={file.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900/40">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{file.name}</span>
                      <span className="text-slate-400 text-[11px] block">{file.size} &bull; {file.uploadedAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-purple-600 transition shadow-xs cursor-pointer"
                      title="Acessar arquivo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {podeEditar && (
                      <Button variant="destructive" size="icon-sm"
                        onClick={() => deleteClientFile(client.id, file.id)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-red-600"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(client.files || []).length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
                  Nenhum arquivo disponível no momento.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Senhas (Cofre) */}
        <TabsContent value="senhas">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Cofre de Senhas da Empresa</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Credenciais que você compartilha com a equipe de marketing da agência.
                </p>
              </div>
              {podeEditar && !mostrarFormSenha && (
                <Button
                  onClick={() => setMostrarFormSenha(true)}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Nova Credencial
                </Button>
              )}
            </div>

            {podeEditar && mostrarFormSenha && (
              <form
                onSubmit={salvarSenha}
                className="p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-slate-50 dark:bg-slate-950 space-y-4 animate-in fade-in"
              >
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">Cadastrar credencial</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Serviço</label>
                    <input
                      type="text"
                      placeholder="Ex: Instagram (@empresa)"
                      value={novaSenhaServico}
                      onChange={(e) => setNovaSenhaServico(e.target.value)}
                      className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Usuário</label>
                    <input
                      type="text"
                      placeholder="login ou @usuario"
                      value={novaSenhaUsuario}
                      onChange={(e) => setNovaSenhaUsuario(e.target.value)}
                      className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Senha</label>
                    <input
                      type="text"
                      placeholder="Senha de acesso"
                      value={novaSenhaValor}
                      onChange={(e) => setNovaSenhaValor(e.target.value)}
                      className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800 font-mono"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Notas / instruções de 2FA
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: o código de verificação chega no celular da Ana"
                      value={novaSenhaNotas}
                      onChange={(e) => setNovaSenhaNotas(e.target.value)}
                      className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => setMostrarFormSenha(false)}
                    className="dark:hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                  >
                    Salvar credencial
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-3 pt-2">
              {(client.passwords || []).map(pwd => {
                const isRevealed = revealedPasswords[pwd.id];
                return (
                  <div key={pwd.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-900/40">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{pwd.service}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Usuário: <strong className="text-slate-700 dark:text-slate-300">{pwd.username}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs">
                        <span className="mr-2 text-slate-700 dark:text-slate-300">
                          {isRevealed ? pwd.password : '••••••••••••'}
                        </span>
                        <Button variant="ghost" size="icon-sm" 
                          onClick={() => toggleRevealPassword(pwd.id)}
                          className="dark:hover:text-white mr-1"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" 
                          onClick={() => handleCopy(pwd.password, pwd.id)}
                        >
                          {copiedId === pwd.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      {podeEditar && (
                        <Button variant="destructive" size="icon-sm"
                          onClick={() => deleteClientPassword(client.id, pwd.id)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-red-600"
                          title="Remover credencial"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {(client.passwords || []).length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma credencial cadastrada.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Notas Fiscais */}
        <TabsContent value="notas">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Notas Fiscais de Prestação de Serviços</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Histórico de NFS-e emitidas para sua empresa pela agência.</p>
            </div>
            <div className="space-y-3 pt-2">
              {(client.invoices || []).map(inv => (
                <div key={inv.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/40">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{inv.number}</span>
                      <span className="text-[11px] text-slate-400">Competência: {inv.monthRef} &bull; Emissão: {inv.issueDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      R$ {inv.value.toLocaleString('pt-BR')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md ${
                      inv.status === 'pago' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                    }`}>
                      {inv.status}
                    </span>
                    {/*
                      Era um botão com `alert("Baixando comprovante...")` —
                      não baixava nada, e dizia que sim. A nota tem
                      `fileUrl`; quando ele existe isto é um link de verdade,
                      e quando não existe o botão **não aparece**, em vez de
                      aparecer sem funcionar.

                      `'#'` conta como ausente: era o padrão que o cadastro
                      gravava quando ninguém anexava arquivo.
                    */}
                    {inv.fileUrl && inv.fileUrl !== '#' ? (
                      <a
                        href={inv.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-purple-600 transition shadow-xs cursor-pointer"
                        title={`Abrir a NFS-e ${inv.number}`}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <span
                        className="text-[10px] font-bold text-slate-400 px-2"
                        title="A agência ainda não anexou o arquivo desta nota."
                      >
                        sem arquivo
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(client.invoices || []).length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma nota fiscal emitida até o momento.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 6: Briefing */}
        <TabsContent value="briefing">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Briefing &amp; Posicionamento da Sua Marca
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Guia de conteúdo, personas e regras editoriais. É daqui que a agência tira o
                  tom de cada publicação.
                </p>
              </div>
              {podeEditar && (
                briefingEmEdicao ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost"
                      onClick={() => setBriefingEmEdicao(null)}
                      className="dark:hover:text-white"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={salvarBriefing}
                    >
                      <Save className="w-4 h-4" />
                      Salvar briefing
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setBriefingEmEdicao(client.briefing ? { ...client.briefing } : {})}
                    className="shrink-0"
                  >
                    Editar briefing
                  </Button>
                )
              )}
            </div>

            {/*
              Os textos de exemplo saíram daqui.
              A tela trazia "Acolhedor, especialista, dinâmico" e outros três
              parágrafos como se fossem o briefing do cliente — eram
              constantes no código. Quem lia concluía que a agência tinha
              alinhado um posicionamento que ninguém escreveu. Campo vazio
              agora diz que está vazio, e quem pode preencher vê o botão.
            */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAMPOS_DO_BRIEFING.map((campo) => {
                const valor = briefingEmEdicao
                  ? briefingEmEdicao[campo.id] ?? ''
                  : client.briefing?.[campo.id] ?? '';

                return (
                  <div
                    key={campo.id}
                    className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 ${
                      campo.largo ? 'md:col-span-2' : ''
                    }`}
                  >
                    <span className="text-[11px] font-bold uppercase text-purple-600">
                      {campo.rotulo}
                    </span>
                    {briefingEmEdicao ? (
                      <textarea
                        value={valor}
                        onChange={(e) =>
                          setBriefingEmEdicao((antes) => ({ ...antes, [campo.id]: e.target.value }))
                        }
                        rows={4}
                        placeholder={campo.dica}
                        className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed resize-y"
                      />
                    ) : valor ? (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {valor}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed italic">
                        Ainda não preenchido.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {!podeEditar && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Seu acesso é de aprovador: você lê o briefing, mas quem altera é um editor
                da sua empresa ou a própria agência.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab 7: Client Materials / Photo Upload */}
        <TabsContent value="materiais">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-600" />
                  Central de Envio de Materiais & Fotos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Envie fotos em alta resolução, vídeos brutos, logos vetorizados ou documentos de apoio para a equipe da agência criar suas artes.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsAddingMaterial(!isAddingMaterial)}
                className="shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>{isAddingMaterial ? 'Fechar Formulário' : 'Enviar Novo Material'}</span>
              </Button>
            </div>

            {/* Material Upload Form */}
            {isAddingMaterial && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  // Sem arquivo não há material. O padrão anterior gravava
                  // uma foto do Unsplash e "4,2 MB" — a agência recebia um
                  // material que o cliente nunca enviou, com um tamanho que
                  // ninguém mediu, e ia trabalhar em cima disso.
                  if (!newMatTitle.trim() || !newMatUrl.trim()) return;
                  addClientMaterial({
                    clientId: client.id,
                    title: newMatTitle.trim(),
                    category: newMatCategory,
                    url: newMatUrl.trim(),
                    thumbnailUrl: newMatUrl.trim(),
                    notes: newMatNotes.trim(),
                    status: 'recebido'
                  });
                  setNewMatTitle('');
                  setNewMatUrl('');
                  setNewMatNotes('');
                  setIsAddingMaterial(false);
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-purple-200 dark:border-purple-900/60 shadow-lg space-y-4 animate-in fade-in duration-200"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  Cadastrar Novo Arquivo ou Fotografia
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Título do Material *
                    </label>
                    <input
                      type="text"
                      required
                      value={newMatTitle}
                      onChange={(e) => setNewMatTitle(e.target.value)}
                      placeholder="Ex: Fotos do Novo Espaço / Café Gourmet"
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Tipo de Conteúdo
                    </label>
                    <select
                      value={newMatCategory}
                      onChange={(e) => setNewMatCategory(e.target.value as any)}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="photo">Fotografia / Imagem do Produto</option>
                      <option value="video">Vídeo Bruto / Depoimento</option>
                      <option value="logo">Logotipo ou Elemento Visual</option>
                      <option value="doc">Documento / PDF de Apoio</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FileUpload
                    label="Foto / Arquivo do Material (ou link da nuvem)"
                    value={newMatUrl}
                    fileName={newMatTitle}
                    onFileSelect={(file) => {
                      setNewMatUrl(file.url);
                      if (!newMatTitle) {
                        setNewMatTitle(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }}
                    onFileRemove={() => setNewMatUrl('')}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Instruções ou Observações para a Agência
                  </label>
                  <textarea
                    rows={2}
                    value={newMatNotes}
                    onChange={(e) => setNewMatNotes(e.target.value)}
                    placeholder="Ex: Favor usar na arte de terça-feira destacando o selo de qualidade."
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => setIsAddingMaterial(false)}
                  >
                    Cancelar
                  </Button>
                  {/* Desabilitado, e não recusando calado no submit: sem o
                      arquivo o envio não acontece, e a pessoa precisa ver por
                      quê antes de clicar. */}
                  <Button
                    type="submit"
                    disabled={!newMatTitle.trim() || !newMatUrl.trim()}
                    title={
                      !newMatUrl.trim()
                        ? 'Envie o arquivo ou cole o link dele antes de confirmar.'
                        : undefined
                    }
                  >
                    Confirmar Envio
                  </Button>
                </div>
              </form>
            )}

            {/* Material Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {clientMaterials
                .filter(m => m.clientId === client.id)
                .map((mat) => (
                  <div
                    key={mat.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                  >
                    {/* Thumbnail Preview */}
                    <div className="aspect-video bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
                      {mat.thumbnailUrl ? (
                        <img
                          src={mat.thumbnailUrl}
                          alt={mat.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <FolderOpen className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-900/80 text-white backdrop-blur-xs">
                          {mat.category}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                          mat.status === 'utilized'
                            ? 'bg-emerald-500 text-white'
                            : mat.status === 'in_review'
                            ? 'bg-purple-500 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {mat.status === 'utilized' ? 'Utilizado' : mat.status === 'in_review' ? 'Em Uso' : 'Recebido'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {mat.title}
                        </h4>
                        {mat.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            "{mat.notes}"
                          </p>
                        )}
                        <span className="text-[10px] text-slate-400 block mt-2">
                          Enviado em {safeDateFormat(mat.createdAt)} • {mat.size}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <a
                          href={mat.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Abrir</span>
                        </a>

                        <Button variant="destructive" size="icon-sm"
                          type="button"
                          onClick={() => deleteClientMaterial(mat.id)}
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

              {clientMaterials.filter(m => m.clientId === client.id).length === 0 && (
                <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
                  <Upload className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium">Nenhum material enviado por este cliente até o momento.</p>
                  <p className="text-[11px] text-slate-500">
                    Use o botão &quot;Enviar Novo Material&quot; acima para mandar fotos e
                    arquivos para a agência.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 8: Usuários do portal — só o editor chega aqui */}
        <TabsContent value="usuarios">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Quem da sua empresa acessa este portal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O aprovador vê o conteúdo e aprova. O editor faz isso e mais: anexa arquivos,
                cadastra senhas, vê as notas fiscais, altera o briefing e convida outras
                pessoas.
              </p>
            </div>

            {erroUsuarios && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                {erroUsuarios}
              </div>
            )}

            <form
              onSubmit={criarUsuario}
              className="p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-slate-50 dark:bg-slate-950 space-y-4"
            >
              <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">
                Convidar alguém
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="pessoa@empresa.com.br"
                    value={novoUsuEmail}
                    onChange={(e) => setNovoUsuEmail(e.target.value)}
                    className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Nome (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Como aparece no histórico"
                    value={novoUsuNome}
                    onChange={(e) => setNovoUsuNome(e.target.value)}
                    className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Papel</label>
                  <select
                    value={novoUsuPapel}
                    onChange={(e) => setNovoUsuPapel(e.target.value as ClientUserRole)}
                    className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800 cursor-pointer"
                  >
                    <option value="aprovador">Aprovador</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                >
                  <Plus className="w-4 h-4" />
                  Dar acesso
                </Button>
              </div>
            </form>

            {carregandoUsuarios ? (
              <div className="p-10 flex justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {usuariosDoPortal.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          u.papel === 'editor'
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 border-purple-100 dark:border-purple-900/40'
                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {u.papel === 'editor' ? (
                          <ShieldCheck className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {u.nome || u.email}
                          {u.id === portalUsuario?.id && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-purple-600">
                              você
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                          {u.nome ? `${u.email} • ` : ''}
                          {u.ultimoAcesso
                            ? `último acesso em ${safeDateFormat(u.ultimoAcesso)}`
                            : 'nunca entrou'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                        {u.papel}
                      </span>
                      {!u.ativo && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                          suspenso
                        </span>
                      )}
                      {/* Ninguém remove o próprio acesso: o último editor
                          faria isso por engano e ficaria do lado de fora,
                          sem tela de recuperação. A RPC também recusa. */}
                      {u.id !== portalUsuario?.id && (
                        <Button variant="destructive" size="icon-sm"
                          onClick={() => void removerUsuario(u.id, u.email)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-red-600"
                          title="Remover do portal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview do job clicado no calendário: aprova/pede ajuste se ainda
          estiver aguardando aprovação, senão só mostra o conteúdo e o status. */}
      {/* `z-[60]`: abre por cima da casca do portal, que é `z-50`. */}
      <Dialog open={!!calendarPreviewJob} onOpenChange={(aberto) => !aberto && setCalendarPreviewJob(null)}>
        {calendarPreviewJob && (
          <DialogContent tamanho="formulario" className="z-[60] p-0 gap-0">
            {/* A prévia abre mostrando a arte, sem faixa de título. O nome
                existe para quem usa leitor de tela. */}
            <DialogTitle className="sr-only">{calendarPreviewJob.title}</DialogTitle>
              {/*
                **A prévia do calendário também aprova**, e por isso ela
                precisa das duas artes tanto quanto o card. Ela mostrava
                `mediaUrls[0]` em qualquer formato: num feed+story, a arte
                vertical nunca chegava à tela do cliente — que decide sobre
                uma peça vendo metade dela. É a mesma omissão do card, um
                clique adiante, e passou despercebida porque o caminho de
                aprovação daqui é o menos usado.
              */}
              <div
                className={`relative bg-slate-900 overflow-hidden shrink-0 ${
                  calendarPreviewJob.format === 'feed_story'
                    ? 'flex flex-col'
                    : `flex items-center justify-center ${proporcaoDoCriativo(calendarPreviewJob.platform, calendarPreviewJob.format)} max-h-72`
                }`}
              >
                {calendarPreviewJob.format === 'feed_story' ? (
                  <CriativoDeFeedEStory
                    feed={calendarPreviewJob.mediaUrls?.[0]}
                    story={calendarPreviewJob.storyMediaUrls?.[0]}
                    encaixe="caber"
                  />
                ) : calendarPreviewJob.mediaUrls && calendarPreviewJob.mediaUrls.length > 0 ? (
                  <img src={urlDeExibicao(calendarPreviewJob.mediaUrls[0])} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center gap-2 text-xs">
                    <Layers className="w-8 h-8" />
                    <span>Preview do Criativo</span>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <PlatformBadge platform={calendarPreviewJob.platform} />
                  <FormatBadge format={calendarPreviewJob.format} />
                </div>
                <Button size="icon-sm"
                  onClick={() => setCalendarPreviewJob(null)}
                  className="absolute top-3 right-3 bg-slate-900/70 text-white hover:bg-slate-900"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {calendarPreviewJob.title}
                  </h4>
                  <StatusBadge status={calendarPreviewJob.status} />
                </div>

                {calendarPreviewJob.caption && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/70 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                    {calendarPreviewJob.caption}
                  </div>
                )}

                {calendarPreviewJob.cta && (
                  <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold bg-purple-50/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    👉 {calendarPreviewJob.cta}
                  </p>
                )}

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Previsão de postagem:</span>
                  <strong className="text-slate-700 dark:text-slate-300 font-mono">
                    {safeDateTimeFormat(calendarPreviewJob.scheduledDate)}
                  </strong>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-end gap-3 shrink-0">
                {calendarPreviewJob.status === 'for_approval' ? (
                  <>
                    <Button variant="destructive"
                      onClick={() => {
                        const job = calendarPreviewJob;
                        setCalendarPreviewJob(null);
                        setSelectedForReview(job);
                        setIsRejecting(true);
                      }}
                      className="flex-1 bg-rose-50 text-rose-700 border border-rose-200"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Pedir Ajuste
                    </Button>
                    <Button variant="success"
                      onClick={() => {
                        handleApprove(calendarPreviewJob.id);
                        setCalendarPreviewJob(null);
                      }}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprovar Agora
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost"
                    onClick={() => setCalendarPreviewJob(null)}
                  >
                    Fechar
                  </Button>
                )}
              </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Reject/Adjustment Dialog */}
      {/* `z-[60]`: abre por cima da casca do portal, que é `z-50`. */}
      <Dialog open={isRejecting && !!selectedForReview} onOpenChange={(aberto) => !aberto && setIsRejecting(false)}>
        {isRejecting && selectedForReview && (
          <DialogContent tamanho="formulario" className="z-[60]">
            <DialogHeader className="pr-12">
              <DialogTitle className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-base font-semibold">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <span>Solicitar Ajuste no Conteúdo</span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Descreva com detalhes o que precisa ser alterado para que nossa equipe produza a nova versão imediatamente.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  O que precisa ser ajustado?
                </label>
                <textarea
                  rows={5}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Ex: Gostaria de trocar a foto do slide 2 e alterar a chamada final para..."
                  className="w-full text-sm p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-y min-h-[110px]"
                  autoFocus
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsRejecting(false);
                  setSelectedForReview(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!feedbackText.trim()}
                onClick={handleReject}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>

      {dialogo}
    </>
  );
};
