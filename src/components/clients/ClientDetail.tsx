import React, { useState } from 'react';
import { Client, ClientPassword, ClientInvoice, ClientFile, ClientBriefing } from '../../types';
import { BotaoDoPortal } from '../common/BotaoDoPortal';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard } from '../../lib/utils';
import {
  User, FolderOpen, Key, Receipt, FileText, Upload, Plus,
  ExternalLink, Eye, EyeOff, Copy, Trash2, Check, ArrowLeft,
  ShieldCheck, AlertCircle, Calendar, DollarSign, Globe, Phone, Mail,
  Share2, Sparkles, Building2, CheckCircle2, Users, Radio,
  Download, FileType2, Image as ImageIcon, Film, Sheet, Link2, Pencil, StickyNote
} from 'lucide-react';
import { FileUpload } from '../ui/file-upload';
import { Avatar } from '../common/Avatar';
import { ClientUsersTab } from './ClientUsersTab';
import { ConexoesDoPerfil } from './ConexoesDoPerfil';
import { EdicaoDeArquivo } from './EdicaoDeArquivo';
import { EditorDeNota } from './EditorDeNota';
import { Button } from '../ui/button';
import { ComTooltip } from '../ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsBadge } from '../ui/tabs';
import { useAviso } from '../ui/alert-dialog';
import {
  familiaDoArquivo,
  tipoDoArquivo,
  type FamiliaDeArquivo,
} from '../../lib/arquivosDoCliente';

/**
 * O ícone de cada família, e a cor de cada um.
 *
 * Fora do componente porque são constantes: dentro, o objeto nasceria de novo
 * a cada render, e um mapa de ícones recriado por linha da lista é trabalho
 * que não rende pixel nenhum.
 *
 * O PDF tem cor própria — foi o pedido, e é o formato que mais aparece em
 * contrato e briefing. Uma pasta roxa em cima de um contrato não diz nada
 * sobre o que vai abrir.
 */
const ICONE_DO_ARQUIVO: Record<FamiliaDeArquivo, typeof FolderOpen> = {
  pdf: FileType2,
  imagem: ImageIcon,
  video: Film,
  planilha: Sheet,
  documento: FileText,
  outro: Link2,
};

const CORES_DO_ARQUIVO: Record<FamiliaDeArquivo, string> = {
  pdf: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/40',
  imagem: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/40',
  video: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40',
  planilha: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40',
  documento: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  outro: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/40',
};

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
}

/** O filtro da lista de arquivos. `todos` não é um tipo de linha: é a ausência de filtro. */
type TipoDeArquivo = 'todos' | 'arquivo' | 'link' | 'nota';

