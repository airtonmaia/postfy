import React, { useState } from 'react';
import { portalApi } from '../../lib/api';
import { ShieldCheck, X, FileText, Eye, EyeOff } from 'lucide-react';
import { Workspace } from '../../types';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

interface ClientPortalLoginProps {
  workspace: Workspace;
  /** Recebe o token do portal, já provado pela senha ou pelo código. */
  onLoginSuccess: (token: string) => void;
  prefilledEmail?: string;
}

/**
 * Entrada do portal: e-mail e senha, com o código por e-mail atrás.
 *
 * O telefone identificava e não autenticava — quem soubesse o número entrava
 * na conta alheia, e número de WhatsApp de empresa costuma estar no rodapé do
 * próprio site do cliente. O código de seis dígitos resolveu isso e trouxe
 * outro custo: **ele depende de o e-mail sair da fila, chegar, não cair em
 * spam e a pessoa achar.** Quem está deste lado quer aprovar um post, e cada
 * minuto de espera é uma aprovação que não acontece hoje.
 *
 * Então a senha vem primeiro, e o código fica **atrás de um link**, não
 * apagado: é por ele que entra quem nunca recebeu senha, quem esqueceu a que
 * recebeu e quem o banco bloqueou por tentativas. Tirá-lo deixaria o acesso
 * do cliente dependendo de a agência lembrar de gerar a senha — sem ninguém a
 * quem recorrer no domingo à noite, que é quando a aprovação acontece.
 *
 * A tela nunca conta se o e-mail existe na base: o passo do código aparece do
 * mesmo jeito nos dois casos, e o erro da senha é o mesmo para e-mail
 * desconhecido, senha errada e acesso bloqueado. Contar a diferença
 * transformaria o portal num verificador de "fulano é cliente de alguma
 * agência daqui?".
 */
/**
 * Arte do painel direito, quando Admin → Design não definiu nenhuma.
 *
 * Fica em `public/`, e não importada pelo bundler, de propósito: é conteúdo
 * de marca que muda sem envolver deploy de código — trocar o arquivo basta.
 * O caminho é absoluto porque o portal também abre em `/portal-do-cliente`,
 * e um caminho relativo procuraria a imagem dentro dessa pasta.
 */
const IMAGEM_PADRAO_DO_PORTAL = '/portal-hero.jpg';

