import React, { useEffect, useState } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Webhook,
  Send,
  Sparkles,
  CircleDashed,
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { webhookApi, statusApi, ApiError, type StatusDoServidor } from '../../lib/api';

type StatusIntegracao = 'ativa' | 'opcional' | 'nao_implementada';

/**
 * Infraestrutura do produto. Vive em /admin, e não nas configurações da
 * agência, porque é isto que a separação significa:
 *
 *   - o dono do SaaS configura o que vale para toda a base — banco, IA,
 *     armazenamento, e-mail. São variáveis de ambiente, não algo que uma
 *     agência escolha;
 *   - a agência conecta as contas *dela* — Instagram para agendar, Drive do
 *     cliente para buscar mídia. Isso fica em Configurações > Integrações.
 *
 * Misturar os dois na mesma tela mostrava ao cliente o estado de chaves que
 * ele não controla e não deveria enxergar.
 *
 * Esta tela também já anunciou "Conectado" para integrações inexistentes, e
 * depois passou a descrever a arquitetura anterior. Uma lista escrita à mão
 * não acompanha o código: o que depende de chave é perguntado ao servidor.
 */

const BADGE: Record<StatusIntegracao, { texto: string; classe: string; Icone: React.FC<{ className?: string }> }> = {
  ativa: {
    texto: 'Em funcionamento',
    classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    Icone: CheckCircle2,
  },
  opcional: {
    texto: 'Requer configuração',
    classe: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    Icone: AlertCircle,
  },
  nao_implementada: {
    texto: 'Não implementada',
    classe: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    Icone: CircleDashed,
  },
};

