import React, { useEffect, useState } from 'react';
import { Mail, Save, AlertCircle, Building2, User, Loader2 } from 'lucide-react';
import {
  listarModelos,
  salvarModelo,
  preencher,
  VARIAVEIS_POR_EVENTO,
  type ModeloDeEmail,
} from '../../lib/emailTemplates';
import { Button } from '../ui/button';

/**
 * Configuração dos disparos automáticos do sistema.
 *
 * São e-mails do produto, não de uma agência: o texto que o cliente final
 * recebe é o mesmo para toda a base. Por isso a tela vive em /admin, e
 * a RLS só deixa o admin da plataforma ler e gravar — para qualquer outro a
 * lista volta vazia.
 */

/** Exemplo para a prévia. Vale mostrar como o cliente vai receber. */
const EXEMPLO: Record<string, string> = {
  cliente: 'Airton Maia',
  agencia: 'Pulmin',
  titulo: 'Carrossel de lançamento',
  feedback: 'Trocar a cor do fundo e aumentar a fonte do título.',
  link: 'https://app.orquesia.com.br/...',
};

export const AdminEmailsView: React.FC = () => {
  const [modelos, setModelos] = useState<ModeloDeEmail[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [aba, setAba] = useState<'agencia' | 'cliente'>('agencia');

  useEffect(() => {
    listarModelos()
      .then(setModelos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar os modelos.'))
      .finally(() => setCarregando(false));
  }, []);

  const alterar = (evento: string, mudancas: Partial<ModeloDeEmail>) => {
    setModelos((atuais) =>
      atuais.map((m) => (m.evento === evento ? { ...m, ...mudancas } : m))
    );
    setSalvo(null);
  };

  const gravar = async (modelo: ModeloDeEmail) => {
    setSalvando(modelo.evento);
    setErro(null);
    try {
      await salvarModelo(modelo.evento, {
        ativo: modelo.ativo,
        assunto: modelo.assunto,
        corpo: modelo.corpo,
      });
      setSalvo(modelo.evento);
      setTimeout(() => setSalvo(null), 4000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(null);
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando os modelos...
      </div>
    );
  }

  const modelosDaAba = modelos.filter((m) => m.destinatario === aba);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          Comunicação do produto
        </p>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          E-mails do Sistema
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Disparos automáticos do fluxo de aprovação. O texto vale para todas as
          agências — quem edita aqui é o dono do SaaS.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {modelos.length === 0 && !erro ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nenhum modelo visível. Esta tela é do administrador da plataforma.
        </p>
      ) : (
        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'agencia', label: 'Agência', Icon: Building2 },
              { id: 'cliente', label: 'Cliente', Icon: User },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                aba === id
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {modelosDaAba.length === 0 && modelos.length > 0 && !erro && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nenhum e-mail cadastrado para {aba === 'agencia' ? 'a agência' : 'o cliente'}.
        </p>
      )}

      {modelosDaAba.map((modelo) => {
        const variaveis = VARIAVEIS_POR_EVENTO[modelo.evento] || [];
        const paraCliente = modelo.destinatario === 'cliente';

        return (
          <div
            key={modelo.evento}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-xl text-white shadow-xs shrink-0 ${
                    paraCliente ? 'bg-blue-600' : 'bg-emerald-600'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {modelo.nome}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        paraCliente
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {paraCliente ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                      {paraCliente ? 'Vai para o cliente' : 'Vai para a agência'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {modelo.descricao}
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modelo.ativo}
                  onChange={(e) => alterar(modelo.evento, { ativo: e.target.checked })}
                  className="w-4 h-4 accent-purple-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {modelo.ativo ? 'Ativo' : 'Desligado'}
                </span>
              </label>
            </div>

            <div className={modelo.ativo ? '' : 'opacity-50'}>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Assunto
              </label>
              <input
                type="text"
                value={modelo.assunto}
                disabled={!modelo.ativo}
                onChange={(e) => alterar(modelo.evento, { assunto: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed"
              />

              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-3 mb-1">
                Corpo
              </label>
              <textarea
                value={modelo.corpo}
                rows={6}
                disabled={!modelo.ativo}
                onChange={(e) => alterar(modelo.evento, { corpo: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono leading-relaxed disabled:cursor-not-allowed"
              />

              <div className="flex flex-wrap gap-1.5 mt-2">
                {variaveis.map((v) => (
                  <code
                    key={v}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    {v}
                  </code>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Variável não preenchida sai como espaço vazio, não como o texto cru.
              </p>
            </div>

            {/* Prévia: como o destinatário vai receber. */}
            <details className="group">
              <summary className="text-[11px] font-bold text-purple-600 dark:text-purple-400 cursor-pointer select-none">
                Ver prévia com dados de exemplo
              </summary>
              <div className="mt-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {preencher(modelo.assunto, EXEMPLO)}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap leading-relaxed">
                  {preencher(modelo.corpo, EXEMPLO)}
                </p>
              </div>
            </details>

            <div className="flex items-center justify-end gap-3 pt-1">
              {salvo === modelo.evento && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Salvo.
                </span>
              )}
              <Button
                onClick={() => gravar(modelo)}
                disabled={salvando === modelo.evento}
              >
                <Save className={`w-3.5 h-3.5 ${salvando === modelo.evento ? 'animate-pulse' : ''}`} />
                {salvando === modelo.evento ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
