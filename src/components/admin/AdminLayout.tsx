import React, { useState } from 'react';
import {
  Building2,
  Users,
  Crown,
  DollarSign,
  BarChart3,
  Mail,
  Plug,
  Search,
  Palette,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ShieldAlert,
} from 'lucide-react';

import { usePostfy } from '../../context/PostfyContext';
import { MarcaOrquesia } from '../common/MarcaOrquesia';
import { Avatar } from '../common/Avatar';
import { tela } from '../../lib/telaSobDemanda';
import { ABA_INICIAL } from '../../lib/rotas';
import type { TabType } from '../../types';

/**
 * A área do dono do produto.
 *
 * Antes ela era um submenu recolhível dentro da barra lateral da agência.
 * Isso obrigava quem administra o Orquesia a fazê-lo de dentro de uma agência
 * qualquer — com o seletor de clientes, o filtro e o "Novo Conteúdo" na tela,
 * e a marca de whitelabel da agência no topo. Duas responsabilidades
 * diferentes disputando a mesma casca.
 *
 * Aqui a casca é a mesma em desenho — barra lateral de 256px, cabeçalho de
 * 56px, os mesmos cantos e as mesmas cores — e diferente em conteúdo: nada
 * de agência, nada de cliente, e a marca no topo é a do Orquesia, sempre. É a
 * única tela do sistema que **não** é whitelabel, de propósito: quem está
 * aqui administra o produto, não uma marca dele.
 *
 * A autorização é a mesma de sempre: `platform_admins`, conferida no banco.
 * Esconder o menu é conveniência; quem recorta o dado é a RLS. Se esta flag
 * fosse forjada no navegador, as telas abririam vazias em vez de vazar.
 */

const AdminAgenciasView = tela(() => import('./AdminAgenciasView'), 'AdminAgenciasView');
const AdminUsuariosView = tela(() => import('./AdminUsuariosView'), 'AdminUsuariosView');
const AdminPlanosView = tela(() => import('./AdminPlanosView'), 'AdminPlanosView');
const AdminFinanceiroView = tela(() => import('./AdminFinanceiroView'), 'AdminFinanceiroView');
const AdminRelatoriosView = tela(() => import('./AdminRelatoriosView'), 'AdminRelatoriosView');
const AdminEmailsView = tela(() => import('./AdminEmailsView'), 'AdminEmailsView');
const AdminIntegracoesView = tela(() => import('./AdminIntegracoesView'), 'AdminIntegracoesView');
const AdminSeoView = tela(() => import('./AdminSeoView'), 'AdminSeoView');
const AdminDesignView = tela(() => import('./AdminDesignView'), 'AdminDesignView');

interface ItemDoMenu {
  id: TabType;
  label: string;
  icon: React.FC<{ className?: string }>;
}

/**
 * Os menus em grupos.
 *
 * Nove itens numa lista corrida viram uma parede: ninguém acha "E-mails do
 * Sistema" no meio de "Financeiro" e "Design". O agrupamento é por pergunta
 * que a pessoa chega fazendo — quem usa, quanto rende, como o produto se
 * comporta, como ele se parece.
 */
