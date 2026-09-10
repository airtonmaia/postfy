import type {
  Client,
  Job,
  Lead,
  Proposal,
  Contract,
  Automation,
  Notification,
  ActivityLog,
  ClientMaterial,
  TimesheetLog,
  Workspace,
} from '../types';

/**
 * Tradução entre o banco e o app.
 *
 * O Postgres usa snake_case (convenção da linguagem, e o que as políticas de
 * RLS enxergam) e os tipos do app usam camelCase. Em vez de espalhar essa
 * conversão por cada consulta, ela fica concentrada aqui e é testada.
 *
 * Campos ausentes viram `undefined`, não `null`: o app trata opcional com
 * `undefined`, e `null` escaparia para a interface como "null" em texto.
 */

type Linha = Record<string, any>;

const semNulos = <T extends Linha>(obj: T): T => {
  const saida: Linha = {};
  for (const [chave, valor] of Object.entries(obj)) {
    if (valor !== undefined) saida[chave] = valor;
  }
  return saida as T;
};

const ounull = <T>(valor: T | null | undefined): T | undefined =>
  valor === null ? undefined : valor;

// ---------------------------------------------------------------- Workspace

export const workspaceDaLinha = (l: Linha): Workspace => ({
  id: l.id,
  name: l.name,
  slug: l.slug,
  logo: l.logo ?? '',
  favicon: ounull(l.favicon),
  primaryColor: l.primary_color ?? '#6366f1',
  secondaryColor: ounull(l.secondary_color),
  customDomain: ounull(l.custom_domain),
  whiteLabel: Boolean(l.white_label),
  timezone: l.timezone ?? 'America/Sao_Paulo',
  isTrial: ounull(l.is_trial),
  trialEndsAt: ounull(l.trial_ends_at),
  deletedAt: ounull(l.deleted_at),
  deletedBy: ounull(l.deleted_by),
});

export const workspaceParaLinha = (w: Partial<Workspace>): Linha =>
  semNulos({
    name: w.name,
    slug: w.slug,
    logo: w.logo,
    favicon: w.favicon,
    primary_color: w.primaryColor,
    secondary_color: w.secondaryColor,
    custom_domain: w.customDomain,
    white_label: w.whiteLabel,
    timezone: w.timezone,
    is_trial: w.isTrial,
    trial_ends_at: w.trialEndsAt,
  });

// ------------------------------------------------------------------- Client

export const clientDaLinha = (l: Linha): Client => ({
  id: l.id,
  slug: l.slug ?? undefined,
  workspaceId: l.workspace_id,
  name: l.name,
  legalName: ounull(l.legal_name),
  tradeName: ounull(l.trade_name),
  cpfCnpj: ounull(l.cpf_cnpj),
  email: l.email ?? '',
  phone: l.phone ?? '',
  avatar: l.avatar ?? '',
  status: l.status ?? 'active',
  segment: l.segment ?? '',
  website: ounull(l.website),
  internalResponsibleId: l.internal_responsible_id ?? '',
  healthScore: l.health_score ?? 'green',
  services: l.services ?? [],
  contacts: l.contacts ?? [],
  files: l.files ?? [],
  passwords: l.passwords ?? [],
  invoices: l.invoices ?? [],
  briefing: l.briefing ?? undefined,
  notes: ounull(l.notes),
  createdAt: l.created_at,
  portalToken: l.portal_token,
});

export const clientParaLinha = (c: Partial<Client>): Linha =>
  semNulos({
    workspace_id: c.workspaceId,
    name: c.name,
    legal_name: c.legalName,
    trade_name: c.tradeName,
    cpf_cnpj: c.cpfCnpj,
    email: c.email,
    phone: c.phone,
    avatar: c.avatar,
    status: c.status,
    segment: c.segment,
    website: c.website,
    internal_responsible_id: c.internalResponsibleId,
    health_score: c.healthScore,
    services: c.services,
    contacts: c.contacts,
    files: c.files,
    passwords: c.passwords,
    invoices: c.invoices,
    briefing: c.briefing,
    notes: c.notes,
    // `slug` fica de fora de propósito: quem gera e mantém é o trigger no
    // banco, a partir do nome. Mandá-lo daqui deixaria a tela sobrescrever o
    // valor gerado com o que ela tinha em memória.
  });

// ---------------------------------------------------------------------- Job

