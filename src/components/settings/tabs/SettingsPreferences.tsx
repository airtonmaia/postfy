import React, { useState } from 'react';
import { usePostfy } from '../../../context/PostfyContext';
import { 
  Settings2, Moon, Sun, Bell, Globe, Clock, ShieldCheck, Check, CheckCircle2 
} from 'lucide-react';

export const SettingsPreferences: React.FC = () => {
  const { theme, setTheme } = usePostfy();
  const [language, setLanguage] = useState('pt-BR');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [autoApprovalHours, setAutoApprovalHours] = useState('48');
  const [defaultJobDeadlineDays, setDefaultJobDeadlineDays] = useState('5');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Preferências salvas com sucesso!
        </div>
      )}

      {/* Theme & Visual Experience */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Moon className="w-4 h-4 text-purple-600" />
            Tema & Aparência do Sistema
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Escolha o tema visual para a interface de trabalho da agência.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition cursor-pointer ${
              theme === 'light' 
                ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-600/20' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <Sun className="w-6 h-6 text-amber-500" />
            <span className="text-xs font-bold">Modo Claro (Padrão)</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition cursor-pointer ${
              theme === 'dark' 
                ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-600/20' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <Moon className="w-6 h-6 text-purple-400" />
            <span className="text-xs font-bold">Modo Escuro (Dark)</span>
          </button>
        </div>
      </div>

      {/* Deadlines & Operational Timers */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" />
            Prazos & SLAs Operacionais
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Defina padrões para a criação de novos jobs e tempo de tolerância de aprovação.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Prazo padrão de produção (dias úteis)
            </label>
            <input
              type="number"
              value={defaultJobDeadlineDays}
              onChange={e => setDefaultJobDeadlineDays(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Aplicado automaticamente ao criar novo job na pauta.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tempo de expiração para lembrete de aprovação (horas)
            </label>
            <input
              type="number"
              value={autoApprovalHours}
              onChange={e => setAutoApprovalHours(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">O sistema dispara alerta caso o cliente não responda neste prazo.</span>
          </div>
        </div>
      </div>

      {/* Regional & Timezone */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-600" />
            Localização & Fuso Horário
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Sincronização de agendamento de posts e disparos automáticos.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Idioma do Sistema</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fuso Horário Padrão</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            >
              <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
              <option value="America/Manaus">Manaus (GMT-4)</option>
              <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
              <option value="Europe/Lisbon">Lisboa (GMT+0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications toggle */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-600" />
            Canais de Alerta
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Escolha onde a equipe da agência recebe alertas operacionais.</p>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={e => setEmailAlerts(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Notificações de e-mail ao receber novo pedido de ajuste do cliente
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappAlerts}
              onChange={e => setWhatsappAlerts(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Disparos no WhatsApp da equipe para postagens prestes a vencer
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
        >
          Salvar Preferências
        </button>
      </div>
    </form>
  );
};
