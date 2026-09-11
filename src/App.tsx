import React, { useState, useEffect, Suspense } from 'react';
import { PostfyProvider, usePostfy } from './context/PostfyContext';
import { safeTimeFormat } from './lib/utils';
import { 
  Sun,
  Moon,
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Kanban, 
  CheckCircle2, 
  Users, 
  Briefcase, 
  Send, 
  BarChart3, 
  Zap, 
  Settings, 
  Search, 
  Bell, 
  Plus, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Crown,
  DollarSign,
  Building2,
  Mail,
  Plug,
  AlertTriangle
} from 'lucide-react';

// Modals
import { JobDetailModal } from './components/modals/JobDetailModal';
import { CreateJobModal } from './components/modals/CreateJobModal';
import { CreateWorkspaceModal } from './components/modals/CreateWorkspaceModal';
import { SearchModal } from './components/modals/SearchModal';
import { AuthModal } from './components/auth/AuthModal';
import { LoginView } from './components/auth/LoginView';
import { AcceptInviteView } from './components/auth/AcceptInviteView';
import { ChangelogModal } from './components/modals/ChangelogModal';
import { BotaoDoPortal } from './components/common/BotaoDoPortal';
import { Avatar } from './components/common/Avatar';

const CalendarApp = tela(() => import('./components/calendar/CalendarApp'), 'CalendarApp');
const DashboardView = tela(() => import('./components/dashboard/DashboardView'), 'DashboardView');
const KanbanBoard = tela(() => import('./components/kanban/KanbanBoard'), 'KanbanBoard');
const ApprovalsView = tela(() => import('./components/approvals/ApprovalsView'), 'ApprovalsView');
const ClientsView = tela(() => import('./components/clients/ClientsView'), 'ClientsView');
const CommercialView = tela(() => import('./components/commercial/CommercialView'), 'CommercialView');
const PublicationsView = tela(() => import('./components/publications/PublicationsView'), 'PublicationsView');
const ReportsView = tela(() => import('./components/reports/ReportsView'), 'ReportsView');
const AutomationsView = tela(() => import('./components/automations/AutomationsView'), 'AutomationsView');
const SettingsView = tela(() => import('./components/settings/SettingsView'), 'SettingsView');
const ClientPortalView = tela(() => import('./components/portal/ClientPortalView'), 'ClientPortalView');

/**
 * A área do dono do produto tem casca própria: barra lateral, cabeçalho e
 * menus diferentes. Vem inteira num chunk só, que quem não é admin da
 * plataforma nunca baixa.
 */
const AdminLayout = tela(() => import('./components/admin/AdminLayout'), 'AdminLayout');

const CarregandoTela: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
  </div>
);
import { TabType } from './types';
import { podeAcessarAba } from './lib/permissions';
import { WorkspaceSwitcher } from './components/layout/WorkspaceSwitcher';
import { ClientSwitcher } from './components/layout/ClientSwitcher';
import { DynamicThemeProvider } from './components/common/DynamicThemeProvider';
import { SeoDoSaas } from './components/common/SeoDoSaas';
import { VersaoDoApp } from './components/common/VersaoDoApp';
import { AvisoDeAtualizacao } from './components/common/AvisoDeAtualizacao';
import { marcarCargaBemSucedida } from './lib/atualizacao';
import { tela } from './lib/telaSobDemanda';
import { ehAbaDeAdmin } from './lib/rotas';
import { AcessoBloqueado } from './components/common/AcessoBloqueado';
import { diasAteOExpurgo } from './lib/lixeira';

