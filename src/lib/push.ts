import { supabase } from './supabase';

/**
 * Notificação no aparelho, com o Orquesia fechado.
 *
 * O sino resolve quem está olhando a tela; este arquivo resolve o resto —
 * que é o caso que custa dinheiro: o cliente aprova às 22h de domingo e a
 * agência descobre na segunda.
 *
 * **A inscrição é gravada direto no Supabase, sem rota.** O plano do qual
 * esta entrega saiu mandava `fetch('/api/push/subscribe')`, que é como se
 * faz no Next. Aqui não cabe: `api/` está em 12 de 12 funções do plano Hobby
 * e a 13ª derruba o deploy inteiro (armadilha 6). E não é preciso — a RLS
 * de `push_subscriptions` é por dono (`auth.uid() = user_id`), então o
 * navegador grava a própria linha e nenhuma outra. A rota era exigência do
 * framework, não do Web Push.
 */

/**
 * A chave pública VAPID, do bundle.
 *
 * Ela **é pública por definição** — o navegador a manda para o serviço de
 * push, e é a privada, que fica na Vercel, que assina. Mesmo caso da chave
 * publicável do Supabase.
 */
const CHAVE_PUBLICA = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

export type EstadoDoPush =
  | 'sem-suporte'
  | 'sem-chave'
  | 'precisa-instalar'
  | 'bloqueado'
  | 'desligado'
  | 'ligado';

/** O navegador tem as três peças que o Web Push exige. */
const temSuporte = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/**
 * No iPhone, Web Push **só existe com o app na tela de início**.
 *
 * A partir do iOS 16.4 o Safari suporta push, e só dentro de um app
 * instalado: no Safari comum `PushManager` sequer aparece. Sem dizer isso em
 * texto, o botão simplesmente não faria nada num iPhone, e a conclusão de
 * quem clica é que o produto está quebrado.
 */
export const ehIosSemInstalar = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const instalado =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return ios && !instalado;
};

export const estadoDoPush = async (): Promise<EstadoDoPush> => {
  if (ehIosSemInstalar()) return 'precisa-instalar';
  if (!temSuporte()) return 'sem-suporte';
  if (!CHAVE_PUBLICA) return 'sem-chave';
  if (Notification.permission === 'denied') return 'bloqueado';

  const registro = await navigator.serviceWorker.getRegistration('/sw.js');
  const inscricao = await registro?.pushManager.getSubscription();
  return inscricao ? 'ligado' : 'desligado';
};

/**
 * O formato que o `PushManager` exige: a chave em bytes, não em base64url.
 *
 * O `+` e o `/` precisam voltar do alfabeto url-safe, e o padding também —
 * sem ele o `atob` recusa a string. É o trecho que todo tutorial copia, e é
 * copiado porque não há atalho.
 */
const paraBytes = (base64url: string): Uint8Array => {
  const preenchido = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bruto = atob(preenchido);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
};

/**
 * Pede a permissão, inscreve o aparelho e grava a linha.
 *
 * **Só pode ser chamada de um clique.** O navegador ignora (e o Safari
 * recusa) um `requestPermission` que não venha de um gesto do usuário, e a
 * caixa de permissão aparecendo sozinha no carregamento é o caminho mais
 * curto para a pessoa clicar em "bloquear" — que é uma decisão difícil de
 * desfazer, porque depois disso o site não pode mais nem perguntar.
 */
export interface ResultadoDaAtivacao {
  ok: boolean;
  /** Preenchido só quando `ok` é falso, e sempre dizendo o que fazer. */
  motivo?: string;
}

export const ativarNotificacoes = async (): Promise<ResultadoDaAtivacao> => {
  if (ehIosSemInstalar()) {
    return {
      ok: false,
      motivo:
        'No iPhone, as notificações só funcionam com o Orquesia adicionado à tela de início. ' +
        'Abra o menu de compartilhar do Safari e toque em "Adicionar à Tela de Início".',
    };
  }
  if (!temSuporte()) {
    return { ok: false, motivo: 'Este navegador não suporta notificações.' };
  }
  if (!CHAVE_PUBLICA) {
    return {
      ok: false,
      motivo: 'Falta a variável VITE_VAPID_PUBLIC_KEY no servidor.',
    };
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    return {
      ok: false,
      motivo:
        permissao === 'denied'
          ? 'As notificações foram bloqueadas para este site. Libere nas permissões do navegador.'
          : 'Permissão não concedida.',
    };
  }

  const registro = await navigator.serviceWorker.register('/sw.js');
  // `register` resolve antes de o SW estar no ar; sem esperar, o
  // `pushManager` de um registro ainda instalando devolve `null`.
  await navigator.serviceWorker.ready;

  const inscricao = await registro.pushManager.subscribe({
    // `false` faria o navegador permitir push silencioso — e os navegadores
    // recusam a inscrição inteira por isso. Sempre `true`.
    userVisibleOnly: true,
    applicationServerKey: paraBytes(CHAVE_PUBLICA),
  });

  const dados = inscricao.toJSON();
  const { data: sessao } = await supabase.auth.getUser();
  const userId = sessao.user?.id;
  if (!userId) return { ok: false, motivo: 'Sessão expirada. Entre novamente.' };

  /**
   * `upsert` pelo par (user_id, endpoint), que é o único da tabela.
   *
   * O mesmo navegador reinscrito devolve o mesmo endpoint — e as chaves
   * podem mudar. Inserir sem o upsert quebraria no unique; ignorar o
   * conflito guardaria as chaves velhas, e aí o envio falha com uma
   * mensagem que não nomeia a causa.
   */
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: dados.endpoint,
      p256dh: dados.keys?.p256dh,
      auth_key: dados.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) {
    // A inscrição no navegador existe e o banco não sabe dela: desfaz, senão
    // a tela diria "ligado" para um aparelho que nunca vai receber nada.
    await inscricao.unsubscribe().catch(() => undefined);
    return { ok: false, motivo: error.message };
  }

  return { ok: true };
};

/** Desliga neste aparelho: tira do navegador e apaga a linha. */
export const desativarNotificacoes = async (): Promise<void> => {
  const registro = await navigator.serviceWorker.getRegistration('/sw.js');
  const inscricao = await registro?.pushManager.getSubscription();
  if (!inscricao) return;

  const endpoint = inscricao.endpoint;
  await inscricao.unsubscribe().catch(() => undefined);
  // A linha sai **depois** — se sair antes e o `unsubscribe` falhar, o
  // aparelho continua inscrito no navegador e ninguém mais sabe disso.
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
};
