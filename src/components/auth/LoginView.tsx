import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { Role, User } from '../../types';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Building2, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Key, 
  Zap, 
  Eye, 
  EyeOff,
  LayoutDashboard
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, register, recuperarSenha, currentWorkspace } = usePostfy();

  const [activeMode, setActiveMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Cadastro de nova agência
  const [regName, setRegName] = useState('');
  const [regAgency, setRegAgency] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Standard Orquesia Logo URL from user request
  const orquesiaLogo = 'https://i.pinimg.com/736x/dd/6e/b3/dd6eb385dafdfd1cce83c084d0021670.jpg';

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Informe e-mail e senha.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.success) {
        setSuccessMsg('Autenticado com sucesso. Entrando...');
      } else {
        setErrorMsg(res.message || 'E-mail ou senha incorretos.');
      }
    } catch {
      setErrorMsg('Não foi possível falar com o servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Recuperação de senha. A resposta é sempre a mesma exista ou não a conta:
   * dizer "e-mail não encontrado" entregaria quem tem cadastro na plataforma.
   */
  const handleRecuperarSenha = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Informe seu e-mail para receber o link de recuperação.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await recuperarSenha(email.trim());
      if (res.success) {
        setSuccessMsg(res.message || 'Link de recuperação enviado.');
      } else {
        setErrorMsg(res.message || 'Não foi possível enviar o link.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Preencha nome, e-mail e senha para criar a conta.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        agencyName: regAgency.trim() || undefined,
      });
      if (res.success) {
        setSuccessMsg('Agência criada com sucesso. Entrando...');
      } else {
        setErrorMsg(res.message || 'Não foi possível criar a conta.');
      }
    } catch {
      setErrorMsg('Não foi possível falar com o servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full h-screen bg-white text-slate-900 grid grid-cols-1 lg:grid-cols-12 font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
      
      {/* Left Side: Full Screen Hero Banner with Antelope Canyon Image */}
      <div className="lg:col-span-5 hidden lg:flex relative bg-slate-900 h-full flex-col justify-end p-10 lg:p-14 text-white overflow-hidden shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80" 
          alt="Orquesia Background" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90 transition duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Bottom Caption inside Banner */}
        <div className="relative z-10 space-y-3 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold text-white shadow-sm">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span>Gestão Inteligente de Agências</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white drop-shadow-md">
            Sua agência de conteúdo em outro nível.
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed font-normal opacity-90">
            Fluxos de aprovação com clientes, pautas editoriais e inteligência artificial para criadores e gestores de mídia.
          </p>
        </div>
      </div>

      {/* Right Side: Full Screen Auth Form Container */}
      <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-12 lg:p-16 flex flex-col justify-between space-y-6 bg-white">
        <div className="max-w-xl mx-auto w-full space-y-6 my-auto">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 p-1.5 flex items-center justify-center shadow-sm shrink-0">
              <img src={orquesiaLogo} alt="Orquesia Logo" className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Orquesia
              </h1>
              <span className="text-[11px] font-mono text-indigo-600 font-bold uppercase tracking-widest block">
                Agency Operating System
              </span>
            </div>
          </div>

          {/* Security Badge */}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Ambiente Seguro
          </span>
        </div>

          {/* Welcome Title */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Bem-vindo ao Orquesia
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Orquesia é a forma mais rápida, simples e segura de gerenciar pautas, aprovações e produção de conteúdo da sua agência.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => { setActiveMode('login'); setErrorMsg(null); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeMode === 'login' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Com E-mail</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveMode('register'); setErrorMsg(null); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeMode === 'register' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Nova Agência</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: Standard Email Login Form */}
          {activeMode === 'login' && (
            <form onSubmit={handleStandardLogin} className="space-y-3 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-0"
                  />
                  <span>Lembrar minhas credenciais</span>
                </label>
                <button
                  type="button"
                  onClick={handleRecuperarSenha}
                  disabled={isLoading}
                  className="text-orange-600 hover:underline font-semibold disabled:opacity-50"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Primary Warm Accent Action Button matching the screenshot style */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-amber-100/80 hover:bg-amber-200/90 text-amber-950 border border-amber-200/80 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Autenticando...</span>
                ) : (
                  <>
                    <span>Continuar com e-mail</span>
                    <ArrowRight className="w-4 h-4 text-amber-900" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: Register New Agency */}
          {activeMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-2.5 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Seu Nome Completo</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome da Agência</label>
                <input
                  type="text"
                  value={regAgency}
                  onChange={(e) => setRegAgency(e.target.value)}
                  placeholder="Ex: Agência Orquesia Creative"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="contato@orquesia.com.br"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Você entra como <strong>proprietário</strong> da nova agência e poderá
                convidar a equipe depois, definindo o papel de cada pessoa.
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-1"
              >
                {isLoading ? 'Criando Conta...' : 'Criar Conta Orquesia'}
              </button>
            </form>
          )}

          {/* Footer Terms & Policy */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-snug">
              Ao continuar, você concorda com nossos{' '}
              <a href="#terms" className="underline hover:text-slate-600">Termos de Serviço</a> &{' '}
              <a href="#privacy" className="underline hover:text-slate-600">Política de Privacidade</a>.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
