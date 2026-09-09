import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Workspace, 
  User, 
  Role,
  Client, 
  Job, 
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
  ClientMaterial,
  TimesheetLog
} from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { aiApi, ApiError } from '../lib/api';
import { db, carregarTudo, listarWorkspaces, atualizarWorkspace, DbError } from '../lib/db';
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
  removerMembro as removerMembroDaAgencia,
  type SessaoDoApp,
} from '../lib/authSupabase';
import { diferenciar, temMudanca, novoId } from '../lib/sincronizacao';
import { carregarPreferencias, salvarPreferencias } from '../lib/preferencias';
import { dispararAutomacoes, EVENTOS_DISPONIVEIS, ACOES_DISPONIVEIS } from '../lib/automacoes';
import { identificar, encerrarIdentificacao, registrar } from '../lib/analytics';
import { belongsToWorkspace as pertenceAoWorkspace } from '../lib/workspaceScope';

interface PostfyContextType {
  // General
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Workspaces & Users
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  setCurrentWorkspace: (ws: Workspace) => void;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  updateCurrentWorkspace: (updates: Partial<Workspace>) => void;
  createWorkspace: (name: string, primaryColor?: string) => Promise<Workspace | null>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  isCreateWorkspaceModalOpen: boolean;
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
  recuperarSenha: (email: string) => Promise<{ success: boolean; message?: string }>;
  redefinirSenha: (novaSenha: string) => Promise<{ success: boolean; message?: string }>;
  
  // Navigation & Views
  activeTab: string;
  setActiveTab: (tab: string) => void;
  calendarView: CalendarViewMode;
  setCalendarView: (view: CalendarViewMode) => void;
  
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
  openCreateJobModal: (date?: string) => void;
  closeCreateJobModal: () => void;
  createJobPreselectedDate: string | null;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  
  // Client Portal Simulation Mode
  isClientPortalOpen: boolean;
  /** Cliente resolvido no portal: por token (link externo) ou por prévia interna. */
  portalClientId: string | null;
  /** Prévia interna do portal, para a equipe da agência. */
  openClientPortal: (clientId: string) => void;
  closeClientPortal: () => void;
  /** Link externo do portal, com o token opaco do cliente. */
  buildClientPortalUrl: (clientId: string) => string;
  
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

  // Supabase
  isPlatformAdmin: boolean;
  isSupabaseConnected: boolean;
  syncWithSupabase: () => Promise<{ success: boolean; message: string }>;

  // Sincronização com o servidor
  syncState: SyncState;
  syncError: string | null;
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

  const setCurrentWorkspace = (ws: Workspace) => {
    setCurrentWorkspaceState(ws);
    // A última agência aberta é preferência do usuário, não do navegador:
    // quem abre no celular continua de onde parou.
    void salvarPreferencias({ lastWorkspaceId: ws.id });
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
  const deleteWorkspace = async (workspaceId: string) => {
    try {
      await removerMembroDaAgencia(workspaceId, currentUser.id);
      const restantes = workspaces.filter((w) => w.id !== workspaceId);
      setWorkspaces(restantes);
      if (currentWorkspace?.id === workspaceId && restantes[0]) {
        setCurrentWorkspace(restantes[0]);
      }
    } catch (erro) {
      relatarErro(erro, 'sair da agência');
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
    const { lastWorkspaceId, theme: temaSalvo } = await carregarPreferencias();
    setThemeState(temaSalvo);
    const sessao = await carregarSessao(lastWorkspaceId);
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

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState<boolean>(false);
  const [createJobPreselectedDate, setCreateJobPreselectedDate] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  
  // O tema é preferência do usuário, então mora no Postgres junto das
  // outras. Começa no claro e é corrigido assim que a sessão responde —
  // trocar de máquina não reseta mais a escolha.
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    void salvarPreferencias({ theme: newTheme });
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
      return valor && valor !== 'true' ? valor : null;
    } catch {
      return null;
    }
  });

  const [portalPreviewClientId, setPortalPreviewClientId] = useState<string | null>(null);
  const [isClientPortalOpen, setIsClientPortalOpen] = useState<boolean>(() => {
    try {
      const valor = new URLSearchParams(window.location.search).get('portal');
      return Boolean(valor && valor !== 'true');
    } catch {
      return false;
    }
  });

  // Workspace ativo: recorta todas as views derivadas abaixo.
  const currentWsId = currentWorkspace?.id || '';

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

