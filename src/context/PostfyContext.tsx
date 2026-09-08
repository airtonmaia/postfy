import React, { createContext, useContext, useState, useEffect } from 'react';
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
import { isFirebaseConfigured } from '../lib/firebase';
import { 
  saveItemToFirestore, 
  deleteItemFromFirestore, 
  fetchCollectionFromFirestore, 
  seedInitialFirestoreData 
} from '../lib/firebaseSync';

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
  login: (email: string, password?: string, userToSet?: User) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchUserRole: (role: Role) => void;
  
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
  portalClientId: string | null;
  openClientPortal: (clientId: string) => void;
  closeClientPortal: () => void;
  
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
  addClientMaterial: (material: Omit<ClientMaterial, 'id' | 'uploadedAt'>) => void;
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

  // Firebase
  isFirebaseConnected: boolean;
  syncWithFirebase: () => Promise<{ success: boolean; message: string }>;
}

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
          saveItemToFirestore('workspaces', workspaceId, updated);
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
    saveItemToFirestore('workspaces', id, newWs);
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
    deleteItemFromFirestore('workspaces', workspaceId);
    if (currentWorkspace?.id === workspaceId) {
      const remaining = workspaces.filter(w => w.id !== workspaceId);
      if (remaining.length > 0) {
        setCurrentWorkspace(remaining[0]);
      }
    }
  };
  
  const [users] = useState<User[]>(initialUsers);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}isAuthenticated`);
    return saved === 'true';
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUser = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}currentUser`);
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.warn('Failed to parse saved user:', e);
      }
    }
    return initialUsers[0];
  });

  const login = async (email: string, _password?: string, userToSet?: User): Promise<{ success: boolean; message?: string }> => {
    let targetUser: User;
    if (userToSet) {
      targetUser = userToSet;
    } else {
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        targetUser = found;
      } else {
        targetUser = {
          id: `u-${Date.now()}`,
          name: email.split('@')[0] || 'Usuário Agência',
          email,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          role: 'owner',
          workspaceId: currentWorkspace?.id || 'ws-1'
        };
      }
    }

    setCurrentUser(targetUser);
    setIsAuthenticated(true);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}isAuthenticated`, 'true');
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}currentUser`, JSON.stringify(targetUser));
    return { success: true, message: 'Autenticado com sucesso!' };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}isAuthenticated`, 'false');
  };

  const switchUserRole = (role: Role) => {
    const match = users.find(u => u.role === role);
    if (match) {
      setCurrentUser(match);
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}currentUser`, JSON.stringify(match));
    } else {
      const updated = { ...currentUser, role };
      setCurrentUser(updated);
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}currentUser`, JSON.stringify(updated));
    }
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
  
  // Client portal mode
  const [isClientPortalOpen, setIsClientPortalOpen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('portal') === 'true' || params.has('portal');
    } catch {
      return false;
    }
  });
  const [portalClientId, setPortalClientId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('clientId') || (params.get('portal') !== 'true' ? params.get('portal') : null);
    } catch {
      return null;
    }
  });
  
  // Entity states (filtered strictly by currentWorkspace.id for multi-tenant isolation)
  const currentWsId = currentWorkspace?.id || 'ws-1';

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}clients`);
    const all = saved ? JSON.parse(saved) : initialClients;
    return all.filter((c: Client) => !c.workspaceId || c.workspaceId === currentWsId);
  });
  
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}jobs`);
    const all = saved ? JSON.parse(saved) : initialJobs;
    return all.filter((j: Job) => !j.workspaceId || j.workspaceId === currentWsId);
  });
  
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}leads`);
    const all = saved ? JSON.parse(saved) : initialLeads;
    return all.filter((l: Lead) => !l.workspaceId || l.workspaceId === currentWsId);
  });
  
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}proposals`);
    const all = saved ? JSON.parse(saved) : initialProposals;
    return all.filter((p: Proposal) => !p.workspaceId || p.workspaceId === currentWsId);
  });
  
  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}contracts`);
    const all = saved ? JSON.parse(saved) : initialContracts;
    return all.filter((ct: Contract) => !ct.workspaceId || ct.workspaceId === currentWsId);
  });
  
  const [automations, setAutomations] = useState<Automation[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}automations`);
    const all = saved ? JSON.parse(saved) : initialAutomations;
    return all.filter((a: Automation) => !a.workspaceId || a.workspaceId === currentWsId);
  });
  
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}notifications`);
    const all = saved ? JSON.parse(saved) : initialNotifications;
    return all.filter((n: Notification) => !n.workspaceId || n.workspaceId === currentWsId);
  });
  
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}activityLogs`);
    const all = saved ? JSON.parse(saved) : initialActivityLogs;
    return all.filter((al: ActivityLog) => !al.workspaceId || al.workspaceId === currentWsId);
  });

  const [clientMaterials, setClientMaterials] = useState<ClientMaterial[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}clientMaterials`);
    const all = saved ? JSON.parse(saved) : initialClientMaterials;
    return all.filter((cm: ClientMaterial) => !cm.workspaceId || cm.workspaceId === currentWsId);
  });

  const [timesheetLogs, setTimesheetLogs] = useState<TimesheetLog[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}timesheetLogs`);
    const all = saved ? JSON.parse(saved) : initialTimesheetLogs;
    return all.filter((tl: TimesheetLog) => !tl.workspaceId || tl.workspaceId === currentWsId);
  });
  
  // Save changes to localStorage with try/catch to prevent quota exceeded errors
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}clients`, JSON.stringify(clients)); } catch(e) {}
  }, [clients]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}jobs`, JSON.stringify(jobs)); } catch(e) {}
  }, [jobs]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}leads`, JSON.stringify(leads)); } catch(e) {}
  }, [leads]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}proposals`, JSON.stringify(proposals)); } catch(e) {}
  }, [proposals]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}contracts`, JSON.stringify(contracts)); } catch(e) {}
  }, [contracts]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}automations`, JSON.stringify(automations)); } catch(e) {}
  }, [automations]);

  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}clientMaterials`, JSON.stringify(clientMaterials)); } catch(e) {}
  }, [clientMaterials]);

  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}timesheetLogs`, JSON.stringify(timesheetLogs));
    } catch (e) {}
  }, [timesheetLogs]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}notifications`, JSON.stringify(notifications)); } catch(e) {}
  }, [notifications]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}activityLogs`, JSON.stringify(activityLogs)); } catch(e) {}
  }, [activityLogs]);
  
  useEffect(() => {
    try { localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}workspaces`, JSON.stringify(workspaces)); } catch(e) {}
  }, [workspaces]);

  // Initial sync & auto-seed with Firebase Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const initFirebaseData = async () => {
      try {
        const firestoreWorkspaces = await fetchCollectionFromFirestore<Workspace>('workspaces');
        if (firestoreWorkspaces && firestoreWorkspaces.length > 0) {
          setWorkspaces(firestoreWorkspaces);
          setCurrentWorkspaceState(prev => {
            const match = firestoreWorkspaces.find(w => w.id === prev.id) || firestoreWorkspaces[0];
            return match || prev;
          });
        }

        const firestoreClients = await fetchCollectionFromFirestore<Client>('clients');
        if (firestoreClients && firestoreClients.length > 0) {
          setClients(firestoreClients);
          const firestoreJobs = await fetchCollectionFromFirestore<Job>('jobs');
          if (firestoreJobs.length > 0) setJobs(firestoreJobs);
          const firestoreLeads = await fetchCollectionFromFirestore<Lead>('leads');
          if (firestoreLeads.length > 0) setLeads(firestoreLeads);
          const firestoreProposals = await fetchCollectionFromFirestore<Proposal>('proposals');
          if (firestoreProposals.length > 0) setProposals(firestoreProposals);
          const firestoreMaterials = await fetchCollectionFromFirestore<ClientMaterial>('client_materials');
          if (firestoreMaterials.length > 0) setClientMaterials(firestoreMaterials);
          const firestoreTimesheet = await fetchCollectionFromFirestore<TimesheetLog>('timesheet_logs');
          if (firestoreTimesheet.length > 0) setTimesheetLogs(firestoreTimesheet);
        } else {
          // First time connected: Seed initial records to Firebase Firestore
          await seedInitialFirestoreData(clients, jobs, leads, proposals, clientMaterials, timesheetLogs, workspaces);
        }
      } catch (err) {
        console.warn('Firebase Firestore initialization:', err);
      }
    };

    initFirebaseData();
  }, []);

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
    setPortalClientId(clientId);
    setIsClientPortalOpen(true);
  };
  
  const closeClientPortal = () => {
    setIsClientPortalOpen(false);
    setPortalClientId(null);
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
    setActivityLogs(prev => [newLog, ...prev]);
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
    
    setJobs(prev => [newJob, ...prev]);
    saveItemToFirestore('jobs', newJob.id, newJob);
    logActivity('Criou o conteúdo', `Job: ${newJob.title}`);
    
    // Check automation for job created
    return newJob;
  };
  
  const updateJob = (jobId: string, updates: Partial<Job>) => {
    setJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        const updated = { ...job, ...updates };
        saveItemToFirestore('jobs', jobId, updated);
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
    deleteItemFromFirestore('jobs', jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
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
      setNotifications(prev => [newNotif, ...prev]);
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
    setNotifications(prev => [newNotif, ...prev]);
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
    setNotifications(prev => [newNotif, ...prev]);
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
    
    setClients(prev => [newClient, ...prev]);
    saveItemToFirestore('clients', newClient.id, newClient);
    logActivity('Cadastrou novo cliente', `Cliente: ${newClient.name}`);
    return newClient;
  };
  
  const updateClient = (clientId: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const updated = { ...c, ...updates };
        saveItemToFirestore('clients', clientId, updated);
        return updated;
      }
      return c;
    }));
  };

  const deleteClient = (clientId: string) => {
    deleteItemFromFirestore('clients', clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
  };

  const addClientPassword = (clientId: string, passwordData: Omit<ClientPassword, 'id' | 'updatedAt'>) => {
    const newPassword: ClientPassword = {
      ...passwordData,
      id: `pwd-${Date.now()}`,
      updatedAt: new Date().toISOString()
    };
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, passwords: [...(c.passwords || []), newPassword] };
    }));
    logActivity('Cadastrou credencial no cofre', `Cliente #${clientId}: ${passwordData.service}`);
  };

  const deleteClientPassword = (clientId: string, passwordId: string) => {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, passwords: (c.passwords || []).filter(p => p.id !== passwordId) };
    }));
  };

  const addClientInvoice = (clientId: string, invoiceData: Omit<ClientInvoice, 'id'>) => {
    const newInvoice: ClientInvoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`
    };
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, invoices: [newInvoice, ...(c.invoices || [])] };
    }));
    logActivity('Lançou nota fiscal', `Cliente #${clientId}: ${invoiceData.number}`);
  };

  const deleteClientInvoice = (clientId: string, invoiceId: string) => {
    setClients(prev => prev.map(c => {
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
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: [newFile, ...(c.files || [])] };
    }));
    logActivity('Adicionou arquivo', `Cliente #${clientId}: ${fileData.name}`);
  };

  const deleteClientFile = (clientId: string, fileId: string) => {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, files: (c.files || []).filter(f => f.id !== fileId) };
    }));
  };

  const updateClientBriefing = (clientId: string, briefingData: Partial<ClientBriefing>) => {
    setClients(prev => prev.map(c => {
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
    setContracts(prev => [newContract, ...prev]);
    logActivity('Criou contrato', `Contrato: ${newContract.title}`);
    return newContract;
  };

  const signContract = (contractId: string, signatoryName: string) => {
    setContracts(prev => prev.map(c => 
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
    setProposals(prev => [newProp, ...prev]);
    saveItemToFirestore('proposals', newProp.id, newProp);
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
    setLeads(prev => [newLead, ...prev]);
    saveItemToFirestore('leads', newLead.id, newLead);
    logActivity('Cadastrou novo Lead comercial', `${newLead.company} (${newLead.name})`);
    return newLead;
  };

  const updateLeadStage = (leadId: string, stage: LeadStage) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const updated = { ...l, stage };
        saveItemToFirestore('leads', leadId, updated);
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
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: 'ganho' as const } : l));
    
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
    setContracts(prev => [newContract, ...prev]);
    
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
    setNotifications(prev => [notif, ...prev]);
  };
  
  const acceptProposal = (proposalId: string) => {
    const prop = proposals.find(p => p.id === proposalId);
    if (!prop) return;
    
    setProposals(prev => prev.map(p => 
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
    setContracts(prev => [newContract, ...prev]);
    logActivity('Gerou Contrato', `Contrato para ${prop.clientName}`);
  };
  
  // Notifications & Automations
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  
  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  
  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ));
  };

  // Client Materials
  const addClientMaterial = (material: Omit<ClientMaterial, 'id' | 'uploadedAt'>) => {
    const newMaterial: ClientMaterial = {
      ...material,
      id: `mat-${Date.now()}`,
      uploadedAt: new Date().toISOString()
    };
    setClientMaterials(prev => [newMaterial, ...prev]);
    saveItemToFirestore('client_materials', newMaterial.id, newMaterial);
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
    setNotifications(prev => [notif, ...prev]);
  };

  const deleteClientMaterial = (id: string) => {
    deleteItemFromFirestore('client_materials', id);
    setClientMaterials(prev => prev.filter(m => m.id !== id));
  };

  // Timesheet
  const addTimesheetLog = (log: Omit<TimesheetLog, 'id' | 'createdAt'>) => {
    const newLog: TimesheetLog = {
      ...log,
      id: `ts-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setTimesheetLogs(prev => [newLog, ...prev]);
    saveItemToFirestore('timesheet_logs', newLog.id, newLog);

    // Update job timesheetMinutes
    setJobs(prev => prev.map(j => {
      if (j.id === log.jobId) {
        const updated = {
          ...j,
          timesheetMinutes: (j.timesheetMinutes || 0) + log.minutes
        };
        saveItemToFirestore('jobs', j.id, updated);
        return updated;
      }
      return j;
    }));

    logActivity('Apontou tempo em Job', `${log.minutes} min em "${log.jobTitle}" por ${log.userName}`);
  };

  // AI Operations (Gemini)
  const generateAiCopy = async (params: { theme: string; format?: string; platform?: string; clientId?: string; additionalNotes?: string }) => {
    const client = clients.find(c => c.id === params.clientId);
    try {
      const res = await fetch('/api/gemini/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: params.theme,
          format: params.format,
          platform: params.platform,
          brandVoice: client?.briefing?.brandVoice,
          targetAudience: client?.briefing?.targetAudience,
          painPoints: client?.briefing?.painPoints,
          monthlyGoals: client?.briefing?.monthlyGoals,
          additionalNotes: params.additionalNotes
        })
      });
      if (!res.ok) throw new Error('Falha na API');
      return await res.json();
    } catch {
      return {
        caption: `✨ [IA Estratégica Postfy] ${params.theme}\n\nVocê já parou para pensar em como isso impacta seus resultados diariamente? Acompanhe o passo a passo completo.\n\n👉 Compartilhe este post com alguém que precisa ver isso hoje!`,
        hook: `O maior erro sobre ${params.theme} que ninguém te conta!`,
        cta: `Comente "QUERO" ou clique no link da bio para conferir.`,
        hashtags: ['#marketingdeconteudo', '#socialmedia', '#estrategiadigital', '#engajamento', '#postfy'],
        reelsScript: `CENA 1 (0-3s): Expressão impactante. Texto: "Faça isso agora mesmo".\nCENA 2: Explicação visual rápida.\nCENA 3: Demonstração prática do benefício.`
      };
    }
  };

  const convertFeedbackToTasks = async (params: { clientFeedback: string; jobTitle: string; currentCopy?: string }) => {
    try {
      const res = await fetch('/api/gemini/convert-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error('Falha na API');
      return await res.json();
    } catch {
      return {
        summary: `Ajuste solicitado pelo cliente em "${params.jobTitle}": ${params.clientFeedback}`,
        checklist: [
          { item: `Ajustar arte/diagramação conforme feedback do cliente: ${params.clientFeedback.slice(0, 60)}...`, role: 'designer' as const },
          { item: 'Revisar ortografia, quebras de linha e CTA da legenda', role: 'copywriter' as const }
        ]
      };
    }
  };

  const generateEditorialIdeas = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId) || clients[0];
    try {
      const res = await fetch('/api/gemini/editorial-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSegment: client?.segment || 'Serviços',
          clientName: client?.name || 'Cliente',
          month: 'Março'
        })
      });
      if (!res.ok) throw new Error('Falha na API');
      return await res.json();
    } catch {
      return {
        ideas: [
          { title: 'Carrossel: 5 Erros mais comuns no segmento', format: 'Carrossel', hook: 'Pare de errar nisso agora!', rationale: 'Gera salvamentos e autoridade imediata' },
          { title: 'Reels: Bastidores de um dia de atendimento', format: 'Reels', hook: 'Como funciona por trás das câmeras', rationale: 'Humaniza a marca e gera identificação' },
          { title: 'Post de Prova Social: Estudo de Caso de Sucesso', format: 'Post Estático', hook: 'De 0 a 100 em 30 dias', rationale: 'Gera desejo e pedidos de orçamento' },
          { title: 'Infográfico / Checklist com Dicas Práticas', format: 'Carrossel', hook: 'Salve para consultar depois!', rationale: 'Aumenta compartilhamentos orgânicos' }
        ]
      };
    }
  };

  // Supabase
  const isSupabaseConnected = isSupabaseConfigured();

  const syncWithSupabase = async (): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase ainda não configurado no .env. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo de ambiente.'
      };
    }

    try {
      const { error } = await supabase.from('clients').select('id').limit(1);
      if (error) throw error;

      return {
        success: true,
        message: 'Conexão com Supabase verificada e ativa! Tabelas prontas.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao conectar com Supabase: ${err.message || 'Verifique o schema.sql'}`
      };
    }
  };

  // Firebase
  const isFirebaseConnected = isFirebaseConfigured();

  const syncWithFirebase = async (): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Firebase ainda não inicializado no projeto.'
      };
    }

    try {
      await seedInitialFirestoreData(clients, jobs, leads, proposals, clientMaterials, timesheetLogs);
      return {
        success: true,
        message: 'Firebase Firestore conectado com sucesso e dados sincronizados!'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao sincronizar com Firebase Firestore: ${err.message || 'Verifique a conexão'}`
      };
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
        login,
        logout,
        switchUserRole,
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
        isFirebaseConnected,
        syncWithFirebase,
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
