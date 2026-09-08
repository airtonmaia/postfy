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
  const { login, users, currentWorkspace } = usePostfy();

  const [activeMode, setActiveMode] = useState<'login' | 'quick_team' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regAgency, setRegAgency] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<Role>('owner');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Standard Propofy Logo URL from user request
  const propofyStandardLogo = 'https://i.pinimg.com/736x/dd/6e/b3/dd6eb385dafdfd1cce83c084d0021670.jpg';

  // Preset team profiles for instant sign in
  const presetProfiles: { user: User; label: string; desc: string }[] = [
    {
      user: users[0] || {
        id: 'u-1',
        name: 'Airton Maia (CEO)',
        email: 'airtonmaiamt@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: 'owner',
        workspaceId: 'ws-1'
      },
      label: 'Diretoria / CEO',
      desc: 'Acesso total, gestão financeira e aprovações'
    },
    {
      user: users[1] || {
        id: 'u-2',
        name: 'Lucas Brandão',
        email: 'lucas@vanguardasocial.com.br',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        role: 'designer',
        workspaceId: 'ws-1'
      },
      label: 'Designer Senior',
      desc: 'Quadro Kanban, criação visual e upload de artes'
    },
    {
      user: users[2] || {
        id: 'u-3',
        name: 'Beatriz Vasconcelos',
        email: 'beatriz@vanguardasocial.com.br',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        role: 'copywriter',
        workspaceId: 'ws-1'
      },
      label: 'Copywriter & Redação',
      desc: 'Redação de legendas, roteiros Reels e IA'
    },
    {
      user: users[3] || {
        id: 'u-4',
        name: 'Mariana Lima',
        email: 'mariana@vanguardasocial.com.br',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
        role: 'social_media',
        workspaceId: 'ws-1'
      },
      label: 'Social Media Manager',
      desc: 'Calendário editorial, agendamento e pautas'
    },
    {
      user: {
        id: 'u-client-demo',
        name: 'Cliente MARY (Portal)',
        email: 'aprovacao@mary.com',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
        role: 'client',
        workspaceId: 'ws-1'
      },
      label: 'Portal do Cliente',
      desc: 'Visão simplificada para aprovação rápida de artes'
    }
  ];

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Por favor, informe seu e-mail corporativo.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        setSuccessMsg('Autenticado com sucesso! Entrando...');
      } else {
        setErrorMsg(res.message || 'Credenciais inválidas. Tente novamente.');
      }
    } catch {
      setErrorMsg('Ocorreu uma falha na autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (presetUser: User) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await login(presetUser.email, 'demo123', presetUser);
      setSuccessMsg(`Bem-vindo(a), ${presetUser.name}!`);
    } catch {
      setErrorMsg('Falha ao alternar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMsg('Preencha todos os campos obrigatórios para cadastrar.');
      return;
    }

    setIsLoading(true);
    const newUser: User = {
      id: `u-${Date.now()}`,
      name: regName.trim(),
      email: regEmail.trim(),
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
      role: regRole,
      workspaceId: currentWorkspace?.id || 'ws-1'
    };

    try {
      await login(newUser.email, regPassword, newUser);
      setSuccessMsg('Conta de agência criada e autenticada com sucesso!');
    } catch {
      setErrorMsg('Erro ao registrar nova conta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full h-screen bg-white text-slate-900 grid grid-cols-1 lg:grid-cols-12 font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
      
      {/* Left Side: Full Screen Hero Banner with Antelope Canyon Image */}
      <div className="lg:col-span-5 hidden lg:flex relative bg-slate-900 h-full flex-col justify-between p-10 lg:p-14 text-white overflow-hidden shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80" 
          alt="Propofy Organic Sand Texture" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90 transition duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Top Brand Tag inside Banner */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/95 p-1.5 backdrop-blur shadow-lg flex items-center justify-center">
            <img src={propofyStandardLogo} alt="Propofy" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
          <div>
            <span className="text-sm font-black tracking-wider text-white uppercase block">
              Propofy
            </span>
            <span className="text-[10px] font-mono font-bold tracking-widest text-orange-300 uppercase block">
              Agency Operating System
            </span>
          </div>
        </div>

        {/* Bottom Caption inside Banner */}
        <div className="relative z-10 space-y-3 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold text-white shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-300" />
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
      <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-12 lg:p-16 flex flex-col justify-between space-y-6 max-w-2xl mx-auto w-full">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 p-1.5 flex items-center justify-center shadow-sm shrink-0">
              <img src={propofyStandardLogo} alt="Propofy Logo" className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Propofy
              </h1>
              <span className="text-[11px] font-mono text-orange-600 font-bold uppercase tracking-widest block">
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
              Bem-vindo ao Propofy
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Propofy é a forma mais rápida, simples e segura de gerenciar pautas, aprovações e produção de conteúdo da sua agência.
            </p>
          </div>

          {/* Social Sign-In Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleQuickLogin(presetProfiles[0].user)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continuar com Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin(presetProfiles[1].user)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              <span>Continuar com Microsoft</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="absolute bg-white px-3 text-[11px] text-slate-400 font-mono">ou</span>
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
              onClick={() => { setActiveMode('quick_team'); setErrorMsg(null); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeMode === 'quick_team' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Acesso da Equipe</span>
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
                  onClick={() => setActiveMode('quick_team')}
                  className="text-orange-600 hover:underline font-semibold"
                >
                  Usar perfil da equipe
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

          {/* TAB 2: Quick Team Access */}
          {activeMode === 'quick_team' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {presetProfiles.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickLogin(item.user)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={item.user.avatar} 
                        alt="" 
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" 
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{item.user.name}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold">
                            {item.user.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
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
                  placeholder="Ex: Agência Propofy Creative"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="contato@propofy.com.br"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Cargo no Sistema</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-orange-500 transition"
                >
                  <option value="owner">Diretor / Owner (Acesso Total)</option>
                  <option value="social_media">Social Media Manager</option>
                  <option value="designer">Designer Visual</option>
                  <option value="copywriter">Copywriter / Redator</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-1"
              >
                {isLoading ? 'Criando Conta...' : 'Criar Conta Propofy'}
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
  );
};