export const ClientDetail: React.FC<ClientDetailProps> = ({ client, onBack }) => {
  const { 
    updateClient, 
    addClientPassword, 
    deleteClientPassword, 
    addClientInvoice, 
    deleteClientInvoice, 
    addClientFile, 
    updateClientFile,
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
  /** O arquivo aberto para correção. `null` = a modal fica fechada. */
  const [arquivoEmEdicao, setArquivoEmEdicao] = useState<ClientFile | null>(null);
  /** A nota aberta para ler ou editar. `null` = fechada. */
  const [notaAberta, setNotaAberta] = useState<ClientFile | null>(null);
  const [tipoVisivel, setTipoVisivel] = useState<TipoDeArquivo>('todos');
  const [fileName, setFileName] = useState('');
  const [fileCat, setFileCat] = useState<ClientFile['category']>('identidade_visual');
  const [fileUrl, setFileUrl] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileKind, setFileKind] = useState<ClientFile['kind']>('arquivo');
  /** O texto, quando o tipo é "Texto". */
  const [fileContent, setFileContent] = useState('');
  const [erroDoArquivo, setErroDoArquivo] = useState('');
  const [baixando, setBaixando] = useState<string | null>(null);
  const { avisar, dialogo: dialogoDeAviso } = useAviso();

  /**
   * Baixar de verdade, e não "abrir numa aba".
   *
   * `<a download>` **não funciona entre origens**: o arquivo mora no R2, em
   * outro domínio, e nesse caso o navegador ignora o atributo e navega até a
   * URL. PDF e imagem abrem na aba em vez de descer para a máquina — e o botão
   * escrito "baixar" teria feito outra coisa, que é a armadilha 9 na sua forma
   * mais barata.
   *
   * O caminho que funciona é buscar os bytes e entregar um blob da **própria**
   * origem, onde o `download` vale. Isso depende de o balde liberar `GET` no
   * CORS para este domínio — o `.env.example` já pede a regra por causa do
   * `PUT` do upload, e sem ela o `fetch` falha.
   *
   * Quando falha, o arquivo abre em outra aba e a tela **diz** que abriu em
   * vez de baixar, com o nome do que falta configurar. Cair para "abrir"
   * calado deixaria a pessoa procurando o arquivo na pasta de downloads.
   */
  const baixarArquivo = async (file: ClientFile) => {
    setBaixando(file.id);
    try {
      const resposta = await fetch(file.url);
      if (!resposta.ok) throw new Error(String(resposta.status));

      const blob = await resposta.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      window.open(file.url, '_blank', 'noopener,noreferrer');
      avisar({
        titulo: 'O arquivo abriu em outra aba',
        descricao:
          'O navegador não conseguiu baixar direto: o balde de arquivos precisa liberar o ' +
          'método GET para este endereço na política de CORS (a mesma regra que o envio já usa). ' +
          'Enquanto isso, salve pela aba que abriu.',
      });
    } finally {
      setBaixando(null);
    }
  };

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

  const fecharFormDeArquivo = () => {
    setShowAddFile(false);
    setFileName('');
    setFileUrl('');
    setFileSize('');
    setFileContent('');
    setFileCat('identidade_visual');
    setFileKind('arquivo');
    setErroDoArquivo('');
  };

  /**
   * O tipo decide o que é obrigatório, o que é gravado e o que fica vazio.
   *
   * **Duas invenções saíram daqui.** A versão anterior gravava
   * `url: fileUrl || 'https://drive.google.com'` e `size: fileSize || '2.0 MB'`:
   * quem salvasse sem escolher arquivo nenhum ficava com uma linha apontando
   * para a página do Drive, com "2,0 MB" de um arquivo que não existe. Número
   * e endereço inventados numa lista de arquivos é a armadilha 9 no lugar em
   * que a pessoa clica esperando abrir o que ela guardou.
   *
   * Agora cada tipo exige o que ele precisa e **deixa vazio o que não tem** —
   * o bloco de notas não tem tamanho, e o campo em branco diz isso melhor que
   * qualquer valor.
   */
  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    setErroDoArquivo('');

    if (!fileName.trim()) {
      setErroDoArquivo('Informe o título.');
      return;
    }

    if (fileKind === 'arquivo' && !fileUrl) {
      setErroDoArquivo('Escolha o arquivo a enviar, ou troque o tipo para Link.');
      return;
    }

    if (fileKind === 'link' && !fileUrl.trim()) {
      setErroDoArquivo('Cole o endereço da pasta ou do documento.');
      return;
    }

    addClientFile(client.id, {
      name: fileName.trim(),
      // A categoria é do conteúdo, e o texto não tem uma.
      category: fileKind === 'nota' ? 'notas' : fileCat,
      url: fileKind === 'nota' ? '' : fileUrl.trim(),
      // Só o arquivo enviado tem tamanho medido. Link e texto ficam vazios.
      size: fileKind === 'arquivo' ? fileSize : '',
      content: fileKind === 'nota' ? fileContent : undefined,
      // Gravado agora, escolhido por quem cadastra: a linha nova não depende
      // da adivinhação que `tipoDoArquivo()` faz pelas antigas.
      kind: fileKind,
    });

    fecharFormDeArquivo();
  };

  /** A mesma classe dos campos do formulário, num lugar só. */
  const classeDoCampo =
    'w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500';

  const arquivosDoCliente = client.files || [];
  const contarPorTipo = (tipo: 'arquivo' | 'link' | 'nota') =>
    arquivosDoCliente.filter((f) => tipoDoArquivo(f) === tipo).length;
  const arquivosVisiveis =
    tipoVisivel === 'todos'
      ? arquivosDoCliente
      : arquivosDoCliente.filter((f) => tipoDoArquivo(f) === tipoVisivel);

  /**
   * Editar o bloco de notas. **Criar não passa por aqui**: quem cria é o
   * formulário de cima, com o tipo "Texto" — ter os dois caminhos faria a
   * mesma linha nascer de dois lugares diferentes.
   */
  const salvarNota = (dados: { name: string; content: string }) => {
    if (notaAberta) updateClientFile(client.id, notaAberta.id, dados);
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
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto"
    >
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-6 pb-0 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" 
              onClick={onBack} 
              className="mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para lista de clientes
            </Button>
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
        <TabsList>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && <TabsBadge>{tab.count}</TabsBadge>}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {/* Main Tab Content */}
      <div className="p-6 max-w-5xl">
        {/* TAB 1: CADASTRO */}
        <TabsContent value="cadastro">
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
                  recorteQuadrado
                  onFileSelect={(file) => setCadAvatar(file.url)}
                  onFileRemove={() => setCadAvatar('')}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button 
                type="submit" 
              >
                Salvar Alterações
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* TAB 2: USUÁRIOS DO PORTAL */}
        <TabsContent value="usuarios"><ClientUsersTab client={client} /></TabsContent>

        <TabsContent value="conexoes">
          <ConexoesDoPerfil clientId={client.id} clientName={client.name} />
        </TabsContent>

        {/* TAB 3: ARQUIVOS & DRIVE */}
        <TabsContent value="arquivos">
          <div className="space-y-6">
            {/*
              **Uma lista só, com tipo.** Eram duas empilhadas — "Arquivos e
              Pastas" e "Anotações" — e elas fazem a mesma pergunta para quem
              usa: *o que a agência guardou sobre este cliente?* Duas listas
              pediam a mesma decisão duas vezes, e a de baixo, mais longe da
              dobra, era a que ninguém abria.
            */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Arquivos do Cliente</h4>
                <p className="text-xs text-slate-500">Anexos, links de pasta na nuvem e blocos de notas da equipe.</p>
              </div>
              {/* **Um botão só.** O "Novo bloco de notas" separado que existia
                  aqui era um segundo caminho para o mesmo formulário — e dois
                  caminhos para a mesma coisa divergem na primeira pressa. Quem
                  escolhe o que cadastrar é o tipo, dentro do formulário. */}
              <Button onClick={() => setShowAddFile(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>

            {/*
              O filtro é `segmentado` — a mesma peça do seletor Feed/Story da
              Prévia. Ele não troca de painel: muda **o que a mesma lista
              mostra**, que é exatamente o papel dessa variante.

              A contagem fica em cada aba porque tipo vazio escondido atrás de
              um filtro é tipo esquecido: sem o número, ninguém clica em "Links"
              para descobrir que não há nenhum.
            */}
            <Tabs value={tipoVisivel} onValueChange={(v) => setTipoVisivel(v as TipoDeArquivo)}>
              <TabsList aparencia="segmentado">
                <TabsTrigger value="todos">
                  Todos
                  {arquivosDoCliente.length > 0 && <TabsBadge>{arquivosDoCliente.length}</TabsBadge>}
                </TabsTrigger>
                <TabsTrigger value="arquivo">
                  Anexos
                  {contarPorTipo('arquivo') > 0 && <TabsBadge>{contarPorTipo('arquivo')}</TabsBadge>}
                </TabsTrigger>
                <TabsTrigger value="link">
                  Links
                  {contarPorTipo('link') > 0 && <TabsBadge>{contarPorTipo('link')}</TabsBadge>}
                </TabsTrigger>
                <TabsTrigger value="nota">
                  Bloco de notas
                  {contarPorTipo('nota') > 0 && <TabsBadge>{contarPorTipo('nota')}</TabsBadge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/*
              **O tipo é a primeira escolha, e ele governa o formulário.**

              Antes o primeiro seletor era "Categoria" (identidade visual,
              fotos, contratos…) e o **tipo era adivinhado** pelo que a pessoa
              fizesse depois: enviar um arquivo virava `arquivo`, colar um
              endereço virava `link`. Funcionava e escondia a decisão — quem
              queria só colar um link do Drive encarava uma área de arrastar
              arquivo, e não havia caminho nenhum para escrever um texto.

              Agora a pessoa diz o que vai cadastrar, e o campo de baixo é o
              daquilo: área de envio, campo de endereço ou campo de texto. Um
              formulário que mostra três campos e usa um é o mesmo que pedir
              que ela adivinhe qual vale.
            */}
            {showAddFile && (
              <form
                /*
                  `noValidate` **não** tira o `required` dos campos: ele fica
                  no DOM, que é o que leitor de tela anuncia. O que sai é a
                  bolha do navegador — ela tem a fonte e o cinza do sistema
                  operacional num produto whitelabel, e, pior, **barrava o
                  envio antes do `handleCreateFile` rodar**: a mensagem escrita
                  aqui, que diz o que fazer ("cole o endereço da pasta"), nunca
                  aparecia.
                */
                noValidate onSubmit={handleCreateFile} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-md space-y-4 animate-in fade-in">
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  {fileKind === 'nota'
                    ? 'Novo bloco de notas'
                    : fileKind === 'link'
                    ? 'Novo link'
                    : 'Novo arquivo'}
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Título *
                    </label>
                    <input
                      type="text"
                      placeholder={
                        fileKind === 'nota'
                          ? 'Ex: Dados comerciais'
                          : 'Ex: Identidade Visual 2026 / Fotos do Ensaio'
                      }
                      value={fileName}
                      onChange={e => setFileName(e.target.value)}
                      className={classeDoCampo}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Tipo de arquivo
                    </label>
                    <select
                      value={fileKind}
                      onChange={e => {
                        /*
                          Trocar de tipo **limpa o conteúdo do tipo anterior**.
                          Sem isto, quem enviasse um arquivo e trocasse para
                          "link" gravaria a linha com a URL do R2 marcada como
                          link — e a lista ofereceria "abrir em outra aba" para
                          um anexo, com o botão de baixar sumido.
                        */
                        setFileKind(e.target.value as ClientFile['kind']);
                        setFileUrl('');
                        setFileSize('');
                        setFileContent('');
                      }}
                      className={`${classeDoCampo} cursor-pointer`}
                    >
                      <option value="arquivo">Arquivo</option>
                      <option value="link">Link</option>
                      <option value="nota">Texto</option>
                    </select>
                  </div>
                </div>

                {/* A categoria é do **conteúdo**, e o texto não tem: um bloco
                    de notas não é identidade visual nem contrato. */}
                {fileKind !== 'nota' && (
                  <div className="sm:max-w-xs">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Categoria
                    </label>
                    <select
                      value={fileCat}
                      onChange={e => setFileCat(e.target.value as ClientFile['category'])}
                      className={`${classeDoCampo} cursor-pointer`}
                    >
                      <option value="identidade_visual">Identidade Visual</option>
                      <option value="fotos">Fotos / Ensaio</option>
                      <option value="videos">Vídeos Brutos</option>
                      <option value="documentos">Documentos / Drive</option>
                      <option value="contratos">Contratos</option>
                      <option value="briefing">Briefing</option>
                    </select>
                  </div>
                )}

                {fileKind === 'arquivo' && (
                  <FileUpload
                    label="Selecionar arquivo"
                    value={fileUrl}
                    fileName={fileName}
                    /* `allowUrlFallback={false}`: colar endereço agora é o tipo
                       "Link", e deixar os dois caminhos abertos aqui traria de
                       volta a adivinhação que o seletor veio resolver. */
                    allowUrlFallback={false}
                    onFileSelect={(file) => {
                      setFileUrl(file.url);
                      if (!fileName) setFileName(file.name);
                      setFileSize(file.size || '');
                    }}
                    onFileRemove={() => setFileUrl('')}
                  />
                )}

                {fileKind === 'link' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Link *
                    </label>
                    <input
                      type="url"
                      value={fileUrl}
                      onChange={e => setFileUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className={`${classeDoCampo} font-mono`}
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      A pasta continua onde está — o Orquesia guarda o endereço,
                      não uma cópia.
                    </p>
                  </div>
                )}

                {fileKind === 'nota' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Texto
                    </label>
                    <textarea
                      rows={8}
                      value={fileContent}
                      onChange={e => setFileContent(e.target.value)}
                      placeholder="O que a próxima pessoa precisa saber sobre este cliente."
                      className={`${classeDoCampo} leading-relaxed`}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Só a equipe da agência vê. Não aparece no Portal do Cliente.
                    </p>
                  </div>
                )}

                {erroDoArquivo && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                    {erroDoArquivo}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 [&>*]:w-full sm:[&>*]:w-auto">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={fecharFormDeArquivo}
                    className="dark:hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            )}

            {/* File List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {arquivosVisiveis.map(file => {
                const tipo = tipoDoArquivo(file);
                const familia = familiaDoArquivo(file);
                const Icone = ICONE_DO_ARQUIVO[familia];

                /*
                  **O bloco de notas tem card próprio, e precisa ter.**

                  No card de arquivo ele cairia no ramo de "baixar" — um botão
                  de download para um texto que não é arquivo nenhum. E o que
                  a pessoa quer ver numa nota é o começo do texto, não a
                  extensão e o tamanho que ela não tem.
                */
                if (tipo === 'nota') {
                  return (
                    <div
                      key={file.id}
                      className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-start justify-between gap-3 hover:border-purple-300 transition"
                    >
                      <button
                        type="button"
                        onClick={() => setNotaAberta(file)}
                        className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400">
                          <StickyNote className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {file.name}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 whitespace-pre-wrap">
                            {file.content || 'Bloco vazio.'}
                          </p>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {file.uploadedAt}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <ComTooltip texto="Abrir bloco de notas">
                          <Button variant="ghost" size="icon-sm" onClick={() => setNotaAberta(file)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </ComTooltip>
                        <ComTooltip texto="Excluir bloco de notas">
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => deleteClientFile(client.id, file.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </ComTooltip>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={file.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 hover:border-purple-300 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/*
                        O ícone diz o que vai abrir. Era `FolderOpen` para tudo
                        — contrato em PDF, foto e link do Drive com a mesma
                        pasta —, e "pasta" é justamente o que nenhum deles é.
                      */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${CORES_DO_ARQUIVO[familia]}`}>
                        <Icone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{file.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span className="capitalize">{file.category.replace('_', ' ')}</span>
                          <span>&bull;</span>
                          <span>{tipo === 'link' ? 'Link externo' : file.size}</span>
                          <span>&bull;</span>
                          <span>{file.uploadedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/*
                        Duas ações diferentes, porque são duas coisas
                        diferentes: o anexo é nosso e desce para a máquina; o
                        link é a pasta de outra pessoa e abre onde ela mora.
                        Um só ícone para os dois fazia "abrir" a única saída
                        para um arquivo que a pessoa quer guardar.
                      */}
                      {tipo === 'link' ? (
                        <ComTooltip texto="Abrir link em nova aba">
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        </ComTooltip>
                      ) : (
                        <ComTooltip texto="Baixar arquivo">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={baixando === file.id}
                            onClick={() => baixarArquivo(file)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </ComTooltip>
                      )}
                      {/*
                        **Editar vem antes de excluir, e é por isso que ele
                        existe.** Sem o lápis, corrigir um nome digitado errado
                        ou trocar a categoria passava por apagar e cadastrar de
                        novo — e num link externo isso perde a URL, que é a
                        única coisa que a linha carrega.
                      */}
                      <ComTooltip texto="Editar arquivo">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setArquivoEmEdicao(file)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </ComTooltip>
                      <ComTooltip texto="Excluir arquivo">
                        <Button variant="destructive" size="icon-sm"
                          onClick={() => deleteClientFile(client.id, file.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </ComTooltip>
                    </div>
                  </div>
                );
              })}
              {arquivosVisiveis.length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  {tipoVisivel === 'nota'
                    ? 'Nenhum bloco de notas. Use o botão acima para escrever o primeiro.'
                    : tipoVisivel === 'todos'
                    ? 'Nenhum arquivo, link ou bloco de notas cadastrado para este cliente.'
                    : 'Nenhum item deste tipo. Troque o filtro acima para ver os outros.'}
                </div>
              )}
            </div>

            <EdicaoDeArquivo
              arquivo={arquivoEmEdicao}
              aoFechar={() => setArquivoEmEdicao(null)}
              aoSalvar={(dados) =>
                arquivoEmEdicao && updateClientFile(client.id, arquivoEmEdicao.id, dados)
              }
            />

            <EditorDeNota
              nota={notaAberta}
              aoFechar={() => setNotaAberta(null)}
              aoSalvar={salvarNota}
            />
          </div>
        </TabsContent>

        {/* TAB 3: COFRE DE SENHAS */}
        <TabsContent value="senhas">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Cofre de Senhas e Credenciais</h4>
                <p className="text-xs text-slate-500">Armazene de forma segura as senhas de Instagram, Meta Ads, TikTok e ferramentas do cliente.</p>
              </div>
              <Button 
                onClick={() => setShowAddPassword(true)}
              >
                <Plus className="w-4 h-4" />
                Nova Credencial
              </Button>
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
                  <Button variant="ghost" 
                    type="button" 
                    onClick={() => setShowAddPassword(false)} 
                    className="dark:hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                  >
                    Salvar Credencial
                  </Button>
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
                        <Button variant="ghost" size="icon-sm" 
                          onClick={() => toggleShowPassword(pwd.id)}
                          className="dark:hover:text-white mr-1"
                          title={isRevealed ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" 
                          onClick={() => handleCopy(pwd.password, pwd.id)}
                          title="Copiar senha"
                        >
                          {copiedId === pwd.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>

                      <Button variant="destructive" size="icon-sm" 
                        onClick={() => deleteClientPassword(client.id, pwd.id)}
                        title="Excluir credencial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
        </TabsContent>

        {/* TAB 4: NOTAS FISCAIS */}
        <TabsContent value="notas">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Notas Fiscais Emitidas</h4>
                <p className="text-xs text-slate-500">Acompanhamento e faturamento mensal das notas emitidas contra este cliente.</p>
              </div>
              <Button 
                onClick={() => setShowAddInvoice(true)}
              >
                <Plus className="w-4 h-4" />
                Lançar Nova NF-e
              </Button>
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
                  <Button variant="ghost" 
                    type="button" 
                    onClick={() => setShowAddInvoice(false)} 
                    className="dark:hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                  >
                    Salvar Nota Fiscal
                  </Button>
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
                    <Button variant="destructive" size="icon-sm" 
                      onClick={() => deleteClientInvoice(client.id, inv.id)} 
                      title="Excluir nota fiscal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
        </TabsContent>

        {/* TAB 5: BRIEFING DA MARCA */}
        <TabsContent value="briefing">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Briefing & Manual Estratégico</h4>
                <p className="text-xs text-slate-500">Diretrizes de conteúdo, tom de voz, persona e objetivos da marca acessíveis para a equipe.</p>
              </div>
              <Button 
                onClick={handleSaveBriefing}
              >
                Salvar Briefing
              </Button>
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
        </TabsContent>
      </div>

      {/*
        O `avisar` não abre nada sem esta linha: o hook devolve o diálogo e
        quem chamou precisa pô-lo na árvore. Esquecer não quebra `tsc`, nem o
        vitest, nem o build — o download falharia calado, que é exatamente o
        que ele existe para não fazer.
      */}
      {dialogoDeAviso}
    </Tabs>
  );
};
