import { 
  Workspace, 
  User, 
  Client, 
  Job, 
  Lead, 
  Proposal, 
  Contract, 
  Automation, 
  Notification, 
  ActivityLog 
} from '../types';

export const initialWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Orquesia Ops',
    slug: 'orquesia-ops',
    logo: 'https://i.pinimg.com/736x/dd/6e/b3/dd6eb385dafdfd1cce83c084d0021670.jpg',
    primaryColor: '#6366f1',
    customDomain: 'app.orquesia.com.br',
    whiteLabel: true,
    timezone: 'America/Sao_Paulo',
  },
  {
    id: 'ws-2',
    name: 'Studio Lumina Growth',
    slug: 'studio-lumina',
    logo: 'https://i.pinimg.com/736x/dd/6e/b3/dd6eb385dafdfd1cce83c084d0021670.jpg',
    primaryColor: '#0ea5e9',
    whiteLabel: false,
    timezone: 'America/Sao_Paulo',
  }
];

export const initialUsers: User[] = [
  {
    id: 'u-1',
    name: 'Airton Maia (Super Admin)',
    email: 'airtonmaiamt@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    role: 'owner',
    workspaceId: 'ws-1',
  },
  {
    id: 'u-2',
    name: 'Lucas Brandão',
    email: 'lucas@vanguardasocial.com.br',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    role: 'designer',
    workspaceId: 'ws-1',
  },
  {
    id: 'u-3',
    name: 'Beatriz Vasconcelos',
    email: 'beatriz@vanguardasocial.com.br',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    role: 'copywriter',
    workspaceId: 'ws-1',
  },
  {
    id: 'u-4',
    name: 'Mariana Lima',
    email: 'mariana@vanguardasocial.com.br',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    role: 'social_media',
    workspaceId: 'ws-1',
  },
];

