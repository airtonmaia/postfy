import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import {
  buscarConvitePorToken,
  aceitarConvite,
  cadastrar,
  entrar,
  type DadosDoConvite,
} from '../../lib/authSupabase';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Building2, Mail, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

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
 *
 * O convite vale para o e-mail convidado, não para quem tiver o link: o
 * vínculo só é criado depois que existe uma sessão com aquele mesmo e-mail, e
 * a RPC no banco confere isso de novo. Ter o link não basta.
 */
export const AcceptInviteView: React.FC<Props> = ({ token }) => {
  const { recarregarSessaoPublica } = usePostfy();

  const [convite, setConvite] = useState<DadosDoConvite | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [modo, setModo] = useState<'cadastrar' | 'entrar'>('cadastrar');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const dados = await buscarConvitePorToken(token);
        if (cancelado) return;
        setConvite(dados);
        setNome(dados?.name || '');

        // Se já houver sessão com o e-mail convidado, aceita direto.
        const { data } = await supabase.auth.getSession();
        const emailDaSessao = data.session?.user?.email;
        if (dados && emailDaSessao && emailDaSessao.toLowerCase() === dados.email.toLowerCase()) {
          const res = await aceitarConvite(token);
          if (res.sucesso) {
            await recarregarSessaoPublica();
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
          setErro(res.mensagem || null);
        }
      } catch (err) {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : 'Não foi possível carregar o convite.');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const finalizar = async () => {
    const res = await aceitarConvite(token, nome.trim() || undefined);
    if (!res.sucesso) {
      setErro(res.mensagem || 'Não foi possível aceitar o convite.');
      setEnviando(false);
      return;
    }
    await recarregarSessaoPublica();
    window.history.replaceState({}, '', window.location.pathname);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (!convite) return;

    if (modo === 'cadastrar') {
      if (!nome.trim()) return setErro('Informe seu nome.');
      if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
      if (senha !== confirmacao) return setErro('As senhas não conferem.');
    } else if (!senha) {
      return setErro('Informe sua senha.');
    }

    setEnviando(true);

    if (modo === 'entrar') {
      const res = await entrar(convite.email, senha);
      if (!res.sucesso) {
        setErro(res.mensagem || 'Não foi possível entrar.');
        setEnviando(false);
        return;
      }
      await finalizar();
      return;
    }

    const res = await cadastrar({ nome: nome.trim(), email: convite.email, senha });
    if (!res.sucesso) {
      setErro(res.mensagem || 'Não foi possível criar a conta.');
      setEnviando(false);
      return;
    }

    // Com confirmação de e-mail ligada, o cadastro não abre sessão — e sem
    // sessão o vínculo não pode ser criado. O convite continua válido.
    if (res.precisaConfirmarEmail) {
      setAviso(
        'Conta criada. Confirme o e-mail que enviamos e abra este mesmo link de convite de novo para entrar na agência.'
      );
      setEnviando(false);
      return;
    }

    await finalizar();
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
              {erro || 'Este convite não existe mais ou já passou da validade.'}{' '}
              Peça um novo link a quem administra a agência.
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
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Você foi convidado</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {modo === 'cadastrar'
              ? 'Defina sua senha para entrar. O e-mail e o papel já vêm do convite.'
              : 'Entre com a senha da sua conta para aceitar o convite.'}
          </p>
        </div>

        <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold truncate">{convite.agencia || 'Agência'}</span>
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

        {aviso && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{aviso}</span>
          </div>
        )}

        <form onSubmit={enviar} className="space-y-3">
          {modo === 'cadastrar' && (
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
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {modo === 'cadastrar' ? 'Senha (mínimo 8 caracteres)' : 'Sua senha'}
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {modo === 'cadastrar' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirme a senha</label>
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {enviando ? 'Entrando...' : 'Aceitar convite e entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'cadastrar' ? 'entrar' : 'cadastrar');
            setErro(null);
            setSenha('');
            setConfirmacao('');
          }}
          className="w-full text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          {modo === 'cadastrar'
            ? 'Já tenho conta com este e-mail'
            : 'Ainda não tenho conta'}
        </button>
      </div>
    </div>
  );
};
