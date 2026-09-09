export type Role = 
  | 'owner' 
  | 'admin' 
  | 'manager' 
  | 'social_media' 
  | 'designer' 
  | 'copywriter' 
  | 'financial' 
  | 'client';

export type JobStatus = 
  | 'ideas' 
  | 'in_production' 
  | 'for_approval' 
  | 'in_adjustment' 
  | 'approved' 
  | 'scheduled' 
  | 'published';

export type JobPlatform = 
  | 'instagram' 
  | 'facebook' 
  | 'linkedin' 
  | 'tiktok' 
  | 'youtube' 
  | 'twitter';

export type JobFormat = 
  | 'feed' 
  | 'carousel' 
  | 'reel' 
  | 'story' 
  | 'video' 
  | 'article';

export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  workspaceId: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor?: string;
  customDomain?: string;
  whiteLabel: boolean;
  timezone: string;
  isTrial?: boolean;
  trialEndsAt?: string;
}

export interface ClientContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isPrimary: boolean;
}

export interface ClientService {
  id: string;
  name: string;
  monthlyValue: number;
  startDate: string;
  recurrence: 'monthly' | 'quarterly' | 'annual';
}

export interface ClientFile {
  id: string;
  name: string;
  category: 'identidade_visual' | 'briefing' | 'fotos' | 'videos' | 'documentos' | 'contratos';
  url: string;
  size: string;
  uploadedAt: string;
}

export interface ClientPassword {
  id: string;
  service: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  updatedAt: string;
}

export interface ClientInvoice {
  id: string;
  number: string;
  monthRef: string;
  value: number;
  issueDate: string;
  dueDate?: string;
  status: 'pago' | 'pendente' | 'emitido';
  fileUrl?: string;
}

export interface ClientBriefing {
  brandVoice: string;
  targetAudience: string;
  painPoints: string;
  competitors: string;
  brandGuidelines: string;
  monthlyGoals: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  legalName?: string;
  tradeName?: string;
  cpfCnpj?: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'active' | 'inactive';
  segment: string;
  website?: string;
  internalResponsibleId: string;
  healthScore: 'green' | 'yellow' | 'red'; // verde (bom), amarelo (alerta), vermelho (gargalo)
  services: ClientService[];
  contacts: ClientContact[];
  files?: ClientFile[];
  passwords?: ClientPassword[];
  invoices?: ClientInvoice[];
  briefing?: ClientBriefing;
  notes?: string;
  createdAt: string;
  portalToken: string;
}

export interface JobVersion {
  versionNumber: number;
  mediaUrls: string[];
  caption: string;
  submittedBy: string;
  submittedAt: string;
  feedback?: string;
  status: 'draft' | 'pending' | 'rejected' | 'approved';
}

export interface JobComment {
  id: string;
  authorName: string;
  authorRole: Role;
  authorAvatar: string;
  isClient: boolean;
  text: string;
  createdAt: string;
}

export interface JobChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
}

export interface Job {
  id: string;
  workspaceId: string;
  clientId: string;
  title: string;
  campaign?: string;
  platform: JobPlatform;
  format: JobFormat;
  status: JobStatus;
  priority: JobPriority;
  targetAudience?: string;
  funnelStage?: 'topo' | 'meio' | 'fundo';
  
  // Content details
  caption: string;
  cta?: string;
  hashtags: string[];
  firstComment?: string;
  link?: string;
  mediaUrls: string[];
  
  // Versions and history
  currentVersion: number;
  versions: JobVersion[];
  
  // Dates
  createdAt: string;
  deadlineProduction: string;
  deadlineApproval: string;
  scheduledDate: string; // ISO string with time
  publishedDate?: string;
  
  // Responsibles
  designerId?: string;
  copywriterId?: string;
  socialMediaId?: string;
  
  // Workflow extras
  checklist: JobChecklistItem[];
  comments: JobComment[];
  lastFeedback?: string;
  timesheetMinutes?: number;
}

