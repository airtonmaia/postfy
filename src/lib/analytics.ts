import posthog from 'posthog-js';

/**
 * PostHog, configurado para um sistema que exibe dados sensíveis.
 *
 * Esta aplicação mostra na tela contratos, faturamento, dados de clientes e um
 * cofre de senhas. Analytics aqui precisa ser conservador por padrão, não
 * permissivo: qualquer captura automática de conteúdo vazaria isso para fora.
 *
 * As decisões tomadas:
 *  - session replay DESLIGADO. Gravar a tela de quem opera o cofre de senhas
 *    seria copiar as credenciais dos clientes para outro fornecedor.
 *  - autocapture DESLIGADO. Ele registra texto de botões e links, que aqui
 *    carregam nome de cliente e de campanha.
 *  - mascaramento de todo input, inclusive os que não são de senha.
 *  - identificação pelo id do usuário, sem e-mail nem nome.
 *  - nada de propriedade livre: só eventos nomeados, definidos aqui.
 */

const CHAVE = (import.meta as any).env?.VITE_POSTHOG_KEY || '';
const HOST = (import.meta as any).env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let ligado = false;

export const iniciarAnalytics = (): void => {
  if (ligado || !CHAVE) return;
  if (typeof window === 'undefined') return;

  posthog.init(CHAVE, {
    api_host: HOST,
    // Sem captura automática: aqui ela pegaria nome de cliente e de campanha.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    persistence: 'localStorage+cookie',
    // Respeita quem pediu para não ser rastreado.
    respect_dnt: true,
    loaded: (ph) => {
      if ((import.meta as any).env?.DEV) ph.debug(false);
    },
  });

  ligado = true;
};

/** Vincula os eventos ao usuário pelo id. Sem e-mail, sem nome. */
export const identificar = (userId: string, papel: string): void => {
  if (!ligado || !userId) return;
  posthog.identify(userId, { papel });
};

export const encerrarIdentificacao = (): void => {
  if (!ligado) return;
  posthog.reset();
};

/**
 * Eventos permitidos. Lista fechada de propósito: uma função que aceitasse
 * nome e payload livres acabaria carregando dado de cliente mais cedo ou
 * mais tarde.
 */
export type EventoDeProduto =
  | 'tela_aberta'
  | 'conteudo_criado'
  | 'conteudo_aprovado'
  | 'ajuste_solicitado'
  | 'cliente_criado'
  | 'proposta_criada'
  | 'convite_enviado'
  | 'ia_utilizada'
  | 'arquivo_enviado';

/** Só valores categóricos entram como propriedade — nunca texto do usuário. */
type PropriedadesSeguras = Record<string, string | number | boolean>;

export const registrar = (evento: EventoDeProduto, props?: PropriedadesSeguras): void => {
  if (!ligado) return;
  posthog.capture(evento, props);
};

export const analyticsAtivo = (): boolean => ligado;
