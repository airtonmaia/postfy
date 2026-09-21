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
  /**
   * Uma peça, duas saídas: sai no feed **e** no story, na mesma data.
   *
   * A arte do story mora em `storyMediaUrls`, e não no segundo item de
   * `mediaUrls`: ali o segundo item já significa "página 2 do carrossel". E as
   * proporções são outras — 4:5 no feed, 9:16 no story —, então a mesma imagem
   * nos dois sai cortada num deles.
   */
  | 'feed_story'
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
  /**
   * Como o cliente é avisado de conteúdo esperando aprovação.
   *
   * `cada` — um e-mail por arte, que é o comportamento de sempre.
   * `lote`  — nenhum e-mail automático; a agência dispara um aviso só,
   *           pelo botão "Aprovação em massa" no quadro.
   */
  notificacaoAprovacao?: 'cada' | 'lote';
  isTrial?: boolean;
  trialEndsAt?: string;
  /**
   * Quando a agência foi para a lixeira. `null` = ativa.
   *
   * Só de leitura no cliente: quem escreve são as RPCs
   * `mover_agencia_para_lixeira` e `restaurar_agencia`, porque o admin da
   * plataforma precisa fazer isso sem ser membro da agência — e a RLS de
   * update em `workspaces` exige ser owner/admin dela. Por isso o campo não
   * aparece em `workspaceParaLinha`.
   */
  deletedAt?: string | null;
  deletedBy?: string | null;
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
  category:
    | 'identidade_visual'
    | 'briefing'
    | 'fotos'
    | 'videos'
    | 'documentos'
    | 'contratos'
    /** Só do bloco de notas: ele não tem categoria de conteúdo. */
    | 'notas';
  url: string;
  size: string;
  uploadedAt: string;
  /**
   * O texto do **bloco de notas**. Vazio nas outras linhas.
   *
   * A nota mora em `files` porque, para quem usa, ela responde a mesma
   * pergunta que o anexo e o link: *o que a agência guardou sobre este
   * cliente?* — e duas listas empilhadas pediam a mesma decisão duas vezes.
   *
   * **Ela continua sendo interna.** `portal_dados` filtra as linhas de
   * `kind = 'nota'` de `files` para todos os papéis, e `portal_salvar_dados`
   * as recoloca na gravação: o navegador do cliente nunca as recebe, então
   * o array que ele devolve não as contém — sem isso, o primeiro arquivo
   * enviado pelo portal apagaria as anotações da agência em silêncio.
   */
  content?: string;
  /**
   * O que a linha é: arquivo enviado para o R2, link colado (Drive, Dropbox)
   * ou bloco de notas.
   *
   * A diferença decide a ação da linha: um baixa, o outro abre em outra aba, o
   * terceiro abre para ler. Opcional porque as linhas gravadas antes disto não
   * têm o campo — `tipoDoArquivo()` em `src/lib/arquivosDoCliente.ts` deriva o
   * valor delas.
   */
  kind?: 'arquivo' | 'link' | 'nota';
}

/**
 * Anotação da agência sobre o cliente.
 *
 * Não confundir com `Client.notes`, que é um texto solto e continua onde
 * estava: aqui são blocos, cada um com título e data própria, para
 * visualizar, editar e excluir um a um.
 *
 * **Nunca sai para o Portal do Cliente.** É o que a agência escreve *sobre* o
 * cliente, e quem recorta é o banco (`portal_dados`), não a tela.
 */
export interface ClientAnnotation {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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
  /**
   * Endereço legível no link do portal, único dentro da agência.
   * Gerado e mantido pelo banco a partir do nome — ver a migração
   * 20260909200000_slug_do_cliente.sql.
   */
  slug?: string;
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
  annotations?: ClientAnnotation[];
  notes?: string;
  createdAt: string;
  /**
   * Credencial do link direto do portal. Opcional porque `portal_dados` não
   * a devolve: quem entrou no portal já provou quem é pela sessão, e mandar
   * a credencial de volta para o navegador dela não serve para nada — só
   * amplia o estrago de um vazamento de tela.
   */
  portalToken?: string;
}

/**
 * Quem entra no Portal do Cliente, e até onde vai.
 *
 * Antes o portal não tinha "quem": o token era da linha de `clients`, e todo
 * mundo que soubesse dele entrava com o mesmo poder — cofre de senhas e
 * notas fiscais incluídos. Estes dois papéis são a resposta.
 *
 *   aprovador  vê o conteúdo e aprova, e nada além disso
 *   editor     tudo do aprovador + arquivos, senhas, notas, briefing
 *              (inclusive alterar) e criar outros usuários
 *
 * O recorte é do banco, não da tela: `portal_dados` simplesmente não devolve
 * senhas, notas e briefing para o aprovador. Esconder aba com o dado já no
 * navegador seria a tela mentindo sobre o que entregou.
 */
