import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, ShieldCheck, Eye, Mail, AlertCircle, CheckCircle2, KeyRound, Copy, Check,
} from 'lucide-react';
import type { Client, ClientUser, ClientUserRole } from '../../types';
import {
  listarUsuariosDoCliente,
  criarUsuarioDoCliente,
  atualizarUsuarioDoCliente,
  removerUsuarioDoCliente,
  definirSenhaDoPortal,
  removerSenhaDoPortal,
} from '../../lib/db';
import { usePostfy } from '../../context/PostfyContext';
import { pode } from '../../lib/permissions';
import { safeDateFormat, copyToClipboard } from '../../lib/utils';
import { gerarSenhaDoPortal, senhaCurta, TAMANHO_MINIMO_DA_SENHA } from '../../lib/senhas';
import { Button } from '../ui/button';
import { useConfirmacao } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

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

/**
 * O campo onde a senha nasce: gerar, ler e copiar num lugar só.
 *
 * Ele serve o cadastro de um usuário novo e a troca de senha de quem já
 * existe. Duas cópias divergiriam na primeira pressa — é a história das doze
 * alturas de botão —, e aqui a divergência sai cara: o botão de gerar que
 * ficasse de fora de um dos lados devolveria a agência a escrever
 * "cliente123" à mão, que é exatamente a senha que esta tela existe para não
 * produzir.
 *
 * **O valor fica visível, e isso é decisão.** Quem está digitando aqui não é
 * o dono da senha: é quem vai mandá-la ao cliente. Escondê-la atrás de
 * bolinhas impediria conferir o que foi copiado — e a senha gerada já não
 * tem `I`, `O`, `0` nem `1` justamente porque ela é lida e repassada por
 * outra pessoa.
 */
