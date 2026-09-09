import React, { useCallback, useEffect, useState } from 'react';
import { usePostfy } from '../../../context/PostfyContext';
import {
  Users, Plus, Mail, Trash2, CheckCircle2, X, Copy, Check, Clock, AlertCircle,
  UserX, UserCheck,
} from 'lucide-react';
import { Role } from '../../../types';
import { conviteApi } from '../../../lib/api';
import {
  listarEquipe,
  listarConvites,
  criarConvite,
  revogarConvite,
  atualizarMembro,
  removerMembro,
  situacaoDoConvidado,
  adicionarMembroExistente,
  type MembroDaEquipe,
  type ConvitePendente,
  type SituacaoDoConvidado,
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
  const [motivoDoEmail, setMotivoDoEmail] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [salvandoMembro, setSalvandoMembro] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<SituacaoDoConvidado | null>(null);

  /**
   * Quem já tem conta não precisa de link.
   *
   * A tela tratava todo mundo como visitante novo: gerava o link e pedia para
   * compartilhar. Para quem já usa a plataforma o link é um passo a mais sem
   * função — a senha já existe, falta só aceitar o cargo.
   *
   * A consulta espera a digitação parar. Sem isso ela sairia a cada tecla, e
   * `pessoa@` chegaria ao banco antes de o e-mail existir.
   */
  useEffect(() => {
    const alvo = email.trim().toLowerCase();
    if (!mostrarModal || !currentWorkspace?.id || !alvo.includes('@')) {
      setSituacao(null);
      return;
    }

    const relogio = setTimeout(() => {
      situacaoDoConvidado(currentWorkspace.id, alvo)
        .then(setSituacao)
        // Silencioso de propósito: isto só decide o texto do botão. Falhar
        // aqui não pode impedir o convite, que o banco valida de novo.
        .catch(() => setSituacao(null));
    }, 400);

    return () => clearTimeout(relogio);
  }, [email, mostrarModal, currentWorkspace?.id]);

  const carregar = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setCarregando(true);
    setErro(null);
    try {
      setMembros(await listarEquipe(currentWorkspace.id));
      if (podeGerenciar) {
        setConvites(await listarConvites(currentWorkspace.id));
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar a equipe.');
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar, currentWorkspace?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setEnviando(true);
    setErro(null);
    try {
      // Quem já tem conta entra agora. O convite servia para criar conta, que
      // essa pessoa já tem — e o aceite era onde o fluxo morria: e-mail que
      // não chega, link que expira, aceite feito no navegador de outra conta.
      if (situacao?.temConta) {
        const { jaEraMembro } = await adicionarMembroExistente(
          currentWorkspace.id,
          email.trim(),
          papel
        );
        setFeedback(
          jaEraMembro
            ? 'Esta pessoa já fazia parte da agência.'
            : `${email.trim()} agora faz parte da agência.`
        );
        setTimeout(() => setFeedback(null), 5000);
        fecharModal();
        await carregar();
        return;
      }

      // A agência é a que está aberta agora, não a do login.
      // `currentUser.workspaceId` é fixado quando a sessão começa: depois de
      // trocar de agência, todo convite continuava nascendo na anterior — a
      // pessoa convidada entrava numa agência que ninguém pediu.
      // O nome não vai para quem já tem conta: o campo está escondido nesse
      // caso, e mandar o que ficou digitado antes da checagem gravaria um
      // nome que ninguém escolheu.
      const nomeDoConvite = situacao?.temConta ? undefined : nome.trim() || undefined;

      const { token } = await criarConvite({
        workspaceId: currentWorkspace.id,
        email: email.trim(),
        nome: nomeDoConvite,
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
          workspaceId: currentWorkspace.id,
          agencyName: currentWorkspace?.name,
          inviterName: currentUser.name,
        });
        setEmailEnviado(true);
        setMotivoDoEmail(null);
      } catch (err) {
        // Guarda o motivo que o servidor deu. "Não pôde ser enviado" sozinho
        // manda procurar defeito onde não tem: o caso mais comum é o limite
        // por hora da rota, que passa em uma hora e não é erro de ninguém.
        setEmailEnviado(false);
        setMotivoDoEmail(err instanceof Error ? err.message : null);
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

  /**
   * As três ações sobre um membro.
   *
   * O que pode e o que não pode é decidido no banco (política + trigger
   * `membro_editado`), não aqui: a mensagem de erro que aparece na tela é a
   * que o Postgres devolveu. Esconder o botão sem a regra no banco daria a
   * impressão de proteção que a API não teria.
   */
  const aplicarNoMembro = async (
    membro: MembroDaEquipe,
    mudancas: { role?: Role; ativo?: boolean },
    mensagem: string
  ) => {
    setErro(null);
    setSalvandoMembro(membro.userId);
    try {
      await atualizarMembro(membro.workspaceId, membro.userId, mudancas);
      setFeedback(mensagem);
      setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar o membro.');
    } finally {
      setSalvandoMembro(null);
    }
  };

  const excluirMembro = async (membro: MembroDaEquipe) => {
    const nome = membro.name || 'este membro';
    if (!window.confirm(`Remover ${nome} da agência? Ela perde o acesso imediatamente.`)) return;

    setErro(null);
    setSalvandoMembro(membro.userId);
    try {
      await removerMembro(membro.workspaceId, membro.userId);
      setFeedback('Membro removido da agência.');
      setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível remover o membro.');
    } finally {
      setSalvandoMembro(null);
    }
  };

  /**
   * Reenvia o e-mail do convite que já existe.
   *
   * Antes a única saída para um e-mail que não chegou era criar outro
   * convite, o que invalida o link anterior — se a pessoa tivesse recebido o
   * primeiro e demorasse a clicar, ele morria na mão dela.
   */
  const reenviar = async (convite: ConvitePendente) => {
    setErro(null);
    setReenviando(convite.id);
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.pathname = '/';
      url.searchParams.set('invite', convite.token);

      await conviteApi.enviarPorEmail({
        email: convite.email,
        link: url.toString(),
        workspaceId: convite.workspaceId,
        agencyName: currentWorkspace?.name,
        inviterName: currentUser.name,
      });

      setFeedback(`Convite reenviado para ${convite.email}.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível reenviar o convite.');
    } finally {
      setReenviando(null);
    }
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
    setSituacao(null);
    setEmail('');
    setNome('');
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
          {membros.map((membro) => {
            const souEu = membro.userId === currentUser?.id;
            // Ninguém mexe no próprio papel nem no próprio acesso — a regra
            // vale no banco, e o botão desabilitado só evita o erro à toa.
            const podeMexer = podeGerenciar && !souEu;
            const ocupado = salvandoMembro === membro.userId;

            return (
              <div
                key={membro.userId}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  membro.ativo ? '' : 'bg-slate-50/70 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    membro.ativo
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600'
                  }`}>
                    {(membro.name || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      <span className={membro.ativo ? '' : 'line-through text-slate-400'}>
                        {membro.name || 'Sem nome'}
                      </span>
                      {souEu && (
                        <span className="text-[10px] font-medium text-slate-400">(você)</span>
                      )}
                      {!membro.ativo && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Inativo
                        </span>
                      )}
                    </p>
                    {/*
                      O e-mail dos colegas não aparece de propósito: ele vive em
                      auth.users, que a RLS não expõe entre membros. Mostramos o
                      do próprio usuário, que ele já conhece.
                    */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {souEu ? currentUser.email : 'Membro da agência'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {podeMexer ? (
                    <select
                      value={membro.role}
                      disabled={ocupado}
                      onChange={(e) =>
                        aplicarNoMembro(membro, { role: e.target.value as Role }, 'Papel atualizado.')
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-50"
                    >
                      {membro.role === 'owner' && <option value="owner">Proprietário</option>}
                      {PAPEIS.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    badgeDoPapel(membro.role)
                  )}

                  {podeMexer && (
                    <>
                      <button
                        onClick={() =>
                          aplicarNoMembro(
                            membro,
                            { ativo: !membro.ativo },
                            membro.ativo ? 'Acesso suspenso.' : 'Acesso reativado.'
                          )
                        }
                        disabled={ocupado}
                        className={`p-1.5 rounded-lg transition cursor-pointer disabled:opacity-50 ${
                          membro.ativo
                            ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                        title={membro.ativo ? 'Suspender o acesso' : 'Reativar o acesso'}
                      >
                        {membro.ativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => excluirMembro(membro)}
                        disabled={ocupado}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                        title="Remover da agência"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

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
                    onClick={() => reenviar(convite)}
                    disabled={reenviando === convite.id}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                    title="Reenviar o e-mail deste convite"
                  >
                    {reenviando === convite.id ? 'Reenviando...' : 'Reenviar'}
                  </button>
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
                {emailEnviado ? (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                    {situacao?.temConta
                      ? 'Pronto. A pessoa já tem conta no Orquesia: basta aceitar o cargo pelo e-mail, com a senha que ela já usa.'
                      : 'Convite enviado por e-mail. O link abaixo é o mesmo, caso queira compartilhar por outro canal.'}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs space-y-1">
                    <p className="font-bold">O convite está criado e válido.</p>
                    <p>
                      O que não saiu foi o e-mail
                      {motivoDoEmail ? `: ${motivoDoEmail}` : '.'} Enquanto isso, o link abaixo
                      funciona igual — pode mandar por onde preferir.
                    </p>
                  </div>
                )}

                {/*
                  Para quem já tem conta o link só aparece se o e-mail falhou.
                  Mostrar sempre transformava um passo que não existe — copiar
                  e mandar o link — no caminho mais visível da tela.
                */}
                <div
                  className={`flex items-center gap-2 ${
                    emailEnviado && situacao?.temConta ? 'hidden' : ''
                  }`}
                >
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

                  {situacao?.jaEMembro && (
                    <p className="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      Esta pessoa já faz parte desta agência. Para mudar o papel dela, use a
                      lista de membros.
                    </p>
                  )}

                  {situacao?.temConta && !situacao.jaEMembro && (
                    <p className="mt-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
                      Já tem conta no Orquesia. Entra na agência agora, sem convite nem
                      link — a agência aparece para ela no próximo acesso.
                    </p>
                  )}

                  {situacao?.convitePendente && !situacao.jaEMembro && (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Já existe um convite pendente para este e-mail. Enviar de novo substitui
                      o anterior.
                    </p>
                  )}
                </div>

                {/* Quem já tem conta já preencheu o próprio nome no perfil.
                    Pedir de novo abriria espaço para o vínculo nascer com um
                    nome diferente do que a pessoa usa no resto do sistema. */}
                {!situacao?.temConta && (
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
                )}

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
                  disabled={enviando || situacao?.jaEMembro}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviando
                    ? 'Enviando...'
                    : situacao?.temConta
                    ? 'Adicionar à agência'
                    : 'Gerar link de convite'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