export const initialClients: Client[] = [
  {
    id: 'c-1',
    workspaceId: 'ws-1',
    name: 'Café Aroma Gourmet',
    legalName: 'Aroma Alimentos & Bebidas Eireli',
    tradeName: 'Aroma Gourmet Café',
    email: 'marketing@aromacafe.com.br',
    phone: '(11) 98765-4321',
    avatar: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=120&auto=format&fit=crop&q=80',
    status: 'active',
    segment: 'Gastronomia & Cafés Especiais',
    website: 'https://aromacafe.com.br',
    internalResponsibleId: 'u-4',
    healthScore: 'green',
    services: [
      { id: 's-1', name: 'Gestão de Redes Sociais Completa', monthlyValue: 4500, startDate: '2025-01-15', recurrence: 'monthly' },
      { id: 's-2', name: 'Produção Fotográfica Mensal', monthlyValue: 1800, startDate: '2025-02-01', recurrence: 'monthly' }
    ],
    cpfCnpj: '12.345.678/0001-90',
    contacts: [
      { id: 'ct-1', name: 'Rodrigo Siqueira', email: 'rodrigo@aromacafe.com.br', phone: '(11) 98888-1122', role: 'Diretor de Marketing', isPrimary: true }
    ],
    files: [
      { id: 'f-1', name: 'Manual de Marca Aroma 2025.pdf', category: 'identidade_visual', url: 'https://drive.google.com', size: '14.2 MB', uploadedAt: '2025-01-10' },
      { id: 'f-2', name: 'Fotos Oficiais Grãos & Cafeteria.zip', category: 'fotos', url: 'https://drive.google.com', size: '280 MB', uploadedAt: '2025-02-05' },
      { id: 'f-3', name: 'Pasta Geral Google Drive', category: 'documentos', url: 'https://drive.google.com', size: '1.2 GB', uploadedAt: '2025-02-15' }
    ],
    passwords: [
      { id: 'p-1', service: 'Instagram (@aromacafegourmet)', username: 'aromacafegourmet', password: 'AromaCafe#2025!', url: 'https://instagram.com', notes: 'Conta principal de anúncios vinculada', updatedAt: '2025-02-01' },
      { id: 'p-2', service: 'Meta Business Suite', username: 'financeiro@aromacafe.com.br', password: 'MetaBusiness@88', url: 'https://business.facebook.com', notes: 'Gerenciador da agência configurado', updatedAt: '2025-01-20' }
    ],
    invoices: [
      { id: 'inv-1', number: 'NFS-e #2025-001', monthRef: 'Fevereiro/2026', value: 6300, issueDate: '2026-02-05', dueDate: '2026-02-15', status: 'pago', fileUrl: '#' },
      { id: 'inv-2', number: 'NFS-e #2025-002', monthRef: 'Março/2026', value: 6300, issueDate: '2026-03-05', dueDate: '2026-03-15', status: 'pendente', fileUrl: '#' }
    ],
    briefing: {
      brandVoice: 'Acolhedor, sofisticado, especialista em cafés especiais e aromas artesanais. Tom próximo porém educador.',
      targetAudience: 'Amantes de café especial, profissionais liberais e entusiastas gastronômicos entre 25 e 50 anos.',
      painPoints: 'Dificuldade de encontrar cafés de torra fresca de alta qualidade sem complicação técnica.',
      competitors: 'CoffeeLab, Santo Grão, IL Barista.',
      brandGuidelines: 'Usar sempre paleta terrosa (#4A2C11, #D4A373, #FAEDCD). Proibido usar fontes sem serifa muito infantis.',
      monthlyGoals: 'Crescer 15% nas vendas do e-commerce e engajar na nova linha de cafés fermentados.',
      updatedAt: '2025-02-10'
    },
    notes: 'Cliente muito rigoroso com a paleta terrosa e iluminação quente das fotos.',
    createdAt: '2025-01-15',
    portalToken: 'aroma-gourmet-token-9988'
  },
  {
    id: 'c-2',
    workspaceId: 'ws-1',
    name: 'NeonPay Fintech',
    legalName: 'NeonPay Soluções Financeiras S/A',
    email: 'growth@neonpay.com.br',
    phone: '(11) 3234-9000',
    avatar: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=120&auto=format&fit=crop&q=80',
    status: 'active',
    segment: 'Fintech & Pagamentos B2B',
    website: 'https://neonpay.io',
    internalResponsibleId: 'u-1',
    healthScore: 'yellow',
    services: [
      { id: 's-3', name: 'Social Media B2B (LinkedIn + Instagram)', monthlyValue: 7200, startDate: '2025-03-01', recurrence: 'monthly' },
      { id: 's-4', name: 'E-books & Artigos Técnicos', monthlyValue: 3500, startDate: '2025-03-01', recurrence: 'monthly' }
    ],
    contacts: [
      { id: 'ct-2', name: 'Fernanda Meirelles', email: 'fernanda@neonpay.io', phone: '(11) 97777-4433', role: 'Head of Growth', isPrimary: true }
    ],
    notes: 'Demora em média 3 dias para aprovar postagens que envolvem dados de mercado.',
    createdAt: '2025-03-01',
    portalToken: 'neonpay-token-4412'
  },
  {
    id: 'c-3',
    workspaceId: 'ws-1',
    name: 'Dra. Camila Ramos Dermatologia',
    legalName: 'Instituto Dermatológico Camila Ramos',
    email: 'contato@dracamilaramos.com.br',
    phone: '(21) 99123-8877',
    avatar: 'https://images.unsplash.com/photo-1594824813689-536979e273ff?w=120&auto=format&fit=crop&q=80',
    status: 'active',
    segment: 'Saúde & Dermatologia Estética',
    website: 'https://dracamilaramos.com.br',
    internalResponsibleId: 'u-3',
    healthScore: 'green',
    services: [
      { id: 's-5', name: 'Social Media & Roteiros de Reels', monthlyValue: 5200, startDate: '2024-11-10', recurrence: 'monthly' }
    ],
    contacts: [
      { id: 'ct-3', name: 'Camila Ramos', email: 'camila@dracamilaramos.com.br', phone: '(21) 99123-8877', role: 'Médica Titular', isPrimary: true }
    ],
    notes: 'Aprovação quase sempre no mesmo dia. Adora conteúdos informativos e mitos/verdades.',
    createdAt: '2024-11-10',
    portalToken: 'dra-camila-token-7711'
  },
  {
    id: 'c-4',
    workspaceId: 'ws-1',
    name: 'EcoModa Brasil',
    legalName: 'EcoModa Confecções Sustentáveis Ltda',
    email: 'brand@ecomodabrasil.com.br',
    phone: '(47) 98456-1234',
    avatar: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=120&auto=format&fit=crop&q=80',
    status: 'active',
    segment: 'Moda Sustentável & E-commerce',
    website: 'https://ecomodabrasil.com.br',
    internalResponsibleId: 'u-4',
    healthScore: 'red',
    services: [
      { id: 's-6', name: 'Gestão Instagram + TikTok + Tráfego', monthlyValue: 6800, startDate: '2025-02-15', recurrence: 'monthly' }
    ],
    contacts: [
      { id: 'ct-4', name: 'Juliana Castro', email: 'juliana@ecomodabrasil.com.br', phone: '(47) 98456-1234', role: 'Fundadora & Estilista', isPrimary: true }
    ],
    notes: 'Apresentou 6 pedidos de ajuste na última semana por alteração tardia de coleção.',
    createdAt: '2025-02-15',
    portalToken: 'ecomoda-token-1290'
  }
];

