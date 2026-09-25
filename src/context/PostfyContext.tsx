import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { safeDateFormat } from '../lib/utils';
import confetti from 'canvas-confetti';
import { 
  Workspace, 
  User, 
  Role,
  Client, 
  Job,
  JobTipo,
  JobStatus,
  JobPlatform, 
  Lead, 
  LeadStage,
  Proposal, 
  Contract, 
  Automation, 
  Notification, 
  ActivityLog,
  CalendarViewMode,
  ClientPassword,
  ClientInvoice,
  ClientBriefing,
  ClientFile,
  ClientAnnotation,
  ClientMaterial,
  TimesheetLog,
  TabType
} from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { aiApi, ApiError } from '../lib/api';
import {
  db,
  carregarTudo,
  listarWorkspaces,
  atualizarWorkspace,
  buscarJobsDoPeriodo,
  buscarNotificacoesRecentes,
  DIAS_DE_HISTORICO,
  moverAgenciaParaLixeira as moverParaLixeira,
  restaurarAgencia as restaurarDaLixeira,
  DbError,
} from '../lib/db';
import {
  entrar as authEntrar,
  cadastrar as authCadastrar,
  sair as authSair,
  garantirAgencia,
  criarAgencia as authCriarAgencia,
  enviarRecuperacaoDeSenha,
  definirNovaSenha,
  carregarSessao,
  aoMudarAutenticacao,
  temSessaoAberta,
  type SessaoDoApp,
} from '../lib/authSupabase';
import { diferenciar, temMudanca, novoId } from '../lib/sincronizacao';
import { criarPainelDeErros, type Repintura } from '../lib/errosDeGravacao';
import {
  carregarAparencia,
  esquecerAparencia,
  APARENCIA_PADRAO,
  type AparenciaDoSaas,
} from '../lib/aparencia';
import { carregarPreferencias, salvarPreferencias } from '../lib/preferencias';
import { dispararAutomacoes, EVENTOS_DISPONIVEIS, ACOES_DISPONIVEIS } from '../lib/automacoes';
import { identificar, encerrarIdentificacao, registrar } from '../lib/analytics';
import { belongsToWorkspace as pertenceAoWorkspace } from '../lib/workspaceScope';
import {
  abaDoCaminho,
  urlDaAba,
  ABA_INICIAL,
  CAMINHO_PORTAL_PREVIEW,
  urlDaPreviaDoPortal,
  agenciaDoCaminho,
} from '../lib/rotas';
import { carregarAcessoDaAgencia, type AcessoDaAgencia } from '../lib/assinatura';
import { definirFusoDaAgencia } from '../lib/fusoHorario';
import { prepararMidiaDoDrive } from '../lib/midiaParaPublicar';
import { apagarMidiaDaPeca } from '../lib/midiaDaPeca';
import { quantasNoDrive } from '../lib/midiaDoDrive';
import {
  carregarPortal,
  aprovarPeloPortal,
  pedirAjustePeloPortal,
  comentarNoPortal,
  salvarDadosPeloPortal,
  enviarMaterialPeloPortal,
  tokenGuardado,
  guardarToken,
  esquecerToken,
  type DadosDoPortal,
  type UsuarioDoPortal,
  carregarMarcaDaAgencia,
  registrarAcessoNoPortal,
} from '../lib/portal';

/**
 * De minuto em minuto, e sempre que a aba volta ao primeiro plano.
 *
 * Um minuto porque o que chega por aqui é decisão do cliente sobre uma peça
 * — aprovou, pediu ajuste, entrou no portal. Mais lento que isso e a agência
 * descobre pelo WhatsApp antes de descobrir pelo produto, que é o problema
 * que o sino existe para resolver.
 */
const INTERVALO_DAS_NOTIFICACOES = 60 * 1000;

interface PostfyContextType {
  // General
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  sidebarRecolhida: boolean;
  setSidebarRecolhida: (recolhida: boolean) => void;
  
  // Workspaces & Users
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  setCurrentWorkspace: (ws: Workspace) => void;
  /** Recarrega esperando a fila de gravação drenar. */
  recarregarComSeguranca: () => Promise<void>;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  updateCurrentWorkspace: (updates: Partial<Workspace>) => void;
  createWorkspace: (name: string, primaryColor?: string) => Promise<Workspace | null>;
  /**
   * Manda a agência para a lixeira. Devolve quando ela entrou lá.
   *
   * Substitui o antigo `deleteWorkspace`, que chamava `removerMembro` — ele
   * tirava o vínculo de quem clicou, não a agência. Para o admin da
   * plataforma, que normalmente não é membro, era um no-op silencioso: o
   * botão não fazia nada e ninguém via erro.
   */
  moverAgenciaParaLixeira: (workspaceId: string) => Promise<void>;
  /** Tira da lixeira, antes de os 7 dias passarem. */
  restaurarAgenciaDaLixeira: (workspaceId: string) => Promise<void>;
  isCreateWorkspaceModalOpen: boolean;
  /**
   * Abre o editor de perfil (nome, avatar, senha, e-mail).
   *
   * Mesmo padrão do modal de nova agência: o modal mora no App, e o
   * sinalizador vive aqui para qualquer tela poder chamá-lo. Sem isto, o
   * botão em Configurações → Visão Geral não teria como abri-lo — e um
   * botão que não abre nada é o bug que aquela tela inteira era.
   */
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;

  /**
   * A agência pode usar o produto agora?
   *
   * `null` enquanto a resposta não chegou — e a tela **não bloqueia nesse
   * estado**: derrubar quem está trabalhando porque a consulta demorou é pior
   * que deixar passar alguns segundos de quem não pagou.
   */
  /**
   * Garante que os jobs de um período estejam em memória.
   *
   * A carga inicial traz os abertos e os concluídos dos últimos 90 dias. Quem
   * navega o calendário para trás ou pede um relatório mais longo chama isto,
   * e o que faltava é buscado e juntado ao estado.
   */
  garantirJobsDoPeriodo: (inicio: Date, fim: Date) => Promise<void>;