export const GRUPOS_DO_ADMIN: { titulo: string; itens: ItemDoMenu[] }[] = [
  {
    titulo: 'Base',
    itens: [
      { id: 'admin_agencias', label: 'Agências', icon: Building2 },
      { id: 'admin_usuarios', label: 'Usuários', icon: Users },
    ],
  },
  {
    titulo: 'Receita',
    itens: [
      { id: 'admin_planos', label: 'Planos', icon: Crown },
      { id: 'admin_financeiro', label: 'Financeiro', icon: DollarSign },
      { id: 'admin_relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    titulo: 'Plataforma',
    itens: [
      { id: 'admin_emails', label: 'E-mails do Sistema', icon: Mail },
      { id: 'admin_integracoes', label: 'Integrações', icon: Plug },
    ],
  },
  {
    titulo: 'Apresentação',
    itens: [
      { id: 'admin_seo', label: 'SEO', icon: Search },
      { id: 'admin_design', label: 'Design', icon: Palette },
    ],
  },
];

const CarregandoTela: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
  </div>
);

export const AdminLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    isPlatformAdmin,
    logout,
    theme,
    setTheme,
    aparencia,
  } = usePostfy();

  const [menuAberto, setMenuAberto] = useState(false);

  /**
   * A versão escura do logo só vale no tema escuro, e só se existir: nem toda
   * marca precisa de duas. Sem a alternativa, a clara serve nos dois — é
   * melhor que voltar para a marca genérica só porque o tema mudou.
   */
  const logoDoProduto =
    (theme === 'dark' ? aparencia.logoEscuroUrl : null) || aparencia.logoUrl;

  /**
   * Quem não é dono do produto vê uma recusa, e não o Dashboard.
   *
   * Redirecionar calado esconderia o link errado: a pessoa clicou em algo,
   * foi parar noutro lugar e não sabe por quê. E manda a mensagem oposta —
   * que `/admin` talvez não exista, quando ele existe e não é dela.
   */
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-sm text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
          <h1 className="text-sm font-bold text-slate-900 dark:text-white">
            Esta área é da administração do Orquesia
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Ser dono da sua agência não dá acesso aqui: são coisas diferentes. Quem
            administra o produto está na tabela <code className="font-mono">platform_admins</code>,
            e essa lista só muda direto no banco.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab(ABA_INICIAL)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para a minha agência
          </button>
        </div>
      </div>
    );
  }

  const abrir = (aba: TabType) => {
    setActiveTab(aba);
    setMenuAberto(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 md:relative md:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="min-h-0 flex flex-col">
          {/*
            A marca do **produto**, e não a da agência: no app da agência este
            mesmo canto é o seletor de agência, com a marca dela.

            Ela vem de `saas_settings`, que é o que Admin → Design edita — e
            aquela tela já dizia, em texto, que o logo enviado "aparece na tela
            de entrada, no cadastro de agência e nesta área". Aqui estava
            desenhada a marca fixa do código, então a promessa não se cumpria:
            quem trocava o logo não via diferença nenhuma no /admin.

            O SVG local continua sendo o fundo do poço, para quem nunca
            enviou logo — ele não depende de rede e não quebra se um arquivo
            sumir, que é o motivo de ele existir.
          */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            {logoDoProduto ? (
              <img
                src={logoDoProduto}
                alt=""
                className="w-[34px] h-[34px] rounded-lg object-cover shrink-0"
              />
            ) : (
              <MarcaOrquesia tamanho={34} className="shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                {aparencia.nome}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Administração
              </span>
            </div>
            <button
              onClick={() => setMenuAberto(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="px-2 py-3 space-y-4 overflow-y-auto">
            {GRUPOS_DO_ADMIN.map((grupo) => (
              <div key={grupo.titulo} className="space-y-1">
                <span className="block px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {grupo.titulo}
                </span>
                {grupo.itens.map((item) => {
                  const Icon = item.icon;
                  const ativo = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => abrir(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        ativo
                          ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          ativo ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab(ABA_INICIAL)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>Voltar para a agência</span>
          </button>

          <div className="flex items-center gap-1 border-t border-slate-200 dark:border-slate-800/80 pt-2">
            <div className="flex-1 flex items-center gap-2.5 p-2 min-w-0">
              <Avatar
                nome={currentUser?.name || 'Usuário'}
                url={currentUser?.avatar}
                tamanho={32}
                className="border border-slate-200 dark:border-slate-700"
              />
              <div className="min-w-0">
                <span className="font-bold text-slate-800 dark:text-white block truncate text-xs">
                  {currentUser?.name || 'Usuário'}
                </span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold block truncate">
                  admin da plataforma
                </span>
              </div>
            </div>

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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMenuAberto(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* A faixa existe para não haver dúvida de onde a pessoa está: as
                telas daqui mexem em toda a base, não numa agência. */}
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900 px-2.5 py-1 rounded-full">
              Administração do produto
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <React.Suspense fallback={<CarregandoTela />}>
            {activeTab === 'admin_agencias' && <AdminAgenciasView />}
            {activeTab === 'admin_usuarios' && <AdminUsuariosView />}
            {activeTab === 'admin_planos' && <AdminPlanosView />}
            {activeTab === 'admin_financeiro' && <AdminFinanceiroView />}
            {activeTab === 'admin_relatorios' && <AdminRelatoriosView />}
            {activeTab === 'admin_emails' && <AdminEmailsView />}
            {activeTab === 'admin_integracoes' && <AdminIntegracoesView />}
            {activeTab === 'admin_seo' && <AdminSeoView />}
            {activeTab === 'admin_design' && <AdminDesignView />}
          </React.Suspense>
        </main>
      </div>
    </div>
  );
};
