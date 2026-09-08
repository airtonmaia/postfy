import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';

// Modals
import { JobDetailModal } from './components/modals/JobDetailModal';
import { CreateJobModal } from './components/modals/CreateJobModal';
import { SearchModal } from './components/modals/SearchModal';
import { AuthModal } from './components/auth/AuthModal';
import { LoginView } from './components/auth/LoginView';
import { ChangelogModal } from './components/modals/ChangelogModal';

// Views
import { CalendarApp } from './components/calendar/CalendarApp';
import { DashboardView } from './components/dashboard/DashboardView';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ApprovalsView } from './components/approvals/ApprovalsView';
import { ClientsView } from './components/clients/ClientsView';
import { CommercialView } from './components/commercial/CommercialView';
import { PublicationsView } from './components/publications/PublicationsView';
import { ReportsView } from './components/reports/ReportsView';
import { AutomationsView } from './components/automations/AutomationsView';
import { SettingsView } from './components/settings/SettingsView';
import { ClientPortalView } from './components/portal/ClientPortalView';
import { TabType } from './types';
import { WorkspaceSwitcher } from './components/layout/WorkspaceSwitcher';
import { ClientSwitcher } from './components/layout/ClientSwitcher';
import { DynamicThemeProvider } from './components/common/DynamicThemeProvider';

const MainLayout: React.FC = () => {
  const { 
    isAuthenticated,
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
    openClientPortal,
    clients,
    clientFilter,
    setClientFilter,
    theme,
    setTheme
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

  // Mandatory Authentication Gate
  if (!isAuthenticated && !isClientPortalOpen) {
    return <LoginView />;
  }

  // Unread notifications & pending approvals count
  const unreadNotifs = notifications.filter(n => !n.read).length;
  const pendingApprovalsCount = jobs.filter(j => j.status === 'for_approval').length;
  const inAdjustmentCount = jobs.filter(j => j.status === 'in_adjustment').length;

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-200 select-none transition-colors duration-200">
      {/* Client Portal Fullscreen Override if active */}
      {isClientPortalOpen && <ClientPortalView />}

      {/* Global Modals */}
      <JobDetailModal />
      <CreateJobModal />
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
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {currentWorkspace?.logo ? (
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0 shadow-xs">
                  <img 
                    src={currentWorkspace.logo} 
                    alt={currentWorkspace.name || 'Logo'} 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: currentWorkspace?.primaryColor || '#9333ea' }}
                >
                  {(currentWorkspace?.name || 'P').substring(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                  <span className="truncate">{currentWorkspace?.name || 'Orquesia Ops'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 shrink-0">
                    PRO
                  </span>
                </h1>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">OS para Agências</span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden"
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
          <nav className="px-2 space-y-1 mt-1">
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

          {/* Quick Client Portal link */}
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('portal', 'true');
              if (clientFilter !== 'all') {
                url.searchParams.set('clientId', clientFilter);
              }
              window.open(url.toString(), '_blank');
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs text-purple-700 dark:text-purple-300 font-bold transition border border-purple-200 dark:border-purple-800 cursor-pointer shadow-xs"
            title="Abrir Portal do Cliente em Nova Janela"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              Portal do Cliente
            </span>
            <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
              Nova Janela ↗
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
            
            {/* Workspace / Agency Switcher */}
            <WorkspaceSwitcher />

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-0.5"></div>

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
                          {safeTimeFormat(n.timestamp || (n as any).createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'calendario' && <CalendarApp />}
          {activeTab === 'producao' && <KanbanBoard />}
          {activeTab === 'aprovacoes' && <ApprovalsView />}
          {activeTab === 'clientes' && <ClientsView />}
          {activeTab === 'comercial' && <CommercialView />}
          {activeTab === 'publicacoes' && <PublicationsView />}
          {activeTab === 'relatorios' && <ReportsView />}
          {activeTab === 'automacoes' && <AutomationsView />}
          {activeTab === 'configuracoes' && <SettingsView />}
        </main>
      </div>
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