  acessoDaAgencia: AcessoDaAgencia | null;
  /** Refaz a consulta — usado ao voltar do checkout do Stripe. */
  recarregarAcesso: () => Promise<void>;
  setIsCreateWorkspaceModalOpen: (open: boolean) => void;
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (input: { name: string; email: string; password: string; agencyName?: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  /** Recarrega a sessão do Supabase (usado após aceitar convite). */
  recarregarSessaoPublica: () => Promise<void>;
  /**
   * Por que uma sessão aberta não virou acesso.
   *
   * Existe para o login que termina **fora** da tela — a volta do Google. Ali
   * não há chamada cujo retorno a tela possa ler: a página recarrega, e quem
   * descobre que a conta não pôde entrar em agência nenhuma é o carregamento
   * da sessão. Sem este recado, a pessoa volta do Google para a tela de login
   * sem nada explicando, e tenta de novo para sempre.
   */
  avisoDaEntrada: string | null;
  recuperarSenha: (email: string) => Promise<{ success: boolean; message?: string }>;
  redefinirSenha: (novaSenha: string) => Promise<{ success: boolean; message?: string }>;
  
  // Navigation & Views
  activeTab: string;
  setActiveTab: (tab: string) => void;
  calendarView: CalendarViewMode;
  setCalendarView: (view: CalendarViewMode) => void;
  /**
   * "Cadastrar novo cliente" pedido de fora da tela de Clientes.
   *
   * O formulário mora em `ClientsView`, em estado local, e quem clica está no
   * cabeçalho — duas árvores diferentes, sem pai em comum abaixo daqui.
   *
   * **Não virou caminho (`/clientes/novo`) de propósito.** O segundo trecho de
   * `/clientes/...` já é o slug de um cliente, e o slug nasce do nome, no
   * banco: um cliente chamado "Novo" ocuparia o endereço do formulário, e a
   * colisão só apareceria depois de ele existir — com a ficha dele abrindo um
   * cadastro em branco.
   *
   * É consumido uma vez e apagado. Sem isso, sair da tela de Clientes e voltar
   * reabriria o formulário sozinho, porque o pedido continuaria de pé.
   */
  abrirNovoCliente: () => void;
  pedidoDeNovoCliente: boolean;
  consumirPedidoDeNovoCliente: () => void;
  
  // Filters
  clientFilter: string; // 'all' or clientId
  setClientFilter: (filter: string) => void;
  platformFilter: string; // 'all' or platform
  setPlatformFilter: (filter: string) => void;
  statusFilter: string; // 'all' or status
  setStatusFilter: (filter: string) => void;
  
  // Modals & Sheets
  selectedJob: Job | null;
  setSelectedJob: (job: Job | null) => void;
  isCreateJobModalOpen: boolean;
  openCreateJobModal: (date?: string, tipo?: JobTipo) => void;
  closeCreateJobModal: () => void;
  createJobPreselectedDate: string | null;
  /** Entrega escolhida no menu Adicionar; o modal se molda a ela. */
  createJobTipo: JobTipo;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  
  // Client Portal Simulation Mode
  isClientPortalOpen: boolean;
  /** Cliente resolvido no portal: por token (link externo) ou por prévia interna. */
  portalClientId: string | null;
  /** Prévia interna do portal, para a equipe da agência. */
  openClientPortal: (clientId: string) => void;
  /** Abre a prévia numa aba nova, com URL amigável própria (não `/calendario`). */
  visualizarPortalDoCliente: (clientId: string) => void;
  closeClientPortal: () => void;
  /** Entrada do cliente: token devolvido pela conferência do código. */
  entrarNoPortal: (token: string) => void;
  sairDoPortal: () => void;
  /** True enquanto a RPC do portal não respondeu. */
  carregandoPortal: boolean;
  erroDoPortal: string | null;
  /**
   * Quem entrou no portal e com que papel. `null` na prévia interna, que é
   * a equipe da agência olhando — ela não é usuária do cliente.
   */
  portalUsuario: UsuarioDoPortal | null;
  /** Atalho do papel: o editor escreve, o aprovador só aprova. */
  portalEhEditor: boolean;
  
  // Data Entities
  clients: Client[];
  jobs: Job[];
  leads: Lead[];
  proposals: Proposal[];
  contracts: Contract[];
  automations: Automation[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  
  // Operations & Workflows
  createJob: (jobData: Partial<Job>) => Job;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  deleteJob: (jobId: string) => void;
  moveJobStatus: (jobId: string, newStatus: JobStatus) => void;
  approveJob: (jobId: string, approverName?: string) => void;
  requestAdjustment: (jobId: string, feedback: string, requesterName?: string) => void;
  addNewJobVersion: (jobId: string, mediaUrls: string[], caption: string) => void;
  addJobComment: (jobId: string, text: string, isClient?: boolean) => void;
  toggleChecklistItem: (jobId: string, itemId: string) => void;
  duplicateJob: (jobId: string) => void;
  
  // Client & Commercial Operations
  addClient: (clientData: Partial<Client>) => Client;
  updateClient: (clientId: string, updates: Partial<Client>) => void;
  deleteClient: (clientId: string) => void;
  addClientPassword: (clientId: string, password: Omit<ClientPassword, 'id' | 'updatedAt'>) => void;
  deleteClientPassword: (clientId: string, passwordId: string) => void;
  addClientInvoice: (clientId: string, invoice: Omit<ClientInvoice, 'id'>) => void;
  deleteClientInvoice: (clientId: string, invoiceId: string) => void;
  addClientFile: (clientId: string, file: Omit<ClientFile, 'id' | 'uploadedAt'>) => void;
  updateClientFile: (
    clientId: string,
    fileId: string,
    dados: Partial<Pick<ClientFile, 'name' | 'category' | 'url'>>
  ) => void;
  deleteClientFile: (clientId: string, fileId: string) => void;
  updateClientBriefing: (clientId: string, briefing: Partial<ClientBriefing>) => void;
  addLead: (leadData: Partial<Lead>) => Lead;
  updateLeadStage: (leadId: string, stage: LeadStage) => void;
  convertLeadToClient: (leadId: string) => void;
  acceptProposal: (proposalId: string) => void;
  generateContractFromProposal: (proposalId: string) => void;
  createContract: (contractData: Partial<Contract>) => Contract;
  signContract: (contractId: string, signatoryName: string) => void;
  addProposal: (proposalData: Partial<Proposal>) => Proposal;
  
  // Notifications & Automations
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  toggleAutomation: (id: string) => void;
  createAutomation: (dados: {
    title: string;
    triggerEvent: NonNullable<Automation['triggerEvent']>;
    actionType: NonNullable<Automation['actionType']>;
    actionConfig?: Record<string, unknown>;
  }) => Automation;
  deleteAutomation: (id: string) => void;
  
  // Calculated Agency Health
  agencyHealthScore: {
    total: number;
    productionOnTimeRate: number;
    approvalRateFirstTry: number;
    reworkIndex: number;
    activeJobsCount: number;
  };

  // Client Uploaded Materials
  clientMaterials: ClientMaterial[];
  addClientMaterial: (material: Omit<ClientMaterial, 'id' | 'createdAt'>) => void;
  deleteClientMaterial: (id: string) => void;

  // Timesheet
  timesheetLogs: TimesheetLog[];
  addTimesheetLog: (log: Omit<TimesheetLog, 'id' | 'createdAt'>) => void;

  // AI Operations (Gemini)
  generateAiCopy: (params: { theme: string; format?: string; platform?: string; clientId?: string; additionalNotes?: string }) => Promise<{ caption: string; hook: string; cta: string; hashtags: string[]; reelsScript?: string }>;
  convertFeedbackToTasks: (params: { clientFeedback: string; jobTitle: string; currentCopy?: string }) => Promise<{ summary: string; checklist: { item: string; role: 'designer' | 'copywriter' }[] }>;
  generateEditorialIdeas: (clientId: string) => Promise<{ ideas: { title: string; format: string; hook: string; rationale: string }[] }>;

  /**
   * A cara do produto: marca, paleta, banners e textos das telas públicas.
   *
   * Vem do banco por uma função anônima, então já está aqui antes de existir
   * sessão — é o que a tela de entrada e a porta do portal precisam. Enquanto
   * a resposta não chega, e se ela não chegar, vale `APARENCIA_PADRAO`:
   * ninguém deixa de entrar no sistema porque a cor não carregou.
   */
  aparencia: AparenciaDoSaas;
  recarregarAparencia: () => Promise<void>;

  // Supabase
  isPlatformAdmin: boolean;
  isSupabaseConnected: boolean;
  syncWithSupabase: () => Promise<{ success: boolean; message: string }>;

  // Sincronização com o servidor
  syncState: SyncState;
  syncError: string | null;
  /** A frase de cima da faixa; null usa a padrão, a da gravação recusada. */
  syncTitulo: string | null;
  forceSync: () => Promise<{ success: boolean; message: string }>;

  // Aviso de cota do armazenamento local
}

export type SyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const PostfyContext = createContext<PostfyContextType | undefined>(undefined);


export const PostfyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // As agências vêm do banco. O cache local só evita a tela piscar vazia
  // entre a montagem e a resposta do Supabase — nada de dados de exemplo, que
  // exibiriam agências inexistentes antes do login.
  const AGENCIA_VAZIA: Workspace = {
    id: '',
    name: 'Orquesia',
    slug: 'orquesia',
    logo: '',
    primaryColor: '#6366f1',
    whiteLabel: false,
    timezone: 'America/Sao_Paulo',
  };

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Nasce vazia e é preenchida pelo banco. Não há cópia local para ler antes:
  // a agência é dado de verdade, e mostrar uma versão velha dela — nome,
  // cor, plano — é pior do que mostrar o esqueleto por um instante.
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace>(AGENCIA_VAZIA);

  /**
   * O fuso da agência, definido **durante a renderização** e não num efeito.
   *
   * Efeito roda depois que a tela já pintou: a primeira renderização após
   * trocar de agência mostraria as datas no fuso da agência anterior, e por
   * um instante o horário estaria errado com cara de certo. Aqui é
   * idempotente e derivado do estado, então não há o que atrasar.
   *
   * É o único ponto que define o fuso. Todo formatador de `utils.ts` o lê
   * por padrão — ver o porquê em `src/lib/fusoHorario.ts`.
   */
  definirFusoDaAgencia(currentWorkspace.timezone);

  /**
   * Troca de agência recarregando a página.
   *
   * Só trocar o estado deixava rastro da agência anterior na tela: a marca
   * (cor e logo) é aplicada uma vez na montagem, e telas com estado próprio —
   * filtros, aba de configurações, modais abertos — continuavam apontando
   * para dados que já não eram os daquela agência.
   *
   * O recarregamento espera duas coisas antes de acontecer: a preferência
   * gravada, senão a página voltaria na agência antiga; e a fila de gravação
   * drenada, senão uma escrita otimista ainda em trânsito morreria no meio —
   * a tela mostra o resultado antes de o banco confirmar.
   */
  const setCurrentWorkspace = (ws: Workspace) => {
    if (!ws?.id || ws.id === currentWorkspace.id) return;
    setCurrentWorkspaceState(ws);

    void (async () => {
      try {
        await salvarPreferencias({ lastWorkspaceId: ws.id });
      } catch {
        /* Recarrega mesmo assim: a tela precisa sair do estado misturado. */
      }
      await recarregarComSeguranca();
    })();
  };

  /**
   * Recarrega a página sem perder o que ainda não foi gravado.
   *
   * A tela mostra o resultado antes de o banco confirmar, então recarregar no
   * meio de uma escrita a mataria em silêncio — o usuário veria a alteração
   * sumir no reload sem nunca ter visto um erro. Esperar a fila drenar custa
   * milissegundos e fecha esse buraco.
   */
  const recarregarComSeguranca = async () => {
    try {
      await filaDeGravacao.current;
    } catch {
      /* Se a gravação falhou, o aviso de erro já apareceu na faixa. */
    }
    window.location.reload();
  };

  const updateWorkspace = (workspaceId: string, updates: Partial<Workspace>) => {
    // Otimista na tela, persistido em seguida. Só owner/admin passa na RLS;
    // para os demais o erro aparece na faixa de aviso.
    atualizarWorkspace(workspaceId, updates).catch((erro) =>
      relatarErro(erro, 'salvar a agência')
    );
    setWorkspaces(prev => {
      const updatedList = prev.map(w => {
        if (w.id === workspaceId) {
          const updated = { ...w, ...updates };
          return updated;
        }
        return w;
      });
      return updatedList;
    });

    setCurrentWorkspaceState(prev => {
      if (prev.id === workspaceId) {
        const updated = { ...prev, ...updates };
        return updated;
      }
      return prev;
    });
  };

  const updateCurrentWorkspace = (updates: Partial<Workspace>) => {
    updateWorkspace(currentWorkspace.id, updates);
  };

  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [acessoDaAgencia, setAcessoDaAgencia] = useState<AcessoDaAgencia | null>(null);

  /**
   * Cria a agência no banco, pela RPC.
   *
   * Antes o objeto nascia só no estado local, com um id inventado. A agência
   * não existia no Postgres, então qualquer gravação nela era recusada pela
   * RLS — a interface mostrava a agência nova e nada dentro dela salvava.
   */
  const createWorkspace = async (
    name: string,
    primaryColor: string = '#6366f1'
  ): Promise<Workspace | null> => {
    try {
      const res = await authCriarAgencia(name, currentUser.name);
      if (!res.sucesso || !res.workspace) {
        setSyncError(res.mensagem || 'Não foi possível criar a agência.');
        return null;
      }

      const criada = res.workspace;
      if (primaryColor && primaryColor !== criada.primaryColor) {
        await atualizarWorkspace(criada.id, { primaryColor });
        criada.primaryColor = primaryColor;
      }

      setWorkspaces((prev) => [...prev, criada]);
      setCurrentWorkspace(criada);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setIsCreateWorkspaceModalOpen(false);
      return criada;
    } catch (erro) {
      relatarErro(erro, 'criar a agência');
      return null;
    }
  };

  /**
   * Sair da agência.
   *
   * Remove o próprio vínculo, não a agência: apagar a agência levaria junto,
   * por cascade, os dados de todos os outros membros. Uma agência sem nenhum
   * membro fica inalcançável pela RLS de qualquer forma.
   */
  const moverAgenciaParaLixeira = async (workspaceId: string) => {
    try {
      const quando = await moverParaLixeira(workspaceId);
      // A linha continua no banco por 7 dias, então ela continua na lista —
      // só marcada. Tirá-la daqui esconderia a única tela de onde dá para
      // restaurar.
      setWorkspaces((antes) =>
        antes.map((w) => (w.id === workspaceId ? { ...w, deletedAt: quando } : w))
      );

      // Ninguém fica dentro de uma agência que acabou de ir para a lixeira.
      if (currentWorkspace?.id === workspaceId) {
        const outra = workspaces.find((w) => w.id !== workspaceId && !w.deletedAt);
        if (outra) setCurrentWorkspace(outra);
      }
    } catch (erro) {
      relatarErro(erro, 'mover a agência para a lixeira');
    }
  };

  const restaurarAgenciaDaLixeira = async (workspaceId: string) => {
    try {
      const restaurou = await restaurarDaLixeira(workspaceId);
      if (!restaurou) {
        // `false` é resposta, não erro: a agência já não estava na lixeira
        // (o expurgo passou, ou outra pessoa restaurou antes). Recarregar é
        // mais honesto que deixar a tela afirmar que restaurou.
        setWorkspaces(await listarWorkspaces());
        return;
      }
      setWorkspaces((antes) =>
        antes.map((w) => (w.id === workspaceId ? { ...w, deletedAt: null, deletedBy: null } : w))
      );
    } catch (erro) {
      relatarErro(erro, 'restaurar a agência');
    }
  };

  // Equipe real da agência, vinda de workspace_members.
  // O e-mail não vem junto: ele vive em auth.users, que a RLS não expõe entre
  // membros. Para atribuir tarefa e montar squad, id + nome + papel bastam.
  const [users, setUsers] = useState<User[]>([]);

  // ============================================================
  // Autenticação (Supabase Auth)
  // ============================================================
  // A sessão é do Supabase e o JWT dela é o que a RLS enxerga como
  // auth.uid(). Ou seja: a mesma sessão que autentica é a que autoriza —
  // não existe um segundo sistema de permissão no cliente para contornar.

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [avisoDaEntrada, setAvisoDaEntrada] = useState<string | null>(null);

  const USUARIO_VAZIO: User = {
    id: '', name: '', email: '', avatar: '', role: 'owner', workspaceId: '',
  };
  const [currentUser, setCurrentUser] = useState<User>(USUARIO_VAZIO);

  /**
   * Dono do SaaS. Vem da tabela platform_admins, não do papel na agência.
   *
   * Esconder o menu aqui é conveniência; quem impede o acesso ao dado é a
   * RLS, que consulta a mesma tabela. Se esta flag fosse forjada no
   * navegador, as telas abririam vazias em vez de vazar.
   */
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Aparência do produto. Não depende de sessão de propósito: a tela de
  // entrada e a porta do portal são anônimas, e são justamente as duas que
  // mais dependem dela.
  const [aparencia, setAparencia] = useState<AparenciaDoSaas>(APARENCIA_PADRAO);

  const recarregarAparencia = useCallback(async () => {
    // Esquece antes de pedir: quem chama isto acabou de salvar no Admin, e
    // devolver o que está lembrado mostraria a marca antiga a quem trocou.
    esquecerAparencia();
    setAparencia(await carregarAparencia());
  }, []);

  useEffect(() => {
    void recarregarAparencia();
  }, [recarregarAparencia]);

  const aplicarSessao = (sessao: SessaoDoApp | null) => {
    if (!sessao) {
      setIsAuthenticated(false);
      setCurrentUser(USUARIO_VAZIO);
      setIsPlatformAdmin(false);
      return;
    }
    setCurrentUser({
      id: sessao.userId,
      name: sessao.nome,
      email: sessao.email,
      avatar: sessao.avatar,
      role: sessao.role,
      workspaceId: sessao.workspaceId,
    });
    setIsPlatformAdmin(sessao.ehAdminDaPlataforma);
    setIsAuthenticated(true);
    // Identifica pelo id e pelo papel. E-mail e nome ficam de fora.
    identificar(sessao.userId, sessao.role);
  };

  /** Recarrega a sessão a partir do Supabase e reflete no estado. */
  const recarregarSessao = async (): Promise<SessaoDoApp | null> => {
    // A preferência mora no Postgres. Sem sessão a consulta volta no padrão,
    // que é o mesmo caminho de quem entra pela primeira vez.
    const {
      lastWorkspaceId,
      theme: temaSalvo,
      sidebarRecolhida: recolhidaSalva,
    } = await carregarPreferencias();
    setThemeState(temaSalvo);
    setSidebarRecolhidaState(recolhidaSalva);
    let sessao = await carregarSessao(lastWorkspaceId);

    /*
      Sessão aberta e nenhuma agência: é aqui que a volta do Google termina.

      `carregarSessao` devolve `null` nos dois casos que parecem um só — quem
      não entrou, e quem entrou e ainda não pertence a agência nenhuma. O
      segundo é o primeiro acesso por um provedor externo: não houve chamada a
      `login()` para criar a agência, porque o login terminou noutra página.
      Sem este trecho, a pessoa autoriza no Google, volta, e encontra a tela de
      login outra vez — autenticada, sem nada explicando e sem saída.

      A conferência vem **depois** de `carregarSessao` falhar, e não antes: no
      caminho normal, que é a imensa maioria das cargas, ela não custa uma
      consulta a mais.
    */
    if (!sessao && (await temSessaoAberta())) {
      const criada = await garantirAgencia();
      // Quem tem convite pendente cai aqui, e a mensagem diz o que fazer:
      // abrir o link do convite. Engoli-la deixaria a mesma tela muda.
      setAvisoDaEntrada(criada.sucesso ? null : criada.mensagem || null);
      if (criada.sucesso) sessao = await carregarSessao(lastWorkspaceId);
    } else if (sessao) {
      setAvisoDaEntrada(null);
    }

    aplicarSessao(sessao);
    return sessao;
  };

  // Restaura ao abrir e acompanha login/logout feitos em outra aba.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        await recarregarSessao();
      } catch {
        /* offline ou projeto indisponível: segue deslogado */
      } finally {
        if (!cancelado) setIsAuthLoading(false);
      }
    })();

    const desinscrever = aoMudarAutenticacao(async (temSessao) => {
      if (cancelado) return;
      if (!temSessao) {
        aplicarSessao(null);
        return;
      }
      await recarregarSessao();
    });

    return () => {
      cancelado = true;
      desinscrever();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    const res = await authEntrar(email, password);
    if (!res.sucesso) return { success: false, message: res.mensagem };

    // Quem confirmou o e-mail depois do cadastro chega aqui sem agência.
    const criada = await garantirAgencia();
    if (!criada.sucesso) return { success: false, message: criada.mensagem };

    await recarregarSessao();
    return { success: true, message: 'Autenticado com sucesso.' };
  };

  const register = async (input: {
    name: string;
    email: string;
    password: string;
    agencyName?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const res = await authCadastrar({
      nome: input.name,
      email: input.email,
      senha: input.password,
      nomeDaAgencia: input.agencyName,
    });
    if (!res.sucesso) return { success: false, message: res.mensagem };

    if (res.precisaConfirmarEmail) {
      return { success: true, message: res.mensagem };
    }

    await recarregarSessao();
    return { success: true, message: 'Conta criada com sucesso.' };
  };

  const recuperarSenha = async (email: string) => {
    const res = await enviarRecuperacaoDeSenha(email);
    return { success: res.sucesso, message: res.mensagem };
  };

  const redefinirSenha = async (novaSenha: string) => {
    const res = await definirNovaSenha(novaSenha);
    return { success: res.sucesso, message: res.mensagem };
  };

  const recarregarSessaoPublica = async () => {
    await recarregarSessao();
  };

  const logout = async () => {
    await authSair();
    aplicarSessao(null);
    encerrarIdentificacao();
    // Não há cache local para limpar: nada de dado de agência toca o
    // navegador. O estado em memória morre com a página, e o próximo login
    // busca tudo de novo — não existe resto do usuário anterior.
    setWorkspaces([]);
    setCurrentWorkspaceState(AGENCIA_VAZIA);
    setAllClients([]); setAllJobs([]); setAllLeads([]); setAllProposals([]);
    setAllContracts([]); setAllAutomations([]); setAllNotifications([]);
    setAllActivityLogs([]); setAllClientMaterials([]); setAllTimesheetLogs([]);
    hidratado.current = false;
  };

  // ============================================================
  // Aba ativa: espelhada na URL
  //
  // Era só estado em memória, e a barra de endereço nunca mudava: um F5
  // devolvia a pessoa para o Dashboard de onde quer que ela estivesse, e não
  // havia como mandar link de tela para ninguém. Agora a URL é a fonte —
  // abrir, recarregar e o voltar do navegador passam pelo mesmo caminho.
  const [activeTab, setActiveTabState] = useState<string>(() => {
    try {
      return abaDoCaminho(window.location.pathname) ?? ABA_INICIAL;
    } catch {
      return ABA_INICIAL;
    }
  });

  const setActiveTab = useCallback((aba: string) => {
    setActiveTabState(aba);
    try {
      // A query fica: `?portal=` e `?invite=` são lidos noutros pontos, e
      // perdê-los ao navegar fecharia o portal do cliente sozinho.
      const destino = urlDaAba(aba as TabType, undefined, window.location.search);
      if (destino !== window.location.pathname + window.location.search) {
        window.history.pushState({ aba }, '', destino);
      }
    } catch {
      /* sem History API a navegação continua funcionando, só sem URL */
    }
  }, []);

  // Voltar e avançar do navegador.
  useEffect(() => {
    const aoVoltar = () => {
      setActiveTabState(abaDoCaminho(window.location.pathname) ?? ABA_INICIAL);
    };
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  /**
   * `/` e caminhos desconhecidos passam a mostrar a URL da tela que abriu.
   *
   * `replaceState` e não `pushState`: entrar pela raiz não deveria criar um
   * passo no histórico, ou o voltar ficaria preso num redirecionamento.
   */
  useEffect(() => {
    try {
      const atual = window.location.pathname;
      // A prévia do portal tem URL própria, fora do mapa de abas de
      // propósito (ver CAMINHO_PORTAL_PREVIEW em lib/rotas) — sem esta
      // exceção, esse efeito a reconhece como "caminho desconhecido" e a
      // substitui pela URL da aba de fundo antes de a pessoa ver o endereço.
      if (
        atual !== CAMINHO_PORTAL_PREVIEW &&
        (abaDoCaminho(atual) === null || atual === '/' || atual === '')
      ) {
        window.history.replaceState(
          {},
          '',
          urlDaAba(activeTab as TabType, undefined, window.location.search)
        );
      }
    } catch {
      /* idem */
    }
    // Só na abertura: depois disso quem escreve a URL é setActiveTab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');

  // Ver a explicação no tipo: o pedido cruza duas árvores e é consumido uma
  // vez, senão voltar para a tela de Clientes reabriria o formulário sozinho.
  const [pedidoDeNovoCliente, setPedidoDeNovoCliente] = useState(false);

  const abrirNovoCliente = useCallback(() => {
    setPedidoDeNovoCliente(true);
    setActiveTab('clientes');
  }, [setActiveTab]);

  const consumirPedidoDeNovoCliente = useCallback(() => {
    setPedidoDeNovoCliente(false);
  }, []);

  const [clientFilter, setClientFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState<boolean>(false);
  const [createJobPreselectedDate, setCreateJobPreselectedDate] = useState<string | null>(null);
  // Qual entrega o menu Adicionar escolheu: conteúdo, copy ou roteiro.
  const [createJobTipo, setCreateJobTipo] = useState<JobTipo>('conteudo');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  
  // O tema é preferência do usuário, então mora no Postgres junto das
  // outras. Começa no claro e é corrigido assim que a sessão responde —
  // trocar de máquina não reseta mais a escolha.
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    void salvarPreferencias({ theme: newTheme });
  };

  /**
   * Barra lateral em modo trilho.
   *
   * Mora no contexto, e não no `App`, porque a preferência é do usuário e vem
   * do banco junto com o tema — `localStorage` prenderia a escolha a um
   * navegador (armadilha 4), e a mesma pessoa abriria no celular com a barra
   * aberta de novo.
   */
  const [sidebarRecolhida, setSidebarRecolhidaState] = useState(false);

  const setSidebarRecolhida = (recolhida: boolean) => {
    setSidebarRecolhidaState(recolhida);
    void salvarPreferencias({ sidebarRecolhida: recolhida });
  };

  // Sync theme with document class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  // ============================================================
  // Portal do cliente
  // ============================================================
  // O link externo carrega o portalToken do cliente, não o id.
  //
  // Antes a URL era ?portal=true&clientId=c-1: bastava trocar o id para abrir
  // o portal de qualquer outro cliente da base, incluindo briefings e
  // materiais. O token é opaco e não enumerável.

  const [portalToken, setPortalToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const valor = params.get('portal');
      // 'true' era o formato antigo e não identifica ninguém.
      if (valor && valor !== 'true') return valor;
      // Guardado na aba: sem isto, um F5 no portal devolvia o cliente para a
      // tela do código.
      return tokenGuardado();
    } catch {
      return null;
    }
  });

  /** Entrada concluída: o código já foi conferido pela rota serverless. */
  const entrarNoPortal = (token: string) => {
    guardarToken(token);
    setPortalToken(token);
    setIsClientPortalOpen(true);
  };

  const sairDoPortal = () => {
    esquecerToken();
    setPortalToken(null);
    setDadosDoPortal(null);
  };

  // Prévia interna aberta direto por URL (aba nova) — só resolve de verdade
  // com `isAuthenticated` (ver `portalClientId` abaixo); sem sessão de
  // equipe, o id na query não abre nada.
  const previaDaUrl = (): string | null => {
    try {
      if (window.location.pathname !== CAMINHO_PORTAL_PREVIEW) return null;
      return new URLSearchParams(window.location.search).get('cliente');
    } catch {
      return null;
    }
  };

  const [portalPreviewClientId, setPortalPreviewClientId] = useState<string | null>(
    () => previaDaUrl()
  );
  const [isClientPortalOpen, setIsClientPortalOpen] = useState<boolean>(() => {
    try {
      // `/portal-do-cliente` é a porta do cliente: abrir a URL já é pedir o
      // portal, com ou sem token. Sem esta linha o endereço caía na tela de
      // login da agência, que é de quem trabalha nela — não de quem aprova.
      if (window.location.pathname === CAMINHO_PORTAL_PREVIEW) return true;

      const valor = new URLSearchParams(window.location.search).get('portal');
      return Boolean(valor && valor !== 'true');
    } catch {
      return false;
    }
  });

  // O portal aberto por token traz os próprios dados, pela RPC. Sem isto o
  // cliente via a tela vazia: `carregarDoBanco` só roda com sessão de
  // agência, e o cliente não tem conta no sistema.
  const [dadosDoPortal, setDadosDoPortal] = useState<DadosDoPortal | null>(null);
  const [carregandoPortal, setCarregandoPortal] = useState(false);
  const [erroDoPortal, setErroDoPortal] = useState<string | null>(null);

  /**
   * "Estamos no portal, sem sessão de agência".
   *
   * Vale para toda gravação daqui para baixo, não só para aprovar: com
   * `isAuthenticated` falso o `useColecaoSincronizada` sai cedo e **nada**
   * é persistido — a mutação morre no estado da aba, e a tela mostra o que
   * o banco nunca recebeu. Onde isto é verdade, quem grava é RPC.
   */
  const noPortal = Boolean(portalToken) && !isAuthenticated;

  /**
   * Papel de quem entrou no portal. `null` para a equipe da agência, que
   * chega pela prévia interna e não tem papel de cliente nenhum.
   *
   * Vem do banco junto com os dados, e é o mesmo papel que decidiu o que
   * veio: a tela usa isto para não oferecer um botão que a RPC recusaria.
   */
  const portalUsuario = dadosDoPortal?.usuario ?? null;
  const portalEhEditor = portalUsuario?.papel === 'editor';

  // Workspace ativo: recorta todas as views derivadas abaixo.
  const currentWsId = currentWorkspace?.id || '';

  /**
   * Consulta se esta agência pode usar o produto.
   *
   * Vem do banco, e não de `workspaces.trial_ends_at` lido aqui, porque a
   * resposta depende de `subscriptions` — que a agência **lê** mas não
   * escreve. Decidir isso no navegador seria decidir com metade do dado, e
   * com a metade que o próprio interessado controla.
   */
  const recarregarAcesso = async () => {
    if (!currentWsId || !isAuthenticated) return;
    try {
      setAcessoDaAgencia(await carregarAcessoDaAgencia(currentWsId));
    } catch {
      // Falha de rede não bloqueia ninguém: `null` é "ainda não sei", e a
      // tela trata isso como liberado. Um erro de consulta derrubando a
      // agência inteira seria pior que o problema que isto resolve.
      setAcessoDaAgencia(null);
    }
  };

  useEffect(() => {
    void recarregarAcesso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWsId, isAuthenticated]);

  // ============================================================
  // Estado das entidades
  // ============================================================
  // O estado guarda o dataset completo das agências às quais o usuário
  // pertence, e as views por workspace são derivadas com useMemo.
  //
  // O cache local serve só para a tela não nascer vazia enquanto o banco
  // responde. A fonte de verdade é o Postgres.

  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allProposals, setAllProposals] = useState<Proposal[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allAutomations, setAllAutomations] = useState<Automation[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [allActivityLogs, setAllActivityLogs] = useState<ActivityLog[]>([]);
  const [allClientMaterials, setAllClientMaterials] = useState<ClientMaterial[]>([]);
  const [allTimesheetLogs, setAllTimesheetLogs] = useState<TimesheetLog[]>([]);

  const belongsToWorkspace = (row: { workspaceId?: string }) =>
    pertenceAoWorkspace(row, currentWsId);

  const clients = useMemo(() => allClients.filter(belongsToWorkspace), [allClients, currentWsId]);
  const jobs = useMemo(() => allJobs.filter(belongsToWorkspace), [allJobs, currentWsId]);
  const leads = useMemo(() => allLeads.filter(belongsToWorkspace), [allLeads, currentWsId]);
  const proposals = useMemo(() => allProposals.filter(belongsToWorkspace), [allProposals, currentWsId]);
  const contracts = useMemo(() => allContracts.filter(belongsToWorkspace), [allContracts, currentWsId]);
  const automations = useMemo(() => allAutomations.filter(belongsToWorkspace), [allAutomations, currentWsId]);
  const notifications = useMemo(() => allNotifications.filter(belongsToWorkspace), [allNotifications, currentWsId]);
  const activityLogs = useMemo(() => allActivityLogs.filter(belongsToWorkspace), [allActivityLogs, currentWsId]);
  const clientMaterials = useMemo(() => allClientMaterials.filter(belongsToWorkspace), [allClientMaterials, currentWsId]);
  const timesheetLogs = useMemo(() => allTimesheetLogs.filter(belongsToWorkspace), [allTimesheetLogs, currentWsId]);

  /**
   * Carga do portal por token.
   *
   * Escreve no mesmo estado que a agência usa, de propósito: assim a tela do
   * portal continua lendo `clients`, `jobs` e `clientMaterials` do contexto,
   * sem um segundo caminho de dados para manter em dia.
   *
   * Não há risco de a sincronização devolver isto para o banco: ela só grava
   * com `isAuthenticated`, e aqui não há sessão de agência nenhuma.
   *
   * A agência também é definida aqui porque as views acima recortam por
   * `currentWsId` — sem isso o cliente carregaria e a tela filtraria tudo.
   */
  /**
   * Marca da agência na porta do portal.
   *
   * O portal é whitelabel, e sem isto ele abria com a marca do Orquesia para
   * todo mundo: o cliente da "Pulmin" recebe um link, chega numa página de
   * outra empresa e conclui que errou o endereço.
   *
   * Roda antes de qualquer código ser digitado, e por isso não pode depender
   * de sessão — a marca vem de uma função que devolve só nome, logo e cores.
   *
   * Não roda com sessão de equipe: ali a agência da vez já é a certa, e
   * sobrescrevê-la trocaria a marca do app inteiro pelo que estiver na URL.
   */
  useEffect(() => {
    const slug = agenciaDoCaminho(window.location.search);
    if (!slug || isAuthenticated) return;

    let cancelado = false;
    void (async () => {
      const marca = await carregarMarcaDaAgencia(slug);
      if (cancelado || !marca) return;
      setCurrentWorkspaceState((atual) => ({ ...atual, ...marca }));
    })();

    return () => {
      cancelado = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!portalToken || isAuthenticated) return;

    let cancelado = false;
    setCarregandoPortal(true);
    setErroDoPortal(null);

    (async () => {
      try {
        const dados = await carregarPortal(portalToken);
        if (cancelado) return;

        if (!dados) {
          // Token revogado ou expirado: volta para a tela de código em vez de
          // deixar a pessoa num portal vazio sem explicação.
          setErroDoPortal('Seu acesso expirou. Entre novamente com seu e-mail.');
          sairDoPortal();
          return;
        }

        setDadosDoPortal(dados);
        setCurrentWorkspaceState(dados.workspace);
        setAllClients([dados.cliente]);
        setAllJobs(dados.jobs);
        setAllClientMaterials(dados.materiais);

        /**
         * A agência fica sabendo que o cliente entrou.
         *
         * Aqui, e não na `ClientPortalView`: este efeito roda uma vez por
         * abertura do portal com token válido, que é exatamente a definição
         * de "visita". Na tela, qualquer remontagem viraria um aviso novo.
         *
         * `void` porque nada nesta tela depende da resposta — o cliente veio
         * aprovar conteúdo, não avisar ninguém, e uma falha aqui não pode
         * atrasar a pintura do portal.
         */
        void registrarAcessoNoPortal(portalToken);
      } catch (erro) {
        if (!cancelado) {
          setErroDoPortal(
            erro instanceof Error ? erro.message : 'Não foi possível carregar o portal.'
          );
        }
      } finally {
        if (!cancelado) setCarregandoPortal(false);
      }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken, isAuthenticated]);

  /**
   * O portal relê os dados de tempos em tempos.
   *
   * **Ele carregava uma vez e ficava parado**, e isso tem um custo que só
   * aparece com uso: o cliente vê o estado de quando abriu a aba. A peça que
   * a agência mandou depois não aparece; a resposta no chat não chega; e o
   * caso que trouxe esta correção — o vídeo fica pronto alguns segundos
   * depois de a peça surgir, e o cliente aprova olhando uma capa parada,
   * achando que não há vídeo nenhum.
   *
   * Não é um caso de borda: a cópia do arquivo acontece no navegador **da
   * agência**, e nada dela alcança a aba do cliente. Ou o portal pergunta de
   * novo, ou ele mostra sempre o primeiro instante.
   *
   * Um minuto, com o padrão do `AvisoDeAtualizacao` e do sino: intervalo
   * **e** volta do foco, porque o navegador estrangula timer de aba em
   * segundo plano — que é onde a aba do cliente passa a maior parte do tempo.
   *
   * Falha em silêncio de propósito. O portal já está pintado com dados
   * válidos; trocar isso por uma mensagem de erro por causa de uma releitura
   * seria assustar quem está no meio de aprovar.
   */
  useEffect(() => {
    if (!portalToken || isAuthenticated) return;

    let parado = false;

    const reler = async () => {
      if (parado || document.visibilityState === 'hidden') return;

      const dados = await carregarPortal(portalToken).catch(() => null);
      if (parado || !dados) return;

      setDadosDoPortal(dados);
      setAllJobs(dados.jobs);
      setAllClientMaterials(dados.materiais);
      /*
        `registrarAcessoNoPortal` **não** é chamado aqui: ele é o aviso de
        visita, e uma visita que se repete a cada minuto encheria o painel da
        agência — é a mesma razão pela qual ele mora no efeito de abertura.
      */
    };

    const relogio = setInterval(() => void reler(), 60_000);
    const aoVoltar = () => void reler();
    window.addEventListener('focus', aoVoltar);
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      parado = true;
      clearInterval(relogio);
      window.removeEventListener('focus', aoVoltar);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken, isAuthenticated]);

  // ============================================================
  // Sincronização com o banco
  // ============================================================

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * A frase de cima da faixa, quando a falha não é uma gravação recusada.
   *
   * `null` é o padrão — "uma alteração não chegou ao banco". Nem toda falha
   * que acende a faixa é isso, e afirmar que foi manda a pessoa procurar um
   * estrago que não existe, enquanto o problema de verdade passa batido.
   */
  const [syncTitulo, setSyncTitulo] = useState<string | null>(null);

  const hidratado = useRef(false);

  /**
   * **Quais linhas vieram do banco, por coleção — e não "estou carregando".**
   *
   * O que havia aqui era uma bandeira booleana global: ela dizia
   * "pule este commit inteiro", e é baixada por um efeito sem lista de
   * dependências, ou seja, **no próximo render que acontecer**. Isso falha de
   * dois jeitos, os dois silenciosos:
   *
   * 1. **Ela fica presa em `true`.** `garantirJobsDoPeriodo` levantava a
   *    bandeira e só então chamava `setAllJobs`, cujo updater devolve
   *    `atuais` quando não há linha nova. Devolver a mesma referência faz o
   *    React **desistir do render** — e sem render o efeito que baixa a
   *    bandeira não roda. A bandeira segue erguida até alguém mexer em
   *    alguma coisa, e a primeira edição depois disso é **descartada**: o
   *    efeito pula a gravação *e ainda avança `anterior.current`*, então ela
   *    nunca é tentada de novo. Era isto que fazia a data editada voltar ao
   *    valor antigo no F5, e a ideia recém-criada não existir no banco.
   * 2. **Ela derruba a edição junto com a carga.** Se a busca de um período
   *    cair no mesmo commit de uma edição do usuário, as duas somem.
   *
   * O conjunto abaixo é preciso onde a bandeira era grossa: ele guarda **os
   * ids que acabaram de vir do banco**, e o efeito remove só esses das
   * inserções. Linha que o usuário editou aparece em `atualizados`, nunca em
   * `inseridos`, então ela passa — venha no commit que vier.
   */
  const idsVindosDoBanco = useRef<Record<string, Set<string>>>({});

  const marcarComoVindoDoBanco = (nome: string, ids: string[]) => {
    if (!ids.length) return;
    const atual = idsVindosDoBanco.current[nome] ?? new Set<string>();
    for (const id of ids) atual.add(id);
    idsVindosDoBanco.current[nome] = atual;
  };

  /**
   * Períodos já buscados, para não repetir a consulta.
   *
   * É o único "cache" do carregamento, e ele guarda **o que já foi pedido**,
   * não o dado — o dado já está no estado. Vive num ref porque não pinta
   * nada na tela: mudá-lo não pode causar render.
   */
  const periodosCarregados = useRef<Set<string>>(new Set());

  /**
   * Traz os jobs de um período que a carga inicial não cobriu.
   *
   * **Marcar as linhas é obrigatório aqui.** Sem a marca, o
   * `useColecaoSincronizada` vê linhas novas no estado e as trata como
   * inserção — tentaria gravar de volta no banco tudo que acabou de ler, e a
   * chave primária recusaria uma a uma, em silêncio, dentro da fila. É a mesma
   * razão de a carga inicial marcar as dela.
   *
   * A marca vai **dentro do updater**, e não antes dele: fora, ela valeria
   * mesmo quando não há linha nova — e aí o `setAllJobs` devolve a mesma
   * referência, o React desiste do render, e a marca ficaria pendurada
   * esperando um commit que não vem.
   */
  const garantirJobsDoPeriodo = async (inicio: Date, fim: Date) => {
    const chave = `${inicio.toISOString().slice(0, 7)}..${fim.toISOString().slice(0, 7)}`;
    if (periodosCarregados.current.has(chave)) return;

    // Dentro da janela que a carga inicial já trouxe: nada a fazer.
    const limiteDaJanela = Date.now() - DIAS_DE_HISTORICO * 24 * 60 * 60 * 1000;
    if (inicio.getTime() >= limiteDaJanela) {
      periodosCarregados.current.add(chave);
      return;
    }

    periodosCarregados.current.add(chave);

    try {
      const encontrados = await buscarJobsDoPeriodo(inicio.toISOString(), fim.toISOString());
      if (encontrados.length === 0) return;

      setAllJobs((atuais) => {
        const conhecidos = new Set(atuais.map((j) => j.id));
        const novos = encontrados.filter((j) => !conhecidos.has(j.id));
        if (!novos.length) return atuais;
        marcarComoVindoDoBanco('jobs', novos.map((j) => j.id));
        return [...atuais, ...novos];
      });
    } catch (erro) {
      // Some da lista de carregados para a próxima navegação tentar de novo:
      // uma falha de rede não pode marcar o período como visto para sempre.
      periodosCarregados.current.delete(chave);
      console.warn('[jobs] não foi possível buscar o período', erro);
    }
  };

  /**
   * O sino sonda o banco, porque metade do que ele mostra não nasce aqui.
   *
   * O popover anunciava **"Tempo Real"** e não havia assinatura nem
   * sondagem: as notificações vinham na carga inicial e só. Tudo o que o
   * cliente faz do outro lado — aprovar, pedir ajuste, comentar, mandar
   * material, abrir o portal — é gravado por RPC `security definer`, no
   * servidor, e portanto **nunca chegava a uma aba já aberta**. Quem
   * deixasse o Orquesia aberto a manhã inteira não via nada até o F5, com a
   * tela afirmando o contrário. É a armadilha 9 no próprio painel de avisos.
   *
   * Sondagem, e não Realtime do Supabase, por uma razão só: o Realtime
   * depende de a tabela estar na publicação do projeto, que é um botão fora
   * deste repositório. Uma dependência que ninguém vê quebrar é como o
   * agendador do GitHub Actions morreu por 52 horas sem sintoma. Uma
   * consulta de 20 linhas por minuto é barata e falha à vista.
   *
   * O padrão é o do `AvisoDeAtualizacao`: intervalo **e** volta do foco. Só
   * o intervalo não basta — o navegador estrangula timer de aba em segundo
   * plano, e a volta do foco é justamente quando a pessoa vai olhar o sino.
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelado = false;

    const sondar = async () => {
      if (cancelado || document.visibilityState !== 'visible') return;
      try {
        const recentes = await buscarNotificacoesRecentes();
        if (cancelado || recentes.length === 0) return;

        setAllNotifications((atuais) => {
          const conhecidas = new Set(atuais.map((n) => n.id));
          const novas = recentes.filter((n) => !conhecidas.has(n.id));
          if (!novas.length) return atuais;
          // Mesma marca da carga por período: sem ela o diff vê linha nova e
          // tenta **gravar de volta** o que acabou de ler, e a chave
          // primária recusa uma a uma, em silêncio, dentro da fila.
          //
          // Só as que faltam entram. Reaproveitar as que já estão no estado
          // desfaria o "lida" de quem acabou de clicar no sino.
          marcarComoVindoDoBanco('notifications', novas.map((n) => n.id));
          return [...novas, ...atuais];
        });
      } catch (erro) {
        console.warn('[notificacoes] sondagem falhou', erro);
      }
    };

    const relogio = setInterval(sondar, INTERVALO_DAS_NOTIFICACOES);
    document.addEventListener('visibilitychange', sondar);

    return () => {
      cancelado = true;
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', sondar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /**
   * Fila única de gravação, compartilhada por todas as coleções.
   *
   * Serializa as escritas para respeitar as chaves estrangeiras entre
   * tabelas. É mais lento que disparar tudo em paralelo, e é o preço de não
   * gravar um filho antes do pai.
   */
  const filaDeGravacao = useRef<Promise<void>>(Promise.resolve());

  /**
   * Os erros de gravação em aberto, **por origem**.
   *
   * O porquê inteiro está em `src/lib/errosDeGravacao.ts`, junto da lógica —
   * em resumo: as dez coleções dividem uma fila e dividiam um `syncState`, e
   * o `'saved'` de `activityLogs` apagava o `'error'` de `jobs` milissegundos
   * depois. O registro de "Criou o conteúdo" apagava o aviso de que o
   * conteúdo não foi criado.
   */
  const painelDeErros = useRef(criarPainelDeErros());

  const aplicarRepintura = (r: Repintura) => {
    if (!r) return;
    setSyncState(r.estado);
    setSyncError(r.mensagem);
    setSyncTitulo(r.titulo ?? null);
  };

  const relatarErro = (erro: unknown, acao: string, origem: string = acao) => {
    const mensagem =
      erro instanceof DbError || erro instanceof ApiError
        ? erro.message
        : `Não foi possível ${acao}.`;
    aplicarRepintura(painelDeErros.current.falhou(origem, mensagem));
  };

  const gravacaoDeuCerto = (origem: string) =>
    aplicarRepintura(painelDeErros.current.deuCerto(origem));

  /**
   * Persiste uma coleção comparando o estado anterior com o novo.
   *
   * O contexto tem dezenas de mutações, todas no formato setAllX(prev => ...).
   * Em vez de reescrever cada uma para chamar o banco — e correr o risco de
   * esquecer alguma, que passaria a salvar só no navegador —, derivamos as
   * operações do diff. Cada linha vira um insert, update ou delete próprio,
   * nunca a substituição da coleção inteira, que perderia edições
   * concorrentes de outro membro da equipe.
   */
  const useColecaoSincronizada = <T extends { id: string; workspaceId?: string }>(
    nome: keyof typeof db,
    linhas: T[]
  ) => {
    const anterior = useRef<T[]>(linhas);

    useEffect(() => {
      const antes = anterior.current;
      anterior.current = linhas;

      if (!hidratado.current || !isAuthenticated) return;

      const d = diferenciar(antes, linhas);

      /*
        **Estas linhas acabaram de vir do banco: gravá-las de volta seria
        reinserir o que já existe.**

        O recorte é por id, e não "pule o commit inteiro". A versão anterior
        era um booleano global baixado pelo próximo render — quando o render
        não vinha (o `setAll` devolvendo a mesma referência faz o React
        desistir dele), a bandeira ficava erguida e a **primeira edição de
        verdade depois disso era descartada**, com `anterior.current` já
        avançado: nunca mais tentada. Era isso que fazia a data editada voltar
        ao valor antigo no F5 e a ideia nova não chegar ao banco.

        Só `inseridos` é filtrado, e é o suficiente: linha que veio do banco é
        nova para o diff, enquanto edição do usuário sobre uma linha que já
        existia cai em `atualizados`. Uma carga e uma edição no mesmo commit
        deixam de se atrapalhar.
      */
      const doBanco = idsVindosDoBanco.current[nome as string];
      if (doBanco?.size) {
        d.inseridos = d.inseridos.filter((linha) => !doBanco.has(linha.id));
        doBanco.clear();
      }

      if (!temMudanca(d)) return;

      // Entra na fila em vez de sair gravando.
      //
      // Uma ação pode tocar duas coleções ligadas por chave estrangeira:
      // converter lead em cliente cria o cliente e o contrato dele no mesmo
      // render. Como cada coleção tem seu próprio efeito, os dois inserts
      // saíam em paralelo e o contrato podia chegar ao Postgres antes do
      // cliente existir — 23503, sem repetição, com a tela mostrando um
      // contrato que sumia no reload.
      //
      // A fila é global e os efeitos entram nela na ordem em que os hooks
      // são declarados, que é a ordem de dependência: clients antes de jobs,
      // contracts e materials; leads antes de proposals.
      filaDeGravacao.current = filaDeGravacao.current.then(async () => {
        try {
          setSyncState('saving');
          const repositorio = db[nome] as any;
          // Dentro da mesma tabela a ordem não importa; entre tabelas, sim.
          await Promise.all([
            ...d.inseridos.map((linha) => repositorio.criar(linha)),
            ...d.atualizados.map((linha) => repositorio.atualizar(linha.id, linha)),
            ...d.removidos.map((id) => repositorio.remover(id)),
          ]);
          // A origem é a coleção, e não um rótulo genérico: é o que impede o
          // sucesso de `activityLogs` de apagar a falha de `jobs`.
          gravacaoDeuCerto(nome as string);
        } catch (erro) {
          // A fila nunca rejeita: uma falha numa coleção não pode impedir a
          // gravação das seguintes.
          relatarErro(erro, 'salvar as alterações', nome as string);
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linhas]);
  };

  useColecaoSincronizada('clients', allClients);
  useColecaoSincronizada('jobs', allJobs);
  useColecaoSincronizada('leads', allLeads);
  useColecaoSincronizada('proposals', allProposals);
  useColecaoSincronizada('contracts', allContracts);
  useColecaoSincronizada('automations', allAutomations);
  useColecaoSincronizada('notifications', allNotifications);
  useColecaoSincronizada('activityLogs', allActivityLogs);
  useColecaoSincronizada('clientMaterials', allClientMaterials);
  useColecaoSincronizada('timesheetLogs', allTimesheetLogs);

  /*
    **O efeito que baixava a bandeira saiu junto com ela.**

    Ele rodava em todo render, sem lista de dependências, e a correção
    dependia disso: bastava o render não acontecer para a bandeira ficar
    presa. O recorte por id não depende de momento nenhum — a marca é
    consumida pelo próprio diff da coleção marcada.
  */

  /** Carrega tudo do banco assim que existe sessão. */
  const carregarDoBanco = async () => {
    setSyncState('loading');
    hidratado.current = false;

    const dados = await carregarTudo();

    setWorkspaces(dados.workspaces);
    setUsers(
      dados.membros.map((m) => ({
        id: m.userId,
        name: m.name || 'Membro',
        email: m.userId === currentUser.id ? currentUser.email : '',
        avatar: m.avatar || '',
        role: m.role as Role,
        workspaceId: m.workspaceId,
      }))
    );
    /*
      A carga inteira entra marcada: cada linha é nova para o diff, e sem a
      marca o efeito tentaria gravar de volta tudo que acabou de ler — a
      chave primária recusaria uma a uma, em silêncio, dentro da fila.
    */
    const carga = {
      clients: dados.clients,
      jobs: dados.jobs,
      leads: dados.leads,
      proposals: dados.proposals,
      contracts: dados.contracts,
      automations: dados.automations,
      notifications: dados.notifications,
      activityLogs: dados.activityLogs,
      clientMaterials: dados.clientMaterials,
      timesheetLogs: dados.timesheetLogs,
    };
    for (const [nome, linhas] of Object.entries(carga)) {
      marcarComoVindoDoBanco(nome, (linhas as { id: string }[]).map((l) => l.id));
    }

    setAllClients(dados.clients);
    setAllJobs(dados.jobs);
    setAllLeads(dados.leads);
    setAllProposals(dados.proposals);
    setAllContracts(dados.contracts);
    setAllAutomations(dados.automations);
    setAllNotifications(dados.notifications);
    setAllActivityLogs(dados.activityLogs);
    setAllClientMaterials(dados.clientMaterials);
    setAllTimesheetLogs(dados.timesheetLogs);

    const alvo =
      dados.workspaces.find((w) => w.id === currentUser.workspaceId) || dados.workspaces[0];
    if (alvo) {
      setCurrentWorkspaceState(alvo);
      void salvarPreferencias({ lastWorkspaceId: alvo.id });
    }

    // Só liga a sincronização depois de aplicar os dados, senão o próprio
    // carregamento seria interpretado como edição e reescreveria tudo.
    hidratado.current = true;
    setSyncState('saved');
    setSyncError(null);
    setSyncTitulo(null);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      hidratado.current = false;
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        await carregarDoBanco();
      } catch (erro) {
        if (!cancelado) relatarErro(erro, 'carregar os dados');
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser.id]);

  // Modal handlers
  const openCreateJobModal = (date?: string, tipo: JobTipo = 'conteudo') => {
    setCreateJobPreselectedDate(date || null);
    setCreateJobTipo(tipo);
    setIsCreateJobModalOpen(true);
  };

  const closeCreateJobModal = () => {
    setIsCreateJobModalOpen(false);
    setCreateJobPreselectedDate(null);
    setCreateJobTipo('conteudo');
  };
  
  const openClientPortal = (clientId: string) => {
    setPortalPreviewClientId(clientId);
    setIsClientPortalOpen(true);
  };

  /**
   * Abre a prévia em aba nova, com URL própria — não mais dependente da aba
   * de fundo (`/calendario`, `/kanban`...) que estava aberta ao clicar.
   * A aba nova já chega autenticada: a sessão do Supabase Auth vive no
   * localStorage, compartilhado entre abas do mesmo navegador.
   */
  const visualizarPortalDoCliente = (clientId: string) => {
    // O slug vai junto para a prévia abrir com a marca da agência — é o que
    // o cliente vai ver, e uma prévia com a marca errada não serve de prévia.
    // Slug quando existir: `?cliente=airton-maia` diz de quem é o link antes
    // de alguém abrir. O id é a reserva para cliente recém-criado, que ainda
    // não voltou do banco com o slug gerado pelo trigger.
    const alvo = allClients.find((c) => c.id === clientId);
    window.open(
      urlDaPreviaDoPortal(alvo?.slug || clientId, currentWorkspace.slug),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const closeClientPortal = () => {
    setIsClientPortalOpen(false);
    setPortalPreviewClientId(null);
    // Limpa também o que ficou guardado na aba: só apagar o estado deixava a
    // sessão do cliente voltar no próximo F5.
    sairDoPortal();
  };

  /**
   * Resolve quem o portal está exibindo. O token tem prioridade porque é o
   * caminho do acesso externo; a prévia interna só vale para a equipe logada.
   */
  const portalClientId = useMemo(() => {
    if (portalToken) {
      // `portal_dados` remove `portal_token` do JSON do cliente de propósito —
      // é credencial, e quem já está dentro não precisa vê-la de volta.
      // Então `c.portalToken` é sempre `undefined` no client carregado pela
      // RPC, e o `find` antigo nunca achava ninguém. O id correto já está em
      // `dadosDoPortal`, que foi validado pelo banco quando o token entrou.
      if (dadosDoPortal?.cliente) return dadosDoPortal.cliente.id;
      // Ainda carregando — o efeito que chama `carregarPortal` ainda não
      // respondeu. Devolver `null` mantém a tela de loading visível.
      return null;
    }
    if (!isAuthenticated || !portalPreviewClientId) return null;

    // Aceita slug ou id. O slug é o que vai na URL hoje; o id continua
    // valendo para os links que já foram compartilhados ou favoritados antes
    // de o slug existir.
    const alvo = allClients.find(
      (c) => c.slug === portalPreviewClientId || c.id === portalPreviewClientId
    );
    return alvo ? alvo.id : null;
  }, [portalToken, portalPreviewClientId, allClients, isAuthenticated, dadosDoPortal]);

  // Activity logger helper
  const logActivity = (action: string, target: string, userName: string = currentUser?.name || 'Usuário') => {
    const newLog: ActivityLog = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      userName,
      action,
      target,
      timestamp: new Date().toISOString()
    };
    setAllActivityLogs(prev => [newLog, ...prev]);
  };
  
  // Job Operations
  const createJob = (jobData: Partial<Job>): Job => {
    const newJob: Job = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      clientId: jobData.clientId || clients[0]?.id || '',
      title: jobData.title || 'Novo Conteúdo Sem Título',
      tipo: jobData.tipo || 'conteudo',
      campaign: jobData.campaign || 'Geral',
      platform: jobData.platform || 'instagram',
      // Job antigo e job criado por outra tela têm uma rede só: a lista vira
      // ela, e não fica vazia — a prévia e o card leem daqui.
      canais: jobData.canais?.length
        ? jobData.canais
        : [jobData.platform || 'instagram'],
      format: jobData.format || 'feed',
      status: jobData.status || 'ideas',
      priority: jobData.priority || 'medium',
      caption: jobData.caption || '',
      cta: jobData.cta || '',
      hashtags: jobData.hashtags || [],
      firstComment: jobData.firstComment || '',
      link: jobData.link || '',
      // Sem imagem de banco como padrão: ela acabava virando a arte real do
      // post de quem não reparasse.
      mediaUrls: jobData.mediaUrls || [],
      currentVersion: 1,
      versions: [
        {
          versionNumber: 1,
          mediaUrls: jobData.mediaUrls || [],
          caption: jobData.caption || '',
          submittedBy: currentUser.name,
          submittedAt: new Date().toISOString(),
          status: 'pending'
        }
      ],
      createdAt: new Date().toISOString(),
      deadlineProduction: jobData.deadlineProduction || new Date(Date.now() + 86400000 * 2).toISOString(),
      deadlineApproval: jobData.deadlineApproval || new Date(Date.now() + 86400000 * 4).toISOString(),
      scheduledDate: jobData.scheduledDate || new Date(Date.now() + 86400000 * 5).toISOString(),
      checklist: jobData.checklist || [
        { id: novoId(), title: 'Redação da copy e chamada', completed: false },
        { id: novoId(), title: 'Design / Edição do criativo', completed: false },
        { id: novoId(), title: 'Revisão ortográfica e aprovação', completed: false }
      ],
      comments: []
    };
    
    setAllJobs(prev => [newJob, ...prev]);
    logActivity('Criou o conteúdo', `Job: ${newJob.title}`);
    
    // Conteúdo que já nasce aguardando aprovação (a tela de criação oferece
    // esse status inicial) avisa o cliente na hora, como se tivesse sido
    // movido para lá.
    if (newJob.status === 'for_approval') {
      void dispararAutomacoes('conteudo_aguardando_aprovacao', {
        jobId: newJob.id, jobTitle: newJob.title,
      });
    }

    // A arte do Drive vem para o R2 agora, com a peça recém-criada — ver
    // `garantirMidiaDoDrive`, que espera a linha chegar ao banco.
    garantirMidiaDoDrive(newJob.id);

    return newJob;
  };
  
  /**
   * A arte do Drive vem para o R2 **assim que a peça existe**.
   *
   * **Ela serve à publicação, e não mais ao portal** — e esta frase corrige
   * o que estava escrito aqui. O texto antigo dizia que sem a cópia o cliente
   * via "a miniatura e mais nada", o que era verdade quando ele foi escrito e
   * deixou de ser quando o portal passou a montar o **player do Google** para
   * vídeo do Drive (`idDeVideoNoDrive`): ele toca com a liberação por link,
   * que `prepararMidiaDoDrive` faz antes de qualquer cópia, escolhe a
   * resolução pela conexão e não depende do balde.
   *
   * Quem depende da cópia é a rede social: a Meta **baixa** a mídia de um
   * endereço público na hora de publicar, e o Google não serve arquivo para
   * quem não tem sessão. Sem a cópia, o que não acontece é a publicação
   * automática — e era isso que a faixa de erro precisava dizer, em vez de
   * anunciar que o cliente não conseguia assistir.
   *
   * **A cópia acontece na criação, e não na aprovação.** Amarrá-la a um
   * status fazia a peça chegar à data de publicação sem arquivo nenhum
   * pronto, e o problema aparecia no pior momento — na hora de agendar, com
   * a data em cima. Aqui ele aparece enquanto ainda dá para trocar o vídeo.
   *
   * Ela é apagada depois de a peça ir ao ar, e o que fica é a imagem de capa:
   * o balde segue guardando só o que está em uso.
   *
   * **Mora aqui, e não nas telas**, porque são quatro caminhos que mexem na
   * mídia de uma peça — o cadastro, o detalhe, e os dois uploaders dentro
   * deles. Repetir a chamada em cada um garante esquecer um, e esquecer aqui
   * não quebra nada visível: o vídeo simplesmente não toca.
   *
   * Não bloqueia e não avisa quando falha. A peça segue com a miniatura, que
   * é exatamente o que ela tinha antes desta função existir.
   */
  const TITULO_DA_MIDIA =
    'O vídeo não foi copiado para a publicação automática. O conteúdo está salvo.';

  const garantirMidiaDoDrive = (jobId: string) => {
    void (async () => {
      try {
        const preparo = await prepararMidiaDoDrive(jobId);

        /*
          **A falha acende a faixa.** Ela era engolida, e "sem cópia" ficava
          indistinguível de "não havia vídeo": a peça ia para o cliente com a
          capa parada e ninguém da agência sabia. Três rodadas de diagnóstico
          saíram desse silêncio — é a mesma lição da faixa de erro de
          gravação, que existe porque o produto perdia dado sem avisar.
        */
        if (preparo.falhas.length) {
          aplicarRepintura(
            painelDeErros.current.falhou(
              'midia-do-drive',
              'O vídeo do Google Drive não foi copiado: ' +
                preparo.falhas.map((f) => `"${f.nome}" (${f.motivo})`).join('; ') +
                '. O conteúdo está salvo e o cliente assiste normalmente no portal, ' +
                'pelo player do Google. O que não sai é a publicação automática, ' +
                'porque a rede social precisa baixar o arquivo de um endereço nosso.',
              TITULO_DA_MIDIA
            )
          );
          return;
        }

        gravacaoDeuCerto('midia-do-drive');
      } catch (erro) {
        aplicarRepintura(
          painelDeErros.current.falhou(
            'midia-do-drive',
            erro instanceof Error
              ? `O vídeo do Google Drive não foi copiado: ${erro.message}`
              : 'O vídeo do Google Drive não foi copiado.',
            TITULO_DA_MIDIA
          )
        );
      }
    })();
  };

  const updateJob = (jobId: string, updates: Partial<Job>) => {
    // Mídia trocada é o gatilho, não o status: acrescentar um vídeo do Drive
    // a uma peça que já existe precisa da cópia do mesmo jeito.
    if (updates.mediaUrls || updates.storyMediaUrls) garantirMidiaDoDrive(jobId);
    setAllJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        const updated = { ...job, ...updates };
        if (selectedJob?.id === jobId) {
          setSelectedJob(updated);
        }
        return updated;
      }
      return job;
    }));
  };
  
  /**
   * Peça antiga com arte no Drive se resolve ao ser aberta.
   *
   * A cópia passou a nascer com a peça, mas o que já existia ficou sem ela —
   * e sem ela não há o que tocar: o portal mostra a capa parada e o cliente
   * aprova um Reels sem ver o Reels. Pedir que alguém tire e recoloque a arte
   * seria transferir para quem usa um problema que é nosso.
   *
   * **É um efeito que grava, e isso pesou na decisão.** A regra deste projeto
   * é que enfileirar publicação nunca sai de um efeito — porque publicar não
   * volta. Copiar um arquivo volta: é idempotente (`prepararMidiaDoDrive`
   * sai cedo quando a cópia já cobre a mídia atual), não tem efeito para
   * fora, e acontece só quando alguém abre a peça, que é justamente quando
   * ela precisa estar tocável.
   */
  useEffect(() => {
    if (!selectedJob) return;
    if (quantasNoDrive(selectedJob.mediaUrls, selectedJob.storyMediaUrls) === 0) return;

    garantirMidiaDoDrive(selectedJob.id);
    // Só o id: o objeto é recriado a cada render do contexto, e com ele na
    // lista o efeito rodaria em toda mudança de estado da agência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.id]);


  const deleteJob = (jobId: string) => {
    const jobToDelete = jobs.find(j => j.id === jobId);
    if (jobToDelete) {
      logActivity('Excluiu o conteúdo', `Job: ${jobToDelete.title}`);

      /*
        A arte sai junto — mas só a que **era desta peça**. Deixá-la no balde
        é a sobra que ninguém vê crescer: a Biblioteca passa a listar arquivo
        de conteúdo que não existe mais, e a agência paga por um acervo que
        acha que apagou.

        `apagarMidiaDaPeca` confere o uso no banco antes de cada exclusão. A
        mesma arte pode servir a dois conteúdos — é por isso que a Biblioteca
        conta usos —, e apagar sem conferir tiraria a imagem de um post que
        continua no ar.

        Em segundo plano e sem bloquear: a exclusão do conteúdo já aconteceu,
        e um erro de limpeza não pode virar uma mensagem de falha sobre algo
        que deu certo.
      */
      void apagarMidiaDaPeca(jobToDelete);
    }
    setAllJobs(prev => prev.filter(j => j.id !== jobId));
    if (selectedJob?.id === jobId) {
      setSelectedJob(null);
    }
  };
  
  const moveJobStatus = (jobId: string, newStatus: JobStatus) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    let updates: Partial<Job> = { status: newStatus };
    if (newStatus === 'published' && !job.publishedDate) {
      updates.publishedDate = new Date().toISOString();
    }
    
    updateJob(jobId, updates);
    logActivity(`Moveu status para ${newStatus.replace('_', ' ').toUpperCase()}`, `Job: ${job.title}`);
    
    // Check automations:
    if (newStatus === 'for_approval') {
      // O e-mail para o cliente saía só quando uma versão nova era enviada
      // (`addNewJobVersion`). Arrastar o card para "Para Aprovação" no Kanban
      // — que é como a maior parte do conteúdo chega lá — criava a
      // notificação interna e não avisava ninguém fora da agência.
      void dispararAutomacoes('conteudo_aguardando_aprovacao', {
        jobId, jobTitle: job.title,
      });

      const client = clients.find(c => c.id === job.clientId);
      const newNotif: Notification = {
        id: novoId(),
        workspaceId: currentWorkspace.id,
        title: `Conteúdo enviado para aprovação: ${job.title}`,
        message: `O conteúdo está aguardando revisão de ${client?.name || 'Cliente'}.`,
        type: 'approval',
        read: false,
        createdAt: new Date().toISOString(),
        // O quadro, e não mais a tela de Aprovações: a coluna "Para Aprovação"
        // é onde a peça aparece, e aquele menu saiu.
        linkContext: { tab: 'producao', jobId: job.id, clientId: job.clientId }
      };
      setAllNotifications(prev => [newNotif, ...prev]);
    }
  };
  
  /** Aprovação vinda do portal: o cliente não tem sessão, então quem grava é a RPC. */
  const aprovarPeloPortalDoCliente = async (jobId: string, quem: string) => {
    if (!portalToken) return;
    try {
      await aprovarPeloPortal(portalToken, jobId, quem);
    } catch (erro) {
      setErroDoPortal(
        erro instanceof Error ? erro.message : 'Não foi possível registrar a aprovação.'
      );
      // Recarrega para a tela voltar ao que o banco realmente tem: o estado
      // otimista já mostrou "aprovado" e mentiria sobre a gravação.
      const dados = await carregarPortal(portalToken).catch(() => null);
      if (dados) setAllJobs(dados.jobs);
    }
  };

  const approveJob = (jobId: string, approverName: string = 'Cliente') => {
    registrar('conteudo_aprovado');
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // No portal a escrita direta seria recusada pela RLS — não há `auth.uid()`
    // ali. A RPC faz o mesmo que o resto desta função faz no banco: status,
    // versão marcada, log e notificação para a agência.
    if (noPortal) void aprovarPeloPortalDoCliente(jobId, approverName);

    // Celebrate with confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }
    
    const updatedVersions = job.versions.map(v => 
      v.versionNumber === job.currentVersion ? { ...v, status: 'approved' as const, feedback: 'Aprovado pelo cliente.' } : v
    );
    
    // Move to approved or scheduled
    const newStatus: JobStatus = 'approved';
    
    updateJob(jobId, {
      status: newStatus,
      versions: updatedVersions
    });
    
    logActivity('Aprovou o conteúdo', `Job: ${job.title}`, approverName);
    
    const newNotif: Notification = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      title: `Conteúdo Aprovado! 🎉`,
      message: `${approverName} aprovou "${job.title}". Pronto para agendamento.`,
      type: 'approval',
      read: false,
      createdAt: new Date().toISOString(),
      linkContext: { tab: 'publicacoes', jobId: job.id, clientId: job.clientId }
    };
    setAllNotifications(prev => [newNotif, ...prev]);

    // Efeito colateral de uma ação que já deu certo: nunca lança, e não
    // segura a interface. Se falhar, o conteúdo continua aprovado.
    void dispararAutomacoes('conteudo_aprovado', { jobId, jobTitle: job.title });
  };
  
  const requestAdjustment = (jobId: string, feedback: string, requesterName: string = 'Cliente') => {
    registrar('ajuste_solicitado');
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // Mesmo caso da aprovação: sem sessão, quem grava é a RPC do portal.
    if (noPortal && portalToken) {
      void (async () => {
        try {
          await pedirAjustePeloPortal(portalToken, jobId, feedback, requesterName);
        } catch (erro) {
          setErroDoPortal(
            erro instanceof Error ? erro.message : 'Não foi possível enviar o pedido de ajuste.'
          );
          const dados = await carregarPortal(portalToken).catch(() => null);
          if (dados) setAllJobs(dados.jobs);
        }
      })();
    }

    const updatedVersions = job.versions.map(v => 
      v.versionNumber === job.currentVersion ? { ...v, status: 'rejected' as const, feedback } : v
    );
    
    updateJob(jobId, {
      status: 'in_adjustment',
      lastFeedback: feedback,
      versions: updatedVersions
    });
    
    logActivity('Solicitou ajuste', `Job: ${job.title} — "${feedback}"`, requesterName);
    
    // Check if rework is high (version >= 2)
    if (job.currentVersion >= 2) {
      const client = clients.find(c => c.id === job.clientId);
      if (client && client.healthScore === 'green') {
        updateClient(client.id, { healthScore: 'yellow' });
      }
    }
    
    const newNotif: Notification = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      title: `Pedido de Ajuste Solicitado`,
      message: `${requesterName} solicitou ajuste em "${job.title}": ${feedback.slice(0, 60)}...`,
      type: 'adjustment',
      read: false,
      createdAt: new Date().toISOString(),
      // `'conteudos'` não é aba nenhuma — `TabType` tem `producao`, que é o
      // WorkFlow. Ninguém viu porque `linkContext` nunca era lido; agora que o
      // sino navega, um destino inválido deixaria a tela em branco.
      linkContext: { tab: 'producao', jobId: job.id, clientId: job.clientId }
    };
    setAllNotifications(prev => [newNotif, ...prev]);

    void dispararAutomacoes('pedido_de_ajuste', {
      jobId, jobTitle: job.title, feedback,
    });
  };
  
  const addNewJobVersion = (jobId: string, mediaUrls: string[], caption: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const newVerNum = job.currentVersion + 1;
    const newVersion = {
      versionNumber: newVerNum,
      mediaUrls,
      caption,
      submittedBy: currentUser.name,
      submittedAt: new Date().toISOString(),
      status: 'pending' as const
    };
    
    updateJob(jobId, {
      currentVersion: newVerNum,
      mediaUrls,
      caption,
      status: 'for_approval',
      versions: [...job.versions, newVersion]
    });
    
    logActivity(`Enviou nova versão v${newVerNum}`, `Job: ${job.title}`);

    // A nova versão coloca o conteúdo de volta em aprovação: é o momento em
    // que o cliente precisa ser avisado.
    void dispararAutomacoes('conteudo_aguardando_aprovacao', {
      jobId, jobTitle: job.title,
    });
  };
  
  const addJobComment = (jobId: string, text: string, isClient: boolean = false) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    /**
     * **No portal não há sessão, logo não há persistência por diff.**
     *
     * `useColecaoSincronizada` sai cedo quando `isAuthenticated` é falso: sem
     * este desvio a mensagem do cliente apareceria na tela, o banco nunca
     * seria chamado e o F5 apagaria tudo — foi assim que o envio de material
     * ficou decorativo por meses (armadilha 10).
     *
     * O comentário que vale é o que a RPC devolve, e não o que montamos aqui:
     * é ela que decide `isClient` e o nome de quem escreveu. Por isso a tela
     * recarrega o portal depois — o otimista abaixo é só para a linha aparecer
     * na hora.
     */
    if (noPortal && portalToken) {
      void (async () => {
        try {
          await comentarNoPortal(portalToken, jobId, text);
        } catch (erro) {
          setErroDoPortal(
            erro instanceof Error ? erro.message : 'Não foi possível enviar a mensagem.'
          );
        }
        const dados = await carregarPortal(portalToken).catch(() => null);
        if (dados) setAllJobs(dados.jobs);
      })();
    }

    const newComment = {
      id: novoId(),
      authorName: isClient ? 'Cliente' : currentUser.name,
      authorRole: isClient ? 'client' as const : currentUser.role,
      // Vazio para o cliente: era um retrato do Unsplash, sempre o mesmo,
      // então todo comentário de todo cliente de toda agência vinha com a
      // cara da mesma pessoa. `Avatar` desenha as iniciais.
      authorAvatar: isClient ? '' : currentUser.avatar,
      isClient,
      text,
      createdAt: new Date().toISOString()
    };
    
    updateJob(jobId, {
      comments: [...job.comments, newComment]
    });
    
    logActivity(isClient ? 'Cliente comentou' : 'Comentou no job', `Job: ${job.title}`);
  };
  
  const toggleChecklistItem = (jobId: string, itemId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const updatedChecklist = job.checklist.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    
    updateJob(jobId, { checklist: updatedChecklist });
  };
  
  const duplicateJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    createJob({
      ...job,
      title: `${job.title} (Cópia)`,
      status: 'ideas',
      currentVersion: 1,
      versions: []
    });
  };
  
  // Client Operations
  const addClient = (clientData: Partial<Client>): Client => {
    const newClient: Client = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      name: clientData.name || 'Novo Cliente',
      legalName: clientData.legalName || clientData.name,
      // Vazio, e não inventado. Havia `contato@cliente.com.br` e
      // `(11) 99999-9999` de padrão: um endereço e um telefone que parecem
      // do cliente, ficam gravados como se fossem, e a agência acaba
      // escrevendo para eles. Campo em branco pelo menos se vê.
      email: clientData.email || '',
      phone: clientData.phone || '',
      avatar: clientData.avatar || '',
      status: 'active',
      segment: clientData.segment || 'Varejo / Serviços',
      website: clientData.website || '',
      internalResponsibleId: currentUser.id,
      healthScore: 'green',
      services: clientData.services || [
        { id: novoId(), name: 'Gestão Social Media', monthlyValue: 4000, startDate: new Date().toISOString().split('T')[0], recurrence: 'monthly' }
      ],
      contacts: clientData.contacts || [
        { id: novoId(), name: clientData.name || 'Contato Principal', email: clientData.email || '', phone: clientData.phone || '', role: 'Gestor', isPrimary: true }
      ],
      notes: clientData.notes || '',
      createdAt: new Date().toISOString(),
      // `portalToken` fica de fora, pelo mesmo motivo do `slug`: quem gera é
      // o default da coluna (`gen_random_bytes(24)`), e `clientParaLinha` não
      // o manda de volta. O valor inventado aqui nunca chegava ao banco — só
      // ficava no estado da tela até o F5, onde virava outro.
    };
    
    setAllClients(prev => [newClient, ...prev]);
    registrar('cliente_criado');
    logActivity('Cadastrou novo cliente', `Cliente: ${newClient.name}`);
    return newClient;
  };
  
  const updateClient = (clientId: string, updates: Partial<Client>) => {
    setAllClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const updated = { ...c, ...updates };
        return updated;
      }
      return c;
    }));
  };

  const deleteClient = (clientId: string) => {
    setAllClients(prev => prev.filter(c => c.id !== clientId));
  };

  /**
   * Grava, pelo portal, o que na agência seria gravado pelo diff.
   *
   * `useColecaoSincronizada` está desligado sem sessão, então sem isto
   * arquivo anexado e senha cadastrada pelo cliente sumiriam no F5 — a tela
   * mostrando o que o banco nunca recebeu. A RPC confere o papel: só editor
   * passa, e só nos três campos que ele pode tocar.
   */
  const gravarClienteNoPortal = async (
    campos: Partial<Pick<Client, 'files' | 'passwords' | 'briefing'>>
  ) => {
    if (!portalToken) return;
    try {
      await salvarDadosPeloPortal(portalToken, campos);
    } catch (erro) {
      setErroDoPortal(
        erro instanceof Error ? erro.message : 'Não foi possível salvar a alteração.'
      );
      // Volta ao que o banco tem: o estado otimista já mostrou o resultado.
      const dados = await carregarPortal(portalToken).catch(() => null);
      if (dados) setAllClients([dados.cliente]);
    }
  };

  const addClientPassword = (clientId: string, passwordData: Omit<ClientPassword, 'id' | 'updatedAt'>) => {
    const newPassword: ClientPassword = {
      ...passwordData,
      id: novoId(),
      updatedAt: new Date().toISOString()
    };
    const proximas = [...(allClients.find(c => c.id === clientId)?.passwords || []), newPassword];
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, passwords: [...(c.passwords || []), newPassword] };
    }));
    if (noPortal) {
      void gravarClienteNoPortal({ passwords: proximas });
      return;
    }
    logActivity('Cadastrou credencial no cofre', `Cliente #${clientId}: ${passwordData.service}`);
  };

  const deleteClientPassword = (clientId: string, passwordId: string) => {
    const proximas = (allClients.find(c => c.id === clientId)?.passwords || [])
      .filter(p => p.id !== passwordId);
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, passwords: (c.passwords || []).filter(p => p.id !== passwordId) };
    }));
    if (noPortal) void gravarClienteNoPortal({ passwords: proximas });
  };

  const addClientInvoice = (clientId: string, invoiceData: Omit<ClientInvoice, 'id'>) => {
    const newInvoice: ClientInvoice = {
      ...invoiceData,
      id: novoId()
    };
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, invoices: [newInvoice, ...(c.invoices || [])] };
    }));
    logActivity('Lançou nota fiscal', `Cliente #${clientId}: ${invoiceData.number}`);
  };

  const deleteClientInvoice = (clientId: string, invoiceId: string) => {
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, invoices: (c.invoices || []).filter(inv => inv.id !== invoiceId) };
    }));
  };

  const addClientFile = (clientId: string, fileData: Omit<ClientFile, 'id' | 'uploadedAt'>) => {
    const newFile: ClientFile = {
      ...fileData,
      id: novoId(),
      uploadedAt: new Date().toISOString().split('T')[0]
    };
    const proximos = [newFile, ...(allClients.find(c => c.id === clientId)?.files || [])];
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: [newFile, ...(c.files || [])] };
    }));
    if (noPortal) {
      void gravarClienteNoPortal({ files: proximos });
      return;
    }
    logActivity('Adicionou arquivo', `Cliente #${clientId}: ${fileData.name}`);
  };

  /**
   * Corrigir o que já está cadastrado, sem apagar e recadastrar.
   *
   * A ficha do cliente só tinha "abrir/baixar" e "excluir": arrumar um nome
   * digitado errado ou trocar a categoria passava por excluir e cadastrar de
   * novo — e num **link externo** isso perde a URL, que é a única coisa que a
   * linha carrega. O caminho de correção não pode ser o de perda.
   *
   * O `if (noPortal)` é obrigatório aqui pela mesma razão do `addClientFile`:
   * o editor do cliente mexe nos arquivos dele de dentro do portal, onde não
   * há sessão e a persistência por diff sai cedo (armadilha 10).
   */
  const updateClientFile = (
    clientId: string,
    fileId: string,
    dados: Partial<Pick<ClientFile, 'name' | 'category' | 'url'>>
  ) => {
    const proximos = (allClients.find(c => c.id === clientId)?.files || []).map(f =>
      f.id === fileId ? { ...f, ...dados } : f
    );
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: proximos };
    }));
    if (noPortal) {
      void gravarClienteNoPortal({ files: proximos });
      return;
    }
    logActivity('Editou arquivo do cliente', `Cliente #${clientId}: ${dados.name || fileId}`);
  };

  const deleteClientFile = (clientId: string, fileId: string) => {
    const proximos = (allClients.find(c => c.id === clientId)?.files || [])
      .filter(f => f.id !== fileId);
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: (c.files || []).filter(f => f.id !== fileId) };
    }));
    if (noPortal) void gravarClienteNoPortal({ files: proximos });
  };

  /**
   * **As anotações saíram daqui, e a coluna ficou.**
   *
   * O bloco de notas virou uma linha de `clients.files`, com `kind: 'nota'` —
   * para quem usa, ele responde a mesma pergunta que o anexo e o link, e duas
   * listas empilhadas pediam a mesma decisão duas vezes. Quem grava agora é
   * `addClientFile` / `updateClientFile`, que já têm o desvio do portal.
   *
   * `clients.annotations` **não foi apagada**: a migração copiou o conteúdo
   * para `files` e deixou o original intacto, para o caso de algo na conversão
   * estar errado. Nada lê nem escreve nela — e é por isso que as três funções
   * que faziam isso saíram: função exportada que grava numa coluna que
   * ninguém lê é a armadilha do `trial_ends_at`, que parece uma regra e não é.
   */

  const updateClientBriefing = (clientId: string, briefingData: Partial<ClientBriefing>) => {
    const atual = allClients.find(c => c.id === clientId)?.briefing || {
      brandVoice: '',
      targetAudience: '',
      painPoints: '',
      competitors: '',
      brandGuidelines: '',
      monthlyGoals: '',
      updatedAt: new Date().toISOString()
    };
    const proximo: ClientBriefing = {
      ...atual,
      ...briefingData,
      updatedAt: new Date().toISOString()
    };
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, briefing: proximo };
    }));
    if (noPortal) {
      void gravarClienteNoPortal({ briefing: proximo });
      return;
    }
    logActivity('Atualizou briefing', `Cliente #${clientId}`);
  };

  const createContract = (contractData: Partial<Contract>): Contract => {
    const newContract: Contract = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      clientId: contractData.clientId || 'c-1',
      clientName: contractData.clientName || 'Cliente',
      title: contractData.title || 'Contrato de Gestão e Marketing',
      monthlyValue: contractData.monthlyValue || 4500,
      startDate: contractData.startDate || new Date().toISOString().split('T')[0],
      endDate: contractData.endDate || new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0],
      status: 'draft',
    };
    setAllContracts(prev => [newContract, ...prev]);
    logActivity('Criou contrato', `Contrato: ${newContract.title}`);
    return newContract;
  };

  const signContract = (contractId: string, signatoryName: string) => {
    setAllContracts(prev => prev.map(c => 
      c.id === contractId ? { ...c, status: 'signed' as const, signedAt: new Date().toISOString() } : c
    ));
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    logActivity('Contrato Assinado Digitalmente', `Contrato #${contractId} assinado por ${signatoryName}`);
  };

  const addProposal = (proposalData: Partial<Proposal>): Proposal => {
    const newProp: Proposal = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      leadId: proposalData.leadId,
      clientId: proposalData.clientId,
      clientName: proposalData.clientName || 'Cliente Prospect',
      title: proposalData.title || 'Proposta de Marketing Digital',
      items: proposalData.items || [
        { id: novoId(), service: 'Gestão Social Media', description: '12 posts mensais + stories', quantity: 1, monthlyValue: 3500 }
      ],
      totalMonthlyValue: proposalData.totalMonthlyValue || 3500,
      status: 'sent',
      validUntil: proposalData.validUntil || new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    setAllProposals(prev => [newProp, ...prev]);
    logActivity('Criou proposta comercial', `Proposta: ${newProp.title}`);
    return newProp;
  };

  const addLead = (leadData: Partial<Lead>): Lead => {
    const newLead: Lead = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      name: leadData.name || 'Novo Contato',
      company: leadData.company || 'Nova Empresa',
      email: leadData.email || 'contato@empresa.com',
      phone: leadData.phone || '',
      source: leadData.source || 'Indicação / Inbound',
      stage: leadData.stage || 'new_lead',
      estimatedValue: leadData.estimatedValue || 3500,
      serviceInterest: leadData.serviceInterest || 'Gestão de Conteúdo e Social Media',
      responsibleId: currentUser.id,
      notes: leadData.notes || '',
      createdAt: new Date().toISOString()
    };
    setAllLeads(prev => [newLead, ...prev]);
    logActivity('Cadastrou novo Lead comercial', `${newLead.company} (${newLead.name})`);
    return newLead;
  };

  const updateLeadStage = (leadId: string, stage: LeadStage) => {
    setAllLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const updated = { ...l, stage };
        return updated;
      }
      return l;
    }));
    logActivity('Atualizou estágio de Lead', `Lead #${leadId} para ${stage}`);
  };
  
  const convertLeadToClient = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    
    // 1. Create client
    const newClient = addClient({
      name: lead.company || lead.name,
      legalName: lead.company,
      email: lead.email,
      phone: lead.phone,
      segment: lead.serviceInterest,
      services: [
        {
          id: novoId(),
          name: lead.serviceInterest,
          monthlyValue: lead.estimatedValue,
          startDate: new Date().toISOString().split('T')[0],
          recurrence: 'monthly'
        }
      ]
    });
    
    // 2. Mark lead as 'ganho'
    setAllLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: 'ganho' as const } : l));
    
    // 3. Generate contract automatically
    const newContract: Contract = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      clientId: newClient.id,
      clientName: newClient.name,
      title: `Contrato de Prestação de Serviços: ${lead.serviceInterest}`,
      monthlyValue: lead.estimatedValue,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0],
      status: 'sent'
    };
    setAllContracts(prev => [newContract, ...prev]);
    
    logActivity('Converteu Lead em Cliente', `Lead: ${lead.name} -> Cliente: ${newClient.name}`);
    
    const notif: Notification = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      title: `Lead Convertido em Cliente! 🚀`,
      message: `${lead.company || lead.name} agora é um cliente ativo. Contrato gerado automaticamente.`,
      type: 'lead',
      read: false,
      createdAt: new Date().toISOString(),
      linkContext: { tab: 'clientes', clientId: newClient.id }
    };
    setAllNotifications(prev => [notif, ...prev]);
  };
  
  const acceptProposal = (proposalId: string) => {
    const prop = proposals.find(p => p.id === proposalId);
    if (!prop) return;
    
    setAllProposals(prev => prev.map(p => 
      p.id === proposalId ? { ...p, status: 'accepted' as const, acceptedAt: new Date().toISOString() } : p
    ));
    
    logActivity('Proposta Comercial Aceita!', `Proposta: ${prop.title}`);
    
    // If associated with a lead, convert lead
    if (prop.leadId) {
      convertLeadToClient(prop.leadId);
    }
  };
  
  const generateContractFromProposal = (proposalId: string) => {
    const prop = proposals.find(p => p.id === proposalId);
    if (!prop) return;
    
    const newContract: Contract = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      clientId: prop.clientId || 'c-1',
      clientName: prop.clientName,
      title: `Contrato: ${prop.title}`,
      monthlyValue: prop.totalMonthlyValue,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0],
      status: 'sent'
    };
    setAllContracts(prev => [newContract, ...prev]);
    logActivity('Gerou Contrato', `Contrato para ${prop.clientName}`);
  };
  
  // Notifications & Automations
  const markNotificationRead = (id: string) => {
    setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  
  const markAllNotificationsRead = () => {
    setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  
  const toggleAutomation = (id: string) => {
    setAllAutomations(prev => prev.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const createAutomation = (dados: {
    title: string;
    triggerEvent: NonNullable<Automation['triggerEvent']>;
    actionType: NonNullable<Automation['actionType']>;
    actionConfig?: Record<string, unknown>;
  }): Automation => {
    const evento = EVENTOS_DISPONIVEIS.find((e) => e.valor === dados.triggerEvent);
    const acao = ACOES_DISPONIVEIS.find((a) => a.valor === dados.actionType);

    const nova: Automation = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      title: dados.title,
      // As duas descrições legíveis são derivadas das opções tipadas, para
      // não existir regra cuja descrição diga uma coisa e o motor faça outra.
      trigger: evento?.rotulo || dados.triggerEvent,
      action: acao?.rotulo || dados.actionType,
      triggerEvent: dados.triggerEvent,
      actionType: dados.actionType,
      actionConfig: dados.actionConfig || {},
      enabled: true,
      executionCount: 0,
    };

    setAllAutomations((prev) => [nova, ...prev]);
    logActivity('Criou automação', nova.title);
    return nova;
  };

  const deleteAutomation = (id: string) => {
    setAllAutomations((prev) => prev.filter((a) => a.id !== id));
  };

  // Client Materials
  const addClientMaterial = (material: Omit<ClientMaterial, 'id' | 'createdAt'>) => {
    // Quem envia material é, quase sempre, o cliente pelo portal — onde não
    // há sessão e a persistência por diff está desligada. A galeria mostrava
    // o material, o insert nunca acontecia, e no F5 ele sumia sem erro
    // nenhum. Aqui quem grava é a RPC, e o que entra no estado é a linha que
    // o banco devolveu.
    if (noPortal && portalToken) {
      void (async () => {
        try {
          const gravado = await enviarMaterialPeloPortal(portalToken, {
            titulo: material.title,
            categoria: material.category || 'photo',
            url: material.url,
            notas: material.notes,
          });
          if (gravado) setAllClientMaterials(prev => [gravado, ...prev]);
          else setErroDoPortal('Envio recusado: seu acesso não permite enviar materiais.');
        } catch (erro) {
          setErroDoPortal(
            erro instanceof Error ? erro.message : 'Não foi possível enviar o material.'
          );
        }
      })();
      return;
    }

    const newMaterial: ClientMaterial = {
      ...material,
      id: novoId(),
      workspaceId: currentWorkspace?.id,
      createdAt: new Date().toISOString()
    };
    setAllClientMaterials(prev => [newMaterial, ...prev]);
    logActivity('Cliente enviou material', `${newMaterial.title} (${newMaterial.clientName})`);
    
    // Notification for agency team
    const notif: Notification = {
      id: novoId(),
      workspaceId: currentWorkspace.id,
      title: `Novo Material Recebido do Cliente 📸`,
      message: `${newMaterial.clientName} enviou "${newMaterial.title}" para uso na criação de conteúdo.`,
      type: 'system',
      read: false,
      createdAt: new Date().toISOString(),
      linkContext: { tab: 'clientes', clientId: newMaterial.clientId }
    };
    setAllNotifications(prev => [notif, ...prev]);
  };

  const deleteClientMaterial = (id: string) => {
    setAllClientMaterials(prev => prev.filter(m => m.id !== id));
  };

  // Timesheet
  const addTimesheetLog = (log: Omit<TimesheetLog, 'id' | 'createdAt'>) => {
    const newLog: TimesheetLog = {
      ...log,
      id: novoId(),
      createdAt: new Date().toISOString()
    };
    setAllTimesheetLogs(prev => [newLog, ...prev]);

    // Update job timesheetMinutes
    setAllJobs(prev => prev.map(j => {
      if (j.id === log.jobId) {
        const updated = {
          ...j,
          timesheetMinutes: (j.timesheetMinutes || 0) + log.minutes
        };
        return updated;
      }
      return j;
    }));

    logActivity('Apontou tempo em Job', `${log.minutes} min em "${log.jobTitle}" por ${log.userName}`);
  };

  // ============================================================
  // IA (Gemini)
  // ============================================================
  // Estas funções propagam o erro em vez de devolver texto de exemplo. Antes
  // qualquer falha — inclusive "chave não configurada" — era engolida e
  // substituída por conteúdo fictício, dando a impressão de que a IA estava
  // gerando de verdade.

  const generateAiCopy = async (params: {
    theme: string;
    format?: string;
    platform?: string;
    clientId?: string;
    additionalNotes?: string;
  }) => {
    registrar('ia_utilizada', { recurso: 'copy' });
    const client = clients.find((c) => c.id === params.clientId);
    return aiApi.generateCopy({
      theme: params.theme,
      format: params.format,
      platform: params.platform,
      brandVoice: client?.briefing?.brandVoice,
      targetAudience: client?.briefing?.targetAudience,
      painPoints: client?.briefing?.painPoints,
      monthlyGoals: client?.briefing?.monthlyGoals,
      additionalNotes: params.additionalNotes,
    });
  };

  const convertFeedbackToTasks = async (params: {
    clientFeedback: string;
    jobTitle: string;
    currentCopy?: string;
  }) => aiApi.convertFeedback(params);

  const generateEditorialIdeas = async (clientId: string) => {
    const client = clients.find((c) => c.id === clientId) || clients[0];
    return aiApi.editorialIdeas({
      clientSegment: client?.segment || 'Serviços',
      clientName: client?.name || 'Cliente',
      month: safeDateFormat(new Date(), { month: 'long' }),
    });
  };

  // ============================================================
  // Sincronização
  // ============================================================
  // O Supabase passou a ser a fonte de verdade: as consultas saem do
  // navegador direto para o Postgres e quem garante o isolamento é a RLS.
  // Não há mais store em arquivo nem servidor Express no caminho dos dados.

  const isSupabaseConnected = isSupabaseConfigured();

  /** Recarrega tudo do banco, descartando o que estiver em memória. */
  const forceSync = async (): Promise<{ success: boolean; message: string }> => {
    if (!isAuthenticated) {
      return { success: false, message: 'Faça login para sincronizar.' };
    }
    try {
      await carregarDoBanco();
      return { success: true, message: 'Dados recarregados do banco.' };
    } catch (erro) {
      relatarErro(erro, 'recarregar os dados');
      const mensagem =
        erro instanceof DbError ? erro.message : 'Falha ao recarregar do banco.';
      return { success: false, message: mensagem };
    }
  };

  // Mantido no contexto porque a tela de Integrações expõe o estado da
  // conexão; agora ele simplesmente reflete o mesmo banco que a aplicação usa.
  const syncWithSupabase = forceSync;

  // Agency Health Score Calculator (0 - 100)
  const calculateAgencyHealth = () => {
    const totalJobs = jobs.length;
    if (totalJobs === 0) {
      return { total: 100, productionOnTimeRate: 100, approvalRateFirstTry: 100, reworkIndex: 0, activeJobsCount: 0 };
    }
    
    // Rate of approved jobs with only 1 version
    const approvedJobs = jobs.filter(j => j.status === 'approved' || j.status === 'scheduled' || j.status === 'published');
    const firstTryApproved = approvedJobs.filter(j => j.currentVersion === 1).length;
    const approvalRateFirstTry = approvedJobs.length > 0 
      ? Math.round((firstTryApproved / approvedJobs.length) * 100) 
      : 85;
      
    // Overdue production check
    const nowTime = new Date().getTime();
    const overdueCount = jobs.filter(j => {
      const isDone = j.status === 'published' || j.status === 'scheduled' || j.status === 'approved';
      if (isDone) return false;
      return new Date(j.deadlineProduction).getTime() < nowTime;
    }).length;
    
    const productionOnTimeRate = Math.max(0, Math.round(((totalJobs - overdueCount) / totalJobs) * 100));
    
    // Rework index (jobs with version >= 2)
    const reworkedJobsCount = jobs.filter(j => j.currentVersion > 1).length;
    const reworkIndex = Math.round((reworkedJobsCount / totalJobs) * 100);
    
    // Score weighted
    const score = Math.min(100, Math.max(0, Math.round(
      (productionOnTimeRate * 0.4) + (approvalRateFirstTry * 0.4) + ((100 - reworkIndex) * 0.2)
    )));
    
    return {
      total: score,
      productionOnTimeRate,
      approvalRateFirstTry,
      reworkIndex,
      activeJobsCount: jobs.filter(j => j.status !== 'published').length
    };
  };
  
  const agencyHealthScore = calculateAgencyHealth();

  return (
    <PostfyContext.Provider
      value={{
        theme,
        setTheme,
        sidebarRecolhida,
        setSidebarRecolhida,
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        recarregarComSeguranca,
        updateWorkspace,
        updateCurrentWorkspace,
        createWorkspace,
        moverAgenciaParaLixeira,
        restaurarAgenciaDaLixeira,
        isCreateWorkspaceModalOpen,
        isProfileModalOpen,
        setIsProfileModalOpen,
        garantirJobsDoPeriodo,
        acessoDaAgencia,
        recarregarAcesso,
        setIsCreateWorkspaceModalOpen,
        users,
        currentUser,
        setCurrentUser,
        isAuthenticated,
        isAuthLoading,
        avisoDaEntrada,
        login,
        register,
        recarregarSessaoPublica,
        recuperarSenha,
        redefinirSenha,
        logout,
        activeTab,
        setActiveTab,
        calendarView,
        setCalendarView,
        abrirNovoCliente,
        pedidoDeNovoCliente,
        consumirPedidoDeNovoCliente,
        clientFilter,
        setClientFilter,
        platformFilter,
        setPlatformFilter,
        statusFilter,
        setStatusFilter,
        selectedJob,
        setSelectedJob,
        isCreateJobModalOpen,
        openCreateJobModal,
        closeCreateJobModal,
        createJobPreselectedDate,
        createJobTipo,
        isSearchModalOpen,
        setIsSearchModalOpen,
        isClientPortalOpen,
        portalClientId,
        openClientPortal,
        visualizarPortalDoCliente,
        entrarNoPortal,
        sairDoPortal,
        carregandoPortal,
        erroDoPortal,
        portalUsuario,
        portalEhEditor,
        closeClientPortal,
        clients,
        jobs,
        leads,
        proposals,
        contracts,
        automations,
        notifications,
        activityLogs,
        createJob,
        updateJob,
        deleteJob,
        moveJobStatus,
        approveJob,
        requestAdjustment,
        addNewJobVersion,
        addJobComment,
        toggleChecklistItem,
        duplicateJob,
        addClient,
        updateClient,
        deleteClient,
        addClientPassword,
        deleteClientPassword,
        addClientInvoice,
        deleteClientInvoice,
        addClientFile,
        updateClientFile,
        deleteClientFile,
        updateClientBriefing,
        addLead,
        updateLeadStage,
        convertLeadToClient,
        acceptProposal,
        generateContractFromProposal,
        createContract,
        signContract,
        addProposal,
        markNotificationRead,
        markAllNotificationsRead,
        toggleAutomation,
        createAutomation,
        deleteAutomation,
        agencyHealthScore,
        clientMaterials,
        addClientMaterial,
        deleteClientMaterial,
        timesheetLogs,
        addTimesheetLog,
        generateAiCopy,
        convertFeedbackToTasks,
        generateEditorialIdeas,
        aparencia,
        recarregarAparencia,
        isPlatformAdmin,
        isSupabaseConnected,
        syncWithSupabase,
        syncState,
        syncError,
        syncTitulo,
        forceSync,
      }}
    >
      {children}
    </PostfyContext.Provider>
  );
};

export const usePostfy = () => {
  const context = useContext(PostfyContext);
  if (!context) {
    throw new Error('usePostfy must be used within a PostfyProvider');
  }
  return context;
};
