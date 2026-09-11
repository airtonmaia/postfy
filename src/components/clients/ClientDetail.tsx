import React, { useState } from 'react';
import { Client, ClientPassword, ClientInvoice, ClientFile, ClientBriefing } from '../../types';
import { BotaoDoPortal } from '../common/BotaoDoPortal';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard } from '../../lib/utils';
import { 
  User, FolderOpen, Key, Receipt, FileText, Upload, Plus, 
  ExternalLink, Eye, EyeOff, Copy, Trash2, Check, ArrowLeft,
  ShieldCheck, AlertCircle, Calendar, DollarSign, Globe, Phone, Mail,
  Share2, Sparkles, Building2, CheckCircle2, Users, Radio
} from 'lucide-react';
import { FileUpload } from '../ui/file-upload';
import { Avatar } from '../common/Avatar';
import { ClientUsersTab } from './ClientUsersTab';
import { ConexoesDoPerfil } from './ConexoesDoPerfil';

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
}

export const ClientDetail: React.FC<ClientDetailProps> = ({ client, onBack }) => {
  const { 
    updateClient, 
    addClientPassword, 
    deleteClientPassword, 
    addClientInvoice, 
    deleteClientInvoice, 
    addClientFile, 
    deleteClientFile, 
    updateClientBriefing,
    visualizarPortalDoCliente,
    users
  } = usePostfy();

  const [activeTab, setActiveTab] = useState<'cadastro' | 'usuarios' | 'conexoes' | 'arquivos' | 'senhas' | 'notas' | 'briefing'>('cadastro');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPasswordIds, setShowPasswordIds] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Form states for adding items
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [pwdService, setPwdService] = useState('');
  const [pwdUser, setPwdUser] = useState('');
  const [pwdPass, setPwdPass] = useState('');
  const [pwdNotes, setPwdNotes] = useState('');
  const [pwdUrl, setPwdUrl] = useState('');

  const [showAddFile, setShowAddFile] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileCat, setFileCat] = useState<ClientFile['category']>('identidade_visual');
  const [fileUrl, setFileUrl] = useState('');
  const [fileSize, setFileSize] = useState('1.5 MB');

  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invNumber, setInvNumber] = useState('');
  const [invMonth, setInvMonth] = useState('Março/2026');
  const [invValue, setInvValue] = useState(4500);
  const [invStatus, setInvStatus] = useState<'pago' | 'pendente' | 'emitido'>('pendente');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invFileUrl, setInvFileUrl] = useState('');

  // Cadastro state
  const [cadName, setCadName] = useState(client.name);
  const [cadLegalName, setCadLegalName] = useState(client.legalName || '');
  const [cadCpfCnpj, setCadCpfCnpj] = useState(client.cpfCnpj || '');
  const [cadEmail, setCadEmail] = useState(client.email);
  const [cadPhone, setCadPhone] = useState(client.phone);
  const [cadSegment, setCadSegment] = useState(client.segment);
  const [cadWebsite, setCadWebsite] = useState(client.website || '');
  const [cadAvatar, setCadAvatar] = useState(client.avatar);
  const [cadStatus, setCadStatus] = useState<'active' | 'inactive'>(client.status);
  const [cadResponsible, setCadResponsible] = useState(client.internalResponsibleId);

  // Briefing state
  const [briefing, setBriefing] = useState<ClientBriefing>(client.briefing || {
    brandVoice: '',
    targetAudience: '',
    painPoints: '',
    competitors: '',
    brandGuidelines: '',
    monthlyGoals: '',
    updatedAt: new Date().toISOString()
  });

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleShowPassword = (id: string) => {
    setShowPasswordIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    updateClient(client.id, {
      name: cadName,
      legalName: cadLegalName,
      cpfCnpj: cadCpfCnpj,
      email: cadEmail,
      phone: cadPhone,
      segment: cadSegment,
      website: cadWebsite,
      avatar: cadAvatar,
      status: cadStatus,
      internalResponsibleId: cadResponsible
    });
    setSavedFeedback('Dados cadastrais atualizados com sucesso!');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  const handleSaveBriefing = () => {
    updateClientBriefing(client.id, briefing);
    setSavedFeedback('Briefing salvo com sucesso!');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  const handleCreatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdService.trim() || !pwdPass.trim()) return;
    addClientPassword(client.id, {
      service: pwdService,
      username: pwdUser,
      password: pwdPass,
      notes: pwdNotes,
      url: pwdUrl
    });
    setPwdService('');
    setPwdUser('');
    setPwdPass('');
    setPwdNotes('');
    setPwdUrl('');
    setShowAddPassword(false);
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    addClientFile(client.id, {
      name: fileName,
      category: fileCat,
      url: fileUrl || 'https://drive.google.com',
      size: fileSize || '2.0 MB'
    });
    setFileName('');
    setFileUrl('');
    setShowAddFile(false);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invNumber.trim()) return;
    addClientInvoice(client.id, {
      number: invNumber,
      monthRef: invMonth,
      value: Number(invValue) || 0,
      issueDate: invDate,
      status: invStatus,
      // Sem arquivo é `undefined`, não `'#'`. O `'#'` fazia a nota parecer
      // ter anexo e levava a lugar nenhum quando clicada no portal.
      fileUrl: invFileUrl || undefined
    });
    setInvNumber('');
    setInvFileUrl('');
    setShowAddInvoice(false);
  };

  /**
   * Os rótulos são **os mesmos do portal do cliente**, e isso é decisão.
   *
   * Eram outros: "Arquivos & Drive", "Cofre de Senhas", "Briefing da Marca".
   * A agência e o cliente olham para o mesmo conteúdo por duas portas, e ao
   * telefone cada lado chamava a aba de um jeito — "está no Cofre de Senhas"
   * / "aqui só tem Senhas". Nome divergente para a mesma coisa é atrito que
   * só aparece na conversa, nunca na tela.
   *
   * `ABAS_DO_PORTAL`, em `ClientPortalView`, é o outro lado desta lista.
   * `tests/abas-do-cliente.test.ts` falha se as duas divergirem de novo.
   */
  const tabs = [
    { id: 'cadastro', label: 'Cadastro', icon: User },
    // Sem contador: a lista vive no banco e só é carregada quando a aba
    // abre. Um número aqui teria que ser adivinhado a cada render.
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'conexoes', label: 'Conexões do perfil', icon: Radio },
    { id: 'arquivos', label: 'Arquivos', icon: FolderOpen, count: (client.files || []).length },
    { id: 'senhas', label: 'Senhas', icon: Key, count: (client.passwords || []).length },
    { id: 'notas', label: 'Notas Fiscais', icon: Receipt, count: (client.invoices || []).length },
    { id: 'briefing', label: 'Briefing', icon: FileText },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-6 pb-0 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button 
              onClick={onBack} 
              className="text-xs font-bold text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1.5 mb-2 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para lista de clientes
            </button>
            <div className="flex items-center gap-3">
              <Avatar
                nome={client.name}
                url={client.avatar}
                tamanho={44}
                formato="quadrado"
                className="border border-slate-200 dark:border-slate-800 shadow-xs"
              />
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <span>{client.name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                    client.status === 'active' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}>
                    {client.status === 'active' ? 'Cliente Ativo' : 'Inativo'}
                  </span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {client.segment} &bull; {client.phone}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BotaoDoPortal
              clientId={client.id}
              variante="destaque"
              rotulo="Visualizar como Cliente"
            />
          </div>
        </div>

        {/* Feedback Alert */}
        {savedFeedback && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            {savedFeedback}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pt-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    isActive 
                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-6 max-w-5xl">
        {/* TAB 1: CADASTRO */}
        {activeTab === 'cadastro' && (
          <form onSubmit={handleSaveCadastro} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Dados Cadastrais da Conta</h4>
                <p className="text-xs text-slate-500">Mantenha as informações fiscais e contratuais do cliente atualizadas.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Status Operacional:</span>
                <button
                  type="button"
                  onClick={() => setCadStatus(cadStatus === 'active' ? 'inactive' : 'active')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                    cadStatus === 'active' 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {cadStatus === 'active' ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome Fantasia / Marca</label>
                <input 
                  type="text" 
                  value={cadName} 
                  onChange={e => setCadName(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500" 
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Razão Social</label>
                <input 
                  type="text" 
                  value={cadLegalName} 
                  onChange={e => setCadLegalName(e.target.value)}
                  placeholder="Ex: Aroma Alimentos & Bebidas Eireli"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">CPF ou CNPJ</label>
                <input 
                  type="text" 
                  value={cadCpfCnpj} 
                  onChange={e => setCadCpfCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Segmento / Nicho</label>
                <input 
                  type="text" 
                  value={cadSegment} 
                  onChange={e => setCadSegment(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail de Contato</label>
                <input 
                  type="email" 
                  value={cadEmail} 
                  onChange={e => setCadEmail(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500" 
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Celular / WhatsApp</label>
                <input 
                  type="text" 
                  value={cadPhone} 
                  onChange={e => setCadPhone(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Website / Landing Page</label>
                <input 
                  type="text" 
                  value={cadWebsite} 
                  onChange={e => setCadWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Responsável na Agência</label>
                <select 
                  value={cadResponsible} 
                  onChange={e => setCadResponsible(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <FileUpload
                  label="Logo / Avatar da Empresa"
                  value={cadAvatar}
                  compact
                  imageOnly
                  onFileSelect={(file) => setCadAvatar(file.url)}
                  onFileRemove={() => setCadAvatar('')}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: USUÁRIOS DO PORTAL */}
        {activeTab === 'usuarios' && <ClientUsersTab client={client} />}

        {activeTab === 'conexoes' && (
          <ConexoesDoPerfil clientId={client.id} clientName={client.name} />
        )}

        {/* TAB 3: ARQUIVOS & DRIVE */}
        {activeTab === 'arquivos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Arquivos e Pastas do Cliente</h4>
                <p className="text-xs text-slate-500">Repositório de identidade visual, fotos brutas e pastas na nuvem.</p>
              </div>
              <button 
                onClick={() => setShowAddFile(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Adicionar Arquivo / Drive
              </button>
            </div>

            {/* Add File Modal/Form */}
            {showAddFile && (
              <form onSubmit={handleCreateFile} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-md space-y-4 animate-in fade-in">
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">Novo Arquivo ou Link do Google Drive</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Título do Arquivo *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Identidade Visual 2026 / Fotos do Ensaio" 
                      value={fileName} 
                      onChange={e => setFileName(e.target.value)} 
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Categoria</label>
                    <select 
                      value={fileCat} 
                      onChange={e => setFileCat(e.target.value as any)} 
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                    >
                      <option value="identidade_visual">Identidade Visual</option>
                      <option value="fotos">Fotos / Ensaio</option>
                      <option value="videos">Vídeos Brutos</option>
                      <option value="documentos">Documentos / Drive</option>
                      <option value="contratos">Contratos</option>
                      <option value="briefing">Briefing</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FileUpload
                    label="Selecionar Arquivo ou Inserir Link"
                    value={fileUrl}
                    fileName={fileName}
                    onFileSelect={(file) => {
                      setFileUrl(file.url);
                      if (!fileName) setFileName(file.name);
                      if (file.size) setFileSize(file.size);
                    }}
                    onFileRemove={() => setFileUrl('')}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddFile(false)} 
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg cursor-pointer transition"
                  >
                    Salvar Arquivo
                  </button>
                </div>
              </form>
            )}

            {/* File List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(client.files || []).map(file => (
                <div 
                  key={file.id} 
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 hover:border-purple-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900/40">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{file.name}</span>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="capitalize">{file.category.replace('_', ' ')}</span>
                        <span>&bull;</span>
                        <span>{file.size}</span>
                        <span>&bull;</span>
                        <span>{file.uploadedAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 text-slate-400 hover:text-purple-600 transition rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                      title="Abrir arquivo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={() => deleteClientFile(client.id, file.id)} 
                      className="p-2 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                      title="Excluir arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(client.files || []).length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  Nenhum arquivo ou link cadastrado para este cliente.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COFRE DE SENHAS */}
        {activeTab === 'senhas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Cofre de Senhas e Credenciais</h4>
                <p className="text-xs text-slate-500">Armazene de forma segura as senhas de Instagram, Meta Ads, TikTok e ferramentas do cliente.</p>
              </div>
              <button 
                onClick={() => setShowAddPassword(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nova Credencial
              </button>
            </div>

            {/* Add Password Form */}
            {showAddPassword && (
              <form onSubmit={handleCreatePassword} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-md space-y-4 animate-in fade-in">
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">Cadastrar Nova Credencial</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Serviço / Plataforma</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Instagram (@cliente)" 
                      value={pwdService} 
                      onChange={e => setPwdService(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Usuário / Login</label>
                    <input 
                      type="text" 
                      placeholder="Ex: email ou @usuario" 
                      value={pwdUser} 
                      onChange={e => setPwdUser(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Senha</label>
                    <input 
                      type="text" 
                      placeholder="Senha de acesso" 
                      value={pwdPass} 
                      onChange={e => setPwdPass(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800 font-mono" 
                      required 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Notas / Instruções 2FA</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Código SMS vai para celular do Rodrigo" 
                      value={pwdNotes} 
                      onChange={e => setPwdNotes(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Link de Acesso (URL)</label>
                    <input 
                      type="text" 
                      placeholder="https://..." 
                      value={pwdUrl} 
                      onChange={e => setPwdUrl(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddPassword(false)} 
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg"
                  >
                    Salvar Credencial
                  </button>
                </div>
              </form>
            )}

            {/* Credentials List */}
            <div className="space-y-3">
              {(client.passwords || []).map(pwd => {
                const isRevealed = showPasswordIds[pwd.id];
                return (
                  <div 
                    key={pwd.id} 
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-900/40">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">{pwd.service}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Usuário: <strong className="text-slate-700 dark:text-slate-300">{pwd.username}</strong>
                        </span>
                        {pwd.notes && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{pwd.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs">
                        <span className="mr-2 text-slate-700 dark:text-slate-200">
                          {isRevealed ? pwd.password : '••••••••••••'}
                        </span>
                        <button 
                          onClick={() => toggleShowPassword(pwd.id)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white mr-1 cursor-pointer"
                          title={isRevealed ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => handleCopy(pwd.password, pwd.id)}
                          className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
                          title="Copiar senha"
                        >
                          {copiedId === pwd.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button 
                        onClick={() => deleteClientPassword(client.id, pwd.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                        title="Excluir credencial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(client.passwords || []).length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  Nenhuma credencial cadastrada para este cliente.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: NOTAS FISCAIS */}
        {activeTab === 'notas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Notas Fiscais Emitidas</h4>
                <p className="text-xs text-slate-500">Acompanhamento e faturamento mensal das notas emitidas contra este cliente.</p>
              </div>
              <button 
                onClick={() => setShowAddInvoice(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Lançar Nova NF-e
              </button>
            </div>

            {/* Add Invoice Form */}
            {showAddInvoice && (
              <form onSubmit={handleCreateInvoice} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-md space-y-4 animate-in fade-in">
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">Lançamento de Nota Fiscal</h5>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Número da NF-e</label>
                    <input 
                      type="text" 
                      placeholder="NFS-e #2026-003" 
                      value={invNumber} 
                      onChange={e => setInvNumber(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Mês de Referência</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Março/2026" 
                      value={invMonth} 
                      onChange={e => setInvMonth(e.target.value)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Valor (R$)</label>
                    <input 
                      type="number" 
                      value={invValue} 
                      onChange={e => setInvValue(Number(e.target.value))} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800 font-mono" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Status Pagamento</label>
                    <select 
                      value={invStatus} 
                      onChange={e => setInvStatus(e.target.value as any)} 
                      className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                    >
                      <option value="pago">Pago</option>
                      <option value="pendente">Pendente</option>
                      <option value="emitido">Emitido</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FileUpload
                    label="Anexo da NF-e (PDF / XML / Comprovante)"
                    compact
                    accept="application/pdf,image/*,.xml"
                    value={invFileUrl}
                    onFileSelect={(file) => setInvFileUrl(file.url)}
                    onFileRemove={() => setInvFileUrl('')}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddInvoice(false)} 
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg"
                  >
                    Salvar Nota Fiscal
                  </button>
                </div>
              </form>
            )}

            {/* Invoices List */}
            <div className="space-y-3">
              {(client.invoices || []).map(inv => (
                <div 
                  key={inv.id} 
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/40">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">{inv.number}</span>
                      <span className="text-[11px] text-slate-400 block">Competência: {inv.monthRef} &bull; Emissão: {inv.issueDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      R$ {inv.value.toLocaleString('pt-BR')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md ${
                      inv.status === 'pago' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200' 
                        : inv.status === 'pendente' 
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200' 
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200'
                    }`}>
                      {inv.status}
                    </span>
                    <button 
                      onClick={() => deleteClientInvoice(client.id, inv.id)} 
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Excluir nota fiscal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(client.invoices || []).length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  Nenhuma nota fiscal lançada para este cliente.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: BRIEFING DA MARCA */}
        {activeTab === 'briefing' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Briefing & Manual Estratégico</h4>
                <p className="text-xs text-slate-500">Diretrizes de conteúdo, tom de voz, persona e objetivos da marca acessíveis para a equipe.</p>
              </div>
              <button 
                onClick={handleSaveBriefing}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Salvar Briefing
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Tom de Voz & Personalidade
                </label>
                <textarea 
                  rows={4}
                  value={briefing.brandVoice} 
                  onChange={e => setBriefing({ ...briefing, brandVoice: e.target.value })}
                  placeholder="Ex: Acolhedor, especialista, dinâmico, elegante..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Público-Alvo & Persona
                </label>
                <textarea 
                  rows={4}
                  value={briefing.targetAudience} 
                  onChange={e => setBriefing({ ...briefing, targetAudience: e.target.value })}
                  placeholder="Ex: Homens e mulheres de 25-45 anos, classe A/B, interessados em café especial..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Dores e Desejos do Cliente
                </label>
                <textarea 
                  rows={4}
                  value={briefing.painPoints} 
                  onChange={e => setBriefing({ ...briefing, painPoints: e.target.value })}
                  placeholder="Ex: O cliente busca conveniência, mas tem medo de produtos de baixa qualidade..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  4. Concorrentes e Referências de Mercado
                </label>
                <textarea 
                  rows={4}
                  value={briefing.competitors} 
                  onChange={e => setBriefing({ ...briefing, competitors: e.target.value })}
                  placeholder="Ex: @concorrenteA, @concorrenteB (gostamos do estilo de Reels da marca X)"
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  5. Regras de Marca & O que NÃO Fazer (Restrições)
                </label>
                <textarea 
                  rows={3}
                  value={briefing.brandGuidelines} 
                  onChange={e => setBriefing({ ...briefing, brandGuidelines: e.target.value })}
                  placeholder="Ex: Não usar emojis excessivos. Não usar memes depreciativos. Paleta oficial: #4A2C11..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  6. Metas & KPIs Principais do Mês
                </label>
                <textarea 
                  rows={3}
                  value={briefing.monthlyGoals} 
                  onChange={e => setBriefing({ ...briefing, monthlyGoals: e.target.value })}
                  placeholder="Ex: Alcançar 5.000 cliques no link da bio e gerar 80 leads pelo direct..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