  // ============================================================
  // Sincronização com o banco
  // ============================================================

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const hidratado = useRef(false);

  /**
   * Marca o render que carrega dados do banco, para o diff ignorá-lo.
   *
   * `hidratado` sozinho não resolve: ele é ligado dentro de carregarTudo, mas
   * `setState` é assíncrono e os efeitos das coleções só rodam no render
   * seguinte — quando a bandeira já está ligada. Aí o estado anterior está
   * vazio, o novo tem as linhas do banco, e o carregamento inteiro vira
   * inserção.
   *
   * Era isso que duplicava as linhas a cada recarga. Mandar o id no insert
   * (v1.2) trocou a duplicação silenciosa por violação de chave única — o
   * erro ficou visível, e a causa continuou aqui.
   *
   * Esta bandeira é limpa por um efeito declarado depois de todas as
   * coleções: efeitos do mesmo commit rodam na ordem de declaração, então
   * quando ele executa todas já pularam o próprio carregamento.
   */
  const aplicandoCargaDoBanco = useRef(false);

  /**
   * Fila única de gravação, compartilhada por todas as coleções.
   *
   * Serializa as escritas para respeitar as chaves estrangeiras entre
   * tabelas. É mais lento que disparar tudo em paralelo, e é o preço de não
   * gravar um filho antes do pai.
   */
  const filaDeGravacao = useRef<Promise<void>>(Promise.resolve());

  const relatarErro = (erro: unknown, acao: string) => {
    const mensagem =
      erro instanceof DbError || erro instanceof ApiError
        ? erro.message
        : `Não foi possível ${acao}.`;
    setSyncState('error');
    setSyncError(mensagem);
  };

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

      // Estas linhas acabaram de vir do banco: gravá-las de volta seria
      // reinserir o que já existe.
      if (aplicandoCargaDoBanco.current) return;

