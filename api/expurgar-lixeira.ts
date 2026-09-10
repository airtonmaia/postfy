import { clienteDeServico, json, autorizadoPeloCron } from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { apagarAgenciaDeVez } from './_lib/lixeira.js';

/**
 * Varredura diária da lixeira de agências.
 *
 * Uma agência movida para a lixeira (`mover_agencia_para_lixeira`) fica com
 * `deleted_at` preenchido, mas a linha continua no banco — os 7 dias são o
 * prazo para alguém se arrepender e restaurar. Esta rota é quem cumpre o
 * "depois exclua": procura o que passou dos 7 dias e apaga de vez, arquivo e
 * banco.
 *
 * Roda por cron do GitHub, igual `api/publicar.ts`, e pelo mesmo motivo:
 * cron da Vercel no plano Hobby só aceita agendamento diário, e aqui isso
 * nem é problema — sete dias de folga não precisam de granularidade de
 * minuto. Ver `.github/workflows/expurgar-lixeira.yml`.
 */

const LOTE = 5;
const DIAS_NA_LIXEIRA = 7;

async function handler(request: Request): Promise<Response> {
  if (!autorizadoPeloCron(request)) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return json(
      { error: 'Expurgo não configurado. Defina SUPABASE_SECRET_KEY.', code: 'NOT_CONFIGURED' },
      503
    );
  }

  const limite = new Date(Date.now() - DIAS_NA_LIXEIRA * 24 * 60 * 60_000).toISOString();

  const { data: vencidas, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', limite)
    .order('deleted_at')
    .limit(LOTE);

  if (error) {
    console.error('[expurgar-lixeira] busca', error.message);
    return json({ error: 'Não foi possível ler a lixeira.' }, 500);
  }

  if (!vencidas || vencidas.length === 0) {
    return json({ apagadas: 0 });
  }

  const resultados: { id: string; ok: boolean; arquivosApagados?: number; detalhe?: string }[] = [];

  for (const ws of vencidas) {
    try {
      const { arquivosApagados } = await apagarAgenciaDeVez(supabase, ws.id);
      resultados.push({ id: ws.id, ok: true, arquivosApagados });
    } catch (erro) {
      // Não apaga a linha quando o R2 falha — ela continua vencida e entra
      // de novo na próxima passada, amanhã. Uma tentativa não vai embora
      // sem sucesso nem fica presa para sempre: só espera a próxima rodada.
      const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida.';
      console.error('[expurgar-lixeira]', ws.id, ws.name, motivo);
      resultados.push({ id: ws.id, ok: false, detalhe: motivo });
    }
  }

  return json({
    apagadas: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
    resultados,
  });
}

/**
 * Handler no formato Web, exportado para os testes chamarem direto.
 * O que a Vercel executa é o default abaixo.
 */
export const POST = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
