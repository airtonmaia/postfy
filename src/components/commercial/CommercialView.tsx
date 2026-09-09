import React, { useState } from 'react';
import { novoId } from '../../lib/sincronizacao';
import { usePostfy } from '../../context/PostfyContext';
import { 
  Briefcase, 
  Plus, 
  FileText, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  DollarSign, 
  Phone, 
  Mail,
  UserCheck,
  Send,
  Check,
  X,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Eye
} from 'lucide-react';
import { Lead, LeadStage, Proposal, Contract } from '../../types';

export const CommercialView: React.FC = () => {
  const { 
    leads, 
    addLead, 
    updateLeadStage, 
    convertLeadToClient, 
    proposals, 
    addProposal, 
    acceptProposal,
    contracts, 
    createContract, 
    signContract,
    clients 
  } = usePostfy();

  const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'proposals' | 'contracts'>('pipeline');

  // Lead modal state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadValue, setLeadValue] = useState(4000);
  const [leadService, setLeadService] = useState('Social Media Completo & Ads');

  // Proposal modal state
  const [showAddProposalModal, setShowAddProposalModal] = useState(false);
  const [proposalClientName, setProposalClientName] = useState('');
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalService, setProposalService] = useState('Gestão de Redes Sociais & Criação de Conteúdo');
  const [proposalScope, setProposalScope] = useState('16 posts mensais (Feed/Carrossel) + 12 Reels + 30 Stories + Relatório');
  const [proposalValue, setProposalValue] = useState(4500);

  // Contract modal state
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [contractClientId, setContractClientId] = useState(clients[0]?.id || '');
  const [contractTitle, setContractTitle] = useState('Contrato de Gestão de Presença Digital e Redes Sociais');
  const [contractValue, setContractValue] = useState(4500);

  // Contract & Proposal preview state
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);
  const [signatoryName, setSignatoryName] = useState('Diretor Responsável');

  const stages: { id: LeadStage; title: string; color: string }[] = [
    { id: 'new_lead', title: 'Novos Leads', color: 'border-slate-300 bg-slate-50 dark:bg-slate-950' },
    { id: 'meeting_scheduled', title: 'Reunião Agendada', color: 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20' },
    { id: 'proposal_sent', title: 'Proposta Enviada', color: 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' },
    { id: 'negotiating', title: 'Negociação', color: 'border-purple-300 bg-purple-50/50 dark:bg-purple-950/20' },
    { id: 'won', title: 'Ganhos / Fechados', color: 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' },
  ];

  const totalPipelineValue = leads
    .filter(l => l.stage !== 'lost')
    .reduce((acc, l) => acc + l.estimatedValue, 0);

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadCompany.trim()) return;

    addLead({
      name: leadName.trim() || leadCompany.trim(),
      company: leadCompany.trim(),
      email: leadEmail.trim(),
      phone: leadPhone.trim(),
      estimatedValue: leadValue,
      serviceInterest: leadService,
      stage: 'new_lead'
    });

    setLeadName('');
    setLeadCompany('');
    setLeadEmail('');
    setLeadPhone('');
    setShowAddLeadModal(false);
  };

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalClientName.trim()) return;

    addProposal({
      clientName: proposalClientName.trim(),
      title: proposalTitle.trim() || `Proposta Comercial - ${proposalClientName}`,
      items: [
        {
          id: novoId(),
          service: proposalService,
          description: proposalScope,
          quantity: 1,
          monthlyValue: proposalValue
        }
      ],
      totalMonthlyValue: proposalValue,
      status: 'sent',
      validUntil: new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0]
    });

    setProposalClientName('');
    setProposalTitle('');
    setShowAddProposalModal(false);
  };

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    const selClient = clients.find(c => c.id === contractClientId) || clients[0];
    if (!selClient) return;

    createContract({
      clientId: selClient.id,
      clientName: selClient.name,
      title: contractTitle,
      monthlyValue: contractValue,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0],
      status: 'sent'
    });

    setShowAddContractModal(false);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Comercial & Vendas</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">Pipeline de Prospecção, Propostas & Contratos</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Funil de leads com conversão em 1 clique, propostas com aceite online e contratos assinados digitalmente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right px-4 py-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Total em Negociação</span>
            <span className="text-base font-extrabold text-purple-950 dark:text-purple-200 font-mono">
              R$ {(totalPipelineValue || 0).toLocaleString('pt-BR')} /mês
            </span>
          </div>

          {activeSubTab === 'pipeline' && (
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Lead
            </button>
          )}

          {activeSubTab === 'proposals' && (
            <button
              onClick={() => setShowAddProposalModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Proposta
            </button>
          )}

          {activeSubTab === 'contracts' && (
            <button
              onClick={() => setShowAddContractModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Gerar Contrato
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 rounded-t-2xl shadow-xs">
        <button
          onClick={() => setActiveSubTab('pipeline')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'pipeline'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Funil de Vendas ({leads.length})
        </button>

        <button
          onClick={() => setActiveSubTab('proposals')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'proposals'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" />
          Propostas Comerciais ({proposals.length})
        </button>

        <button
          onClick={() => setActiveSubTab('contracts')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'contracts'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Contratos Digitais ({contracts.length})
        </button>
      </div>

      {/* Sub Tab 1: Pipeline View */}
      {activeSubTab === 'pipeline' && (
        <div className="flex overflow-x-auto gap-4 pb-4 items-start">
          {stages.map(st => {
            const stageLeads = leads.filter(l => l.stage === st.id);
            const sumVal = stageLeads.reduce((acc, l) => acc + l.estimatedValue, 0);

            return (
              <div
                key={st.id}
                className={`w-76 shrink-0 rounded-2xl p-3.5 border shadow-xs flex flex-col max-h-full ${st.color}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">{st.title}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      R$ {(sumVal || 0).toLocaleString('pt-BR')} &bull; {stageLeads.length} leads
                    </span>
                  </div>
                </div>

                {/* Leads Cards */}
                <div className="space-y-3 overflow-y-auto">
                  {stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-300 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white">{lead.company}</h5>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{lead.name}</span>
                        </div>
                        <span className="text-[11px] font-bold font-mono text-purple-600 dark:text-purple-400">
                          R$ {lead.estimatedValue.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {lead.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        {lead.stage !== 'won' ? (
                          <>
                            {lead.stage === 'new_lead' && (
                              <button
                                onClick={() => updateLeadStage(lead.id, 'meeting_scheduled')}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              >
                                Agendar Reunião <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {lead.stage === 'meeting_scheduled' && (
                              <button
                                onClick={() => updateLeadStage(lead.id, 'proposal_sent')}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              >
                                Enviar Proposta <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {lead.stage === 'proposal_sent' && (
                              <button
                                onClick={() => updateLeadStage(lead.id, 'negotiating')}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              >
                                Negociar <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {lead.stage === 'negotiating' && (
                              <button
                                onClick={() => convertLeadToClient(lead.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow-xs"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Fechar & Ativar
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Cliente Ativo na Agência
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                      Nenhum lead nesta etapa.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub Tab 2: Proposals View */}
      {activeSubTab === 'proposals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.map(prop => (
              <div 
                key={prop.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">Proposta Comercial</span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">{prop.title}</h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                        Cliente / Prospect: <strong className="text-slate-700 dark:text-slate-300">{prop.clientName}</strong>
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      prop.status === 'accepted'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                    }`}>
                      {prop.status === 'accepted' ? 'Aceita & Ativada' : 'Aguardando Aceite'}
                    </span>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    {prop.items.map(item => (
                      <div key={item.id} className="flex justify-between items-start gap-2">
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200 block">{item.service}</strong>
                          <span className="text-[11px] text-slate-400">{item.description}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                          R$ {item.monthlyValue.toLocaleString('pt-BR')} /mês
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Mensal</span>
                    <strong className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                      R$ {prop.totalMonthlyValue.toLocaleString('pt-BR')} /mês
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingProposal(prop)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 inline mr-1" />
                      Visualizar
                    </button>

                    {prop.status !== 'accepted' && (
                      <button
                        onClick={() => acceptProposal(prop.id)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Simular Aceite Online
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub Tab 3: Contracts View */}
      {activeSubTab === 'contracts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contracts.map(contract => (
              <div
                key={contract.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{contract.title}</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                          Contratante: <strong className="text-slate-700 dark:text-slate-300">{contract.clientName}</strong>
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      contract.status === 'signed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                    }`}>
                      {contract.status === 'signed' ? 'Assinado Digitalmente' : 'Pendente de Assinatura'}
                    </span>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Início de Vigência:</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{contract.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Renovação:</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{contract.endDate} (Anual)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assinatura Certificada:</span>
                      <span className="text-emerald-600 font-bold">
                        {contract.status === 'signed' ? 'Certificado ICP-Brasil OK' : 'Aguardando partes'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Mensalidade</span>
                    <strong className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                      R$ {(contract.monthlyValue || 0).toLocaleString('pt-BR')} /mês
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewingContract(contract)}
                      className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Ler Contrato Completo
                    </button>

                    {contract.status !== 'signed' && (
                      <button 
                        onClick={() => signContract(contract.id, 'Diretor Comercial')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Assinar Agora
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Lead */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleCreateLead} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Cadastrar Novo Lead Comercial</h4>
              <button type="button" onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-slate-700 dark:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Empresa / Marca *</label>
              <input
                type="text"
                required
                value={leadCompany}
                onChange={e => setLeadCompany(e.target.value)}
                placeholder="Ex: Grupo Odonto Prime"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Contato / Decisor</label>
              <input
                type="text"
                value={leadName}
                onChange={e => setLeadName(e.target.value)}
                placeholder="Ex: Dra. Mariana Santos"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  value={leadEmail}
                  onChange={e => setLeadEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={leadPhone}
                  onChange={e => setLeadPhone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Estimado (R$)</label>
                <input
                  type="number"
                  value={leadValue}
                  onChange={e => setLeadValue(Number(e.target.value))}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Serviço de Interesse</label>
                <input
                  type="text"
                  value={leadService}
                  onChange={e => setLeadService(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Salvar Lead
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Proposal */}
      {showAddProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleCreateProposal} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Gerar Proposta Comercial</h4>
              <button type="button" onClick={() => setShowAddProposalModal(false)} className="text-slate-400 hover:text-slate-700 dark:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cliente / Empresa *</label>
              <input
                type="text"
                required
                value={proposalClientName}
                onChange={e => setProposalClientName(e.target.value)}
                placeholder="Ex: Bella Cucina Ristorante"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título da Proposta</label>
              <input
                type="text"
                value={proposalTitle}
                onChange={e => setProposalTitle(e.target.value)}
                placeholder="Ex: Plano de Aceleração Social Media & Reels 2026"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Escopo & Entregas Mensais</label>
              <textarea
                rows={3}
                value={proposalScope}
                onChange={e => setProposalScope(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Investimento Recorrente Mensal (R$)</label>
              <input
                type="number"
                value={proposalValue}
                onChange={e => setProposalValue(Number(e.target.value))}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProposalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Criar Proposta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Contract */}
      {showAddContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleCreateContract} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Gerar Novo Contrato de Serviços</h4>
              <button type="button" onClick={() => setShowAddContractModal(false)} className="text-slate-400 hover:text-slate-700 dark:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selecione o Cliente</label>
              <select
                value={contractClientId}
                onChange={e => setContractClientId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.segment})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título do Contrato</label>
              <input
                type="text"
                value={contractTitle}
                onChange={e => setContractTitle(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Mensal Recorrente (R$)</label>
              <input
                type="number"
                value={contractValue}
                onChange={e => setContractValue(Number(e.target.value))}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddContractModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Gerar Minuta do Contrato
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Full Contract Viewer with Dynamic Variables & Sign */}
      {viewingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {viewingContract.title}
                </h4>
              </div>
              <button onClick={() => setViewingContract(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-serif bg-slate-50/50 dark:bg-slate-950/50">
              <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white font-sans">
                  INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">REGISTRO DIGITAL #{viewingContract.id}</span>
              </div>

              <p>
                <strong>CONTRATADA:</strong> AGÊNCIA POSTFY DIGITAL LTDA, devidamente inscrita no CNPJ sob o nº 12.345.678/0001-90, com sede operacional em São Paulo/SP.
              </p>

              <p>
                <strong>CONTRATANTE:</strong> {viewingContract.clientName.toUpperCase()}, pessoa jurídica de direito privado, doravante denominada simplesmente CONTRATANTE.
              </p>

              <div className="space-y-2 pt-2">
                <h5 className="font-bold text-xs uppercase text-slate-900 dark:text-white font-sans">CLÁUSULA 1ª - DO OBJETO</h5>
                <p>
                  O presente contrato tem como objeto a prestação de serviços continuados de consultoria, planejamento editorial, criação gráfica, redação publicitária (copywriting), agendamento e análise de performance em mídias digitais para os canais oficiais da CONTRATANTE.
                </p>

                <h5 className="font-bold text-xs uppercase text-slate-900 dark:text-white font-sans">CLÁUSULA 2ª - DO VALOR E FORMA DE PAGAMENTO</h5>
                <p>
                  Pela prestação dos serviços contratados, a CONTRATANTE pagará à CONTRATADA o valor mensal fixo e irreajustável pelo período de 12 meses de <strong>R$ {viewingContract.monthlyValue.toLocaleString('pt-BR')}</strong> (mensal recorrente), com vencimento todo dia 10 de cada mês subsequente via boleto bancário ou Pix com emissão de NFS-e.
                </p>

                <h5 className="font-bold text-xs uppercase text-slate-900 dark:text-white font-sans">CLÁUSULA 3ª - DA VIGÊNCIA</h5>
                <p>
                  O presente contrato entra em vigor na data de {viewingContract.startDate} e terá vigência de 12 (doze) meses, findando-se em {viewingContract.endDate}, renovando-se automaticamente caso não haja notificação prévia de 30 dias.
                </p>
              </div>

              {/* Digital Signature Stamp */}
              <div className="mt-6 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-600 block">Status da Assinatura Digital</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {viewingContract.status === 'signed' 
                      ? `Assinado digitalmente por ${signatoryName}` 
                      : 'Aguardando assinatura das partes'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Hash ICP: sha256_e8c89bf1a04910b2e887cc...
                  </span>
                </div>

                {viewingContract.status !== 'signed' ? (
                  <button
                    onClick={() => {
                      signContract(viewingContract.id, signatoryName);
                      setViewingContract(prev => prev ? { ...prev, status: 'signed' } : null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Assinar com Certificado Digital
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Válido e Autenticado
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Proposal Viewer */}
      {viewingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-purple-600">Proposta de Prestação de Serviços</span>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{viewingProposal.title}</h4>
              </div>
              <button onClick={() => setViewingProposal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente / Interessado:</span>
                <strong className="text-slate-800 dark:text-slate-200">{viewingProposal.clientName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Validade da Proposta:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{viewingProposal.validUntil}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Recorrente Mensal:</span>
                <span className="font-mono font-extrabold text-purple-600 text-sm">
                  R$ {viewingProposal.totalMonthlyValue.toLocaleString('pt-BR')} /mês
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Itens e Entregas Inclusas:</span>
              {viewingProposal.items.map(i => (
                <div key={i.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <strong className="text-slate-900 dark:text-white block">{i.service}</strong>
                  <p className="text-slate-500 mt-0.5">{i.description}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setViewingProposal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Fechar
              </button>
              {viewingProposal.status !== 'accepted' && (
                <button
                  onClick={() => {
                    acceptProposal(viewingProposal.id);
                    setViewingProposal(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Confirmar Aceite do Cliente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
