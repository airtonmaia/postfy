import {
  LayoutDashboard,
  Kanban,
  Images,
  Users,
  Briefcase,
  Send,
  BarChart3,
  Zap,
  Settings,
  DollarSign,
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
} from 'lucide-react';
import type { TabType } from '../../types';

/**
 * O menu da agência, num lugar só.
 *
 * Ele morava dentro do `App.tsx`, e isso bastou enquanto a barra lateral era a
 * única a desenhá-lo. Deixou de bastar quando o Dashboard passou a mostrar os
 * atalhos no celular: duas listas do mesmo menu divergem na primeira pressa —
 * é a história das doze alturas de botão e das sete barras de abas —, e
 * divergir **aqui** tem um custo próprio: um menu novo que não aparece nos
 * atalhos é uma tela que a pessoa no telefone simplesmente não encontra.
 *
 * Quem desenha continua sendo cada tela. O que mora aqui é a lista, a ordem e
 * o ícone.
 */

export interface ItemDoMenu {
  id: TabType;
  label: string;
  icon: React.FC<{ className?: string }>;
}

/**
 * A ordem é a do produto, e ela significa alguma coisa: o que se faz todo dia
 * em cima, a configuração embaixo.
 *
 * O calendário **não** está aqui de propósito — ele virou uma visão do
 * WorkFlow, alternada por `AlternarVisaoDoWorkflow`. A aba continua existindo
 * em `TabType`, nas permissões e em `/calendario`, porque tirar a rota
 * quebraria o favorito de quem já usa o endereço.
 */
export const ITENS_DO_MENU: ItemDoMenu[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'producao', label: 'WorkFlow', icon: Kanban },
  { id: 'biblioteca', label: 'Biblioteca', icon: Images },
  { id: 'clientes', label: 'Clientes (360°)', icon: Users },
  { id: 'comercial', label: 'Comercial & Vendas', icon: Briefcase },
  { id: 'publicacoes', label: 'Fila de Publicações', icon: Send },
  { id: 'relatorios', label: 'Relatórios & BI', icon: BarChart3 },
  { id: 'automacoes', label: 'Automações', icon: Zap },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

/** O grupo do Financeiro: a cabeça que abre, e as cinco telas dentro. */
export const CABECA_DO_FINANCEIRO = {
  id: 'financeiro' as TabType,
  label: 'Financeiro',
  icon: DollarSign as React.FC<{ className?: string }>,
};

export const FILHOS_DO_FINANCEIRO: ItemDoMenu[] = [
  { id: 'financeiro', label: 'Visão geral', icon: PieChart },
  { id: 'financeiro_receber', label: 'Receber', icon: TrendingUp },
  { id: 'financeiro_pagar', label: 'Pagar', icon: TrendingDown },
  { id: 'financeiro_relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'financeiro_caixa', label: 'Caixa', icon: Wallet },
];

/**
 * O menu como uma lista plana, para quem desenha atalho em vez de árvore.
 *
 * O Financeiro entra pela **cabeça**, não pelos cinco filhos: um atalho é um
 * toque para chegar a um assunto, e cinco ladrilhos de dinheiro ao lado de
 * nove telas diria que o Financeiro é metade do produto. Quem entra pela
 * cabeça cai na visão geral, que é onde o assunto começa.
 *
 * A posição é a mesma da barra lateral — depois de Comercial & Vendas —, e a
 * reserva no fim existe pelo motivo de sempre: um papel que tivesse o
 * Financeiro e não tivesse o Comercial perderia o item sem ninguém notar.
 */
export const menuPlano = (podeVer: (aba: TabType) => boolean): ItemDoMenu[] => {
  const lista: ItemDoMenu[] = [];
  const temFinanceiro = FILHOS_DO_FINANCEIRO.some((filho) => podeVer(filho.id));

  for (const item of ITENS_DO_MENU) {
    if (!podeVer(item.id)) continue;
    lista.push(item);
    if (item.id === 'comercial' && temFinanceiro) lista.push(CABECA_DO_FINANCEIRO);
  }

  if (temFinanceiro && !lista.some((i) => i.id === CABECA_DO_FINANCEIRO.id)) {
    lista.push(CABECA_DO_FINANCEIRO);
  }

  return lista;
};
