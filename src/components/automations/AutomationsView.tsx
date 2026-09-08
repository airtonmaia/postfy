import React from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Bell, 
  MessageSquare, 
  Calendar, 
  Share2, 
  Sliders
} from 'lucide-react';

export const AutomationsView: React.FC = () => {
  const { automations, toggleAutomation } = usePostfy();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Workflow Inteligente</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">Motor de Automações Postfy</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Elimine processos manuais entre agência e cliente com regras automáticas de workflow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            {automations.filter(a => a.enabled).length} de {automations.length} ativas
          </span>
        </div>
      </div>

      {/* Automations List */}
      <div className="space-y-3">
        {automations.map(auto => (
          <div
            key={auto.id}
            className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              auto.enabled ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-950/50'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${auto.enabled ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Zap className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{auto.title}</h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {auto.executionCount} execuções registradas
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md font-medium border border-slate-200 dark:border-slate-800">
                    <strong>SE:</strong> {auto.trigger}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="bg-purple-50 text-purple-800 px-2.5 py-1 rounded-md font-medium border border-purple-100">
                    <strong>ENTÃO:</strong> {auto.action}
                  </span>
                </div>
              </div>
            </div>

            {/* Switch button */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={auto.enabled}
                  onChange={() => toggleAutomation(auto.id)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