const CampoDeSenha: React.FC<{
  valor: string;
  aoMudar: (v: string) => void;
  autoFocus?: boolean;
}> = ({ valor, aoMudar, autoFocus }) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!valor) return;
    if (await copyToClipboard(valor)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        autoFocus={autoFocus}
        // Nada de preencher com a senha guardada: não existe senha guardada
        // para preencher. O que está no banco é bcrypt, e não volta.
        autoComplete="off"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={`Mínimo de ${TAMANHO_MINIMO_DA_SENHA} caracteres`}
        className="flex-1 min-w-0 p-2 text-xs font-mono border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800 tracking-wider"
      />
      <Button variant="secondary" type="button" onClick={() => aoMudar(gerarSenhaDoPortal())}>
        Gerar
      </Button>
      <Button variant="ghost" size="icon-sm"
        type="button"
        onClick={() => void copiar()}
        disabled={!valor}
        aria-label="Copiar a senha"
      >
        {/* Confirmação de que deu certo não usa diálogo: um ícone que muda
            por dois segundos basta, e não precisa ser fechado. */}
        {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
};

interface ClientUsersTabProps {
  client: Client;
}

export const ClientUsersTab: React.FC<ClientUsersTabProps> = ({ client }) => {
  const { currentUser } = usePostfy();
  const podeGerenciar = pode(currentUser?.role, 'gerenciar_clientes');

  const [usuarios, setUsuarios] = useState<ClientUser[]>([]);
  const { pedir, dialogo } = useConfirmacao();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoPapel, setNovoPapel] = useState<ClientUserRole>('aprovador');
  const [novaSenha, setNovaSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  /** Quem está com a janela de senha aberta, e o valor sendo definido. */
  const [trocandoSenha, setTrocandoSenha] = useState<ClientUser | null>(null);
  const [senhaDaTroca, setSenhaDaTroca] = useState('');

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

    const senha = novaSenha.trim();
    // O banco cobra o mesmo mínimo. Conferir aqui existe para a pessoa não
    // descobrir o limite por um erro do Postgres depois de já ter criado o
    // usuário — que é o passo que **não** desfaz.
    if (senha && senhaCurta(senha)) {
      setErro(`A senha precisa de pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`);
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

      /**
       * **São duas escritas, e a segunda pode falhar sozinha.**
       *
       * O usuário é criado por `insert` (a RLS recorta) e a senha por RPC (o
       * hash é feito no banco). Sem este `catch` próprio, uma falha na senha
       * cairia no `catch` de fora dizendo "não foi possível criar o usuário"
       * — e o usuário **está** criado, então a agência tentaria de novo e
       * levaria um erro de e-mail repetido. A mensagem nomeia o que ficou
       * pendente e o que já existe.
       */
      let avisoDaSenha = '';
      if (senha) {
        try {
          await definirSenhaDoPortal(criado.id, senha);
          criado.senhaDefinidaEm = new Date().toISOString();
        } catch (e) {
          avisoDaSenha =
            ' O acesso foi criado, mas a senha não foi salva — use "Definir senha" na lista.';
          setErro(e instanceof Error ? e.message : 'Não foi possível definir a senha.');
        }
      }

      setUsuarios((antes) => [...antes, criado]);
      setNovoEmail('');
      setNovoNome('');
      setNovoPapel('aprovador');
      setNovaSenha('');
      setMostrarForm(false);
      if (!avisoDaSenha) setErro(null);

      confirmar(
        senha && !avisoDaSenha
          ? `${email} já pode entrar no portal com essa senha. Ela não aparece de novo — copie antes de fechar.`
          : `${email} já pode entrar no portal com o código enviado por e-mail.${avisoDaSenha}`
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const salvarSenha = async () => {
    if (!trocandoSenha) return;
    const senha = senhaDaTroca.trim();
    if (senhaCurta(senha)) {
      setErro(`A senha precisa de pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`);
      return;
    }

    setSalvando(true);
    try {
      await definirSenhaDoPortal(trocandoSenha.id, senha);
      const agora = new Date().toISOString();
      setUsuarios((atual) =>
        atual.map((u) => (u.id === trocandoSenha.id ? { ...u, senhaDefinidaEm: agora } : u))
      );
      setErro(null);
      const quem = trocandoSenha.email;
      setTrocandoSenha(null);
      setSenhaDaTroca('');
      confirmar(`Senha definida para ${quem}. Ela não aparece de novo — copie antes de fechar.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível definir a senha.');
    } finally {
      setSalvando(false);
    }
  };

  const tirarSenha = (usuario: ClientUser) =>
    pedir({
      titulo: 'Tirar a senha deste acesso?',
      descricao: `${usuario.email} volta a entrar apenas pelo código de seis dígitos enviado por e-mail, e as sessões abertas dessa pessoa caem na hora — inclusive nas abas que já estiverem abertas.`,
      rotuloConfirmar: 'Tirar a senha',
      aoConfirmar: async () => {
        try {
          await removerSenhaDoPortal(usuario.id);
          setUsuarios((atual) =>
            atual.map((u) => (u.id === usuario.id ? { ...u, senhaDefinidaEm: undefined } : u))
          );
          setErro(null);
          confirmar(`${usuario.email} voltou a entrar por código.`);
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Não foi possível tirar a senha.');
        }
      },
    });

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

  const remover = (usuario: ClientUser) =>
    pedir({
      titulo: 'Remover o acesso ao portal?',
      descricao: `${usuario.email} deixa de entrar no portal deste cliente. O que já foi aprovado continua registrado.`,
      rotuloConfirmar: 'Remover acesso',
      aoConfirmar: () => removerDeVez(usuario),
    });

  const removerDeVez = async (usuario: ClientUser) => {
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
    <>
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
          <Button
            onClick={() => setMostrarForm(true)}
            className="shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
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

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Senha de acesso (opcional)
            </label>
            <CampoDeSenha valor={novaSenha} aoMudar={setNovaSenha} />
            <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
              Com senha, a pessoa entra na hora. Sem senha, ela pede um código de seis dígitos
              na porta do portal e espera o e-mail chegar.{' '}
              <strong className="text-slate-600 dark:text-slate-300">
                A senha aparece só agora
              </strong>{' '}
              — o banco guarda uma versão irreversível dela. Se perder, gere outra.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost"
              type="button"
              onClick={() => {
                setMostrarForm(false);
                setNovaSenha('');
                setErro(null);
              }}
              className="dark:hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Dar acesso'}
            </Button>
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
                    {/* Como a pessoa entra é o que a agência precisa saber
                        quando o cliente liga dizendo que não consegue: sem
                        isto, a resposta exige abrir o banco. */}
                    {' • '}
                    {usuario.senhaDefinidaEm ? 'entra com senha' : 'entra por código'}
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
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {usuario.role}
                  </span>
                )}

                {podeGerenciar && (
                  <>
                    <Button variant="ghost" size="icon-sm"
                      onClick={() => {
                        setTrocandoSenha(usuario);
                        setSenhaDaTroca('');
                        setErro(null);
                      }}
                      className={`border ${
                        usuario.senhaDefinidaEm
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-purple-600'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                      title={usuario.senhaDefinidaEm ? 'Trocar a senha' : 'Definir uma senha'}
                      aria-label={usuario.senhaDefinidaEm ? 'Trocar a senha' : 'Definir uma senha'}
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>

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
                    <Button variant="destructive" size="icon-sm"
                      onClick={() => void remover(usuario)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-red-600"
                      title="Remover do portal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        <strong className="text-slate-700 dark:text-slate-300">Como o acesso funciona:</strong>{' '}
        quem tem senha entra com e-mail e senha, na hora. Quem não tem pede um código de seis
        dígitos na porta do portal, recebe por e-mail e entra — e esse caminho continua valendo
        para todo mundo, inclusive para quem esqueceu a senha. O que o aprovador não pode ver —
        senhas, notas fiscais e briefing — não é escondido na tela: o banco não devolve esses
        campos para ele.
      </div>
    </div>

      {/*
        A troca de senha de quem já existe. É a mesma peça do cadastro, e não
        um segundo campo escrito aqui: quem gera a senha na criação e quem a
        troca depois precisam do mesmo botão de gerar e do mesmo de copiar.
      */}
      <Dialog
        open={!!trocandoSenha}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setTrocandoSenha(null);
            setSenhaDaTroca('');
          }
        }}
      >
        {trocandoSenha && (
          <DialogContent tamanho="formulario" className="p-6 gap-4">
            <DialogTitle asChild>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-600" />
                {trocandoSenha.senhaDefinidaEm ? 'Trocar a senha' : 'Definir uma senha'}
              </h3>
            </DialogTitle>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Para <strong className="text-slate-700 dark:text-slate-300">{trocandoSenha.email}</strong>.
              {trocandoSenha.senhaDefinidaEm
                ? ' A senha atual deixa de valer na hora, e as sessões abertas dessa pessoa caem junto — inclusive nas abas que já estiverem abertas.'
                : ' Ela passa a entrar com e-mail e senha, sem esperar o código chegar.'}
            </p>

            <CampoDeSenha valor={senhaDaTroca} aoMudar={setSenhaDaTroca} autoFocus />

            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-600 dark:text-slate-300">
                Copie antes de salvar.
              </strong>{' '}
              O banco guarda uma versão irreversível — nem esta tela consegue mostrá-la de novo.
            </p>

            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-1 [&>*]:w-full sm:[&>*]:w-auto">
              {trocandoSenha.senhaDefinidaEm ? (
                <Button variant="destructive"
                  type="button"
                  onClick={() => {
                    const alvo = trocandoSenha;
                    setTrocandoSenha(null);
                    void tirarSenha(alvo);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  Tirar a senha
                </Button>
              ) : (
                <span />
              )}

              <span className="flex flex-col sm:flex-row gap-2 [&>*]:w-full sm:[&>*]:w-auto">
                <Button variant="ghost" type="button" onClick={() => setTrocandoSenha(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={salvando} onClick={() => void salvarSenha()}>
                  {salvando ? 'Salvando…' : 'Salvar senha'}
                </Button>
              </span>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {dialogo}
    </>
  );
};
