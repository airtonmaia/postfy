import React, { useState } from 'react';
import { safeDateTimeFormat } from '../../lib/utils';
import { usePostfy } from '../../context/PostfyContext';
import {
  Zap,
  ArrowRight,
  Mail,
  Webhook,
  Plus,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';
import { EVENTOS_DISPONIVEIS, ACOES_DISPONIVEIS } from '../../lib/automacoes';
import type { Automation } from '../../types';

/**
 * Automações.
 *
 * A tela listava regras cujo gatilho e ação eram texto livre, e nada as
 * executava — inclusive exibia um contador de execuções que ninguém
 * incrementava. Agora as opções são fechadas, porque só existe motor para o
 * que está nesta lista: oferecer um campo aberto seria voltar a prometer o
 * que não acontece.
 */

const ICONE_DA_ACAO: Record<string, React.FC<{ className?: string }>> = {
  email: Mail,
  webhook: Webhook,
};

export const AutomationsView: React.FC = () => {
  const { automations, toggleAutomation, createAutomation, deleteAutomation } = usePostfy();

  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [evento, setEvento] = useState<NonNullable<Automation['triggerEvent']>>(
    'conteudo_aguardando_aprovacao'
  );
  const [acao, setAcao] = useState<NonNullable<Automation['actionType']>>('email');
  const [urlWebhook, setUrlWebhook] = useState('');
  const [erro, setErro] = useState('');

  const salvar = () => {
    setErro('');
    if (!titulo.trim()) {
      setErro('Dê um nome para a regra.');
      return;
    }
    if (acao === 'webhook' && !urlWebhook.trim().startsWith('http')) {
      setErro('Informe a URL do webhook, começando com http.');
      return;
    }

    createAutomation({
      title: titulo.trim(),
      triggerEvent: evento,
      actionType: acao,
      actionConfig: acao === 'webhook' ? { url: urlWebhook.trim() } : {},
    });

    setTitulo('');
    setUrlWebhook('');
    setCriando(false);
  };

  const ativas = automations.filter((a) => a.enabled).length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
            Workflow
          </span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            Automações
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Regras que disparam sozinhas quando um conteúdo muda de estado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            {ativas} de {automations.length} ativas
          </span>
          <button
            onClick={() => setCriando((v) => !v)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            {criando ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {criando ? 'Cancelar' : 'Nova regra'}
          </button>
        </div>
      </div>

      {criando && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-purple-200 dark:border-purple-900 shadow-xs space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Nome da regra
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Avisar o cliente quando houver arte para aprovar"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Quando (gatilho)
              </label>
              <select
                value={evento}
                onChange={(e) => setEvento(e.target.value as typeof evento)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {EVENTOS_DISPONIVEIS.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.rotulo}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Dispara {EVENTOS_DISPONIVEIS.find((e) => e.valor === evento)?.quando}.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Então (ação)
              </label>
              <select
                value={acao}
                onChange={(e) => setAcao(e.target.value as typeof acao)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {ACOES_DISPONIVEIS.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.rotulo}
                  </option>
                ))}
              </select>
              {acao === 'email' && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  O texto é o configurado em Admin → E-mails do Sistema.
                </p>
              )}
            </div>
          </div>

          {acao === 'webhook' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                URL do webhook
              </label>
              <input
                value={urlWebhook}
                onChange={(e) => setUrlWebhook(e.target.value)}
                placeholder="https://hook.us1.make.com/..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
              />
            </div>
          )}

          {erro && (
            <p className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {erro}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={salvar}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer"
            >
              Criar regra
            </button>
          </div>
        </div>
      )}

      {automations.length === 0 && !criando && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center">
          <Zap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">
            Nenhuma automação ainda
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Crie uma regra para avisar o cliente por e-mail quando houver conteúdo
            esperando aprovação.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {automations.map((auto) => {
          const Icone = ICONE_DA_ACAO[auto.actionType || ''] || Zap;
          // Regra criada antes de os gatilhos serem tipados: aparece, mas o
          // motor não tem como executá-la. Melhor dizer isso do que deixar a
          // pessoa achando que está ligada.
          const semMotor = !auto.triggerEvent || !auto.actionType;

          return (
            <div
              key={auto.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-xs ${
                auto.enabled && !semMotor
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-950/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    auto.enabled && !semMotor
                      ? 'bg-purple-50 text-purple-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icone className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {auto.title}
                    </h4>
                    {semMotor && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Sem gatilho configurado
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {auto.executionCount} {auto.executionCount === 1 ? 'execução' : 'execuções'}
                    {auto.lastRunAt &&
                      ` · última em ${safeDateTimeFormat(auto.lastRunAt)}`}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap mt-3 text-[11px]">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <strong>SE:</strong> {auto.trigger}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <strong>ENTÃO:</strong> {auto.action}
                    </span>
                  </div>

                  {auto.actionType === 'webhook' && typeof auto.actionConfig?.url === 'string' && (
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-2 truncate">
                      {auto.actionConfig.url}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => deleteAutomation(auto.id)}
                    title="Excluir regra"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={auto.enabled}
                      onChange={() => toggleAutomation(auto.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
