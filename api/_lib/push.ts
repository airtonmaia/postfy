import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Web Push: o aviso que alcança quem está com o Orquesia fechado.
 *
 * O sino resolve o caso de quem está olhando. Este resolve o outro, que é o
 * que custa: o cliente aprova às 22h de domingo, e a agência descobre na
 * segunda de manhã.
 *
 * **Quem empurra é o cron, e aqui isso não é escolha de arquitetura.** A
 * chave privada VAPID é o que autentica o remetente para o serviço de push
 * do navegador: no bundle ela deixaria qualquer um mandar notificação em
 * nome do produto. Então o envio mora onde o segredo já mora, e pega carona
 * na passada de cinco em cinco minutos — como a fila de e-mail, e pelo mesmo
 * motivo do plano Hobby (armadilha 6): não há a 13ª função.
 */

/**
 * Avisos mais velhos que isto não viram push.
 *
 * Se o cron ficar parado uma hora, o que ele tem a fazer ao voltar **não** é
 * despejar sessenta minutos de avisos no celular de todo mundo. Push é
 * efêmero: um que chega cinco minutos atrasado ainda serve, um que chega no
 * dia seguinte só ensina a pessoa a desligar a permissão.
 */
const JANELA_MS = 30 * 60_000;

/** Por passada. O resto espera cinco minutos, como todo o resto desta rota. */
const LOTE = 25;

/**
 * As três variáveis, lidas na chamada e **nunca no topo do módulo**.
 *
 * `setVapidDetails` lança quando a chave é inválida ou o e-mail não tem
 * esquema. No topo do arquivo, esse `throw` acontece no *import* — e mata
 * `api/publicar.ts` inteiro antes da primeira linha, com
 * `FUNCTION_INVOCATION_FAILED` e sem corpo. A publicação inteira pararia por
 * causa de uma variável de push mal preenchida. É a mesma classe da
 * armadilha 0, e o preço é o mesmo: 500 sem stack.
 */
const configurar = (): boolean => {
  const publica = process.env.VAPID_PUBLIC_KEY?.trim();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publica || !privada) return false;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL?.trim() || 'mailto:contato@orquesia.com.br',
      publica,
      privada
    );
    return true;
  } catch (erro) {
    console.error('[push] VAPID recusado:', erro instanceof Error ? erro.message : erro);
    return false;
  }
};

export interface ResumoDoPush {
  avisos: number;
  enviados: number;
  removidos: number;
}

/**
 * Empurra o que ainda não foi empurrado.
 *
 * Não lança em caminho nenhum: ela roda dentro da rota que publica conteúdo,
 * e derrubar a publicação porque um serviço de push respondeu estranho seria
 * trocar o compromisso da rota pelo acessório dela.
 */
export const empurrarNotificacoes = async (
  supabase: SupabaseClient
): Promise<ResumoDoPush> => {
  const vazio: ResumoDoPush = { avisos: 0, enviados: 0, removidos: 0 };
  if (!configurar()) return vazio;

  const desde = new Date(Date.now() - JANELA_MS).toISOString();

  const { data: avisos, error } = await supabase
    .from('notifications')
    .select('id, workspace_id, title, message')
    .is('push_enviado_em', null)
    .gte('created_at', desde)
    .order('created_at')
    .limit(LOTE);

  if (error) {
    console.error('[push] leitura dos avisos', error.message);
    return vazio;
  }
  if (!avisos || avisos.length === 0) return vazio;

  let enviados = 0;
  let removidos = 0;

  for (const aviso of avisos) {
    /**
     * **Quem recebe sai de `workspace_members`, não da inscrição.**
     *
     * A inscrição guarda só o dono do aparelho. Guardar a agência nela
     * abriria o buraco que a migração descreve: com a RLS por dono, qualquer
     * pessoa gravaria uma linha apontando para a agência de outro e passaria
     * a receber os avisos dela.
     *
     * Vai para a equipe inteira, e não só para quem administra, porque é
     * exatamente o que o sino já mostra: `notifications` é da agência, sem
     * destinatário. Push para menos gente que o sino seria a mesma
     * informação com duas respostas.
     */
    const { data: membros } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', aviso.workspace_id)
      .eq('ativo', true);

    const ids = (membros || []).map((m: { user_id: string }) => m.user_id);

    if (ids.length > 0) {
      const { data: inscricoes } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth_key')
        .in('user_id', ids);

      for (const inscricao of inscricoes || []) {
        const entregou = await enviarPara(inscricao, {
          title: aviso.title,
          body: aviso.message || '',
        });

        if (entregou === 'ok') {
          enviados++;
          await supabase
            .from('push_subscriptions')
            .update({ ultimo_envio_em: new Date().toISOString() })
            .eq('id', inscricao.id);
          continue;
        }

        /**
         * **404 e 410 são a inscrição morta, e apagá-la é obrigatório.**
         *
         * O navegador descarta a inscrição quando a pessoa limpa os dados do
         * site, reinstala o app ou revoga a permissão — e a partir daí todo
         * envio para aquele endpoint falha, para sempre. Sem apagar, a
         * tabela vira um cemitério que é relido a cada cinco minutos, e a
         * taxa de falha sobe até esconder as falhas que importam.
         */
        if (entregou === 'morta') {
          removidos++;
          await supabase.from('push_subscriptions').delete().eq('id', inscricao.id);
        }
      }
    }

    /**
     * A marca avança **sempre**, inclusive quando nada foi entregue — mesma
     * razão de `post_metrics.medido_em` avançar na falha: a fila é ordenada
     * por ela, e uma linha que não avança é retentada em toda passada e
     * segura todas as outras atrás dela. A entrega pararia sem dar erro.
     */
    await supabase
      .from('notifications')
      .update({ push_enviado_em: new Date().toISOString() })
      .eq('id', aviso.id);
  }

  return { avisos: avisos.length, enviados, removidos };
};

type Desfecho = 'ok' | 'morta' | 'erro';

const enviarPara = async (
  inscricao: { endpoint: string; p256dh: string; auth_key: string },
  corpo: { title: string; body: string }
): Promise<Desfecho> => {
  try {
    await webpush.sendNotification(
      {
        endpoint: inscricao.endpoint,
        keys: { p256dh: inscricao.p256dh, auth: inscricao.auth_key },
      },
      JSON.stringify(corpo)
    );
    return 'ok';
  } catch (erro) {
    const status = (erro as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'morta';
    console.error('[push] envio falhou', status ?? '', erro instanceof Error ? erro.message : '');
    return 'erro';
  }
};