export type PipelineStage = 
  | 'lead' 
  | 'contato' 
  | 'reuniao' 
  | 'proposta_enviada' 
  | 'negociacao' 
  | 'ganho' 
  | 'perdido'
  | LeadStage;

export interface Lead {
  id: string;
  workspaceId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  serviceInterest: string;
  estimatedValue: number;
  stage: PipelineStage;
  responsibleId: string;
  notes: string;
  createdAt: string;
}

export interface ProposalItem {
  id: string;
  service: string;
  description: string;
  quantity: number;
  monthlyValue: number;
}

export interface Proposal {
  id: string;
  workspaceId: string;
  leadId?: string;
  clientId?: string;
  clientName: string;
  title: string;
  items: ProposalItem[];
  totalMonthlyValue: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';
  validUntil: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface Contract {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  title: string;
  monthlyValue: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled';
  signedAt?: string;
  /**
   * Quem assinou. signContract() sempre recebeu este nome, mas o tipo não
   * tinha onde guardá-lo, então ele era descartado: o contrato ficava
   * "assinado" sem registro de por quem.
   */
  signatoryName?: string;
  createdAt?: string;
}

export interface Automation {
  id: string;
  workspaceId: string;
  title: string;
  /** Descrição legível da condição, exibida na tela. */
  trigger: string;
  /** Descrição legível da ação, exibida na tela. */
  action: string;
  /**
   * Versões tipadas do par acima. São o que o motor casa e executa; as
   * strings existem para a interface. Opcionais porque regras criadas antes
   * disso não têm — elas simplesmente não disparam.
   */
  triggerEvent?: 'conteudo_aguardando_aprovacao' | 'conteudo_aprovado' | 'pedido_de_ajuste';
  actionType?: 'email' | 'webhook';
  actionConfig?: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: string;
  executionCount: number;
}

export interface Notification {
  id: string;
  workspaceId: string;
  title: string;
  message: string;
  type: 'approval' | 'adjustment' | 'publication' | 'system' | 'lead';
  read: boolean;
  createdAt: string;
  linkContext?: {
    tab: string;
    jobId?: string;
    clientId?: string;
  };
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

export type TabType = 
  | 'dashboard' 
  | 'calendario' 
  | 'producao' 
  | 'aprovacoes' 
  | 'clientes' 
  | 'comercial' 
  | 'publicacoes' 
  | 'relatorios' 
  | 'automacoes' 
  | 'configuracoes'
  | 'saas_planos'
  | 'saas_financeiro'
  | 'saas_agencias'
  | 'saas_emails'
  | 'saas_integracoes';

export type LeadStage = 'new_lead' | 'meeting_scheduled' | 'proposal_sent' | 'negotiating' | 'won' | 'lost';

/**
 * Materiais que o cliente envia pelo portal.
 *
 * O tipo estava divergente da tela que o consome: o portal lia `url`,
 * `category`, `notes`, `size`, `thumbnailUrl` e `createdAt`, campos que não
 * existiam aqui — e comparava o status com 'utilized'/'in_review', valores fora
 * do union. Como o seed era tipado `any[]`, nada disso aparecia no typecheck e
 * a galeria do portal renderizava campos indefinidos.
 */
export type ClientMaterialStatus = 'recebido' | 'in_review' | 'utilized';

export interface ClientMaterial {
  id: string;
  workspaceId?: string;
  clientId: string;
  clientName?: string;
  title: string;
  description?: string;
  notes?: string;
  category?: string;
  url: string;
  thumbnailUrl?: string;
  fileType?: 'image' | 'video' | 'document';
  size?: string;
  status: ClientMaterialStatus;
  createdAt: string;
}

export interface TimesheetLog {
  id: string;
  workspaceId?: string;
  jobId: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  userId: string;
  userName: string;
  minutes: number;
  notes?: string;
  createdAt: string;
}