// Helper to calculate realistic ISO dates around current time
const now = new Date();
const getOffsetDate = (days: number, hours: number = 10, minutes: number = 0): string => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

export const initialJobs: Job[] = [
  {
    id: 'job-1',
    workspaceId: 'ws-1',
    clientId: 'c-1',
    title: 'Guia de Métodos de Filtragem de Café Especial',
    campaign: 'Cultura do Grão 2025',
    platform: 'instagram',
    format: 'carousel',
    status: 'scheduled',
    priority: 'high',
    targetAudience: 'Amantes de café especial e público gourmet',
    funnelStage: 'meio',
    caption: `Qual o seu método favorito para extrair o melhor de cada grão? ☕✨\n\nNeste guia prático, desvendamos as diferenças entre V60, Prensa Francesa, Aeropress e Chemex. A moagem correta e a temperatura da água fazem toda a mágica acontecer!\n\n👉 Arraste para o lado e salve este post para o seu café da manhã de amanhã.`,
    cta: 'Salve este carrossel para consultar no próximo preparo!',
    hashtags: ['#CafeEspecial', '#MetodosDePreparo', '#V60', '#AromaGourmet', '#BaristaBrasil'],
    firstComment: 'Comente aqui: qual método você mais usa em casa?',
    mediaUrls: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 2,
    versions: [
      {
        versionNumber: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80'],
        caption: 'Conheça os métodos de café.',
        submittedBy: 'Lucas Brandão',
        submittedAt: getOffsetDate(-3, 11),
        feedback: 'Faltou incluir a Aeropress no carrossel e destacar a temperatura ideal de 92°C.',
        status: 'rejected'
      },
      {
        versionNumber: 2,
        mediaUrls: [
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&auto=format&fit=crop&q=80'
        ],
        caption: 'Qual o seu método favorito para extrair o melhor de cada grão? ☕✨...',
        submittedBy: 'Lucas Brandão',
        submittedAt: getOffsetDate(-2, 15),
        feedback: 'Perfeito! Aprovado com louvor.',
        status: 'approved'
      }
    ],
    createdAt: getOffsetDate(-4, 9),
    deadlineProduction: getOffsetDate(-2, 12),
    deadlineApproval: getOffsetDate(-1, 18),
    scheduledDate: getOffsetDate(1, 10, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-4',
    checklist: [
      { id: 'chk-1', title: 'Redação da legenda e CTAs', completed: true },
      { id: 'chk-2', title: 'Design das 5 lâminas do carrossel', completed: true },
      { id: 'chk-3', title: 'Aprovação com Rodrigo (Cliente)', completed: true },
      { id: 'chk-4', title: 'Agendamento na fila Instagram', completed: true }
    ],
    comments: [
      {
        id: 'cm-1',
        authorName: 'Rodrigo Siqueira (Cliente)',
        authorRole: 'client',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        isClient: true,
        text: 'A versão 2 ficou impecável, parabéns ao Lucas e Beatriz!',
        createdAt: getOffsetDate(-1, 14, 30)
      }
    ]
  },
  {
    id: 'job-2',
    workspaceId: 'ws-1',
    clientId: 'c-2',
    title: 'Infográfico: Redução de Custos com Pix Automático B2B',
    campaign: 'Eficiência Financeira 2025',
    platform: 'linkedin',
    format: 'feed',
    status: 'for_approval',
    priority: 'high',
    targetAudience: 'CFOs, Diretores Financeiros e Gerentes de Tesouraria',
    funnelStage: 'fundo',
    caption: `Quanto a sua empresa gasta hoje com conciliação manual de boletos e TEDs? 📊\n\nCom o Pix Automático da NeonPay, empresas de médio e grande porte estão reduzindo em até 42% o custo operacional de cobrança recorrente, além de zerar a inadimplência involuntária.\n\nConfira os dados consolidados do nosso último benchmark no gráfico abaixo. 👇`,
    cta: 'Acesse o link nos comentários para falar com um especialista em tesouraria moderna.',
    hashtags: ['#Fintech', '#PixAutomatico', '#GestaoFinanceira', '#B2B', '#CFO'],
    firstComment: 'Solicite uma demonstração exclusiva com nossa equipe comercial no link: neonpay.io/demo',
    mediaUrls: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80'],
        caption: 'Quanto a sua empresa gasta hoje com conciliação manual de boletos e TEDs? 📊...',
        submittedBy: 'Beatriz Vasconcelos',
        submittedAt: getOffsetDate(-1, 16),
        status: 'pending'
      }
    ],
    createdAt: getOffsetDate(-2, 10),
    deadlineProduction: getOffsetDate(-1, 12),
    deadlineApproval: getOffsetDate(0, 18),
    scheduledDate: getOffsetDate(2, 9, 30),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-1',
    checklist: [
      { id: 'chk-5', title: 'Pesquisa de benchmark com equipe de produto', completed: true },
      { id: 'chk-6', title: 'Criação do infográfico vetorial', completed: true },
      { id: 'chk-7', title: 'Aprovação com Fernanda (Head of Growth)', completed: false }
    ],
    comments: []
  },
  {
    id: 'job-3',
    workspaceId: 'ws-1',
    clientId: 'c-3',
    title: 'Reel: 3 Mitos Comuns sobre Protetor Solar no Inverno',
    campaign: 'Pele Saudável Todo Dia',
    platform: 'instagram',
    format: 'reel',
    status: 'for_approval',
    priority: 'urgent',
    targetAudience: 'Mulheres e homens 25-55 anos interessados em skincare preventivo',
    funnelStage: 'topo',
    caption: `Você sabia que a radiação UVA atravessa vidros e nuvens mesmo nos dias nublados ou frios? ☀️☁️\n\nA Dra. Camila Ramos esclarece os 3 principais mitos que podem acelerar o envelhecimento da sua pele e o surgimento de manchas indesejadas.\n\nAssista até o final e descubra a textura de protetor ideal para o seu tipo de pele!`,
    cta: 'Envie este vídeo para aquela amiga que só passa protetor na praia!',
    hashtags: ['#Dermatologia', '#SkincareDicas', '#DraCamilaRamos', '#ProtetorSolar', '#PelePerfeita'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80'],
        caption: 'Você sabia que a radiação UVA atravessa vidros e nuvens...',
        submittedBy: 'Beatriz Vasconcelos',
        submittedAt: getOffsetDate(-1, 17, 30),
        status: 'pending'
      }
    ],
    createdAt: getOffsetDate(-2, 14),
    deadlineProduction: getOffsetDate(-1, 12),
    deadlineApproval: getOffsetDate(0, 15),
    scheduledDate: getOffsetDate(1, 18, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-4',
    checklist: [
      { id: 'chk-8', title: 'Edição dinâmica de cortes com legendas automáticas', completed: true },
      { id: 'chk-9', title: 'Trilha sonora em alta no Instagram Reels', completed: true },
      { id: 'chk-10', title: 'Aprovação médica Dra. Camila', completed: false }
    ],
    comments: []
  },
  {
    id: 'job-4',
    workspaceId: 'ws-1',
    clientId: 'c-4',
    title: 'Carrossel: Como Nossos Tecidos de Linho Puro Reduzem o Impacto Ambiental',
    campaign: 'Coleção Raízes do Brasil',
    platform: 'instagram',
    format: 'carousel',
    status: 'in_adjustment',
    priority: 'high',
    targetAudience: 'Consumidores conscientes e amantes de moda sustentável',
    funnelStage: 'meio',
    caption: `Menos água, zero químicos pesados e 100% de compostabilidade. Conheça a cadeia produtiva por trás do linho da EcoModa. 🌱👗`,
    cta: 'Conheça as novas peças na nossa bio com frete neutro em carbono.',
    hashtags: ['#ModaSustentavel', '#EcoModa', '#LinhoPuro', '#ConsumoConsciente'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'],
        caption: 'Menos água, zero químicos pesados...',
        submittedBy: 'Lucas Brandão',
        submittedAt: getOffsetDate(-1, 18),
        feedback: 'Precisa trocar a 2ª imagem: a cor da blusa mostrada não é da nova coleção de inverno, colocar o modelo terracota.',
        status: 'rejected'
      }
    ],
    lastFeedback: 'Precisa trocar a 2ª imagem: a cor da blusa mostrada não é da nova coleção de inverno, colocar o modelo terracota.',
    createdAt: getOffsetDate(-3, 8),
    deadlineProduction: getOffsetDate(-1, 14),
    deadlineApproval: getOffsetDate(0, 16),
    scheduledDate: getOffsetDate(2, 14, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-4',
    checklist: [
      { id: 'chk-11', title: 'Substituir slide 2 pela foto da blusa terracota', completed: false },
      { id: 'chk-12', title: 'Atualizar link do catálogo na legenda', completed: true }
    ],
    comments: [
      {
        id: 'cm-2',
        authorName: 'Juliana Castro (Cliente)',
        authorRole: 'client',
        authorAvatar: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=120&auto=format&fit=crop&q=80',
        isClient: true,
        text: 'Por favor ajustem a foto do slide 2 para a peça terracota que acabamos de lançar!',
        createdAt: getOffsetDate(-1, 19, 10)
      }
    ]
  },
  {
    id: 'job-5',
    workspaceId: 'ws-1',
    clientId: 'c-1',
    title: 'Reel de Bastidores: A Chegada da Nova Safra Bourbon Amarelo',
    campaign: 'Cafés Selecionados',
    platform: 'tiktok',
    format: 'reel',
    status: 'in_production',
    priority: 'medium',
    targetAudience: 'Jovens apaixonados por cafés diferenciados',
    funnelStage: 'topo',
    caption: `Chegou o lote mais esperado do ano: Bourbon Amarelo de altitude direto do Sul de Minas! 💛 Notas sensoriais de mel e frutas amarelas que vão explodir no seu paladar.`,
    cta: 'Peça no delivery ou venha tomar um espresso fresquinho na nossa unidade Jardins!',
    hashtags: ['#BourbonAmarelo', '#CafeDeEspecialidade', '#BaristaLife', '#TikTokFood'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1518832553480-cd0e625ed3e6?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [],
    createdAt: getOffsetDate(-1, 10),
    deadlineProduction: getOffsetDate(1, 18),
    deadlineApproval: getOffsetDate(2, 16),
    scheduledDate: getOffsetDate(4, 11, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-4',
    checklist: [
      { id: 'chk-13', title: 'Coleta de vídeos brutos na cafeteria', completed: true },
      { id: 'chk-14', title: 'Edição de som com ASMR de moagem', completed: false }
    ],
    comments: []
  },
  {
    id: 'job-6',
    workspaceId: 'ws-1',
    clientId: 'c-2',
    title: 'Artigo LinkedIn: Como a IA está Redefinindo a Análise de Risco de Crédito',
    campaign: 'Thought Leadership Fintech',
    platform: 'linkedin',
    format: 'article',
    status: 'ideas',
    priority: 'medium',
    targetAudience: 'Líderes de risco e compliance financeiro',
    funnelStage: 'topo',
    caption: `Artigo assinado pelo CTO da NeonPay sobre o uso de redes neurais na prevenção de fraudes em pagamentos instantâneos.`,
    hashtags: ['#Fintech', '#ArtificialIntelligence', '#Credito', '#InovacaoB2B'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 0,
    versions: [],
    createdAt: getOffsetDate(0, 9),
    deadlineProduction: getOffsetDate(4, 18),
    deadlineApproval: getOffsetDate(6, 18),
    scheduledDate: getOffsetDate(8, 10, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-1',
    checklist: [
      { id: 'chk-15', title: 'Entrevista de 20 min com CTO', completed: false },
      { id: 'chk-16', title: 'Primeiro rascunho de 800 palavras', completed: false }
    ],
    comments: []
  },
  {
    id: 'job-7',
    workspaceId: 'ws-1',
    clientId: 'c-3',
    title: 'Carrossel: Cuidados Pós-Laser e Peeling Químico',
    campaign: 'Procedimentos de Inverno',
    platform: 'instagram',
    format: 'carousel',
    status: 'published',
    priority: 'high',
    targetAudience: 'Pacientes de dermatologia clínica e estética',
    funnelStage: 'meio',
    caption: `Fez procedimento nesta semana? Salve este passo a passo essencial para garantir cicatrização uniforme e luminosidade radiante sem manchas!`,
    cta: 'Dúvidas? Deixe sua pergunta aqui nos comentários ou agende sua revisão.',
    hashtags: ['#PosPeeling', '#LaserCO2', '#CuidadosComAPele', '#DraCamilaRamos'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1512290900672-1f023338b152?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1512290900672-1f023338b152?w=800&auto=format&fit=crop&q=80'],
        caption: 'Fez procedimento nesta semana?...',
        submittedBy: 'Mariana Lima',
        submittedAt: getOffsetDate(-3, 10),
        status: 'approved'
      }
    ],
    createdAt: getOffsetDate(-5, 9),
    deadlineProduction: getOffsetDate(-4, 12),
    deadlineApproval: getOffsetDate(-3, 18),
    scheduledDate: getOffsetDate(-2, 19, 0),
    publishedDate: getOffsetDate(-2, 19, 2),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-4',
    checklist: [
      { id: 'chk-17', title: 'Revisão técnica das substâncias cicatrizantes', completed: true },
      { id: 'chk-18', title: 'Aprovação com Dra. Camila', completed: true },
      { id: 'chk-19', title: 'Publicação realizada', completed: true }
    ],
    comments: []
  },
  {
    id: 'job-8',
    workspaceId: 'ws-1',
    clientId: 'c-1',
    title: 'Story Interativo: Enquete Qual o Seu Momento Café?',
    campaign: 'Interação Semanal',
    platform: 'instagram',
    format: 'story',
    status: 'scheduled',
    priority: 'medium',
    targetAudience: 'Seguidores da página',
    funnelStage: 'topo',
    caption: 'Enquete interativa nos stories: Manhã bem cedo ou pausa das 15h? Com stick de reação e caixa de perguntas.',
    hashtags: ['#AromaCafe', '#MomentoCafe'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80'],
        caption: 'Story com sticker de enquete.',
        submittedBy: 'Lucas Brandão',
        submittedAt: getOffsetDate(-1, 14),
        status: 'approved'
      }
    ],
    createdAt: getOffsetDate(-2, 11),
    deadlineProduction: getOffsetDate(-1, 12),
    deadlineApproval: getOffsetDate(0, 12),
    scheduledDate: getOffsetDate(0, 15, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-4',
    checklist: [],
    comments: []
  },
  {
    id: 'job-9',
    workspaceId: 'ws-1',
    clientId: 'c-2',
    title: 'Vídeo YouTube: Demonstração da API de Pagamentos Recorrentes',
    campaign: 'Dev Experience NeonPay',
    platform: 'youtube',
    format: 'video',
    status: 'in_production',
    priority: 'medium',
    targetAudience: 'Desenvolvedores e CTOs integradores',
    funnelStage: 'fundo',
    caption: 'Tutorial passo a passo de integração com SDK Node.js e Webhooks em menos de 10 minutos.',
    hashtags: ['#API', '#Dev', '#Pagamentos', '#NeonPay'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80'
    ],
    currentVersion: 1,
    versions: [],
    createdAt: getOffsetDate(-1, 15),
    deadlineProduction: getOffsetDate(3, 18),
    deadlineApproval: getOffsetDate(5, 12),
    scheduledDate: getOffsetDate(6, 16, 0),
    designerId: 'u-2',
    copywriterId: 'u-3',
    socialMediaId: 'u-1',
    checklist: [
      { id: 'chk-20', title: 'Gravação da tela de código', completed: true },
      { id: 'chk-21', title: 'Motion graphics de introdução', completed: false }
    ],
    comments: []
  }
];

export const initialLeads: Lead[] = [
  {
    id: 'lead-1',
    workspaceId: 'ws-1',
    name: 'Gabriel Faria',
    company: 'Vanguard Investimentos Imobiliários',
    email: 'gabriel@vanguardimoveis.com.br',
    phone: '(11) 99345-6789',
    source: 'Indicação de Cliente',
    serviceInterest: 'Gestão de Redes + Tráfego Pago para Lançamentos de Luxo',
    estimatedValue: 8500,
    stage: 'proposta_enviada',
    responsibleId: 'u-1',
    notes: 'Reunião excelente na terça. Apresentamos case de sucesso do setor.',
    createdAt: getOffsetDate(-6)
  },
  {
    id: 'lead-2',
    workspaceId: 'ws-1',
    name: 'Dra. Patrícia Fontes',
    company: 'Clínica Fontes Odontologia Integrada',
    email: 'patricia@clinicafontes.com.br',
    phone: '(19) 98123-4567',
    source: 'Instagram da Agência',
    serviceInterest: 'Social Media & Roteiros de Vídeos Curtos',
    estimatedValue: 4900,
    stage: 'reuniao',
    responsibleId: 'u-1',
    notes: 'Quer focar em Invisalign e reabilitação estética oral.',
    createdAt: getOffsetDate(-3)
  },
  {
    id: 'lead-3',
    workspaceId: 'ws-1',
    name: 'Eduardo Martins',
    company: 'Cervejaria Artesanal Lúpulo Real',
    email: 'eduardo@lupuloreal.com.br',
    phone: '(31) 97654-3210',
    source: 'Google Ads',
    serviceInterest: 'Branding e Redes Sociais',
    estimatedValue: 5500,
    stage: 'contato',
    responsibleId: 'u-4',
    notes: 'Primeiro contato realizado via WhatsApp.',
    createdAt: getOffsetDate(-1)
  }
];

export const initialProposals: Proposal[] = [
  {
    id: 'prop-1',
    workspaceId: 'ws-1',
    leadId: 'lead-1',
    clientName: 'Vanguard Investimentos Imobiliários',
    title: 'Proposta Comercial: Operação Estratégica de Conteúdo & Performance High-End',
    totalMonthlyValue: 8500,
    status: 'sent',
    validUntil: getOffsetDate(10),
    createdAt: getOffsetDate(-4),
    items: [
      { id: 'pi-1', service: 'Gestão Instagram + LinkedIn', description: '16 conteúdos mensais, incluindo carrosséis analíticos e reels de imóveis.', quantity: 1, monthlyValue: 5500 },
      { id: 'pi-2', service: 'Estratégia & Gestão de Tráfego Pago', description: 'Otimização diária de campanhas Meta Ads e Google Search para captação de investidores.', quantity: 1, monthlyValue: 3000 }
    ]
  },
  {
    id: 'prop-2',
    workspaceId: 'ws-1',
    clientId: 'c-1',
    clientName: 'Café Aroma Gourmet',
    title: 'Aditivo: Expansão para Canal TikTok e Cobertura de Eventos',
    totalMonthlyValue: 2200,
    status: 'accepted',
    validUntil: getOffsetDate(5),
    createdAt: getOffsetDate(-12),
    acceptedAt: getOffsetDate(-8),
    items: [
      { id: 'pi-3', service: 'Produção TikTok', description: '8 vídeos mensais focados em tendências e ASMR de café.', quantity: 1, monthlyValue: 2200 }
    ]
  }
];

export const initialContracts: Contract[] = [
  {
    id: 'cont-1',
    workspaceId: 'ws-1',
    clientId: 'c-1',
    clientName: 'Café Aroma Gourmet',
    title: 'Contrato de Prestação de Serviços de Marketing Digital e Gestão de Conteúdo',
    monthlyValue: 6300,
    startDate: '2025-01-15',
    endDate: '2026-01-14',
    status: 'signed',
    signedAt: '2025-01-14'
  },
  {
    id: 'cont-2',
    workspaceId: 'ws-1',
    clientId: 'c-2',
    clientName: 'NeonPay Fintech',
    title: 'Contrato Anual de Inbound Marketing e Social Media B2B',
    monthlyValue: 10700,
    startDate: '2025-03-01',
    endDate: '2026-02-28',
    status: 'signed',
    signedAt: '2025-02-28'
  },
  {
    id: 'cont-3',
    workspaceId: 'ws-1',
    clientId: 'c-3',
    clientName: 'Dra. Camila Ramos Dermatologia',
    title: 'Contrato de Produção Audiovisual e Posicionamento Médico',
    monthlyValue: 5200,
    startDate: '2024-11-10',
    endDate: '2025-11-09',
    status: 'signed',
    signedAt: '2024-11-08'
  }
];

export const initialAutomations: Automation[] = [
  {
    id: 'auto-1',
    workspaceId: 'ws-1',
    title: 'Notificar cliente quando Job entrar em "Para Aprovação"',
    trigger: 'Status do Job alterado para "Para Aprovação"',
    action: 'Disparar e-mail e gerar link seguro para o Portal do Cliente',
    enabled: true,
    lastRunAt: getOffsetDate(-1, 16, 30),
    executionCount: 47
  },
  {
    id: 'auto-2',
    workspaceId: 'ws-1',
    title: 'Mover automaticamente para "Agendado" quando Cliente Aprovar',
    trigger: 'Cliente clica em "Aprovar Conteúdo"',
    action: 'Mudar status para "Aprovado" e enfileirar para agendamento',
    enabled: true,
    lastRunAt: getOffsetDate(-2, 15, 10),
    executionCount: 39
  },
  {
    id: 'auto-3',
    workspaceId: 'ws-1',
    title: 'Converter Proposta Aceita em Cliente e Iniciar Onboarding',
    trigger: 'Status da Proposta comercial alterado para "Aceita"',
    action: 'Criar cadastro do cliente, gerar minuta de contrato e criar checklist inicial',
    enabled: true,
    lastRunAt: getOffsetDate(-8, 14, 0),
    executionCount: 12
  },
  {
    id: 'auto-4',
    workspaceId: 'ws-1',
    title: 'Alerta de Retrabalho Elevado',
    trigger: 'Job atinge a Versão 3 (v3) sem aprovação',
    action: 'Marcar cliente com status Amarelo/Vermelho e notificar Gestor de Conta',
    enabled: true,
    lastRunAt: getOffsetDate(-1, 19, 15),
    executionCount: 6
  }
];

export const initialNotifications: Notification[] = [
  {
    id: 'notif-1',
    workspaceId: 'ws-1',
    title: 'Ajuste solicitado por EcoModa Brasil',
    message: 'Juliana Castro solicitou alteração na 2ª imagem do carrossel de Linho Puro.',
    type: 'adjustment',
    read: false,
    createdAt: getOffsetDate(-1, 19, 10),
    linkContext: { tab: 'aprovacoes', jobId: 'job-4', clientId: 'c-4' }
  },
  {
    id: 'notif-2',
    workspaceId: 'ws-1',
    title: 'Conteúdo Aprovado!',
    message: 'Rodrigo Siqueira (Café Aroma) aprovou a versão 2 do Guia de Métodos.',
    type: 'approval',
    read: false,
    createdAt: getOffsetDate(-1, 14, 30),
    linkContext: { tab: 'aprovacoes', jobId: 'job-1', clientId: 'c-1' }
  },
  {
    id: 'notif-3',
    workspaceId: 'ws-1',
    title: 'Publicação realizada com sucesso',
    message: 'Carrossel "Cuidados Pós-Laser" foi publicado no perfil @dracamilaramos.',
    type: 'publication',
    read: true,
    createdAt: getOffsetDate(-2, 19, 2),
    linkContext: { tab: 'publicacoes', jobId: 'job-7', clientId: 'c-3' }
  },
  {
    id: 'notif-4',
    workspaceId: 'ws-1',
    title: 'Novo Lead Quente Cadastrado',
    message: 'Gabriel Faria (Vanguard Imóveis) visualizou a proposta comercial enviada.',
    type: 'lead',
    read: true,
    createdAt: getOffsetDate(-3, 10, 15),
    linkContext: { tab: 'comercial' }
  }
];

export const initialActivityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    workspaceId: 'ws-1',
    userName: 'Juliana Castro (Cliente)',
    action: 'Solicitou ajuste na Versão 1',
    target: 'Job: Carrossel Linho Puro',
    timestamp: getOffsetDate(-1, 19, 10)
  },
  {
    id: 'log-2',
    workspaceId: 'ws-1',
    userName: 'Beatriz Vasconcelos',
    action: 'Enviou para aprovação',
    target: 'Job: Infográfico Pix Automático B2B',
    timestamp: getOffsetDate(-1, 16, 0)
  },
  {
    id: 'log-3',
    workspaceId: 'ws-1',
    userName: 'Rodrigo Siqueira (Cliente)',
    action: 'Aprovou o conteúdo',
    target: 'Job: Guia de Métodos de Filtragem',
    timestamp: getOffsetDate(-1, 14, 30)
  },
  {
    id: 'log-4',
    workspaceId: 'ws-1',
    userName: 'Lucas Brandão',
    action: 'Fez upload de nova versão (v2)',
    target: 'Job: Guia de Métodos de Filtragem',
    timestamp: getOffsetDate(-2, 15, 0)
  },
  {
    id: 'log-5',
    workspaceId: 'ws-1',
    userName: 'Arthur Prado',
    action: 'Gerou e enviou proposta comercial',
    target: 'Proposta: Vanguard Investimentos',
    timestamp: getOffsetDate(-4, 11, 30)
  }
];

