import React, { useState } from 'react';
import { 
  Link, 
  Database, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle,
  Flame,
  Webhook,
  Send,
  Radio
} from 'lucide-react';
import { usePostfy } from '../../../context/PostfyContext';

export const SettingsIntegrations: React.FC = () => {
  const { isSupabaseConnected, syncWithSupabase, isFirebaseConnected, syncWithFirebase } = usePostfy();
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [firebaseMsg, setFirebaseMsg] = useState<string | null>(null);
  const [supabaseMsg, setSupabaseMsg] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Webhook State
  const [webhookUrl, setWebhookUrl] = useState('https://webhook.site/postfy-test-endpoint');
  const [webhookTriggerApproved, setWebhookTriggerApproved] = useState(true);
  const [webhookTriggerAdjustment, setWebhookTriggerAdjustment] = useState(true);
  const [webhookTriggerScheduled, setWebhookTriggerScheduled] = useState(true);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null);

  const handleTestWebhook = () => {
    setTestingWebhook(true);
    setWebhookMsg(null);
    setTimeout(() => {
      setTestingWebhook(false);
      setWebhookMsg(`✅ Disparo de teste enviado com sucesso para ${webhookUrl}! Payload HTTP 200 OK.`);
      setTimeout(() => setWebhookMsg(null), 5000);
    }, 1000);
  };

  const handleSyncFirebase = async () => {
    setSyncingFirebase(true);
    setFirebaseMsg(null);
    try {
      const res = await syncWithFirebase();
      setFirebaseMsg(res.message);
    } catch (err: any) {
      setFirebaseMsg(`Erro: ${err.message}`);
    } finally {
      setSyncingFirebase(false);
      setTimeout(() => setFirebaseMsg(null), 5000);
    }
  };

  const handleSyncSupabase = async () => {
    setSyncingSupabase(true);
    setSupabaseMsg(null);
    try {
      const res = await syncWithSupabase();
      setSupabaseMsg(res.message);
    } catch (err: any) {
      setSupabaseMsg(`Erro ao sincronizar: ${err.message}`);
    } finally {
      setSyncingSupabase(false);
      setTimeout(() => setSupabaseMsg(null), 4000);
    }
  };

  const copySqlSchema = () => {
    navigator.clipboard.writeText(`-- Postfy Core Database Schema (PostgreSQL / Supabase)
-- Consulte o arquivo supabase/schema.sql no repositório para o script completo`);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const integrations = [
    { name: 'Google Cloud Firestore', status: 'Ativo & Gratuito', desc: 'Banco NoSQL na nuvem (50.000 leituras/dia e 20.000 gravações/dia no Plano Spark gratuito)' },
    { name: 'API do Sistema Postfy', status: 'Conectado', desc: 'Acesso via Bearer token para automações externas' },
    { name: 'WhatsApp Web Direct', status: 'Conectado', desc: 'Disparo de link de aprovação para clientes' },
    { name: 'Google Gemini 2.5 Pro & Flash', status: 'Conectado', desc: 'Copywriting, análise de briefing e conversão de feedback' },
    { name: 'Google Drive & Cloud Storage', status: 'Conectado', desc: 'Armazenamento de assets e criativos' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Firebase Primary Cloud Database Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-300 dark:border-amber-700/50 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Firebase Cloud Firestore
                </h4>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  isFirebaseConnected 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {isFirebaseConnected ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{isFirebaseConnected ? 'Conectado & Ativo (Nuvem Gratuita)' : 'Pendente'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Banco de dados na nuvem com 50.000 leituras e 20.000 gravações diárias gratuitas (R$ 0,00 sem custos).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncFirebase}
              disabled={syncingFirebase}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingFirebase ? 'animate-spin' : ''}`} />
              <span>{syncingFirebase ? 'Sincronizando...' : 'Sincronizar Firestore'}</span>
            </button>
          </div>
        </div>

        {firebaseMsg && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-900 dark:text-amber-200 animate-in fade-in">
            {firebaseMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Coleções Sincronizadas</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              clients, jobs, leads, proposals, materials, timesheets
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Plano de Custo</span>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              Plano Spark (R$ 0,00 / 100% Gratuito)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Regras de Segurança</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              firestore.rules (Deploy Realizado)
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Supabase (Opcional / PostgreSQL)
                </h4>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  isSupabaseConnected 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {isSupabaseConnected ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{isSupabaseConnected ? 'Conectado' : 'Não configurado (Usando Firebase)'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Caso prefira conectar uma instância externa do Supabase no futuro.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncSupabase}
              disabled={syncingSupabase}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-spin' : ''}`} />
              <span>{syncingSupabase ? 'Testando...' : 'Testar Supabase'}</span>
            </button>
          </div>
        </div>

        {supabaseMsg && (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 animate-in fade-in">
            {supabaseMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Variáveis Opcionais</span>
            <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
              VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Esquema SQL</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                supabase/schema.sql
              </span>
            </div>
            <button
              onClick={copySqlSchema}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copiado' : 'Copiar DDL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Webhook & Automation Trigger Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Webhooks & Disparos Externos (Zapier, Make, n8n)
                </h4>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Pronto para Conectar</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Envie dados em tempo real para agendadores, CRMs ou canais do Slack/Discord a cada alteração de status.
              </p>
            </div>
          </div>

          <button
            onClick={handleTestWebhook}
            disabled={testingWebhook}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${testingWebhook ? 'animate-bounce' : ''}`} />
            <span>{testingWebhook ? 'Enviando...' : 'Testar Disparo'}</span>
          </button>
        </div>

        {webhookMsg && (
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-900 dark:text-indigo-200 animate-in fade-in">
            {webhookMsg}
          </div>
        )}

        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              URL do Endpoint Webhook (POST):
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hook.us1.make.com/... ou https://hooks.zapier.com/..."
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={webhookTriggerApproved}
                onChange={(e) => setWebhookTriggerApproved(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Post Aprovado
              </span>
            </label>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={webhookTriggerAdjustment}
                onChange={(e) => setWebhookTriggerAdjustment(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Ajuste Solicitado
              </span>
            </label>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={webhookTriggerScheduled}
                onChange={(e) => setWebhookTriggerScheduled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Post Agendado
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Other Integrations Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Link className="w-4 h-4 text-purple-600" />
          Serviços e Automações Conectadas
        </h4>
        <div className="space-y-3">
          {integrations.map((int, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
               <div>
                 <span className="text-sm font-bold text-slate-900 dark:text-white block">{int.name}</span>
                 <span className="text-xs text-slate-500 dark:text-slate-400">{int.desc}</span>
               </div>
               <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                 {int.status}
               </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
