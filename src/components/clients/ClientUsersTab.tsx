import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, Eye, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Client, ClientUser, ClientUserRole } from '../../types';
import {
  listarUsuariosDoCliente,
  criarUsuarioDoCliente,
  atualizarUsuarioDoCliente,
  removerUsuarioDoCliente,
} from '../../lib/db';
import { usePostfy } from '../../context/PostfyContext';
import { pode } from '../../lib/permissions';
import { safeDateFormat } from '../../lib/utils';

/**
 * Quem do lado do cliente entra no Portal, e até onde vai.
 *
 * Fora da persistência derivada de diff de propósito: aqui a gravação é a
 * resposta ao clique, e a tela precisa saber se o banco recusou — e-mail
 * repetido (23505) ou papel sem permissão (42501) — antes de dizer que
 * criou. O diff grava em segundo plano, o que serve para o estado grande do
 * app e não serve para um formulário.
 */

const DESCRICAO: Record<ClientUserRole, string> = {
  aprovador: 'Vê o conteúdo e aprova ou pede ajuste. Nada além disso.',
  editor:
    'Tudo do aprovador, mais arquivos, senhas, notas fiscais, briefing e criar novos usuários.',
};

interface ClientUsersTabProps {
  client: Client;
}

export const ClientUsersTab: React.FC<ClientUsersTabProps> = ({ client }) => {
  const { currentUser } = usePostfy();
  const podeGerenciar = pode(currentUser?.role, 'gerenciar_clientes');

  const [usuarios, setUsuarios] = useState<ClientUser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoPapel, setNovoPapel] = useState<ClientUserRole>('aprovador');
  const [salvando, setSalvando] = useState(false);

  const recarregar = async () => {
    setCarregando(true);
    try {
      setUsuarios(await listarUsuariosDoCliente(client.id));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os usuários.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const confirmar = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3000);
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      setErro('Informe um e-mail válido.');
      return;
    }

    setSalvando(true);
    try {
      const criado = await criarUsuarioDoCliente({
        workspaceId: client.workspaceId,
        clientId: client.id,
        email,
        name: novoNome.trim() || undefined,
        role: novoPapel,
      });
      setUsuarios((antes) => [...antes, criado]);
      setNovoEmail('');
      setNovoNome('');
      setNovoPapel('aprovador');
      setMostrarForm(false);
      setErro(null);
      confirmar(`${email} já pode entrar no portal com o código enviado por e-mail.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const trocarPapel = async (usuario: ClientUser, papel: ClientUserRole) => {
    if (usuario.role === papel) return;
    // Otimista com rollback: a lista é curta e o banco responde rápido, mas
    // se ele recusar a tela volta ao que ele tem em vez de ficar exibindo um
    // papel que ninguém gravou.
    const antes = usuarios;
    setUsuarios((atual) => atual.map((u) => (u.id === usuario.id ? { ...u, role: papel } : u)));
    try {
      await atualizarUsuarioDoCliente(usuario.id, { role: papel });
      setErro(null);
    } catch (e) {
      setUsuarios(antes);
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o papel.');
    }
  };

  const alternarAtivo = async (usuario: ClientUser) => {
    const antes = usuarios;
    setUsuarios((atual) =>
      atual.map((u) => (u.id === usuario.id ? { ...u, ativo: !u.ativo } : u))
    );
    try {
      await atualizarUsuarioDoCliente(usuario.id, { ativo: !usuario.ativo });
      setErro(null);
    } catch (e) {
      setUsuarios(antes);
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o acesso.');
    }
  };

  const remover = async (usuario: ClientUser) => {
    if (!window.confirm(`Remover o acesso de ${usuario.email} ao portal?`)) return;
    const antes = usuarios;
    setUsuarios((atual) => atual.filter((u) => u.id !== usuario.id));
    try {
      await removerUsuarioDoCliente(usuario.id);
      setErro(null);
    } catch (e) {
      setUsuarios(antes);
      setErro(e instanceof Error ? e.message : 'Não foi possível remover o usuário.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
            Usuários do Portal
          </h4>
          <p className="text-xs text-slate-500">
            Quem do lado do cliente entra no Portal, e o que cada um pode fazer lá dentro.
          </p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Usuário
          </button>
        )}
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          {erro}
        </div>
      )}

      {aviso && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          {aviso}
        </div>
      )}

      {mostrarForm && podeGerenciar && (
        <form
          onSubmit={criar}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-md space-y-4 animate-in fade-in"
        >
          <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">
            Dar acesso ao portal
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">E-mail</label>
              <input
                type="email"
                placeholder="pessoa@empresa.com.br"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Nome (opcional)
              </label>
              <input
                type="text"
                placeholder="Como aparece no histórico de aprovações"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['aprovador', 'editor'] as ClientUserRole[]).map((papel) => (
              <button
                key={papel}
                type="button"
                onClick={() => setNovoPapel(papel)}
                className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
                  novoPapel === papel
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white capitalize">
                  {papel === 'editor' ? (
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-500" />
                  )}
                  {papel}
                </span>
                <span className="block mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {DESCRICAO[papel]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setMostrarForm(false);
                setErro(null);
              }}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Dar acesso'}
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex justify-center shadow-xs">
          <div className="w-6 h-6 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-400 flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-800">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Ninguém tem acesso ao portal deste cliente.
          </p>
          <p className="text-xs text-slate-500">
            Enquanto não houver nenhum usuário aqui, o código de acesso não é enviado para
            e-mail nenhum e o portal não abre.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    usuario.role === 'editor'
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 border-purple-100 dark:border-purple-900/40'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {usuario.role === 'editor' ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                    {usuario.name || usuario.email}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    {usuario.name ? `${usuario.email} • ` : ''}
                    {usuario.ultimoAcesso
                      ? `último acesso em ${safeDateFormat(usuario.ultimoAcesso)}`
                      : 'nunca entrou'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {podeGerenciar ? (
                  <select
                    value={usuario.role}
                    onChange={(e) => void trocarPapel(usuario, e.target.value as ClientUserRole)}
                    className="p-2 text-xs font-bold border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="aprovador">Aprovador</option>
                    <option value="editor">Editor</option>
                  </select>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {usuario.role}
                  </span>
                )}

                {podeGerenciar && (
                  <>
                    <button
                      onClick={() => void alternarAtivo(usuario)}
                      className={`px-3 py-2 text-[11px] font-bold rounded-xl border transition cursor-pointer ${
                        usuario.ativo
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                      title={usuario.ativo ? 'Suspender o acesso' : 'Devolver o acesso'}
                    >
                      {usuario.ativo ? 'Ativo' : 'Suspenso'}
                    </button>
                    <button
                      onClick={() => void remover(usuario)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="Remover do portal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        <strong className="text-slate-700 dark:text-slate-300">Como o acesso funciona:</strong>{' '}
        não há senha. Quem está nesta lista pede um código de seis dígitos na porta do portal,
        recebe por e-mail e entra. O que o aprovador não pode ver — senhas, notas fiscais e
        briefing — não é escondido na tela: o banco não devolve esses campos para ele.
      </div>
    </div>
  );
};
