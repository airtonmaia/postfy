import React, { useState, useEffect, lazy, Suspense } from 'react';
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

// Views carregadas sob demanda (code splitting): cada tela vira um chunk
// próprio, então abrir o login não baixa mais relatórios, gráficos e PDF.
const CalendarApp = lazy(() => import('./components/calendar/CalendarApp').then(m => ({ default: m.CalendarApp })));
const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const KanbanBoard = lazy(() => import('./components/kanban/KanbanBoard').then(m => ({ default: m.KanbanBoard })));
const ApprovalsView = lazy(() => import('./components/approvals/ApprovalsView').then(m => ({ default: m.ApprovalsView })));
const ClientsView = lazy(() => import('./components/clients/ClientsView').then(m => ({ default: m.ClientsView })));
const CommercialView = lazy(() => import('./components/commercial/CommercialView').then(m => ({ default: m.CommercialView })));
const PublicationsView = lazy(() => import('./components/publications/PublicationsView').then(m => ({ default: m.PublicationsView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then(m => ({ default: m.ReportsView })));
const AutomationsView = lazy(() => import('./components/automations/AutomationsView').then(m => ({ default: m.AutomationsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const ClientPortalView = lazy(() => import('./components/portal/ClientPortalView').then(m => ({ default: m.ClientPortalView })));
const SaasPlansView = lazy(() => import('./components/saas/SaasPlansView').then(m => ({ default: m.SaasPlansView })));
const SaasFinancialView = lazy(() => import('./components/saas/SaasFinancialView').then(m => ({ default: m.SaasFinancialView })));
const SaasAgenciesView = lazy(() => import('./components/saas/SaasAgenciesView').then(m => ({ default: m.SaasAgenciesView })));
const SaasEmailsView = lazy(() => import('./components/saas/SaasEmailsView').then(m => ({ default: m.SaasEmailsView })));
const SaasIntegrationsView = lazy(() => import('./components/saas/SaasIntegrationsView').then(m => ({ default: m.SaasIntegrationsView })));

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
import { VersaoDoApp } from './components/common/VersaoDoApp';

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
    buildClientPortalUrl,
    clients,
    clientFilter,
    setClientFilter,
    theme,
    setTheme,
    syncState,
    syncError,
    isPlatformAdmin,
  } = usePostfy();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saasAberto, setSaasAberto] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  // Abre o submenu quando já se está numa tela do SaaS: recolhido, ele
  // esconderia onde a pessoa está. Fica antes das saídas antecipadas porque
  // hook não pode vir depois de return condicional.
  useEffect(() => {
    if (String(activeTab).startsWith('saas_')) setSaasAberto(true);
  }, [activeTab]);

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

  // Dono do SaaS, e não dono de agência.
  //
  // Vinha de `pode(role, 'gerenciar_saas')`, mas `owner` é o papel que a RPC
  // criar_agencia dá a todo mundo que se cadastra: na prática, qualquer
  // cliente novo enxergava o menu de gestão do produto. Agora vem da tabela
  // platform_admins, que é a mesma fonte consultada pela RLS.
  const isSuperAdmin = isPlatformAdmin;

  const ABAS_SAAS: TabType[] = [
    'saas_planos', 'saas_financeiro', 'saas_agencias', 'saas_emails',
    'saas_integracoes',
  ];
  const abaPermitida = ABAS_SAAS.includes(activeTab as TabType)
    ? isSuperAdmin
    : podeAcessarAba(currentUser?.role, activeTab as TabType);

  const todasAsAbas: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendario', label: 'Calendário', icon: CalendarIcon },
    { id: 'producao', label: 'Quadro Kanban', icon: Kanban },
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Client Portal Fullscreen Override if active */}
      {isClientPortalOpen && (
        <Suspense fallback={<CarregandoTela />}>
          <ClientPortalView />
        </Suspense>
      )}

      {/* Global Modals */}
      <JobDetailModal />
      <CreateJobModal />
      <CreateWorkspaceModal />
      <SearchModal />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
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

            {isSuperAdmin && (
              <>
                {/* Recolhível: são cinco itens que o dono do SaaS usa de vez
                    em quando, competindo por espaço com o menu do dia a dia.
                    Abre sozinho quando já se está numa das telas, senão
                    recolher esconderia onde a pessoa está. */}
                <button
                  type="button"
                  onClick={() => setSaasAberto((v) => !v)}
                  className="w-full flex items-center justify-between px-3 pt-4 pb-1 cursor-pointer group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    👑 Super Admin
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 transition-transform ${
                      saasAberto ? '' : '-rotate-90'
                    }`}
                  />
                </button>
                {saasAberto && [
                  { id: 'saas_planos', label: 'Planos do SaaS', icon: Crown },
                  { id: 'saas_financeiro', label: 'Financeiro SaaS', icon: DollarSign },
                  { id: 'saas_agencias', label: 'Lista de Agências', icon: Building2 },
                  { id: 'saas_emails', label: 'E-mails do Sistema', icon: Mail },
                  { id: 'saas_integracoes', label: 'Integrações do SaaS', icon: Plug },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as TabType);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                          : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-200/50 dark:border-purple-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
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

          {/* Quick Client Portal link */}
          <button
            onClick={() => {
              // Prévia interna, em aba nova: a sessão do Supabase Auth vive
              // no localStorage, compartilhado entre abas do mesmo
              // navegador, então a aba nova já abre autenticada. Não serve
              // como link para mandar ao cliente de verdade — isso continua
              // sendo o link com token, de buildClientPortalUrl.
              visualizarPortalDoCliente(
                clientFilter === 'all' ? clients[0]?.id || '' : clientFilter
              );
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs text-purple-700 dark:text-purple-300 font-bold transition border border-purple-200 dark:border-purple-800 cursor-pointer shadow-xs"
            title="Ver como o cliente enxerga, numa aba nova. O envio do link ao cliente ainda não está disponível."
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              Portal do Cliente
            </span>
            <span className="text-[10px] bg-slate-500 text-white px-1.5 py-0.5 rounded font-bold">
              Prévia
            </span>
          </button>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-1 border-t border-slate-200 dark:border-slate-800/80 pt-2">
            <button 
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex-1 flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition text-xs text-left cursor-pointer min-w-0"
              title="Gerenciar Sessão & Alternar Usuário"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
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
          {abaPermitida && activeTab === 'saas_planos' && <SaasPlansView />}
          {abaPermitida && activeTab === 'saas_financeiro' && <SaasFinancialView />}
          {abaPermitida && activeTab === 'saas_agencias' && <SaasAgenciesView />}
          {abaPermitida && activeTab === 'saas_emails' && <SaasEmailsView />}
          {abaPermitida && activeTab === 'saas_integracoes' && <SaasIntegrationsView />}
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
  return (
    <PostfyProvider>
      <DynamicThemeProvider />
      <MainLayout />
    </PostfyProvider>
  );
}
