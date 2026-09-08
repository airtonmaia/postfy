import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  Globe, 
  Layers, 
  FileCheck2, 
  Send,
  X,
  Check,
  Building2,
  FileText,
  ThumbsUp,
  Mail,
  Search,
  MessageSquare
} from 'lucide-react';
import { Client, Workspace } from '../../types';

interface ClientPortalLoginProps {
  workspace: Workspace;
  clients: Client[];
  onLoginSuccess: (client: Client) => void;
  prefilledPhone?: string;
}

const COUNTRIES = [
  { code: '+55', name: 'Brazil', flag: '🇧🇷', mask: '(##) #####-####' },
  { code: '+1', name: 'United States', flag: '🇺🇸', mask: '(###) ###-####' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹', mask: '### ### ###' },
  { code: '+34', name: 'Spain', flag: '🇪🇸', mask: '### ### ###' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', mask: '##### ######' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷', mask: '## ####-####' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽', mask: '## ####-####' },
];

export const ClientPortalLogin: React.FC<ClientPortalLoginProps> = ({
  workspace,
  clients,
  onLoginSuccess,
  prefilledPhone = ''
}) => {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState(prefilledPhone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Helper to normalize phone numbers (strip non-digit characters)
  const normalizePhone = (num: string) => num.replace(/\D/g, '');

  // Format phone input nicely as user types (Brazil format)
  const handlePhoneChange = (val: string) => {
    setErrorMsg(null);
    const digits = normalizePhone(val);
    
    if (selectedCountry.code === '+55') {
      if (digits.length <= 2) {
        setPhone(digits.length > 0 ? `(${digits}` : '');
      } else if (digits.length <= 6) {
        setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
      } else if (digits.length <= 10) {
        setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`);
      } else {
        setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`);
      }
    } else {
      setPhone(val);
    }
  };

  /**
   * Formas equivalentes do mesmo número: com e sem o DDI 55, com e sem o nono
   * dígito. Evita rejeitar um número correto só por causa da formatação.
   */
  const variacoesDoNumero = (digitos: string): string[] => {
    if (!digitos) return [];
    const saida = new Set<string>();
    const semDdi = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos;
    saida.add(semDdi);
    if (semDdi.length === 11 && semDdi[2] === '9') {
      saida.add(semDdi.slice(0, 2) + semDdi.slice(3));
    }
    if (semDdi.length === 10) {
      saida.add(semDdi.slice(0, 2) + '9' + semDdi.slice(2));
    }
    return [...saida];
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const inputDigits = normalizePhone(phone);
    if (!inputDigits || inputDigits.length < 8) {
      setErrorMsg('Por favor, informe seu número de WhatsApp com DDD.');
      setIsSubmitting(false);
      return;
    }

    // Comparação exata dos dígitos, tolerando apenas a variação do DDI e do
    // nono dígito do celular brasileiro.
    //
    // Antes o casamento era por substring nos dois sentidos
    // (a.includes(b) || b.includes(a)): digitar "999" casava com praticamente
    // qualquer cliente da base e abria o portal dele.
    const mesmoNumero = (armazenado: string): boolean => {
      const a = variacoesDoNumero(armazenado);
      const b = variacoesDoNumero(inputDigits);
      return a.some((x) => x.length >= 10 && b.includes(x));
    };

    const matchedClient = clients.find(c => {
      if (c.phone && mesmoNumero(normalizePhone(c.phone))) return true;
      return (c.contacts || []).some(contact =>
        contact.phone ? mesmoNumero(normalizePhone(contact.phone)) : false
      );
    });

    setTimeout(() => {
      setIsSubmitting(false);
      if (matchedClient) {
        onLoginSuccess(matchedClient);
      } else {
        setErrorMsg('Número não encontrado. Entre em contato com seu gestor de conta na agência para autorizar seu acesso.');
      }
    }, 450);
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-slate-950 flex flex-col lg:flex-row text-slate-800 dark:text-slate-200">
      
      {/* Left Column: Authentic Login Form (Matching Reference Image) */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 z-10">
        
        {/* Top Branding / Logo */}
        <div className="flex items-center gap-2.5">
          {workspace.logo ? (
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-0.5 shadow-xs shrink-0">
              <img src={workspace.logo} alt={workspace.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-xs shrink-0"
              style={{ backgroundColor: workspace.primaryColor || '#9333ea' }}
            >
              {(workspace.name || 'P').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
              {workspace.name || 'Postfy Portal'}
            </span>
          </div>
        </div>

        {/* Center: Clean Form Box matching reference image */}
        <div className="my-auto py-8 max-w-sm w-full mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-7 sm:p-8 shadow-sm">
            
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
              Entrar
            </h1>

            {errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Country Selector */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    País
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between gap-1 hover:border-slate-400 transition cursor-pointer"
                  >
                    <span className="truncate flex items-center gap-1">
                      <span>({selectedCountry.code}) {selectedCountry.name}</span>
                    </span>
                    <span className="text-slate-400 text-[11px] font-bold">✕</span>
                  </button>

                  {/* Country Picker Dropdown */}
                  {showCountryPicker && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 py-2 max-h-56 overflow-y-auto">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c);
                            setShowCountryPicker(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-purple-50 dark:hover:bg-purple-950/50 flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span>{c.flag}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span>
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Whatsapp Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Whatsapp
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder=""
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden transition font-mono"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-purple-600 hover:text-white active:bg-purple-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {isSubmitting ? 'Validando...' : 'Entrar'}
                </button>
              </div>
            </form>

            {/* Bottom Links (Matching reference) */}
            <div className="pt-8 text-center text-[11px] text-slate-400 space-x-3">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                Políticas de Privacidade
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                Termos de Uso
              </button>
            </div>

          </div>
        </div>

        {/* Bottom copyright */}
        <div className="text-center lg:text-left text-[11px] text-slate-400">
          © {new Date().getFullYear()} {workspace.name} &bull; Portal Seguro
        </div>
      </div>

      {/* Right Column: Full-Height Graphic Illustration (Exact visual of image.png reference) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-sky-50 via-indigo-50/50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 items-center justify-center p-8 lg:p-12 relative overflow-hidden border-l border-slate-200/60 dark:border-slate-800">
        
        {/* Background ambient elements */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-sky-200/40 dark:bg-sky-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-200/40 dark:bg-purple-900/10 rounded-full blur-3xl" />

        {/* Floating Chat Bubbles & Reactions (Like Reference Graphic) */}
        <div className="absolute top-24 right-16 bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-lg border border-slate-200/80 dark:border-slate-700 flex items-center gap-2.5 animate-bounce duration-1000">
          <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600">
            <Mail className="w-4 h-4" />
          </div>
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600">
            <ThumbsUp className="w-4 h-4" />
          </div>
        </div>

        <div className="absolute top-44 left-14 bg-sky-500 text-white rounded-2xl py-2 px-3.5 shadow-md flex items-center gap-1.5 text-xs font-bold">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Aprovação rápida via WhatsApp</span>
        </div>

        <div className="absolute bottom-32 right-20 bg-teal-500 text-white rounded-2xl py-2 px-4 shadow-lg text-xs font-extrabold flex items-center gap-1.5">
          <span>Great work!</span>
          <ThumbsUp className="w-3.5 h-3.5" />
        </div>

        {/* Main Center Stage: Illustrated Monitor */}
        <div className="relative w-full max-w-xl flex flex-col items-center">
          
          {/* Monitor Screen Frame */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border-4 border-sky-400 dark:border-sky-600 shadow-2xl p-6 sm:p-8 relative">
            
            {/* Monitor Top Dots */}
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            </div>

            {/* Interior Post Canvas */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
              
              {/* Post Author / Header */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600" />
                <div className="space-y-1">
                  <div className="w-24 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                  <div className="w-14 h-2 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
              </div>

              {/* Central Creative Area */}
              <div className="aspect-16/9 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="w-16 h-12 rounded-lg border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center text-slate-400">
                  <Layers className="w-6 h-6" />
                </div>

                {/* APPROVED Stamp / Badge (Just like the reference image) */}
                <div className="absolute right-4 bottom-4 bg-teal-500 text-white font-black text-sm px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 transform rotate-[-2deg] tracking-wide">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>APPROVED</span>
                </div>

                {/* Check Floating Circle */}
                <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
              </div>

              {/* Text Lines */}
              <div className="space-y-2 pt-1">
                <div className="w-full h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                <div className="w-4/5 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>

            </div>

            {/* Floating Left Check Icon */}
            <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            {/* 3 Steps Pipeline at Bottom (UPLOAD -> REVIEW -> PUBLISH) */}
            <div className="mt-8 grid grid-cols-3 gap-4 text-center items-center">
              
              {/* Step 1: Upload */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/30">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-200 mt-1 uppercase">
                  UPLOAD
                </span>
              </div>

              {/* Arrow + Step 2: Review */}
              <div className="flex flex-col items-center gap-1 relative">
                <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30">
                  <Search className="w-6 h-6" />
                </div>
                <span className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-200 mt-1 uppercase">
                  REVIEW
                </span>
              </div>

              {/* Arrow + Step 3: Publish */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md shadow-teal-500/30">
                  <Send className="w-6 h-6" />
                </div>
                <span className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-200 mt-1 uppercase">
                  PUBLISH
                </span>
              </div>

            </div>

          </div>

          {/* Monitor Stand Base */}
          <div className="w-16 h-8 bg-slate-300 dark:bg-slate-700 -mt-1 rounded-b-md" />
          <div className="w-40 h-3 bg-slate-400 dark:bg-slate-600 rounded-full shadow-md" />

        </div>

      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Políticas de Privacidade & Segurança de Dados (LGPD)
              </h3>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed max-h-60 overflow-y-auto">
              <p>
                O <strong>Portal do Cliente</strong> assegura o mais alto padrão de proteção e sigilo em relação aos criativos, dados cadastrais, notas fiscais e credenciais da sua marca.
              </p>
              <p>
                1. <strong>Isolamento de Dados</strong>: Suas postagens, briefings e senhas são criptografados e acessíveis exclusivamente por você e pelos membros autorizados da agência.
              </p>
              <p>
                2. <strong>Autenticação Segura</strong>: O login via WhatsApp garante a validação direta do contato responsável sem risco de vazamento de credenciais.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Entendi e Concordo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Use Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Termos de Uso do Portal de Conteúdo
              </h3>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed max-h-60 overflow-y-auto">
              <p>
                Ao aprovar publicações neste portal, você confirma a autorização para veiculação do conteúdo nos canais digitais especificados de acordo com o cronograma acordado.
              </p>
              <p>
                Solicitações de alteração enviadas pelo portal são registradas com data e hora para garantir o cumprimento rigoroso dos prazos de entrega.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
