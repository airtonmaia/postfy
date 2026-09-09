import React, { useCallback, useEffect, useState } from 'react';
import { usePostfy } from '../../../context/PostfyContext';
import {
  Users, Plus, Mail, Trash2, CheckCircle2, X, Copy, Check, Clock, AlertCircle,
} from 'lucide-react';
import { Role } from '../../../types';
import { conviteApi } from '../../../lib/api';
import {
  listarEquipe,
  listarConvites,
  criarConvite,
  revogarConvite,
  type MembroDaEquipe,
  type ConvitePendente,
} from '../../../lib/authSupabase';
import { pode } from '../../../lib/permissions';
import { copyToClipboard } from '../../../lib/utils';

const PAPEIS: { valor: Role; rotulo: string; classe: string }[] = [
  { valor: 'admin', rotulo: 'Administrador', classe: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { valor: 'manager', rotulo: 'Gestor', classe: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { valor: 'social_media', rotulo: 'Social Media', classe: 'bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
  { valor: 'designer', rotulo: 'Designer', classe: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { valor: 'copywriter', rotulo: 'Copywriter', classe: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { valor: 'financial', rotulo: 'Financeiro', classe: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
];

const badgeDoPapel = (papel: string) => {
  const achado = PAPEIS.find((p) => p.valor === papel);
  if (papel === 'owner') {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border border-slate-900 dark:border-slate-100">
        Proprietário
      </span>
    );
  }
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
        achado?.classe || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {achado?.rotulo || papel}
    </span>
  );
};

/**
 * Equipe da agência.
 *
 * Antes esta tela mantinha a lista num useState local a partir do seed: o
 * "convite" só empurrava um objeto para o array, sumia no recarregamento e a
 * pessoa convidada nunca conseguia entrar. Agora os membros vêm do servidor e o
 * convite gera um link real de aceite, com papel e validade.
 */
export const SettingsUsers: React.FC = () => {
  const { currentUser, currentWorkspace } = usePostfy();
  const podeGerenciar = pode(currentUser?.role, 'gerenciar_usuarios');

  const [membros, setMembros] = useState<MembroDaEquipe[]>([]);
  const [convites, setConvites] = useState<ConvitePendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Role>('designer');
  const [enviando, setEnviando] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setMembros(await listarEquipe());
      if (podeGerenciar) {
        setConvites(await listarConvites());
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar a equipe.');
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setEnviando(true);
    setErro(null);
    try {
      const { token } = await criarConvite({
        workspaceId: currentUser.workspaceId,
        email: email.trim(),
        nome: nome.trim() || undefined,
        role: papel,
      });

      const url = new URL(window.location.href);
      url.search = '';
      // Raiz, e não a tela onde o convite foi criado: agora que cada menu tem
      // URL própria, o link herdaria `/configuracoes/usuarios` — uma tela que
      // o convidado talvez nem possa abrir.
      url.pathname = '/';
      url.searchParams.set('invite', token);
      const link = url.toString();
      setLinkGerado(link);

      // O e-mail é um extra: se o envio falhar (Resend sem chave, por
      // exemplo), o convite continua válido e o link fica na tela para ser
      // compartilhado à mão. Por isso o erro aqui não derruba o fluxo.
      try {
        await conviteApi.enviarPorEmail({
          email: email.trim(),
          link,
          workspaceId: currentUser.workspaceId,
          agencyName: currentWorkspace?.name,
          inviterName: currentUser.name,
        });
        setEmailEnviado(true);
      } catch {
        setEmailEnviado(false);
      }

      setNome('');
      setEmail('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o convite.');
    } finally {
      setEnviando(false);
    }
  };

  const copiarLink = async () => {
    if (!linkGerado) return;
    await copyToClipboard(linkGerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const revogar = async (id: string) => {
    try {
      await revogarConvite(id);
      setFeedback('Convite revogado.');
      setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível revogar o convite.');
    }
  };

  const fecharModal = () => {
    setMostrarModal(false);
    setLinkGerado(null);
    setErro(null);
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {erro && !mostrarModal && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* Membros */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-purple-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Equipe da agência</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {carregando ? 'Carregando...' : `${membros.length} pessoa(s) com acesso`}
              </p>
            </div>
          </div>

          {podeGerenciar && (
            <button
              onClick={() => setMostrarModal(true)}
              className="shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Convidar
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {membros.map((membro) => (
            <div key={membro.userId} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {(membro.name || '?').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {membro.name || 'Sem nome'}
                    {membro.userId === currentUser?.id && (
                      <span className="ml-1.5 text-[10px] font-medium text-slate-400">(você)</span>
                    )}
                  </p>
                  {/*
                    O e-mail dos colegas não aparece de propósito: ele vive em
                    auth.users, que a RLS não expõe entre membros. Mostramos o
                    do próprio usuário, que ele já conhece.
                  */}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {membro.userId === currentUser?.id
                      ? currentUser.email
                      : 'Membro da agência'}
                  </p>
                </div>
              </div>
              {badgeDoPapel(membro.role)}
            </div>
          ))}

          {!carregando && membros.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              Nenhum membro carregado.
            </div>
          )}
        </div>
      </div>

      {/* Convites pendentes */}
      {podeGerenciar && convites.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Convites pendentes</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Válidos por 7 dias a partir da criação
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {convites.map((convite) => (
              <div key={convite.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {convite.email}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Expira em {new Date(convite.expiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {badgeDoPapel(convite.role)}
                  <button
                    onClick={() => revogar(convite.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Revogar convite"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de convite */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Convidar para a agência
              </h3>
              <button
                onClick={fecharModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {linkGerado ? (
              <div className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                  {emailEnviado
                    ? 'Convite enviado por e-mail. O link abaixo é o mesmo, caso queira compartilhar por outro canal.'
                    : 'Convite criado, mas o e-mail não pôde ser enviado. Compartilhe o link abaixo manualmente.'}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={linkGerado}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-mono text-slate-700 dark:text-slate-300"
                  />
                  <button
                    onClick={copiarLink}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>

                <button
                  onClick={fecharModal}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={convidar} className="p-5 space-y-3.5">
                {erro && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                    {erro}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pessoa@agencia.com.br"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome (opcional)
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Lucas Mendes"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Papel
                  </label>
                  <select
                    value={papel}
                    onChange={(e) => setPapel(e.target.value as Role)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {PAPEIS.map((p) => (
                      <option key={p.valor} value={p.valor}>
                        {p.rotulo}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {enviando ? 'Gerando convite...' : 'Gerar link de convite'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