export const AdminIntegracoesView: React.FC = () => {
  const { syncState, syncError, forceSync } = usePostfy();

  const [sincronizando, setSincronizando] = useState(false);
  const [msgBanco, setMsgBanco] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusDoServidor | null>(null);
  const [erroStatus, setErroStatus] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [testandoWebhook, setTestandoWebhook] = useState(false);
  const [msgWebhook, setMsgWebhook] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    statusApi
      .consultar()
      .then((res) => ativo && setStatus(res))
      .catch((err) => {
        if (!ativo) return;
        // 403 aqui significa que a sessão não é do admin da plataforma —
        // caso normal, não falha. A tela inteira já é do Super Admin, mas a
        // mensagem do servidor é mais precisa que uma genérica.
        setErroStatus(
          err instanceof ApiError ? err.message : 'Não foi possível consultar o servidor.'
        );
      });
    return () => {
      ativo = false;
    };
  }, []);

  const sincronizarBanco = async () => {
    setSincronizando(true);
    setMsgBanco(null);
    const res = await forceSync();
    setMsgBanco(res.message);
    setSincronizando(false);
    setTimeout(() => setMsgBanco(null), 5000);
  };

  const testarWebhook = async () => {
    if (!webhookUrl.trim()) {
      setMsgWebhook({ ok: false, texto: 'Informe a URL do webhook.' });
      return;
    }
    setTestandoWebhook(true);
    setMsgWebhook(null);
    try {
      const res = await webhookApi.test(webhookUrl.trim(), 'test.ping');
      setMsgWebhook({
        ok: res.ok,
        texto: res.ok
          ? `Endpoint respondeu ${res.status} ${res.statusText || ''}`.trim()
          : `Endpoint respondeu ${res.status}. Verifique o destino.`,
      });
    } catch (err) {
      setMsgWebhook({
        ok: false,
        texto: err instanceof ApiError ? err.message : 'Falha ao disparar o webhook.',
      });
    } finally {
      setTestandoWebhook(false);
      setTimeout(() => setMsgWebhook(null), 8000);
    }
  };

  /**
   * O que é fato do repositório fica aqui; o que depende de variável de
   * ambiente vem de `status`, e enquanto ele não chega o item aparece como
   * indefinido em vez de chutar um estado.
   */
  const integracoes: { nome: string; status: StatusIntegracao | null; desc: string }[] = [
    {
      // Estava fixo em 'ativa' — a lista escrita à mão que o comentário no
      // topo deste arquivo condena, sobrevivendo bem no meio dele. Ficou
      // verde enquanto o Portal do Cliente estava fora do ar por causa da
      // chave de serviço.
      nome: 'Banco de dados e login (Supabase)',
      status: status ? (status.chaveDeServicoValida ? 'ativa' : 'opcional') : null,
      desc: !status
        ? 'Postgres com Row Level Security: o recorte por agência é aplicado pelo banco.'
        : status.chaveDeServicoValida
          ? 'Postgres com Row Level Security, e a chave de serviço responde. Portal do cliente, publicação nas redes e conexão social funcionam.'
          : status.chaveDeServico
            ? 'O banco RECUSOU a SUPABASE_SECRET_KEY. Confira o valor e refaça o deploy — a Vercel congela o ambiente no deploy, então salvar a variável não alcança o que já está no ar. Sem isso, o portal do cliente, a fila de publicação e a conexão de contas sociais não funcionam.'
            : 'Falta SUPABASE_SECRET_KEY no servidor. Sem ela, o portal do cliente, a fila de publicação e a conexão de contas sociais não funcionam.',
    },
    {
      nome: 'Geração de texto por IA',
      status: status ? (status.ia ? 'ativa' : 'opcional') : null,
      desc: status?.ia
        ? 'Chave presente no servidor. Gera copy e converte feedback em checklist.'
        : 'Falta IA_API_KEY nas variáveis do servidor. Sem ela, os dois botões avisam em vez de gerar.',
    },
    {
      nome: 'Armazenamento de arquivos (Cloudflare R2)',
      status: status ? (status.armazenamentoPublico ? 'ativa' : 'opcional') : null,
      desc: !status
        ? 'Consultando o servidor...'
        : status.armazenamentoPublico
        ? 'O arquivo vai do navegador direto para o R2, sem passar pela função.'
        : status.armazenamento
        ? 'O envio funciona, mas falta R2_PUBLIC_BASE_URL: sem ela o arquivo é gravado e não abre depois.'
        : 'Faltam as credenciais do R2. O envio avisa e a tela oferece anexar por URL.',
    },
    {
      nome: 'E-mail transacional (Resend)',
      status: status ? (status.email ? 'ativa' : 'opcional') : null,
      desc: status?.email
        ? 'Convites de equipe saem por e-mail.'
        : 'Falta RESEND_API_KEY. O convite ainda é criado; só não sai o e-mail, e o link fica na tela.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banco de dados */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Banco de dados (Supabase)
                </h4>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    syncState === 'error'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {syncState === 'error' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  <span>{syncState === 'error' ? 'Com falha' : 'Sincronizado'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fonte de verdade dos dados da agência. Nada fica guardado no navegador:
                toda a equipe lê e escreve no mesmo Postgres, com isolamento por agência
                aplicado pelo próprio banco.
              </p>
            </div>
          </div>

          <button
            onClick={sincronizarBanco}
            disabled={sincronizando}
            className="shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            Recarregar do banco
          </button>
        </div>

        {(msgBanco || syncError) && (
          <div className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            {msgBanco || syncError}
          </div>
        )}
      </div>

      {/* Webhook */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white shadow-xs">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Webhook de saída
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              O disparo de teste é feito pelo servidor e devolve o status HTTP real do destino.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hook.us1.make.com/... ou https://hooks.zapier.com/..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
          />
          <button
            onClick={testarWebhook}
            disabled={testandoWebhook}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${testandoWebhook ? 'animate-pulse' : ''}`} />
            {testandoWebhook ? 'Enviando...' : 'Disparar teste'}
          </button>
        </div>

        {msgWebhook && (
          <div
            className={`text-xs p-3 rounded-xl border ${
              msgWebhook.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
            }`}
          >
            {msgWebhook.texto}
          </div>
        )}
      </div>

      {/* Panorama */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Estado da infraestrutura
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consultado no servidor, não escrito aqui à mão. Vale para todas as agências.
            </p>
          </div>
        </div>

        {erroStatus && (
          <div className="text-xs p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
            {erroStatus}
          </div>
        )}

        <div className="space-y-2.5">
          {integracoes.map((item) => {
            const badge = item.status ? BADGE[item.status] : null;
            return (
              <div
                key={item.nome}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{item.nome}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                {badge ? (
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${badge.classe}`}
                  >
                    <badge.Icone className="w-3 h-3" />
                    {badge.texto}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    Consultando...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