export const jobDaLinha = (l: Linha): Job => ({
  id: l.id,
  workspaceId: l.workspace_id,
  clientId: l.client_id,
  title: l.title,
  campaign: ounull(l.campaign),
  platform: l.platform,
  format: l.format,
  status: l.status,
  priority: l.priority ?? 'medium',
  targetAudience: ounull(l.target_audience),
  funnelStage: ounull(l.funnel_stage),
  caption: l.caption ?? '',
  cta: ounull(l.cta),
  hashtags: l.hashtags ?? [],
  firstComment: ounull(l.first_comment),
  link: ounull(l.link),
  mediaUrls: l.media_urls ?? [],
  currentVersion: l.current_version ?? 1,
  versions: l.versions ?? [],
  createdAt: l.created_at,
  deadlineProduction: l.deadline_production ?? '',
  deadlineApproval: l.deadline_approval ?? '',
  scheduledDate: l.scheduled_date ?? '',
  publishedDate: ounull(l.published_date),
  designerId: ounull(l.designer_id),
  copywriterId: ounull(l.copywriter_id),
  socialMediaId: ounull(l.social_media_id),
  checklist: l.checklist ?? [],
  comments: l.comments ?? [],
  lastFeedback: ounull(l.last_feedback),
  timesheetMinutes: l.timesheet_minutes ?? 0,
});

/** Datas vazias precisam virar null: string vazia não é timestamp válido. */
const dataOuNulo = (valor?: string) => (valor && valor.trim() ? valor : null);

export const jobParaLinha = (j: Partial<Job>): Linha =>
  semNulos({
    workspace_id: j.workspaceId,
    client_id: j.clientId,
    title: j.title,
    campaign: j.campaign,
    platform: j.platform,
    format: j.format,
    status: j.status,
    priority: j.priority,
    target_audience: j.targetAudience,
    funnel_stage: j.funnelStage,
    caption: j.caption,
    cta: j.cta,
    hashtags: j.hashtags,
    first_comment: j.firstComment,
    link: j.link,
    media_urls: j.mediaUrls,
    current_version: j.currentVersion,
    versions: j.versions,
    deadline_production: j.deadlineProduction === undefined ? undefined : dataOuNulo(j.deadlineProduction),
    deadline_approval: j.deadlineApproval === undefined ? undefined : dataOuNulo(j.deadlineApproval),
    scheduled_date: j.scheduledDate === undefined ? undefined : dataOuNulo(j.scheduledDate),
    published_date: j.publishedDate === undefined ? undefined : dataOuNulo(j.publishedDate),
    designer_id: j.designerId,
    copywriter_id: j.copywriterId,
    social_media_id: j.socialMediaId,
    checklist: j.checklist,
    comments: j.comments,
    last_feedback: j.lastFeedback,
    timesheet_minutes: j.timesheetMinutes,
  });

// --------------------------------------------------------------------- Lead

export const leadDaLinha = (l: Linha): Lead => ({
  id: l.id,
  workspaceId: l.workspace_id,
  name: l.name,
  company: l.company ?? '',
  email: l.email ?? '',
  phone: l.phone ?? '',
  source: l.source ?? '',
  serviceInterest: l.service_interest ?? '',
  estimatedValue: Number(l.estimated_value ?? 0),
  stage: l.stage ?? 'new_lead',
  responsibleId: l.responsible_id ?? '',
  notes: ounull(l.notes),
  createdAt: l.created_at,
});

export const leadParaLinha = (l: Partial<Lead>): Linha =>
  semNulos({
    workspace_id: l.workspaceId,
    name: l.name,
    company: l.company,
    email: l.email,
    phone: l.phone,
    source: l.source,
    service_interest: l.serviceInterest,
    estimated_value: l.estimatedValue,
    stage: l.stage,
    responsible_id: l.responsibleId,
    notes: l.notes,
  });

// ----------------------------------------------------------------- Proposal

export const proposalDaLinha = (l: Linha): Proposal => ({
  id: l.id,
  workspaceId: l.workspace_id,
  leadId: ounull(l.lead_id),
  clientId: ounull(l.client_id),
  clientName: l.client_name,
  title: l.title,
  items: l.items ?? [],
  totalMonthlyValue: Number(l.total_monthly_value ?? 0),
  status: l.status ?? 'draft',
  validUntil: l.valid_until ?? '',
  createdAt: l.created_at,
  acceptedAt: ounull(l.accepted_at),
});

export const proposalParaLinha = (p: Partial<Proposal>): Linha =>
  semNulos({
    workspace_id: p.workspaceId,
    lead_id: p.leadId,
    client_id: p.clientId,
    client_name: p.clientName,
    title: p.title,
    items: p.items,
    total_monthly_value: p.totalMonthlyValue,
    status: p.status,
    valid_until: p.validUntil === undefined ? undefined : dataOuNulo(p.validUntil),
    accepted_at: p.acceptedAt === undefined ? undefined : dataOuNulo(p.acceptedAt),
  });

// ----------------------------------------------------------------- Contract

export const contractDaLinha = (l: Linha): Contract => ({
  id: l.id,
  workspaceId: l.workspace_id,
  clientId: l.client_id ?? '',
  clientName: l.client_name,
  title: l.title,
  monthlyValue: Number(l.monthly_value ?? 0),
  startDate: l.start_date ?? '',
  endDate: l.end_date ?? '',
  status: l.status ?? 'draft',
  signedAt: ounull(l.signed_at),
  signatoryName: ounull(l.signatory_name),
  createdAt: l.created_at,
});

