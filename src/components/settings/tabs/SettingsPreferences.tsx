import React, { useState } from 'react';
import { usePostfy } from '../../../context/PostfyContext';
import { Moon, Sun, Globe, Bell, Check, CheckCircle2, AlertTriangle } from 'lucide-react';
import { atualizarWorkspace } from '../../../lib/db';
import { FUSOS, cidadeDoFuso } from '../../../lib/fusoHorario';
import { pode } from '../../../lib/permissions';

/**
 * Preferências da agência.
 *
 * **Esta tela mentia.** O botão de salvar fazia isto, e só isto:
 *
 *     const handleSave = (e) => { e.preventDefault(); setSaved(true); … };
 *
 * Nenhuma chamada ao banco, e em seguida a faixa verde dizia "Preferências
 * salvas com sucesso!". É a armadilha 9 na forma mais direta que ela assume —
 * não um número estimado, mas a afirmação do próprio sucesso. Quem
 * configurasse o fuso aqui confiaria, e descobriria semanas depois.
 *
 * Quatro campos saíram junto com a mentira, e **sair é a correção**, não uma
 * perda: idioma (o app é pt-BR em todo lugar, não há i18n), prazo de
 * auto-aprovação (nada aprova sozinho), prazo padrão de entrega (os prazos
 * são derivados da data de publicação, em `CreateJobModal`) e os dois
 * alertas (o motor de avisos é a tela de Automações, e WhatsApp não tem
 * integração nenhuma). Campo que não faz nada é pior que campo ausente: ele
 * é configurado, e a pessoa passa a contar com o que ele promete.
 *
 * Ficam os dois que existem de verdade: o tema, que já era persistido, e o
 * fuso, que agora é lido por todo formatador de data do produto.
 */

export const SettingsPreferences: React.FC = () => {
  const { theme, setTheme, currentWorkspace, updateWorkspace, currentUser } = usePostfy();

  const [timezone, setTimezone] = useState(
    currentWorkspace.timezone || 'America/Sao_Paulo'
  );
  const [notificacao, setNotificacao] = useState<'cada' | 'lote'>(
    currentWorkspace.notificacaoAprovacao === 'lote' ? 'lote' : 'cada'
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mexer na agência é de quem administra a agência. A RLS recusaria de
  // qualquer jeito, com `42501`; dizer aqui evita o erro genérico.
  const podeSalvar = pode(currentUser?.role, 'gerenciar_workspace');

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      // O banco primeiro, a faixa verde depois — e só se ele confirmar. Era
      // exatamente a ordem invertida que fazia a tela mentir.
      const mudancas = { timezone, notificacaoAprovacao: notificacao };
      await atualizarWorkspace(currentWorkspace.id, mudancas);
      updateWorkspace(currentWorkspace.id, mudancas);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const fusoMudou = timezone !== (currentWorkspace.timezone || 'America/Sao_Paulo');
  const mudou =
    fusoMudou ||
    notificacao !== (currentWorkspace.notificacaoAprovacao === 'lote' ? 'lote' : 'cada');

  return (
    <form onSubmit={(e) => void salvar(e)} className="space-y-6">
      {salvo && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Preferências salvas.
        </div>
      )}

      {erro && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          {erro}
        </div>
      )}

      {/* Tema */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Moon className="w-4 h-4 text-purple-600" />
            Tema & Aparência do Sistema
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Vale só para você, neste navegador e nos próximos acessos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {([
            { valor: 'light', rotulo: 'Claro', Icone: Sun },
            { valor: 'dark', rotulo: 'Escuro', Icone: Moon },
          ] as const).map(({ valor, rotulo, Icone }) => {
            const ativo = theme === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setTheme(valor)}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  ativo
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icone className="w-4 h-4" />
                  {rotulo}
                </span>
                {ativo && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fuso horário */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-600" />
            Fuso Horário da Agência
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
            Todo horário do sistema é lido e escrito neste fuso — o agendamento, o
            calendário, o portal do cliente e os avisos por e-mail. Vale para a
            agência inteira, em qualquer aparelho: quem abrir o app de outro estado
            vê o mesmo horário que você.
          </p>
        </div>

        <div className="pt-2 max-w-md">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Fuso da agência
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!podeSalvar}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl disabled:opacity-60"
          >
            {FUSOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </select>

          {fusoMudou && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-relaxed">
              Os conteúdos já agendados não mudam de horário — eles foram marcados
              num instante fixo. O que muda é como esse instante aparece na tela:
              passarão a ser mostrados no horário de <strong>{cidadeDoFuso(timezone)}</strong>.
            </p>
          )}
        </div>
      </div>

      {/* Notificação de aprovação */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-600" />
            Aviso de Aprovação ao Cliente
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
            Como o cliente fica sabendo que tem conteúdo esperando aprovação.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          {([
            {
              valor: 'cada' as const,
              titulo: 'Avisar a cada arte',
              detalhe:
                'Um e-mail assim que o conteúdo entra em "Para Aprovação". Bom para quem manda poucas peças por vez.',
            },
            {
              valor: 'lote' as const,
              titulo: 'Agrupar e avisar de uma vez',
              detalhe:
                'Nenhum e-mail automático. Você junta as artes e dispara um aviso só, pelo botão "Aprovação em massa" no quadro. Dez peças na segunda-feira viram um e-mail, não dez.',
            },
          ]).map((opcao) => {
            const ativo = notificacao === opcao.valor;
            return (
              <label
                key={opcao.valor}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition ${
                  !podeSalvar ? 'opacity-60' : 'cursor-pointer'
                } ${
                  ativo
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="notificacao"
                  value={opcao.valor}
                  checked={ativo}
                  disabled={!podeSalvar}
                  onChange={() => setNotificacao(opcao.valor)}
                  className="w-4 h-4 mt-0.5 text-purple-600 focus:ring-purple-500 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">
                    {opcao.titulo}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {opcao.detalhe}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {!podeSalvar && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Só o proprietário ou um administrador de <strong>{currentWorkspace.name}</strong>{' '}
          altera o fuso da agência. O tema acima é seu e pode ser trocado por qualquer um.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!podeSalvar || salvando || !mudou}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
        >
          {salvando ? 'Salvando...' : 'Salvar Preferências'}
        </button>
      </div>
    </form>
  );
};