export const ClientPortalLogin: React.FC<ClientPortalLoginProps> = ({
  workspace,
  onLoginSuccess,
  prefilledEmail = ''
}) => {
  // A marca da tela é da agência — o portal é whitelabel. O que vem daqui é
  // do produto: a arte de fundo e a frase, iguais para todas as agências.
  const { aparencia } = usePostfy();

  const [passo, setPasso] = useState<'senha' | 'codigo'>('senha');
  const [email, setEmail] = useState(prefilledEmail);
  const [senha, setSenha] = useState('');
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const entrarComSenha = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const alvo = email.trim().toLowerCase();
    if (!alvo || !alvo.includes('@')) {
      setErrorMsg('Informe o e-mail cadastrado na agência.');
      return;
    }
    if (!senha) {
      setErrorMsg('Informe a senha que a agência enviou.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { token } = await portalApi.entrarComSenha(alvo, senha);
      onLoginSuccess(token);
    } catch (erro) {
      setErrorMsg(erro instanceof Error ? erro.message : 'E-mail ou senha incorretos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pedirCodigo = async () => {
    setErrorMsg(null);

    const alvo = email.trim().toLowerCase();
    if (!alvo || !alvo.includes('@')) {
      setErrorMsg('Informe o e-mail para receber o código.');
      return;
    }

    setIsSubmitting(true);
    try {
      await portalApi.enviarCodigo(alvo);
      setPasso('codigo');
    } catch (erro) {
      setErrorMsg(erro instanceof Error ? erro.message : 'Não foi possível enviar o código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const conferirCodigo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const digitos = codigo.replace(/\D/g, '');
    if (digitos.length !== 6) {
      setErrorMsg('O código tem 6 dígitos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { token } = await portalApi.conferirCodigo(email.trim().toLowerCase(), digitos);
      onLoginSuccess(token);
    } catch (erro) {
      setErrorMsg(erro instanceof Error ? erro.message : 'Código inválido ou expirado.');
    } finally {
      setIsSubmitting(false);
    }
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

            {passo === 'senha' ? (
              <form onSubmit={entrarComSenha} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    // O gerenciador de senhas do navegador só reconhece o par
                    // com estes dois nomes. Sem eles, quem já entrou uma vez
                    // digita tudo de novo — e a senha é gerada, não escolhida:
                    // ninguém a decora.
                    autoComplete="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="voce@suaempresa.com.br"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={senhaAberta ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      name="current-password"
                      value={senha}
                      onChange={(e) => {
                        setSenha(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="A senha que a agência enviou"
                      className="w-full h-10 pl-3 pr-10 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden transition"
                    />
                    {/* A senha é gerada pela agência e digitada por quem não a
                        escolheu: sem poder conferir o que digitou, o erro de
                        digitação vira "o portal não aceita minha senha". */}
                    <Button variant="ghost" size="icon-sm"
                      type="button"
                      onClick={() => setSenhaAberta((v) => !v)}
                      aria-label={senhaAberta ? 'Ocultar a senha' : 'Mostrar a senha'}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                    >
                      {senhaAberta ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-10">
                    {isSubmitting ? 'Entrando...' : 'Entrar'}
                  </Button>

                  {/*
                    O código continua sendo a porta de saída, e por isso ele
                    está aqui e não numa tela escondida: é por ele que entra
                    quem nunca recebeu senha, quem esqueceu a que recebeu e
                    quem o banco bloqueou por tentativas.
                  */}
                  <Button variant="ghost"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void pedirCodigo()}
                    className="w-full h-9"
                  >
                    Não tenho senha — receber código por e-mail
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={conferirCodigo} className="space-y-4">
                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-sky-900 dark:text-sky-200 text-xs">
                  Se <strong>{email.trim().toLowerCase()}</strong> estiver cadastrado na agência,
                  o código chegou na caixa de entrada. Ele vale por 10 minutos.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Código
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => {
                      setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setErrorMsg(null);
                    }}
                    placeholder="000000"
                    className="w-full h-12 px-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-lg font-bold tracking-[0.5em] text-center text-slate-900 dark:text-white placeholder-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden transition font-mono"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10"
                  >
                    {isSubmitting ? 'Validando...' : 'Entrar'}
                  </Button>

                  <Button variant="ghost"
                    type="button"
                    onClick={() => {
                      setPasso('senha');
                      setCodigo('');
                      setErrorMsg(null);
                    }}
                    className="w-full h-9"
                  >
                    Voltar e entrar com a senha
                  </Button>
                </div>
              </form>
            )}

            {/* Bottom Links (Matching reference) */}
            <div className="pt-8 text-center text-[11px] text-slate-400 space-x-3">
              <Button variant="ghost"
                type="button"
                onClick={() => setShowPrivacyModal(true)}
              >
                Políticas de Privacidade
              </Button>
              <span>|</span>
              <Button variant="ghost"
                type="button"
                onClick={() => setShowTermsModal(true)}
              >
                Termos de Uso
              </Button>
            </div>

          </div>
        </div>

        {/* Bottom copyright */}
        <div className="text-center lg:text-left text-[11px] text-slate-400">
          © {new Date().getFullYear()} {workspace.name} &bull; Portal Seguro
        </div>
      </div>

      {/* Coluna direita: a foto ocupa o painel inteiro.

          Antes havia aqui um monitor desenhado em CSS, com balões de conversa
          flutuando em volta. A foto já traz a conversa composta dentro dela —
          manter os balões repetiria o mesmo assunto duas vezes na mesma tela.

          Só aparece a partir de `lg`: numa tela estreita ela empurraria o
          formulário para baixo da dobra, e quem abre este endereço veio
          entrar, não ver a imagem. */}
      <div className="hidden lg:block relative flex-1 overflow-hidden border-l border-slate-200/60 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
        <img
          src={aparencia.bannerPortalUrl || IMAGEM_PADRAO_DO_PORTAL}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            // Sem o arquivo, o painel fica no fundo liso. O ícone de imagem
            // quebrada ao lado da tela de entrar diria "site mal feito" para
            // quem é cliente da agência, não nosso.
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* A foto é clara embaixo, e a assinatura da agência se perderia
            dentro dela sem este escurecimento. */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />

        <div className="absolute bottom-8 left-10 right-10 space-y-1">
          <p className="text-sm font-semibold text-white/95 drop-shadow-sm">
            {aparencia.tituloPortal || 'Aprove o conteúdo da sua agência sem trocar uma mensagem sequer.'}
          </p>
          {aparencia.subtituloPortal && (
            <p className="text-xs text-white/80 drop-shadow-sm leading-relaxed">
              {aparencia.subtituloPortal}
            </p>
          )}
        </div>
      </div>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent tamanho="formulario" className="p-6 gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <DialogTitle asChild>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Políticas de Privacidade & Segurança de Dados (LGPD)
              </h3>
              </DialogTitle>
              <Button variant="ghost" size="icon-sm" 
                onClick={() => setShowPrivacyModal(false)}
                className="dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed max-h-60 overflow-y-auto">
              <p>
                O <strong>Portal do Cliente</strong> assegura o mais alto padrão de proteção e sigilo em relação aos criativos, dados cadastrais, notas fiscais e credenciais da sua marca.
              </p>
              <p>
                1. <strong>Isolamento de Dados</strong>: Suas postagens, briefings e senhas são criptografados e acessíveis exclusivamente por você e pelos membros autorizados da agência.
              </p>
              {/*
                Esta frase dizia "o login via WhatsApp garante a validação
                direta do contato responsável" — e o login por WhatsApp não
                existe desde que o telefone saiu de cena, duas trocas de
                método atrás. Texto de segurança que descreve um mecanismo
                que não existe é pior que texto nenhum: ele é lido como
                promessa por quem está decidindo se confia no portal.
              */}
              <p>
                2. <strong>Autenticação</strong>: o acesso é por e-mail e senha, ou por um
                código de seis dígitos enviado para o seu e-mail. A senha é guardada em
                formato irreversível (bcrypt) — nem a agência nem o Orquesia conseguem lê-la
                de volta.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setShowPrivacyModal(false)}
              >
                Entendi e Concordo
              </Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Terms of Use Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent tamanho="formulario" className="p-6 gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <DialogTitle asChild>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Termos de Uso do Portal de Conteúdo
              </h3>
              </DialogTitle>
              <Button variant="ghost" size="icon-sm" 
                onClick={() => setShowTermsModal(false)}
                className="dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
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
              <Button
                onClick={() => setShowTermsModal(false)}
              >
                Fechar
              </Button>
            </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};
