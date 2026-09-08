import React, { useState } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Webhook,
  Send,
  Sparkles,
  CircleDashed,
  Server,
} from 'lucide-react';
import { usePostfy } from '../../../context/PostfyContext';
import { webhookApi, ApiError } from '../../../lib/api';

type StatusIntegracao = 'ativa' | 'opcional' | 'nao_implementada';

/**
 * Esta tela costumava anunciar "Conectado" para integrações que não existiam
 * (Instagram Graph API, Drive, WhatsApp) e o teste de webhook era um
 * setTimeout que sempre respondia "HTTP 200 OK" sem enviar nada. Agora cada
 * item mostra o estado real e o teste faz a requisição de verdade.
 */
const INTEGRACOES: { nome: string; status: StatusIntegracao; desc: string }[] = [
  {
    nome: 'Compartilhamento por WhatsApp',
    status: 'ativa',
    desc: 'Abre o wa.me com o link de aprovação já preenchido. Não usa a API oficial.',
  },
  {
    nome: 'Google Gemini',
    status: 'opcional',
    desc: 'Geração de copy e pautas. Requer GEMINI_API_KEY no ambiente do servidor.',
  },
  {
    nome: 'Supabase (PostgreSQL)',
    status: 'opcional',
    desc: 'Caminho de migração do banco. Schema em supabase/schema.sql.',
  },
  {
    nome: 'Publicação automática nas redes',
    status: 'nao_implementada',
    desc: 'Exige OAuth com Meta, LinkedIn e TikTok, além de uma fila de disparo. Ainda não construído.',
  },
  {
    nome: 'WhatsApp API (Cloud, Evolution ou Z-API)',
    status: 'nao_implementada',
    desc: 'Envio automático de notificações ao cliente. Ainda não construído.',
  },
  {
    nome: 'Google Drive / Cloud Storage',
    status: 'nao_implementada',
    desc: 'Upload de assets direto para a nuvem. Hoje os arquivos ficam no navegador.',
  },
];

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

export const SettingsIntegrations: React.FC = () => {
  const {
    isSupabaseConnected,
    syncWithSupabase,
    syncState,
    syncError,
    forceSync,
  } = usePostfy();

  const [sincronizando, setSincronizando] = useState(false);
  const [msgServidor, setMsgServidor] = useState<string | null>(null);
  const [checandoSupabase, setChecandoSupabase] = useState(false);
  const [msgSupabase, setMsgSupabase] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [testandoWebhook, setTestandoWebhook] = useState(false);
  const [msgWebhook, setMsgWebhook] = useState<{ ok: boolean; texto: string } | null>(null);

  const sincronizarServidor = async () => {
    setSincronizando(true);
    setMsgServidor(null);
    const res = await forceSync();
    setMsgServidor(res.message);
    setSincronizando(false);
    setTimeout(() => setMsgServidor(null), 5000);
  };

  const checarSupabase = async () => {
    setChecandoSupabase(true);
    setMsgSupabase(null);
    const res = await syncWithSupabase();
    setMsgSupabase(res.message);
    setChecandoSupabase(false);
    setTimeout(() => setMsgSupabase(null), 6000);
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

  return (
    <div className="space-y-6">
      {/* Banco de dados da aplicação */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Servidor Orquesia
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
                Fonte de verdade dos dados da agência. Toda a equipe enxerga o mesmo
                conteúdo, com isolamento por workspace garantido no servidor.
              </p>
            </div>
          </div>

          <button
            onClick={sincronizarServidor}
            disabled={sincronizando}
            className="shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            Sincronizar agora
          </button>
        </div>

        {(msgServidor || syncError) && (
          <div className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            {msgServidor || syncError}
          </div>
        )}
      </div>

      {/* Supabase */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Supabase (PostgreSQL)
                </h4>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    isSupabaseConnected
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {isSupabaseConnected ? 'Credenciais presentes' : 'Não configurado'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Caminho de migração do banco. Rode <code className="font-mono">supabase/schema.sql</code>{' '}
                no SQL Editor — ele já cria as políticas de RLS por workspace.
                A migração dos dados ainda é manual.
              </p>
            </div>
          </div>

          <button
            onClick={checarSupabase}
            disabled={checandoSupabase}
            className="shrink-0 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checandoSupabase ? 'animate-spin' : ''}`} />
            Testar conexão
          </button>
        </div>

        {msgSupabase && (
          <div className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            {msgSupabase}
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

      {/* Panorama das integrações */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Estado das integrações
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              O que já funciona, o que depende de configuração e o que ainda não foi construído.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {INTEGRACOES.map((item) => {
            const badge = BADGE[item.status];
            return (
              <div
                key={item.nome}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{item.nome}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${badge.classe}`}
                >
                  <badge.Icone className="w-3 h-3" />
                  {badge.texto}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