export const contractParaLinha = (c: Partial<Contract>): Linha =>
  semNulos({
    workspace_id: c.workspaceId,
    client_id: c.clientId,
    client_name: c.clientName,
    title: c.title,
    monthly_value: c.monthlyValue,
    start_date: c.startDate === undefined ? undefined : dataOuNulo(c.startDate),
    end_date: c.endDate === undefined ? undefined : dataOuNulo(c.endDate),
    status: c.status,
    signed_at: c.signedAt === undefined ? undefined : dataOuNulo(c.signedAt),
    signatory_name: c.signatoryName,
  });

// --------------------------------------------------------------- Automation

export const automationDaLinha = (l: Linha): Automation => ({
  id: l.id,
  workspaceId: l.workspace_id,
  title: l.title,
  trigger: l.trigger,
  action: l.action,
  triggerEvent: ounull(l.trigger_event) as Automation['triggerEvent'],
  actionType: ounull(l.action_type) as Automation['actionType'],
  actionConfig: l.action_config ?? {},
  enabled: Boolean(l.enabled),
  lastRunAt: ounull(l.last_run_at),
  executionCount: l.execution_count ?? 0,
});

export const automationParaLinha = (a: Partial<Automation>): Linha =>
  semNulos({
    workspace_id: a.workspaceId,
    title: a.title,
    trigger: a.trigger,
    action: a.action,
    trigger_event: a.triggerEvent,
    action_type: a.actionType,
    action_config: a.actionConfig,
    enabled: a.enabled,
    last_run_at: a.lastRunAt === undefined ? undefined : dataOuNulo(a.lastRunAt),
    execution_count: a.executionCount,
  });

// ------------------------------------------------------------- Notification

export const notificationDaLinha = (l: Linha): Notification => ({
  id: l.id,
  workspaceId: l.workspace_id,
  title: l.title,
  message: l.message ?? '',
  type: l.type,
  read: Boolean(l.read),
  createdAt: l.created_at,
  linkContext: ounull(l.link_context),
});

export const notificationParaLinha = (n: Partial<Notification>): Linha =>
  semNulos({
    workspace_id: n.workspaceId,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    link_context: n.linkContext,
  });

// -------------------------------------------------------------- ActivityLog

export const activityLogDaLinha = (l: Linha): ActivityLog => ({
  id: l.id,
  workspaceId: l.workspace_id,
  userName: l.user_name,
  action: l.action,
  target: l.target ?? '',
  timestamp: l.created_at,
});

export const activityLogParaLinha = (a: Partial<ActivityLog>): Linha =>
  semNulos({
    workspace_id: a.workspaceId,
    user_name: a.userName,
    action: a.action,
    target: a.target,
  });

// ----------------------------------------------------------- ClientMaterial

export const clientMaterialDaLinha = (l: Linha): ClientMaterial => ({
  id: l.id,
  workspaceId: l.workspace_id,
  clientId: l.client_id,
  clientName: ounull(l.client_name),
  title: l.title,
  description: ounull(l.description),
  notes: ounull(l.notes),
  category: ounull(l.category),
  url: l.url,
  thumbnailUrl: ounull(l.thumbnail_url),
  fileType: ounull(l.file_type),
  size: ounull(l.size),
  status: l.status ?? 'recebido',
  createdAt: l.created_at,
});

export const clientMaterialParaLinha = (m: Partial<ClientMaterial>): Linha =>
  semNulos({
    workspace_id: m.workspaceId,
    client_id: m.clientId,
    client_name: m.clientName,
    title: m.title,
    description: m.description,
    notes: m.notes,
    category: m.category,
    url: m.url,
    thumbnail_url: m.thumbnailUrl,
    file_type: m.fileType,
    size: m.size,
    status: m.status,
  });

// ------------------------------------------------------------ TimesheetLog

export const timesheetLogDaLinha = (l: Linha): TimesheetLog => ({
  id: l.id,
  workspaceId: l.workspace_id,
  jobId: l.job_id ?? '',
  jobTitle: l.job_title ?? '',
  clientId: l.client_id ?? '',
  clientName: l.client_name ?? '',
  userId: l.user_id ?? '',
  userName: l.user_name ?? '',
  minutes: l.minutes ?? 0,
  notes: ounull(l.notes),
  createdAt: l.created_at,
});

export const timesheetLogParaLinha = (t: Partial<TimesheetLog>): Linha =>
  semNulos({
    workspace_id: t.workspaceId,
    job_id: t.jobId,
    job_title: t.jobTitle,
    client_id: t.clientId,
    client_name: t.clientName,
    user_id: t.userId,
    user_name: t.userName,
    minutes: t.minutes,
    notes: t.notes,
  });
