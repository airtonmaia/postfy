import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, CheckCircle2, Users, Search, X, Building2 } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { Avatar } from '../common/Avatar';

export const ClientSwitcher: React.FC = () => {
  const { clients, clientFilter, setClientFilter, jobs } = usePostfy();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.id === clientFilter);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.segment && c.segment.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative z-40" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full sm:w-auto flex items-center justify-between gap-2.5 p-1.5 pr-2.5 rounded-xl transition cursor-pointer border ${
          clientFilter !== 'all'
            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/80 text-purple-900 dark:text-purple-200 shadow-xs'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200'
        }`}
        title="Filtrar dados de todo o sistema por Cliente"
      >
        <div className="flex items-center gap-2">
          {selectedClient ? (
            <Avatar
              nome={selectedClient.name}
              url={selectedClient.avatar}
              tamanho={28}
              formato="quadrado"
              className="border border-purple-300 dark:border-purple-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="min-w-0 text-left hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-tight truncate max-w-[130px] block">
                {selectedClient ? selectedClient.name : 'Todos os Clientes'}
              </span>
              {clientFilter !== 'all' && (
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-600 text-white leading-tight">
                  Ativo
                </span>
              )}
            </div>
            <span className="text-[9px] uppercase text-slate-400 dark:text-slate-500 block truncate">
              {selectedClient ? 'Filtro por Cliente' : 'Visão Geral (Todos)'}
            </span>
          </div>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 sm:left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              Filtrar por Cliente
            </span>
            {clientFilter !== 'all' && (
              <button 
                onClick={() => {
                  setClientFilter('all');
                  setIsOpen(false);
                }}
                className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <X className="w-2.5 h-2.5" />
                Limpar Filtro
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative mb-2 px-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              autoFocus
            />
          </div>

          {/* All Clients Option */}
          <button
            onClick={() => {
              setClientFilter('all');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer mb-1 ${
              clientFilter === 'all'
                ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs block">Todos os Clientes</span>
                <span className="text-[10px] text-slate-400 font-normal">Exibir todos os {clients.length} clientes</span>
              </div>
            </div>
            {clientFilter === 'all' && (
              <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            )}
          </button>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
            {filteredClients.map(c => {
              const clientJobsCount = jobs.filter(j => j.clientId === c.id).length;
              const isSelected = clientFilter === c.id;

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientFilter(c.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar nome={c.name} url={c.avatar} tamanho={24} formato="quadrado" />
                    <div className="min-w-0 truncate">
                      <span className="text-xs block truncate">{c.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{c.segment || 'Cliente'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {clientJobsCount} {clientJobsCount === 1 ? 'post' : 'posts'}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                </button>
              );
            })}

            {filteredClients.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-400">
                Nenhum cliente encontrado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
