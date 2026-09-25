import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, MailCheck } from 'lucide-react';
import { MarcaOrquesia } from '../common/MarcaOrquesia';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';

/**
 * Definir a senha, chegando pelo link do e-mail.
 *
 * **Esta tela não existia, e é por isso que "esqueci minha senha" não
 * resolvia nada.** O link era enviado desde sempre e trazia a pessoa para
 * `/?recuperar=1` — um endereço que o app não lia. `redefinirSenha` estava no
 * contexto **sem nenhum chamador**: a função pronta, a rota sem tela. O
 * efeito é o pior possível para um caminho de recuperação, porque ele
 * *parece* funcionar: o link abre o produto, a sessão entra, e a pessoa segue
 * usando — com a senha antiga intacta. Na próxima vez que precisar dela,
 * está trancada do mesmo jeito, agora sem entender por quê.
 *
 * É a família do `trial_ends_at` e da fila sem produtor: a peça do meio
 * existia, as duas pontas não.
 *
 * O mesmo link serve para **criar** a primeira senha de quem entrou pelo
 * Google — daí o texto falar em "definir", nunca em "trocar": quem chega aqui
 * pode não ter tido senha nenhuma antes.
 */
export const TelaDeNovaSenha: React.FC = () => {
  const { redefinirSenha, recuperarSenha, isAuthenticated, aparencia } = usePostfy();

  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState('');
  const [reenviado, setReenviado] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    /*
      A repetição existe porque esta é a única tela do produto onde a pessoa
      digita uma senha que ela ainda não sabe se funciona: no login um erro de
      digitação é recusado na hora, aqui ele é gravado. E o campo está com o
      texto escondido, então nem reler resolve.
    */
    if (senha !== repetida) {
      setErro('As duas senhas não são iguais.');
      return;
    }

    setOcupado(true);
    try {
      const res = await redefinirSenha(senha);
      if (!res.success) {
        setErro(res.message || 'Não foi possível salvar a senha.');
        return;
      }
      /*
        Recarrega em vez de trocar de tela por estado: o `?recuperar=1` está
        na URL, e quem decide montar esta tela lê a URL. Sem a recarga, sair
        daqui exigiria sincronizar duas fontes para a mesma resposta — e a
        sessão sobrevive à recarga, então a pessoa cai no app já dentro.
      */
      window.location.replace('/');
    } catch {
      setErro('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  };

  const pedirOutroLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await recuperarSenha(email.trim());
      // A resposta é a mesma exista ou não a conta: dizer "e-mail não
      // encontrado" entregaria quem tem cadastro na plataforma.
      setReenviado(true);
    } finally {
      setOcupado(false);
    }
  };

  const BASE_DO_CAMPO =
    'w-full py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 ' +
    'dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 ' +
    'placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white ' +
    'dark:focus:bg-slate-900 transition';
  // Com ícone dentro, o texto precisa do respiro dos dois lados; sem ícone, não.
  const campo = `${BASE_DO_CAMPO} pl-10 pr-10`;
  const campoSimples = `${BASE_DO_CAMPO} px-3`;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          {aparencia.logoUrl ? (
            <img src={aparencia.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
          ) : (
            <MarcaOrquesia tamanho={40} className="shrink-0" />
          )}
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {aparencia.nome}
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Definir senha de acesso
            </span>
          </div>
        </div>

        {erro && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/*
          Sem sessão, o link caducou ou já foi usado — ele vale uma vez. A
          tela não pode ser um beco: pedir outro daqui é um campo e um botão,
          e mandar a pessoa de volta ao login para achar "esqueci minha senha"
          é onde ela desiste.
        */}
        {!isAuthenticated ? (
          reenviado ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                <MailCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Se existir uma conta com esse e-mail, o link chegou. Ele vale uma vez e
                  expira em uma hora.
                </span>
              </p>
              <Button variant="outline" className="w-full" onClick={() => window.location.replace('/')}>
                Voltar para a entrada
              </Button>
            </div>
          ) : (
            <form onSubmit={pedirOutroLink} className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Este link já foi usado ou expirou. Informe seu e-mail para receber outro.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className={campoSimples}
              />
              <Button type="submit" disabled={ocupado} className="w-full">
                {ocupado ? 'Enviando...' : 'Enviar novo link'}
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={salvar} className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Escolha a senha que você vai usar para entrar com o seu e-mail. Ela não
              substitui o acesso pelo Google — os dois passam a funcionar.
            </p>

            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={verSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Nova senha (mínimo 8 caracteres)"
                autoComplete="new-password"
                className={campo}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {verSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            <div className="relative">
              <CheckCircle2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={verSenha ? 'text' : 'password'}
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className={campo}
              />
            </div>

            <Button type="submit" disabled={ocupado} className="w-full">
              {ocupado ? 'Salvando...' : 'Salvar senha e entrar'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