      const d = diferenciar(antes, linhas);
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
          setSyncState('saved');
          setSyncError(null);
        } catch (erro) {
          // A fila nunca rejeita: uma falha numa coleção não pode impedir a
          // gravação das seguintes.
          relatarErro(erro, 'salvar as alterações');
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

  /**
   * Baixa a bandeira de carga.
   *
   * Precisa ficar **depois** de todas as coleções: efeitos do mesmo commit
   * rodam na ordem em que são declarados, então quando este executa todas já
   * tiveram a chance de pular o próprio carregamento. Mover para cima faz o
   * carregamento voltar a ser gravado como inserção.
   *
   * Sem lista de dependências de propósito: roda em todo render, e é o que
   * garante que a próxima edição de verdade seja sincronizada.
   */
  useEffect(() => {
    aplicandoCargaDoBanco.current = false;
  });

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
    aplicandoCargaDoBanco.current = true;

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
  const openCreateJobModal = (date?: string) => {
    setCreateJobPreselectedDate(date || null);
    setIsCreateJobModalOpen(true);
  };
  
  const closeCreateJobModal = () => {
    setIsCreateJobModalOpen(false);
    setCreateJobPreselectedDate(null);
  };
  
  const openClientPortal = (clientId: string) => {
    setPortalPreviewClientId(clientId);
    setIsClientPortalOpen(true);
  };

  const closeClientPortal = () => {
    setIsClientPortalOpen(false);
    setPortalPreviewClientId(null);
    setPortalToken(null);
  };

  /**
   * Resolve quem o portal está exibindo. O token tem prioridade porque é o
   * caminho do acesso externo; a prévia interna só vale para a equipe logada.
   */
  const portalClientId = useMemo(() => {
    if (portalToken) {
      const alvo = allClients.find((c) => c.portalToken === portalToken);
      return alvo ? alvo.id : null;
    }
    return isAuthenticated ? portalPreviewClientId : null;
  }, [portalToken, portalPreviewClientId, allClients, isAuthenticated]);

  const buildClientPortalUrl = (clientId: string): string => {
    const alvo = allClients.find((c) => c.id === clientId);
    const url = new URL(window.location.href);
    url.search = '';
    if (alvo?.portalToken) url.searchParams.set('portal', alvo.portalToken);
    return url.toString();
  };
  
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
      campaign: jobData.campaign || 'Geral',
      platform: jobData.platform || 'instagram',
      format: jobData.format || 'feed',
      status: jobData.status || 'ideas',
      priority: jobData.priority || 'medium',
      caption: jobData.caption || '',
      cta: jobData.cta || '',
      hashtags: jobData.hashtags || [],
      firstComment: jobData.firstComment || '',
      link: jobData.link || '',
      mediaUrls: jobData.mediaUrls || [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
      ],
      currentVersion: 1,
      versions: [
        {
          versionNumber: 1,
          mediaUrls: jobData.mediaUrls || [
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
          ],
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
    
    // Check automation for job created
    return newJob;
  };
  
  const updateJob = (jobId: string, updates: Partial<Job>) => {
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
  
  const deleteJob = (jobId: string) => {
    const jobToDelete = jobs.find(j => j.id === jobId);
    if (jobToDelete) {
      logActivity('Excluiu o conteúdo', `Job: ${jobToDelete.title}`);
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
      const client = clients.find(c => c.id === job.clientId);
      const newNotif: Notification = {
        id: novoId(),
        workspaceId: currentWorkspace.id,
        title: `Conteúdo enviado para aprovação: ${job.title}`,
        message: `O conteúdo está aguardando revisão de ${client?.name || 'Cliente'}.`,
        type: 'approval',
        read: false,
        createdAt: new Date().toISOString(),
        linkContext: { tab: 'aprovacoes', jobId: job.id, clientId: job.clientId }
      };
      setAllNotifications(prev => [newNotif, ...prev]);
    }
  };
  
  const approveJob = (jobId: string, approverName: string = 'Cliente') => {
    registrar('conteudo_aprovado');
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
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
      linkContext: { tab: 'conteudos', jobId: job.id, clientId: job.clientId }
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
    
    const newComment = {
      id: novoId(),
      authorName: isClient ? 'Cliente' : currentUser.name,
      authorRole: isClient ? 'client' as const : currentUser.role,
      authorAvatar: isClient 
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80' 
        : currentUser.avatar,
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
      email: clientData.email || 'contato@cliente.com.br',
      phone: clientData.phone || '(11) 99999-9999',
      avatar: clientData.avatar || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&auto=format&fit=crop&q=80',
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
      portalToken: `token-${Math.random().toString(36).substring(2, 9)}`
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

  const addClientPassword = (clientId: string, passwordData: Omit<ClientPassword, 'id' | 'updatedAt'>) => {
    const newPassword: ClientPassword = {
      ...passwordData,
      id: novoId(),
      updatedAt: new Date().toISOString()
    };
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, passwords: [...(c.passwords || []), newPassword] };
    }));
    logActivity('Cadastrou credencial no cofre', `Cliente #${clientId}: ${passwordData.service}`);
  };

  const deleteClientPassword = (clientId: string, passwordId: string) => {
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, passwords: (c.passwords || []).filter(p => p.id !== passwordId) };
    }));
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
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: [newFile, ...(c.files || [])] };
    }));
    logActivity('Adicionou arquivo', `Cliente #${clientId}: ${fileData.name}`);
  };

  const deleteClientFile = (clientId: string, fileId: string) => {
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: (c.files || []).filter(f => f.id !== fileId) };
    }));
  };

  const updateClientBriefing = (clientId: string, briefingData: Partial<ClientBriefing>) => {
    setAllClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const current = c.briefing || {
        brandVoice: '',
        targetAudience: '',
        painPoints: '',
        competitors: '',
        brandGuidelines: '',
        monthlyGoals: '',
        updatedAt: new Date().toISOString()
      };
      return {
        ...c,
        briefing: {
          ...current,
          ...briefingData,
          updatedAt: new Date().toISOString()
        }
      };
    }));
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
      month: new Date().toLocaleDateString('pt-BR', { month: 'long' }),
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
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        updateWorkspace,
        updateCurrentWorkspace,
        createWorkspace,
        deleteWorkspace,
        isCreateWorkspaceModalOpen,
        setIsCreateWorkspaceModalOpen,
        users,
        currentUser,
        setCurrentUser,
        isAuthenticated,
        isAuthLoading,
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
        isSearchModalOpen,
        setIsSearchModalOpen,
        isClientPortalOpen,
        portalClientId,
        openClientPortal,
        closeClientPortal,
        buildClientPortalUrl,
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
        isPlatformAdmin,
        isSupabaseConnected,
        syncWithSupabase,
        syncState,
        syncError,
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