const MainLayout: React.FC = () => {
  const { 
    isAuthenticated,
    isAuthLoading,
    logout,
    activeTab, 
    setActiveTab, 
    workspaces,
    currentWorkspace, 
    setCurrentWorkspace,
    currentUser, 
    agencyHealthScore, 
    jobs, 
    notifications,
    openCreateJobModal, 
    setIsSearchModalOpen,
    isClientPortalOpen,
    visualizarPortalDoCliente,
    clients,
    clientFilter,
    setClientFilter,
    theme,
    setTheme,
    syncState,
    syncError,
    isPlatformAdmin,
      isProfileModalOpen,
    setIsProfileModalOpen,
      acessoDaAgencia,
  } = usePostfy();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  // Sync dynamic favicon when whitelabel favicon is updated
  useEffect(() => {
    if (currentWorkspace?.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = currentWorkspace.favicon;
    }
  }, [currentWorkspace?.favicon]);

  // Enquanto /api/auth/me responde, não decidimos nada: sem isso a tela de
  // login pisca a cada recarregamento para quem já está autenticado.
  if (isAuthLoading && !isClientPortalOpen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Verificando sua sessão...
          </span>
        </div>
      </div>
    );
  }

  // Barreira de autenticação
  if (!isAuthenticated && !isClientPortalOpen) {
    const conviteNaUrl = new URLSearchParams(window.location.search).get('invite');
    if (conviteNaUrl) return <AcceptInviteView token={conviteNaUrl} />;
    return <LoginView />;
  }

  // Unread notifications & pending approvals count
  const unreadNotifs = notifications.filter(n => !n.read).length;
  const pendingApprovalsCount = jobs.filter(j => j.status === 'for_approval').length;
  const inAdjustmentCount = jobs.filter(j => j.status === 'in_adjustment').length;

  const abaPermitida = podeAcessarAba(currentUser?.role, activeTab as TabType);

  const todasAsAbas: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendario', label: 'Calendário', icon: CalendarIcon },
    { id: 'producao', label: 'WorkFlow', icon: Kanban },
    { 
      id: 'aprovacoes', 
      label: 'Aprovações', 
      icon: CheckCircle2, 
      badge: pendingApprovalsCount,
      badgeColor: 'bg-amber-500 text-white' 
    },
    { id: 'clientes', label: 'Clientes (360°)', icon: Users },
    { id: 'comercial', label: 'Comercial & Vendas', icon: Briefcase },
    { id: 'publicacoes', label: 'Fila de Publicações', icon: Send },
    { id: 'relatorios', label: 'Relatórios & BI', icon: BarChart3 },
    { id: 'automacoes', label: 'Automações', icon: Zap },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const navItems = todasAsAbas.filter((item) => podeAcessarAba(currentUser?.role, item.id));

  /**
   * O portal ocupa a tela sozinho.
   *
   * Ele era uma sobreposição por cima do app inteiro: a barra lateral, os
   * modais e a tela da aba ativa continuavam montando por baixo. Isso
   * significava baixar e executar a interface da agência no navegador de um
   * cliente que nunca pode vê-la — e foi assim que abrir `/portal-do-cliente`
   * quebrou por causa de um chunk do Dashboard, que não tem nada a ver com o
   * portal.
   */
  /**
   * `/admin` monta outra casca — barra lateral, cabeçalho e menus próprios.
   *
   * A troca acontece aqui, e não dentro do `main`, porque a área do dono do
   * produto não é uma aba da agência: montá-la por dentro traria junto o
   * seletor de agência, o filtro de clientes e o "Novo Conteúdo", que não
   * significam nada quando se está administrando toda a base.
   *
   * A recusa para quem não é admin da plataforma fica lá dentro, com a
   * mensagem que explica o porquê — redirecionar calado esconderia o link
   * errado.
   */
  if (ehAbaDeAdmin(activeTab)) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="w-8 h-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        }
      >
        <AdminLayout />
      </Suspense>
    );
  }

  if (isClientPortalOpen) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-200">
        <Suspense fallback={<CarregandoTela />}>
          <ClientPortalView />
        </Suspense>
      </div>
    );
  }

  /**
   * Teste vencido, assinatura cancelada ou pagamento recusado.
   *
   * Depois do `/admin` e do portal de propósito. O admin da plataforma não
   * pode perder a própria área por causa de uma agência de teste dele, e o
   * cliente que entra no portal não tem nada a ver com a cobrança da agência
   * — bloqueá-lo puniria quem não decide nada.
   *
   * `acessoDaAgencia` em `null` — consulta pendente ou que falhou — passa
   * direto. Derrubar quem está trabalhando porque a rede oscilou é pior que
   * deixar passar alguns segundos de quem não pagou.
   */
  if (acessoDaAgencia && !acessoDaAgencia.liberado) {
    return <AcessoBloqueado acesso={acessoDaAgencia} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Global Modals */}
      <JobDetailModal />
      <CreateJobModal />
      <CreateWorkspaceModal />
      <SearchModal />
      {/* Aberto pelo card do usuário na barra lateral e por
          Configurações → Visão Geral, que antes tinha um formulário de
          perfil próprio — decorativo, e que não salvava nada. */}
      <AuthModal
        isOpen={isAuthModalOpen || isProfileModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setIsProfileModalOpen(false);
        }}
      />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />

      {/* Left Sidebar (Desktop + Mobile responsive) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Agency / Workspace Header */}
        <div>
          {/* A logo é o próprio seletor de agência: eram dois lugares
              mostrando a mesma marca, e só um deles trocava de agência. */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher />
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action: New Content Button */}
          <div className="p-3">
            <button
              onClick={() => openCreateJobModal()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Conteúdo</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-2 space-y-1 mt-1 overflow-y-auto max-h-[calc(100vh-320px)]">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

          </nav>
        </div>

        {/* Bottom Sidebar: Health Mini Widget & User Card */}
        <div className="p-3 space-y-3 border-t border-slate-200 dark:border-slate-800">
          {/* Health score mini card */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Saúde Operacional
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                {agencyHealthScore.total}/100
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-purple-500 rounded-full"
                style={{ width: `${agencyHealthScore.total}%` }}
              />
            </div>
          </div>

          {/*
            Prévia do portal, e o link para mandar ao cliente.

            São duas ações diferentes: a esquerda abre o portal de um cliente
            para conferir, a direita copia o endereço que a agência manda ao
            cliente — esse não leva cliente nenhum, quem chega prova quem é
            pelo código no e-mail.

            O badge "Prévia" que ficava aqui saiu por espaço, não por gosto:
            com ele o par pede 240px e a coluna tem 232 (w-64 menos o p-3),
            com o padding já apertado. O que ele dizia foi para o `title`.
          */}
          <BotaoDoPortal
            clientId={clientFilter === 'all' ? undefined : clientFilter}
            variante="lateral"
            rotulo="Portal do Cliente"
          />

          {/* User Profile & Logout */}
          <div className="flex items-center gap-1 border-t border-slate-200 dark:border-slate-800/80 pt-2">
            <button 
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex-1 flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition text-xs text-left cursor-pointer min-w-0"
              title="Gerenciar Sessão & Alternar Usuário"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Era um retrato do Unsplash como padrão: a foto de um
                    desconhecido no lugar da pessoa, e uma dependência de rede
                    para desenhar a barra lateral. */}
                <Avatar
                  nome={currentUser?.name || 'Usuário'}
                  url={currentUser?.avatar}
                  tamanho={32}
                  className="border border-slate-200 dark:border-slate-700"
                />
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 dark:text-white block truncate">{currentUser?.name || 'Usuário'}</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold block truncate">
                    Cargo: {currentUser?.role || 'owner'}
                  </span>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
              title="Sair do Sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        {/* Top Navbar */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* O seletor de agência mora na barra lateral, no lugar da logo. */}

            {/* Client Filter Switcher */}
            <ClientSwitcher />

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block mx-0.5"></div>

            {/* Global Search shortcut button (Cmd + K) */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 transition border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Pesquisar jobs, clientes, leads...</span>
              <kbd className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Quick Status Pill */}
            {inAdjustmentCount > 0 && (
              <button
                onClick={() => setActiveTab('aprovacoes')}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>{inAdjustmentCount} Ajustes</span>
              </button>
            )}

            {/*
              A porta para `/admin`, só para quem administra o produto.

              Pequena e no cabeçalho de propósito: as telas de lá não são do
              dia a dia de ninguém — são visitadas de vez em quando, e antes
              disputavam a barra lateral com o menu que a agência usa toda
              hora. Some para todo mundo que não está em `platform_admins`;
              quem digitar `/admin` mesmo assim recebe a recusa explicada.
            */}
            {isPlatformAdmin && (
              <button
                onClick={() => setActiveTab('admin_agencias')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-900 text-xs font-bold transition cursor-pointer"
                title="Administração do Orquesia (/admin)"
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Admin</span>
              </button>
            )}

            {/* What's New / Novidades Changelog button */}
            <button
              onClick={() => setIsChangelogOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-xs font-bold transition cursor-pointer"
              title="Ver Novidades do Sistema (Changelog)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden md:inline">Novidades</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications toggle */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-500" />
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in space-y-2"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Notificações da Agência</span>
                    <span className="text-[10px] text-slate-400 font-medium">Tempo Real</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 text-xs">
                    {notifications.map(n => (
                      <div key={n.id} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-purple-50/50 dark:hover:bg-purple-500/10 transition">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{n.title}</span>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-snug">{n.message}</p>
                        <span className="text-[10px] text-slate-400 font-mono block mt-1">
                          {safeTimeFormat(n.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Deploy que saiu com esta aba aberta. */}
        <AvisoDeAtualizacao />

        {/*
          A agência em que a pessoa está trabalhando foi para a lixeira.

          A linha continua legível pelos sete dias, então sem este aviso a
          equipe segue produzindo normalmente e perde tudo numa madrugada,
          sem nunca ter visto nada. O prazo vem do mesmo lugar que o expurgo
          usa — ver `src/lib/lixeira.ts`.
        */}
        {currentWorkspace?.deletedAt && (
          <div className="shrink-0 px-4 py-2.5 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed flex-1">
              <strong>Esta agência está na lixeira.</strong>{' '}
              {(() => {
                const restam = diasAteOExpurgo(currentWorkspace.deletedAt);
                if (restam === 0) return 'Ela será apagada na próxima passada do expurgo,';
                if (restam === 1) return 'Falta 1 dia para ela ser apagada,';
                return `Faltam ${restam} dias para ela ser apagada,`;
              })()}{' '}
              com clientes, conteúdos e arquivos. Um administrador da plataforma ou o
              proprietário da agência pode restaurá-la em <strong>Admin → Agências</strong> até
              lá.
            </p>
          </div>
        )}

        {/* Falha ao gravar no banco. Não existe mais aviso de cache: nada de
            dado de agência passa pelo navegador. */}
        {syncState === 'error' && (
          <div className="shrink-0 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed flex-1">
              {syncError}
            </p>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <Suspense fallback={<CarregandoTela />}>
          {!abaPermitida && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-sm text-center space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sem acesso a esta área
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Seu perfil não tem permissão para abrir esta tela. Fale com quem
                  administra a agência para ajustar seu papel.
                </p>
              </div>
            </div>
          )}

          {abaPermitida && activeTab === 'dashboard' && <DashboardView />}
          {abaPermitida && activeTab === 'calendario' && <CalendarApp />}
          {abaPermitida && activeTab === 'producao' && <KanbanBoard />}
          {abaPermitida && activeTab === 'aprovacoes' && <ApprovalsView />}
          {abaPermitida && activeTab === 'clientes' && <ClientsView />}
          {abaPermitida && activeTab === 'comercial' && <CommercialView />}
          {abaPermitida && activeTab === 'publicacoes' && <PublicationsView />}
          {abaPermitida && activeTab === 'relatorios' && <ReportsView />}
          {abaPermitida && activeTab === 'automacoes' && <AutomationsView />}
          {abaPermitida && activeTab === 'configuracoes' && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {/* Fica por último para ficar por cima, e fora da barra lateral: a
          pergunta que ele responde — "já subiu?" — vale em qualquer tela. */}
      <VersaoDoApp />
    </div>
  );
};

export default function App() {
  // A aplicação subiu inteira: se um chunk sumir daqui em diante, vale
  // recarregar de novo. Sem isto, a marca da primeira recarga ficaria de pé
  // pela sessão toda e o segundo deploy do dia cairia direto na tela de erro.
  useEffect(() => {
    marcarCargaBemSucedida();
  }, []);

  return (
    <PostfyProvider>
      <DynamicThemeProvider />
      {/* Título da aba e meta tags, vindos do banco. Os robôs de prévia de
          link não executam JavaScript e não chegam aqui — para eles existe
          api/seo.ts, servido pela Vercel conforme o user-agent. */}
      <SeoDoSaas />
      <MainLayout />
    </PostfyProvider>
  );
}
