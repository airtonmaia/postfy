import React, { useState } from 'react';
import { 
  MessageSquare, Send, Smartphone, Sparkles, CheckCircle2, Copy, Check, Plus, Trash2, Mail
} from 'lucide-react';

export const SettingsCommunication: React.FC = () => {
  const [provider, setProvider] = useState<'whatsapp_official' | 'evolution_api' | 'z_api'>('evolution_api');
  const [apiKey, setApiKey] = useState('ev_sec_99410298a8c88df32');
  const [instanceName, setInstanceName] = useState('postfy-agency-ops');
  const [connectedNumber, setConnectedNumber] = useState('+55 (11) 99887-6655');
  const [saved, setSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Message templates
  const [templates, setTemplates] = useState([
    {
      id: 't-1',
      title: 'Envio de Nova Pauta para Aprovação',
      trigger: 'Quando o job é movido para "Para Aprovação"',
      body: 'Olá, {nome_cliente}! Tudo bem? ✨\n\nNossa equipe acabou de liberar novos posts para sua revisão no Postfy:\n🔗 Acesse para aprovar com 1 clique: {link_portal}\n\nQualquer dúvida ou ajuste, pode nos responder por aqui!',
    },
    {
      id: 't-2',
      title: 'Lembrete de Aprovação Pendente (24h)',
      trigger: '24h antes do prazo final de postagem',
      body: 'Oi, {nome_cliente}! Passando para lembrar que temos postagens aguardando sua validação para não atrasarmos o cronograma:\n\n👉 {link_portal}\n\nPodemos confirmar a veiculação?',
    },
    {
      id: 't-3',
      title: 'Notificação de Postagem Publicada com Sucesso',
      trigger: 'Quando o post é publicado nas redes',
      body: '🚀 Seu post acabou de ir ao ar com sucesso nas suas redes sociais!\nConfira o engajamento direto no seu painel: {link_portal}',
    }
  ]);

  const [activeTemplate, setActiveTemplate] = useState(templates[0].id);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSendTest = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const selectedTpl = templates.find(t => t.id === activeTemplate) || templates[0];

  return (
    <div className="space-y-6">
      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Configurações de comunicação salvas com sucesso!
        </div>
      )}

      {/* Gateway WhatsApp */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-600" />
              Gateway de Disparo WhatsApp
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">Envie alertas diretamente no WhatsApp dos clientes sem depender de e-mail.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Instância Conectada</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Provedor de API</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as any)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
            >
              <option value="evolution_api">Evolution API (Self-hosted / Cloud)</option>
              <option value="z_api">Z-API WhatsApp Gateway</option>
              <option value="whatsapp_official">Meta WhatsApp Cloud API (Oficial)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Instância</label>
            <input
              type="text"
              value={instanceName}
              onChange={e => setInstanceName(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Número Conectado</label>
            <input
              type="text"
              value={connectedNumber}
              onChange={e => setConnectedNumber(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Chave de Autenticação (API Key)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="flex-1 p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
              />
              <button
                type="button"
                onClick={handleSendTest}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {testSent ? 'Disparo Enviado!' : 'Testar Conexão'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            Salvar Conexão
          </button>
        </div>
      </form>

      {/* Message Templates */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            Modelos de Mensagens & Automações de Disparo
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalize os textos enviados aos clientes com variáveis automáticas.
          </p>
        </div>

        {/* Templates Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800 pb-2">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTemplate(t.id)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap cursor-pointer ${
                activeTemplate === t.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>

        {/* Selected Template Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-600 font-bold uppercase tracking-wider">
              Gatilho: {selectedTpl.trigger}
            </span>

            {/* Quick Variable Inserts */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">Variáveis:</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono rounded">
                &#123;nome_cliente&#125;
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono rounded">
                &#123;link_portal&#125;
              </span>
            </div>
          </div>

          <textarea
            rows={5}
            value={selectedTpl.body}
            onChange={e => {
              const updated = templates.map(t => t.id === selectedTpl.id ? { ...t, body: e.target.value } : t);
              setTemplates(updated);
            }}
            className="w-full p-4 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-sans leading-relaxed"
          />

          <div className="flex justify-end">
            <button
              onClick={() => {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
              }}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Salvar Modelo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
