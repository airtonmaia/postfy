import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { teamApi, ApiError } from '../../lib/api';
import { ShieldCheck, Building2, Mail, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  token: string;
}

const ROTULO_PAPEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gestor',
  social_media: 'Social Media',
  designer: 'Designer',
  copywriter: 'Copywriter',
  financial: 'Financeiro',
  client: 'Cliente',
};

/**
 * Aceite de convite de equipe.
 * A pessoa convidada define a própria senha; o e-mail e o papel vêm do convite
 * e não podem ser alterados aqui.
 */
export const AcceptInviteView: React.FC<Props> = ({ token }) => {
  const { acceptInvite } = usePostfy();

  const [convite, setConvite] = useState<{
    email: string;
    name: string | null;
    role: string;
    agencyName: string | null;
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const dados = await teamApi.lookupInvite(token);
        if (cancelado) return;
        setConvite(dados);
        setNome(dados.name || '');
      } catch (err) {
        if (cancelado) return;
        setErro(
          err instanceof ApiError ? err.message : 'Não foi possível carregar o convite.'
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Informe seu nome.');
      return;
    }
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }

    setEnviando(true);
    const res = await acceptInvite({ token, name: nome.trim(), password: senha });
    if (!res.success) {
      setErro(res.message || 'Não foi possível aceitar o convite.');
      setEnviando(false);
      return;
    }
    // Sessão aplicada: limpa o token da URL para não ficar no histórico.
    window.history.replaceState({}, '', window.location.pathname);
  };

  if (carregando) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Carregando convite...</span>
        </div>
      </div>
    );
  }

  if (!convite) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">Convite indisponível</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {erro || 'Este convite não existe mais ou já passou da validade.'}
              {' '}Peça um novo link a quem administra a agência.
            </p>
          </div>
          <a
            href={window.location.pathname}
            className="inline-block w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
          >
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-bold text-purple-700">
            <Sparkles className="w-3 h-3" />
            Convite para equipe
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Você foi convidado
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Defina sua senha para entrar. Seu e-mail e papel já foram definidos por
            quem convidou.
          </p>
        </div>

        <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold truncate">{convite.agencyName || 'Agência'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{convite.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{ROTULO_PAPEL[convite.role] || convite.role}</span>
          </div>
        </div>

        {erro && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {erro}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Seu nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Senha (mínimo 8 caracteres)
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Confirme a senha
            </label>
            <input
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {enviando ? 'Entrando...' : 'Aceitar convite e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