export const initialClientMaterials: any[] = [
  {
    id: 'mat-1',
    clientId: 'c-1',
    clientName: 'Aura Café Especial',
    title: 'Fotos da Inauguração da Nova Torrefação',
    description: 'Fotos em alta resolução tiradas pelo fotógrafo no evento de sábado.',
    fileUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
    fileType: 'image',
    uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'recebido'
  },
  {
    id: 'mat-2',
    clientId: 'c-1',
    clientName: 'Aura Café Especial',
    title: 'Vídeo do Barista preparando Cold Brew',
    description: 'Vídeo na vertical (9:16) em 4K para usar como Reels ou Stories.',
    fileUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    fileType: 'video',
    uploadedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: 'recebido'
  }
];

export const initialTimesheetLogs: any[] = [
  {
    id: 'ts-1',
    jobId: 'job-1',
    jobTitle: 'Carrossel: Segredos da Extração em V60',
    clientId: 'c-1',
    clientName: 'Aura Café Especial',
    userId: 'u-2',
    userName: 'Lucas Brandão (Designer)',
    minutes: 75,
    notes: 'Criação dos 6 slides e tratamento das fotos de grãos',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'ts-2',
    jobId: 'job-1',
    jobTitle: 'Carrossel: Segredos da Extração em V60',
    clientId: 'c-1',
    clientName: 'Aura Café Especial',
    userId: 'u-3',
    userName: 'Beatriz Vasconcelos (Copywriter)',
    minutes: 40,
    notes: 'Redação da copy persuasiva e gancho inicial',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  }
];

