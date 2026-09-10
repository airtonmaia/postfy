import React, { useState, useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { Search, X, Calendar, User, Briefcase, FileText, ArrowRight } from 'lucide-react';
import { PlatformBadge, StatusBadge } from '../common/Badges';
import { Avatar } from '../common/Avatar';

export const SearchModal: React.FC = () => {
  const { 
    isSearchModalOpen, 
    setIsSearchModalOpen, 
    jobs, 
    clients, 
    leads, 
    contracts,
    setSelectedJob,
    setActiveTab,
    openClientPortal
  } = usePostfy();

  const [query, setQuery] = useState('');

  // Keyboard shortcut listener: Cmd + K or Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(!isSearchModalOpen);
      }
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen, setIsSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  const q = query.toLowerCase().trim();

  const matchingJobs = q ? jobs.filter(j => 
    j.title.toLowerCase().includes(q) || 
    j.caption.toLowerCase().includes(q) ||
    j.campaign?.toLowerCase().includes(q)
  ).slice(0, 5) : [];

  const matchingClients = q ? clients.filter(c => 
    c.name.toLowerCase().includes(q) ||
    c.segment.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q)
  ).slice(0, 3) : [];

  const matchingLeads = q ? leads.filter(l => 
    l.name.toLowerCase().includes(q) ||
    l.company.toLowerCase().includes(q)
  ).slice(0, 3) : [];

  const hasResults = matchingJobs.length > 0 || matchingClients.length > 0 || matchingLeads.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Search Input */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Pesquisar jobs, clientes, leads, pautas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
          />
          <button
            onClick={() => setIsSearchModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {!query ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-600 dark:text-slate-400">Busca Rápida Postfy</p>
              <p>Digite para localizar conteúdos, clientes ou propostas na agência.</p>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            <>
              {/* Jobs */}
              {matchingJobs.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                    Conteúdos & Jobs
                  </span>
                  {matchingJobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setIsSearchModalOpen(false);
                        setSelectedJob(job);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-purple-50 text-left transition text-xs group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlatformBadge platform={job.platform} showLabel={false} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-purple-900">
                          {job.title}
                        </span>
                      </div>
                      <StatusBadge status={job.status} size="sm" />
                    </button>
                  ))}
                </div>
              )}

              {/* Clients */}
              {matchingClients.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                    Clientes
                  </span>
                  {matchingClients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setIsSearchModalOpen(false);
                        setActiveTab('clientes');
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-purple-50 text-left transition text-xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={client.name} url={client.avatar} tamanho={20} formato="quadrado" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-900">
                          {client.name}
                        </span>
                        <span className="text-[11px] text-slate-400">{client.segment}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
                    </button>
                  ))}
                </div>
              )}

              {/* Leads */}
              {matchingLeads.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                    Leads Comerciais
                  </span>
                  {matchingLeads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setIsSearchModalOpen(false);
                        setActiveTab('comercial');
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-purple-50 text-left transition text-xs group"
                    >
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {lead.company} ({lead.name})
                        </span>
                      </div>
                      <span className="text-emerald-600 font-bold text-[11px]">
                        R$ {lead.estimatedValue}/mês
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Pressione <strong>ESC</strong> para fechar</span>
          <span>Dica: Use <strong>Cmd + K</strong> em qualquer tela</span>
        </div>
      </div>
    </div>
  );
};