export type ClientUserRole = 'aprovador' | 'editor';

export interface ClientUser {
  id: string;
  workspaceId: string;
  clientId: string;
  email: string;
  name?: string;
  role: ClientUserRole;
  ativo: boolean;
  createdAt: string;
  /** Última vez que a pessoa entrou — por senha ou pelo código. */
  ultimoAcesso?: string;
  /**
   * Quando a agência definiu a senha desta pessoa.
   *
   * É o que distingue "entra com e-mail e senha" de "entra pelo código que
   * chega por e-mail". O hash não vem para cá: a tela nunca precisou dele, e
   * uma tela que o carrega é material para ataque offline sem nenhum ganho.
   */
  senhaDefinidaEm?: string;
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

/**
 * O que está sendo aprovado.
 *
 * O cliente olha para coisas diferentes em cada um: `conteudo` tem arte
 * pronta, `copy` e `roteiro` são texto — pedir aprovação de imagem neles
 * seria pedir aprovação de algo que não existe.
 */
export type JobTipo = 'conteudo' | 'copy' | 'roteiro';

export interface Job {
  id: string;
  workspaceId: string;
  clientId: string;
  title: string;
  tipo: JobTipo;
  campaign?: string;
  /**
   * Canal principal. Kanban, portal, relatórios e fila de publicação leem
   * daqui — é sempre o primeiro de `canais`.
   */
  platform: JobPlatform;
  /** Todos os canais escolhidos. Um conteúdo pode ir para mais de uma rede. */
  canais?: JobPlatform[];
  format: JobFormat;
  status: JobStatus;
  priority: JobPriority;
  targetAudience?: string;
  funnelStage?: 'topo' | 'meio' | 'fundo';
  
  /**
   * Campos que só existem numa rede: localização e capa do Reel no Instagram,
   * thumbnail e visibilidade no YouTube, tipo de publicação no LinkedIn.
   * O catálogo do que cabe aqui está em `lib/camposDoCanal.ts`.
   */
  configuracoes?: Record<string, unknown>;

  // Content details
  caption: string;
  /**
   * Texto de trabalho do conteúdo: rascunho da legenda, gancho, o que o
   * cliente falou na reunião.
   *
   * **Nunca é publicado.** Quem vai para a rede é `caption` — os dois num
   * campo só significaria publicar o rascunho junto na primeira vez que
   * alguém esquecesse de apagar, e o que sai no perfil do cliente não volta.
   */
  draft?: string;
  cta?: string;
  hashtags: string[];
  firstComment?: string;
  link?: string;
  mediaUrls: string[];
  /** A arte do story, quando `format` é `feed_story`. */
  storyMediaUrls?: string[];
  
  // Versions and history
  currentVersion: number;
  versions: JobVersion[];
  
  // Dates
  createdAt: string;
  /**
   * Quando a peça mudou pela última vez.
   *
   * Carimbada pelo gatilho `jobs_carimbar_atualizacao`, no banco. É o campo
   * que responde "o cliente viu esta versão ou a de antes?" — e por isso ele
   * não podia ser `created_at` com outro rótulo.
   */
  updatedAt?: string;
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

/**
 * As telas do app da agência e as do dono do produto, num tipo só.
 *
 * O prefixo `admin_` não é decoração: é ele que decide qual casca monta —
 * `App.tsx` troca o layout inteiro quando a aba começa com `admin_`, e a
 * autorização (`platform_admins`) é conferida no mesmo ponto. Antes essas
 * telas eram um submenu recolhível dentro da barra lateral da agência, e o
 * dono do SaaS administrava o produto de dentro de uma agência qualquer,
 * com o seletor de clientes e o "Novo Conteúdo" na tela.
 */
export type TabType = 
  | 'dashboard' 
  | 'calendario' 
  | 'producao' 
  | 'biblioteca'
  | 'clientes' 
  | 'comercial' 
  | 'publicacoes' 
  | 'relatorios' 
  | 'automacoes' 
  | 'configuracoes'
  | 'admin_agencias'
  | 'admin_usuarios'
  | 'admin_planos'
  | 'admin_financeiro'
  | 'admin_relatorios'
  | 'admin_emails'
  | 'admin_integracoes'
  | 'admin_seo'
  | 'admin_design';

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

