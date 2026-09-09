import React, { useState } from 'react';
import { novoId } from '../../lib/sincronizacao';
import { BotaoDoPortal } from '../common/BotaoDoPortal';
import { usePostfy } from '../../context/PostfyContext';
import { 
  Users, 
  Plus, 
  ExternalLink,
  Eye,
  Mail, 
  Phone, 
  FileText, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle,
  Calendar,
  Layers,
  X
} from 'lucide-react';
import { Client } from '../../types';
import { ClientDetail } from './ClientDetail';
import { FileUpload } from '../ui/file-upload';

export const ClientsView: React.FC = () => {
  const { clients, jobs, visualizarPortalDoCliente, addClient, setActiveTab, setClientFilter, clientFilter } = usePostfy();
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState('');
  const [monthlyValue, setMonthlyValue] = useState(4500);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [avatar, setAvatar] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const displayedClients = clientFilter === 'all'
    ? clients
    : clients.filter(c => c.id === clientFilter);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedClientId(null)} />;
  }

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCl = addClient({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      cpfCnpj: cpfCnpj.trim(),
      avatar: avatar.trim() || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&auto=format&fit=crop&q=80',
      status: 'active',
      segment: segment.trim() || 'Serviços & Varejo',
      services: [
        {
          id: novoId(),
          name: 'Gestão de Conteúdo e Social Media',
          monthlyValue,
          startDate: new Date().toISOString().split('T')[0],
          recurrence: 'monthly'
        }
      ]
    });

    setName('');
    setEmail('');
    setPhone('');
    setSegment('');
    setCpfCnpj('');
    setAvatar('');
    setIsAddingClient(false);
    setSelectedClientId(newCl.id);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Gestão 360°</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">Clientes da Agência</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Contratos, serviços, saúde operacional e acesso direto ao Portal do Cliente.
          </p>
        </div>

        <button
          onClick={() => setIsAddingClient(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Add Client Form */}
      {isAddingClient && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-purple-200 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cadastrar Novo Cliente</h4>
            <button onClick={() => setIsAddingClient(false)} className="text-slate-400 hover:text-slate-700 dark:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateClient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome Fantasia / Marca *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Studio Bella Estética"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Segmento / Nicho</label>
              <input
                type="text"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Saúde, Moda, Gastronomia..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail Principal</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">CPF ou CNPJ</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Celular / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Mensal do Contrato (R$)</label>
              <input
                type="number"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="sm:col-span-2">
              <FileUpload
                label="Logo / Avatar da Marca"
                compact
                imageOnly
                value={avatar}
                onFileSelect={(file) => setAvatar(file.url)}
                onFileRemove={() => setAvatar('')}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingClient(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {displayedClients.map(client => {
          const clientJobs = jobs.filter(j => j.clientId === client.id);
          const pendingApproval = clientJobs.filter(j => j.status === 'for_approval').length;
          const totalMonthly = client.services.reduce((acc, s) => acc + s.monthlyValue, 0);

          const healthConfig = {
            green: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Operação Saudável' },
            yellow: { bg: 'bg-amber-50', text: 'text-amber-800', label: 'Atenção em Prazos' },
            red: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Alto Retrabalho' },
          }[client.healthScore];

          return (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-purple-300 transition"
            >
              <div>
                {/* Top Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={client.avatar} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800" />
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">{client.name}</h4>
                      <span className="text-xs text-slate-400 block">{client.segment}</span>
                    </div>
                  </div>

                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${healthConfig.bg} ${healthConfig.text}`}>
                    {healthConfig.label}
                  </span>
                </div>

                {/* Contacts and details */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.contacts[0]?.email || client.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.contacts[0]?.phone || client.phone}</span>
                  </div>
                  {client.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-2 rounded-lg mt-2">
                      "{client.notes}"
                    </p>
                  )}
                </div>

                {/* Services badge & Monthly Value */}
                <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Investimento Mensal</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                      R$ {(totalMonthly || 0).toLocaleString('pt-BR')} /mês
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pautas Ativas</span>
                    <span className="font-bold text-purple-600 font-mono text-sm">
                      {clientJobs.length} posts
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedClientId(client.id)}
                  className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Abrir Perfil
                </button>
                <button
                  onClick={() => {
                    setClientFilter(client.id);
                    setActiveTab('calendario');
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-purple-600 transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Ver Calendário
                </button>

                {/*
                  Prévia interna, não link para enviar ao cliente.
                  O portal ainda resolve o token contra o cache local do
                  navegador da agência, então num navegador novo ele não acha
                  o cliente nem os conteúdos. Enquanto a resolução por token
                  não for feita no servidor, oferecer isto como link de
                  compartilhamento seria enganoso.
                */}
                <BotaoDoPortal clientId={client.id} rotulo="Prévia do portal" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
