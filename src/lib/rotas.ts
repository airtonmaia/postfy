import type { TabType } from '../types';

/**
 * URL de cada tela.
 *
 * A navegação era só estado em memória: a barra de endereço nunca mudava, e
 * um F5 devolvia a pessoa para o Dashboard, tivesse ela passado a manhã
 * inteira no Kanban. Também não dava para mandar link de tela para ninguém,
 * nem usar o voltar do navegador.
 *
 * O mapa vive aqui, e não espalhado pelos componentes, porque ele precisa
 * funcionar nos dois sentidos e sem buraco: toda aba tem caminho, todo
 * caminho conhecido tem aba. `tests/rotas.test.ts` confere a ida e a volta.
 *
 * O deploy depende do rewrite em `vercel.json`, que serve o index.html para
 * qualquer caminho fora de `/api`. Sem ele o F5 em `/calendario` vira 404 da
 * própria Vercel, antes de o app existir — e nada disso aparece no CI, que
 * não valida `vercel.json` (armadilha 6).
 */

/**
 * Nomes pensados para serem lidos, não para espelhar o identificador interno:
 * a aba `producao` é o "Quadro Kanban" no menu, então a URL é `/kanban`.
 *
 * O que é do dono do produto fica sob `/super-admin`, o que deixa óbvio no
 * link — e num print — que aquilo não é tela de agência.
 */
export const CAMINHOS: Record<TabType, string> = {
  dashboard: '/dashboard',
  calendario: '/calendario',
  producao: '/kanban',
  aprovacoes: '/aprovacoes',
  clientes: '/clientes',
  comercial: '/comercial',
  publicacoes: '/publicacoes',
  relatorios: '/relatorios',
  automacoes: '/automacoes',
  configuracoes: '/configuracoes',
  saas_planos: '/super-admin/planos',
  saas_financeiro: '/super-admin/financeiro',
  saas_agencias: '/super-admin/agencias',
  saas_emails: '/super-admin/emails',
  saas_integracoes: '/super-admin/integracoes',
  saas_usuarios: '/super-admin/usuarios',
};

export const ABA_INICIAL: TabType = 'dashboard';

/** Abas de Configurações: viram o segundo trecho de `/configuracoes/...`. */
export const ABAS_DE_CONFIGURACOES = [
  'overview',
  'whitelabel',
  'integrations',
  'preferences',
  'communication',
  'users',
  'teams',
] as const;

export type AbaDeConfiguracoes = (typeof ABAS_DE_CONFIGURACOES)[number];

/**
 * O identificador da aba é em inglês por acidente histórico, mas a URL é
 * lida por quem usa o sistema — e o sistema é em português.
 */
const CAMINHO_DE_CONFIGURACOES: Record<AbaDeConfiguracoes, string> = {
  overview: 'geral',
  whitelabel: 'whitelabel',
  integrations: 'integracoes',
  preferences: 'preferencias',
  communication: 'comunicacao',
  users: 'usuarios',
  teams: 'equipes',
};

const normalizar = (caminho: string): string => {
  const limpo = caminho.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return limpo.startsWith('/') ? limpo.toLowerCase() : `/${limpo.toLowerCase()}`;
};

/** Aba correspondente ao caminho, ou null se o caminho não for de nenhuma. */
export const abaDoCaminho = (caminho: string): TabType | null => {
  const alvo = normalizar(caminho);
  if (alvo === '' || alvo === '/') return ABA_INICIAL;

  // Configurações casa por prefixo, para `/configuracoes/usuarios` também
  // cair na aba de configurações.
  if (alvo === CAMINHOS.configuracoes || alvo.startsWith(`${CAMINHOS.configuracoes}/`)) {
    return 'configuracoes';
  }

  const encontrada = (Object.keys(CAMINHOS) as TabType[]).find(
    (aba) => CAMINHOS[aba] === alvo
  );
  return encontrada ?? null;
};

/** Caminho da aba. Aceita a sub-aba de Configurações. */
export const caminhoDaAba = (aba: TabType, subAba?: string): string => {
  const base = CAMINHOS[aba] ?? CAMINHOS[ABA_INICIAL];
  if (aba !== 'configuracoes' || !subAba) return base;

  const trecho = CAMINHO_DE_CONFIGURACOES[subAba as AbaDeConfiguracoes];
  // Sub-aba desconhecida cai na tela de configurações, não numa URL quebrada.
  return trecho ? `${base}/${trecho}` : base;
};

/**
 * Sub-aba de Configurações a partir do caminho.
 * `/configuracoes` sem nada depois abre a primeira, como sempre abriu.
 */
export const subAbaDeConfiguracoes = (caminho: string): AbaDeConfiguracoes => {
  const alvo = normalizar(caminho);
  const trecho = alvo.slice(CAMINHOS.configuracoes.length + 1);
  const encontrada = ABAS_DE_CONFIGURACOES.find(
    (aba) => CAMINHO_DE_CONFIGURACOES[aba] === trecho
  );
  return encontrada ?? 'overview';
};

/**
 * Caminho atual, preservando a query.
 *
 * `?portal=` e `?invite=` são lidos em outros pontos do app: trocar de tela
 * não pode perdê-los, ou o portal do cliente fecharia sozinho ao navegar.
 */
export const urlDaAba = (aba: TabType, subAba?: string, busca = ''): string =>
  `${caminhoDaAba(aba, subAba)}${busca || ''}`;

/**
 * Prévia interna do Portal do Cliente, para a equipe da agência.
 *
 * Não é uma aba (`TabType`): é uma sobreposição independente da tela de
 * fundo, então fica fora do mapa `CAMINHOS` de propósito — igual ao link
 * externo `?portal=<token>`, que também não passa por `abaDoCaminho`.
 *
 * O id vai cru na query porque só vale para quem já está logado como equipe
 * (`portalClientId` em PostfyContext só resolve com `isAuthenticated`); não é
 * o mesmo caso do token opaco do link externo, que precisa ser não-enumerável
 * porque abre para qualquer um.
 */
export const CAMINHO_PORTAL_PREVIEW = '/portal-do-cliente';

export const urlDaPreviaDoPortal = (clienteId: string, slugDaAgencia?: string): string => {
  const params = new URLSearchParams({ cliente: clienteId });
  if (slugDaAgencia) params.set('agencia', slugDaAgencia);
  return `${CAMINHO_PORTAL_PREVIEW}?${params}`;
};

/**
 * Link do portal para mandar ao cliente.
 *
 * Leva a agência, e não o cliente: quem chega prova quem é pelo código no
 * e-mail, e é esse código que decide o que ele vê. O parâmetro serve só para
 * a porta abrir com a marca certa — sem ele o cliente da "Pulmin" chega numa
 * página do Orquesia e conclui que errou o endereço.
 *
 * Vai o `slug`, não o nome. O nome tem acento, espaço e repete entre
 * agências; o slug é único no banco e já nasce com formato de URL. E ele
 * sobrevive à agência ser renomeada, que é quando um link antigo quebraria.
 */
export const urlDoPortalDaAgencia = (slugDaAgencia: string, origem = ''): string =>
  `${origem}${CAMINHO_PORTAL_PREVIEW}?agencia=${encodeURIComponent(slugDaAgencia)}`;

/** Slug na URL, para a porta do portal saber de quem é a marca. */
export const agenciaDoCaminho = (busca: string): string | null => {
  try {
    return new URLSearchParams(busca).get('agencia');
  } catch {
    return null;
  }
};
