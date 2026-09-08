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
import { 
  initialWorkspaces, 
  initialUsers, 
  initialClients, 
  initialJobs, 
  initialLeads, 
  initialProposals, 
  initialContracts, 
  initialAutomations, 
  initialNotifications, 
  initialActivityLogs,
  initialClientMaterials,
  initialTimesheetLogs
} from '../data/initialData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { authApi, dataApi, aiApi, teamApi, ApiError } from '../lib/api';
import {
  readStorage,
  writeStorage,
  removeStorage,
  onStorageQuotaExceeded,
  formatBytes,
} from '../lib/storage';
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
  createWorkspace: (name: string, primaryColor?: string) => Workspace;
  deleteWorkspace: (workspaceId: string) => void;
  isCreateWorkspaceModalOpen: boolean;
  setIsCreateWorkspaceModalOpen: (open: boolean) => void;
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (input: { name: string; email: string; password: string; agencyName?: string }) => Promise<{ success: boolean; message?: string }>;
  acceptInvite: (input: { token: string; name: string; password: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  
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
  isSupabaseConnected: boolean;
  syncWithSupabase: () => Promise<{ success: boolean; message: string }>;

  // Sincronização com o servidor
  syncState: SyncState;
  syncError: string | null;
  forceSync: () => Promise<{ success: boolean; message: string }>;

  // Aviso de cota do armazenamento local
  storageWarning: string | null;
  dismissStorageWarning: () => void;
}

export type SyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const PostfyContext = createContext<PostfyContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'postfy_v1_';

export const PostfyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load or fallback to initial data
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}workspaces`);
    return saved ? JSON.parse(saved) : initialWorkspaces;
  });
  
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace>(() => {
    const savedWsId = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}currentWorkspaceId`);
    const initialList = (() => {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}workspaces`);
      return saved ? JSON.parse(saved) : initialWorkspaces;
    })();
    return initialList.find((w: Workspace) => w.id === savedWsId) || initialList[0] || initialWorkspaces[0];
  });

  const setCurrentWorkspace = (ws: Workspace) => {
    setCurrentWorkspaceState(ws);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}currentWorkspaceId`, ws.id);
  };

  const updateWorkspace = (workspaceId: string, updates: Partial<Workspace>) => {
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

  const createWorkspace = (name: string, primaryColor: string = '#6366f1'): Workspace => {
    const id = `ws-${Date.now()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    const newWs: Workspace = {
      id,
      name,
      slug,
      logo: 'https://i.pinimg.com/736x/dd/6e/b3/dd6eb385dafdfd1cce83c084d0021670.jpg',
      primaryColor: '#6366f1',
      whiteLabel: true,
      timezone: 'America/Sao_Paulo',
      isTrial: true,
      trialEndsAt: trialEnd.toISOString(),
    };

    setWorkspaces(prev => [...prev, newWs]);
    setCurrentWorkspace(newWs);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    setIsCreateWorkspaceModalOpen(false);
    return newWs;
  };

  const deleteWorkspace = (workspaceId: string) => {
    if (workspaces.length <= 1) {
      alert('Você não pode excluir o único workspace restante.');
      return;
    }
    setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
    if (currentWorkspace?.id === workspaceId) {
      const remaining = workspaces.filter(w => w.id !== workspaceId);
      if (remaining.length > 0) {
        setCurrentWorkspace(remaining[0]);
      }
    }
  };
  
  const [users] = useState<User[]>(initialUsers);
  
  // ============================================================
  // Autenticação
  // ============================================================
  // A sessão vive no servidor, num cookie httpOnly assinado, e é validada em
  // /api/auth/me. O estado abaixo é apenas o reflexo dela na interface.
  //
  // A versão anterior aceitava qualquer e-mail com qualquer senha (o parâmetro
  // password sequer era lido) e guardava "isAuthenticated" no localStorage:
  // bastava editar essa chave pelo console do navegador para entrar como dono
  // da agência.

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const USUARIO_VAZIO: User = {
    id: '',
    name: '',
    email: '',
    avatar: '',
    role: 'owner',
    workspaceId: '',
  };

  const [currentUser, setCurrentUser] = useState<User>(USUARIO_VAZIO);

  /** Garante que o workspace devolvido pelo servidor exista na lista local. */
  const adotarWorkspaceDoServidor = (remoto: { id: string; name: string; slug: string } | null) => {
    if (!remoto) return;

    const montado: Workspace = {
      id: remoto.id,
      name: remoto.name,
      slug: remoto.slug,
      logo: '',
      primaryColor: '#6366f1',
      whiteLabel: false,
      timezone: 'America/Sao_Paulo',
    };

    setWorkspaces((prev) => {
      const existente = prev.find((w) => w.id === remoto.id);
      if (existente) return prev;
      return [...prev, montado];
    });

    setCurrentWorkspaceState((prev) => {
      if (prev?.id === remoto.id) return prev;
      return montado;
    });

    writeStorage(`${LOCAL_STORAGE_KEY_PREFIX}currentWorkspaceId`, remoto.id);
  };

  const aplicarSessao = (payload: { user: any; workspace: any }) => {
    setCurrentUser({
      id: payload.user.id,
      name: payload.user.name,
      email: payload.user.email,
      avatar: payload.user.avatar || '',
      role: payload.user.role as Role,
      workspaceId: payload.user.workspaceId,
    });
    setIsAuthenticated(true);
    adotarWorkspaceDoServidor(payload.workspace);
  };

  // Restaura a sessão ao abrir a aplicação.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const sessao = await authApi.me();
        if (!cancelado && sessao) aplicarSessao(sessao);
      } catch {
        /* servidor indisponível: segue deslogado */
      } finally {
        if (!cancelado) setIsAuthLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      aplicarSessao(await authApi.login({ email, password }));
      return { success: true, message: 'Autenticado com sucesso.' };
    } catch (err) {
      return {
        success: false,
        message: err instanceof ApiError ? err.message : 'Falha ao autenticar.',
      };
    }
  };

  const register = async (input: {
    name: string;
    email: string;
    password: string;
    agencyName?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      aplicarSessao(await authApi.register(input));
      return { success: true, message: 'Conta criada com sucesso.' };
    } catch (err) {
      return {
        success: false,
        message: err instanceof ApiError ? err.message : 'Falha ao criar a conta.',
      };
    }
  };

  const acceptInvite = async (input: {
    token: string;
    name: string;
    password: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      aplicarSessao(await teamApi.acceptInvite(input));
      return { success: true, message: 'Convite aceito. Entrando...' };
    } catch (err) {
      return {
        success: false,
        message: err instanceof ApiError ? err.message : 'Não foi possível aceitar o convite.',
      };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* mesmo se a chamada falhar, limpamos o estado local */
    }
    setIsAuthenticated(false);
    setCurrentUser(USUARIO_VAZIO);

    // Limpa o cache local para que os dados de uma agência não fiquem
    // visíveis para quem logar em seguida no mesmo navegador.
    [
      'clients', 'jobs', 'leads', 'proposals', 'contracts', 'automations',
      'notifications', 'activityLogs', 'clientMaterials', 'timesheetLogs',
      'currentUser', 'isAuthenticated',
    ].forEach((nome) => removeStorage(`${LOCAL_STORAGE_KEY_PREFIX}${nome}`));
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
  
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}theme`);
    return (saved as 'light' | 'dark') || 'light';
  });

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}theme`, newTheme);
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
  const currentWsId = currentWorkspace?.id || 'ws-1';

  // ============================================================
  // Estado das entidades
  // ============================================================
  // O estado guarda o dataset COMPLETO e as views por workspace são derivadas
  // com useMemo.
  //
  // Antes o filtro era aplicado dentro do inicializador do useState e o efeito
  // de persistência gravava esse array já filtrado por cima do conjunto
  // completo: na primeira renderização os dados dos outros workspaces eram
  // apagados do localStorage. E trocar de workspace não trocava os dados na
  // tela, porque nada reexecutava o filtro.

  const [allClients, setAllClients] = useState<Client[]>(() =>
    readStorage<Client[]>(`${LOCAL_STORAGE_KEY_PREFIX}clients`, initialClients));

  const [allJobs, setAllJobs] = useState<Job[]>(() =>
    readStorage<Job[]>(`${LOCAL_STORAGE_KEY_PREFIX}jobs`, initialJobs));

  const [allLeads, setAllLeads] = useState<Lead[]>(() =>
    readStorage<Lead[]>(`${LOCAL_STORAGE_KEY_PREFIX}leads`, initialLeads));

  const [allProposals, setAllProposals] = useState<Proposal[]>(() =>
    readStorage<Proposal[]>(`${LOCAL_STORAGE_KEY_PREFIX}proposals`, initialProposals));

  const [allContracts, setAllContracts] = useState<Contract[]>(() =>
    readStorage<Contract[]>(`${LOCAL_STORAGE_KEY_PREFIX}contracts`, initialContracts));

  const [allAutomations, setAllAutomations] = useState<Automation[]>(() =>
    readStorage<Automation[]>(`${LOCAL_STORAGE_KEY_PREFIX}automations`, initialAutomations));

  const [allNotifications, setAllNotifications] = useState<Notification[]>(() =>
    readStorage<Notification[]>(`${LOCAL_STORAGE_KEY_PREFIX}notifications`, initialNotifications));

  const [allActivityLogs, setAllActivityLogs] = useState<ActivityLog[]>(() =>
    readStorage<ActivityLog[]>(`${LOCAL_STORAGE_KEY_PREFIX}activityLogs`, initialActivityLogs));

  const [allClientMaterials, setAllClientMaterials] = useState<ClientMaterial[]>(() =>
    readStorage<ClientMaterial[]>(`${LOCAL_STORAGE_KEY_PREFIX}clientMaterials`, initialClientMaterials));

  const [allTimesheetLogs, setAllTimesheetLogs] = useState<TimesheetLog[]>(() =>
    readStorage<TimesheetLog[]>(`${LOCAL_STORAGE_KEY_PREFIX}timesheetLogs`, initialTimesheetLogs));

  // Regras de recorte ficam em src/lib/workspaceScope.ts, com testes próprios.
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
  // Persistência
  // ============================================================
  // Cache local (abre offline, não pisca tela vazia) + envio ao servidor, que
  // é a fonte de verdade compartilhada pela equipe.

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const dismissStorageWarning = () => setStorageWarning(null);

  const hydratedRef = useRef(false);
  const pushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => onStorageQuotaExceeded(({ key, bytes }) => {
    setStorageWarning(
      `O armazenamento do navegador encheu ao salvar "${key.replace(LOCAL_STORAGE_KEY_PREFIX, '')}" ` +
      `(~${formatBytes(bytes)}). Anexe mídias por URL em vez de subir o arquivo, ou remova as mais pesadas.`
    );
  }), []);

  /**
   * O servidor mantém um workspace por sessão e carimba toda linha recebida
   * com ele. O seletor de workspace da interface, porém, é local: existem
   * agências na lista que não correspondem à sessão.
   *
   * Sincronizar nessa situação seria destrutivo — as linhas da agência
   * selecionada localmente (ou um array vazio) sobrescreveriam os dados reais
   * da agência da sessão. Então a sincronização só acontece quando as duas
   * coincidem; nas demais, a interface opera apenas sobre o cache local.
   */
  const workspaceDaSessao = currentUser?.workspaceId || '';
  const sincronizacaoPermitida =
    isAuthenticated && Boolean(workspaceDaSessao) && currentWsId === workspaceDaSessao;

  /** Envia a fatia do workspace atual, com debounce para não disparar a cada tecla. */
  const schedulePush = (collection: string, rows: { workspaceId?: string }[]) => {
    if (!hydratedRef.current || !sincronizacaoPermitida) return;

    clearTimeout(pushTimers.current[collection]);
    pushTimers.current[collection] = setTimeout(async () => {
      try {
        setSyncState('saving');
        await dataApi.pushCollection(collection, rows.filter(belongsToWorkspace));
        setSyncState('saved');
        setSyncError(null);
      } catch (err) {
        setSyncState('error');
        setSyncError(
          err instanceof ApiError
            ? err.message
            : 'Não foi possível salvar no servidor. As alterações seguem neste navegador.'
        );
      }
    }, 800);
  };

  const usePersistedCollection = (name: string, rows: { workspaceId?: string }[]) => {
    useEffect(() => {
      writeStorage(`${LOCAL_STORAGE_KEY_PREFIX}${name}`, rows);
      schedulePush(name, rows);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);
  };

  usePersistedCollection('clients', allClients);
  usePersistedCollection('jobs', allJobs);
  usePersistedCollection('leads', allLeads);
  usePersistedCollection('proposals', allProposals);
  usePersistedCollection('contracts', allContracts);
  usePersistedCollection('automations', allAutomations);
  usePersistedCollection('notifications', allNotifications);
  usePersistedCollection('activityLogs', allActivityLogs);
  usePersistedCollection('clientMaterials', allClientMaterials);
  usePersistedCollection('timesheetLogs', allTimesheetLogs);

  useEffect(() => {
    writeStorage(`${LOCAL_STORAGE_KEY_PREFIX}workspaces`, workspaces);
  }, [workspaces]);

  /**
   * Hidratação a partir do servidor assim que existe sessão. Se o servidor
   * ainda não tem nada deste workspace, sobe o que está no navegador — é a
   * migração do estado local para o compartilhado.
   */
  useEffect(() => {
    // Mesma trava do envio: hidratar com a agência da sessão enquanto a
    // interface exibe outra misturaria dados de duas agências no mesmo estado.
    if (!sincronizacaoPermitida) {
      hydratedRef.current = false;
      return;
    }

    let cancelado = false;

    (async () => {
      try {
        setSyncState('loading');
        const { workspaceId, collections } = await dataApi.fetchAll();
        if (cancelado) return;

        const aplicar = <T extends { workspaceId?: string }>(
          nome: string,
          setter: React.Dispatch<React.SetStateAction<T[]>>,
          locais: T[]
        ) => {
          const remotas = (collections[nome] || []) as T[];
          if (remotas.length > 0) {
            // O servidor manda: troca as linhas deste workspace, preserva as demais.
            setter([
              ...locais.filter((r) => r.workspaceId && r.workspaceId !== workspaceId),
              ...remotas,
            ]);
          } else {
            const paraSubir = locais.filter(belongsToWorkspace);
            if (paraSubir.length > 0) {
              dataApi.pushCollection(nome, paraSubir).catch(() => {});
            }
          }
        };

        aplicar('clients', setAllClients, allClients);
        aplicar('jobs', setAllJobs, allJobs);
        aplicar('leads', setAllLeads, allLeads);
        aplicar('proposals', setAllProposals, allProposals);
        aplicar('contracts', setAllContracts, allContracts);
        aplicar('automations', setAllAutomations, allAutomations);
        aplicar('notifications', setAllNotifications, allNotifications);
        aplicar('activityLogs', setAllActivityLogs, allActivityLogs);
        aplicar('clientMaterials', setAllClientMaterials, allClientMaterials);
        aplicar('timesheetLogs', setAllTimesheetLogs, allTimesheetLogs);

        hydratedRef.current = true;
        setSyncState('saved');
        setSyncError(null);
      } catch (err) {
        if (cancelado) return;
        hydratedRef.current = true;
        setSyncState('error');
        setSyncError(
          err instanceof ApiError
            ? err.message
            : 'Servidor indisponível. Trabalhando com os dados salvos neste navegador.'
        );
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sincronizacaoPermitida, currentWsId]);

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
      id: `log-${Date.now()}`,
      workspaceId: currentWorkspace?.id || 'w-1',
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
      id: `job-${Date.now()}`,
      workspaceId: currentWorkspace?.id || 'w-1',
      clientId: jobData.clientId || clients[0]?.id || 'c-1',
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
        { id: `chk-${Date.now()}-1`, title: 'Redação da copy e chamada', completed: false },
        { id: `chk-${Date.now()}-2`, title: 'Design / Edição do criativo', completed: false },
        { id: `chk-${Date.now()}-3`, title: 'Revisão ortográfica e aprovação', completed: false }
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
        id: `notif-${Date.now()}`,
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
      id: `notif-${Date.now()}`,
      workspaceId: currentWorkspace.id,
      title: `Conteúdo Aprovado! 🎉`,
      message: `${approverName} aprovou "${job.title}". Pronto para agendamento.`,
      type: 'approval',
      read: false,
      createdAt: new Date().toISOString(),
      linkContext: { tab: 'publicacoes', jobId: job.id, clientId: job.clientId }
    };
    setAllNotifications(prev => [newNotif, ...prev]);
  };
  
  const requestAdjustment = (jobId: string, feedback: string, requesterName: string = 'Cliente') => {
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
      id: `notif-${Date.now()}`,
      workspaceId: currentWorkspace.id,
      title: `Pedido de Ajuste Solicitado`,
      message: `${requesterName} solicitou ajuste em "${job.title}": ${feedback.slice(0, 60)}...`,
      type: 'adjustment',
      read: false,
      createdAt: new Date().toISOString(),
      linkContext: { tab: 'conteudos', jobId: job.id, clientId: job.clientId }
    };
    setAllNotifications(prev => [newNotif, ...prev]);
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
  };
  
  const addJobComment = (jobId: string, text: string, isClient: boolean = false) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const newComment = {
      id: `cm-${Date.now()}`,
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
      id: `c-${Date.now()}`,
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
        { id: `s-${Date.now()}`, name: 'Gestão Social Media', monthlyValue: 4000, startDate: new Date().toISOString().split('T')[0], recurrence: 'monthly' }
      ],
      contacts: clientData.contacts || [
        { id: `ct-${Date.now()}`, name: clientData.name || 'Contato Principal', email: clientData.email || '', phone: clientData.phone || '', role: 'Gestor', isPrimary: true }
      ],
      notes: clientData.notes || '',
      createdAt: new Date().toISOString(),
      portalToken: `token-${Math.random().toString(36).substring(2, 9)}`
    };
    
    setAllClients(prev => [newClient, ...prev]);
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
      id: `pwd-${Date.now()}`,
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
      id: `inv-${Date.now()}`
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
      id: `file-${Date.now()}`,
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
      id: `cont-${Date.now()}`,
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
      id: `prop-${Date.now()}`,
      workspaceId: currentWorkspace.id,
      leadId: proposalData.leadId,
      clientId: proposalData.clientId,
      clientName: proposalData.clientName || 'Cliente Prospect',
      title: proposalData.title || 'Proposta de Marketing Digital',
      items: proposalData.items || [
        { id: `pi-${Date.now()}`, service: 'Gestão Social Media', description: '12 posts mensais + stories', quantity: 1, monthlyValue: 3500 }
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
      id: `lead-${Date.now()}`,
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
          id: `s-${Date.now()}`,
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
      id: `cont-${Date.now()}`,
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
      id: `notif-${Date.now()}`,
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
      id: `cont-${Date.now()}`,
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

  // Client Materials
  const addClientMaterial = (material: Omit<ClientMaterial, 'id' | 'createdAt'>) => {
    const newMaterial: ClientMaterial = {
      ...material,
      id: `mat-${Date.now()}`,
      workspaceId: currentWorkspace?.id,
      createdAt: new Date().toISOString()
    };
    setAllClientMaterials(prev => [newMaterial, ...prev]);
    logActivity('Cliente enviou material', `${newMaterial.title} (${newMaterial.clientName})`);
    
    // Notification for agency team
    const notif: Notification = {
      id: `notif-${Date.now()}`,
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
      id: `ts-${Date.now()}`,
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
  // O Firebase foi removido: era um segundo banco, sem autenticação e com
  // regras liberadas para qualquer origem. A persistência compartilhada passou
  // a ser a API autenticada em /api/data.
  //
  // O Supabase continua disponível como caminho de migração documentado
  // (supabase/schema.sql e README), mas não é a fonte de verdade hoje.

  const isSupabaseConnected = isSupabaseConfigured();

  const syncWithSupabase = async (): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
      };
    }
    try {
      const { error } = await supabase.from('clients').select('id').limit(1);
      if (error) throw error;
      return {
        success: true,
        message: 'O Supabase respondeu. Nenhum dado foi migrado — a migração ainda é manual.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Não foi possível consultar o Supabase: ${err?.message || 'verifique o schema e as políticas RLS.'}`,
      };
    }
  };

  const forceSync = async (): Promise<{ success: boolean; message: string }> => {
    if (!isAuthenticated) {
      return { success: false, message: 'Faça login para sincronizar com o servidor.' };
    }
    try {
      setSyncState('saving');
      await Promise.all(
        ([
          ['clients', allClients],
          ['jobs', allJobs],
          ['leads', allLeads],
          ['proposals', allProposals],
          ['contracts', allContracts],
          ['automations', allAutomations],
          ['clientMaterials', allClientMaterials],
          ['timesheetLogs', allTimesheetLogs],
        ] as const).map(([nome, linhas]) =>
          dataApi.pushCollection(nome, (linhas as { workspaceId?: string }[]).filter(belongsToWorkspace))
        )
      );
      setSyncState('saved');
      setSyncError(null);
      return { success: true, message: 'Dados enviados ao servidor com sucesso.' };
    } catch (err) {
      const mensagem = err instanceof ApiError ? err.message : 'Falha ao sincronizar com o servidor.';
      setSyncState('error');
      setSyncError(mensagem);
      return { success: false, message: mensagem };
    }
  };

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
        acceptInvite,
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
        agencyHealthScore,
        clientMaterials,
        addClientMaterial,
        deleteClientMaterial,
        timesheetLogs,
        addTimesheetLog,
        generateAiCopy,
        convertFeedbackToTasks,
        generateEditorialIdeas,
        isSupabaseConnected,
        syncWithSupabase,
        syncState,
        syncError,
        forceSync,
        storageWarning,
        dismissStorageWarning,
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
