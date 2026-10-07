import React, { useEffect, useRef, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import {
  LogOut, ShieldCheck, Building2, Mail, RefreshCw, CloudOff, Cloud,
  Upload, KeyRound, Check, AlertTriangle, Eye, EyeOff, Link2, User as UserIcon,
  Trash2,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { RecorteQuadrado } from '../ui/recorte-quadrado';
import { arquivosApi } from '../../lib/api';
import {
  salvarPerfil,
  alterarSenha,
  pedirTrocaDeEmail,
  temSenhaDeAcesso,
  pedirLinkParaCriarSenha,
} from '../../lib/perfil';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
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
 * Painel da conta.
 *
 * Antes esta modal permitia trocar o próprio papel ("Acesso Total",
 * "Cliente") com um clique e anunciava login bem-sucedido sem autenticar
 * nada. Trocar o próprio papel no cliente é escalonamento de privilégio,
 * então a função saiu: o papel vem da sessão do servidor, e aqui ele é só
 * exibido.
 *
 * O que sobrou era um cartão de leitura — nome, e-mail, papel, agência — sem
 * nenhuma forma de mudar o nome que os colegas veem, a foto ou a senha. Quem
 * quisesse trocar a senha só tinha o "esqueci minha senha" da tela de
 * entrada, que exige sair da conta para usar.
 *
 * O papel e a agência continuam em leitura, e é a única parte desta tela que
 * não tem botão: quem muda isso é quem administra a agência.
 *
 * ---
 *
 * **O que esta tela é hoje, e por que mudou de forma.**
 *
 * Ela era cinco blocos empilhados numa coluna só, cada um com o seu botão de
 * largura inteira — cinco botões iguais, um embaixo do outro, nenhum deles
 * óbvio. E o primeiro campo, logo abaixo do título, era o **endereço da
 * foto**: um `https://pub-231a2...` ocupando a linha mais nobre de "Sua
 * conta". Ninguém abre o próprio perfil para digitar uma URL; abre para
 * trocar a foto, o nome ou a senha.
 *
 * Três decisões, e nenhuma é enfeite:
 *
 * - **A identidade sobe para o cabeçalho.** Foto, nome, e-mail, papel e
 *   agência respondem "de quem é esta conta" antes de qualquer campo — e isso
 *   apagou um bloco inteiro lá embaixo, que repetia papel e agência em dois
 *   cartões.
 * - **Perfil e Acesso viram abas.** São duas perguntas diferentes (*como eu
 *   apareço* / *como eu entro*), cada uma com **um** botão. Em lista única, o
 *   "Salvar perfil" disputava a vista com "Alterar senha" e "Enviar link de
 *   troca", que fazem coisas sem relação entre si.
 * - **Sair da conta e o estado da sincronização ficam no rodapé fixo.** São as
 *   duas coisas que valem em qualquer aba, e sair da conta estava no fim de
 *   uma rolagem — atrás justamente dos campos que alguém talvez tivesse
 *   começado a preencher.
 *
 * O endereço da foto **não sumiu**: ele continua atrás de "Colar endereço", e
 * aparece sozinho quando o envio falha. Sem balde configurado é por ele que
 * se põe uma foto (armadilha 5), e esconder a saída de emergência seria
 * trocar um ruído por um beco.
 */

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none';

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-800 first:pt-0 first:border-t-0">
    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h4>
    {children}
  </section>
);

/** Papel e agência: leitura, e por isso chip — não campo nem cartão. */
const Selo: React.FC<{ icone: React.ElementType; children: React.ReactNode }> = ({
  icone: Icone,
  children,
}) => (
  <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
    <Icone className="w-3 h-3 shrink-0" />
    <span className="truncate">{children}</span>
  </span>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser, currentWorkspace, logout, syncState, syncError, forceSync,
    recarregarSessaoPublica,
  } = usePostfy();

  const [aba, setAba] = useState<'perfil' | 'acesso'>('perfil');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [nome, setNome] = useState('');
  const [avatar, setAvatar] = useState('');
  const [colarEndereco, setColarEndereco] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  const [novoEmail, setNovoEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [verSenha, setVerSenha] = useState(false);

  /**
   * Esta conta tem senha?
   *
   * `null` enquanto a resposta não chega, e a seção não pinta campo nenhum
   * nesse meio-tempo: mostrar "senha atual" e trocá-lo meio segundo depois
   * faria o formulário se reorganizar embaixo de quem já começou a digitar.
   *
   * Quem entrou pelo Google não tem senha, e a seção pedia a atual para
   * confirmar quem está ali — uma pergunta sem resposta possível: qualquer
   * coisa digitada volta como "a senha atual não confere", e a pessoa conclui
   * que esqueceu uma senha que nunca criou.
   */
  const [temSenha, setTemSenha] = useState<boolean | null>(null);
  const [linkEnviadoPara, setLinkEnviadoPara] = useState<string | null>(null);

  // Reabrir a modal tem que trazer o que está gravado, e não o rascunho que
  // ficou de uma edição abandonada.
  useEffect(() => {
    if (!isOpen) return;
    setAba('perfil');
    setNome(currentUser?.name || '');
    setAvatar(currentUser?.avatar || '');
    setColarEndereco(false);
    setNovoEmail('');
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmacao('');
    setMensagem(null);
    setErro(null);
    setLinkEnviadoPara(null);
  }, [isOpen, currentUser?.name, currentUser?.avatar]);

  // A pergunta vai ao servidor a cada abertura: ligar o Google (ou criar a
  // senha pelo link) muda a resposta sem esta aba saber.
  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    void temSenhaDeAcesso().then((tem) => {
      if (!cancelado) setTemSenha(tem);
    });
    return () => {
      cancelado = true;
    };
  }, [isOpen]);


  const avisar = (texto: string) => {
    setErro(null);
    setMensagem(texto);
    setTimeout(() => setMensagem(null), 5000);
  };

  const executar = async (acao: () => Promise<string>) => {
    setOcupado(true);
    setErro(null);
    setMensagem(null);
    try {
      avisar(await acao());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  /**
   * A foto escolhida, esperando o enquadramento.
   *
   * Este caminho **não passa pelo `FileUpload`** — ele chama `arquivosApi`
   * direto —, então o recorte é montado aqui à mão. O avatar é desenhado num
   * círculo por `Avatar`, e sem recorte o navegador corta o centro: numa foto
   * de perfil o rosto quase nunca está no centro geométrico.
   */
  const [fotoARecortar, setFotoARecortar] = useState<File | null>(null);

  const enviarFoto = async (arquivo: File) => {
    if (!currentWorkspace?.id) {
      // A saída fica à vista no mesmo instante em que o caminho normal
      // falha: dizer "cole o endereço" com o campo escondido manda procurar
      // um controle que a tela não mostra.
      setColarEndereco(true);
      setErro('Sem agência aberta não dá para enviar arquivo. Cole o endereço da imagem.');
      return;
    }
    setErro(null);
    setEnviando(true);
    setProgresso(0);
    try {
      setAvatar(await arquivosApi.enviar(arquivo, currentWorkspace.id, setProgresso));
    } catch (e) {
      setColarEndereco(true);
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  };

  const perfilMudou =
    nome.trim() !== (currentUser?.name || '') || avatar.trim() !== (currentUser?.avatar || '');

  // A conferência da confirmação é de quem grava (`alterarSenha`); aqui ela
  // só adianta a resposta, para o erro não chegar depois de uma ida ao
  // servidor que já conferiu a senha atual.
  const confirmacaoDivergente = Boolean(confirmacao) && confirmacao !== novaSenha;

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => !aberto && onClose()}>
      {/* O fechar é o do primitivo: uma posição só em todas as modais. */}
      <DialogContent tamanho="formulario" className="p-0 gap-0">
        {/*
          **A identidade é o cabeçalho.** Ela respondia lá embaixo, em dois
          cartões de "Sessão" que repetiam o que a barra lateral já mostra; no
          topo, ela diz de quem é a conta antes do primeiro campo — e o bloco
          de baixo deixou de existir.
        */}
        <div className="shrink-0 flex items-start gap-3 p-5 pr-12 border-b border-slate-200 dark:border-slate-800">
          <Avatar nome={nome || currentUser?.name || '?'} url={avatar} tamanho={44} />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Sua conta
            </span>
            <DialogTitle asChild>
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {currentUser?.name || 'Sua conta'}
              </h3>
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {currentUser?.email || '—'}
            </p>
            {/* Leitura, e sem botão: quem muda papel é quem administra a
                agência, e mudar o próprio seria escalonamento de privilégio.
                O banco recusa de qualquer forma — o trigger `membro_editado`
                barra alteração de papel na própria linha. */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Selo icone={ShieldCheck}>
                {ROTULO_PAPEL[currentUser?.role] || currentUser?.role || '—'}
              </Selo>
              <Selo icone={Building2}>{currentWorkspace?.name || '—'}</Selo>
            </div>
          </div>
        </div>

        <Tabs
          value={aba}
          onValueChange={(v) => setAba(v as typeof aba)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* `min-w-0` é o que faz a faixa rolar: o `min-width:auto` padrão de
              um filho de flex impede que ela encolha abaixo do conteúdo. */}
          <div className="shrink-0 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <TabsList
              aparencia="painel"
              className="min-w-0 border-b-0 px-0 rounded-none bg-transparent dark:bg-transparent"
            >
              <TabsTrigger value="perfil">
                <UserIcon className="w-3.5 h-3.5" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="acesso">
                <KeyRound className="w-3.5 h-3.5" />
                Acesso
              </TabsTrigger>
            </TabsList>
          </div>

          {/*
            O aviso fica **fora** da área que rola, e isso não é detalhe: o
            botão que o produz pode estar no fim de um formulário, e uma faixa
            verde no topo de uma rolagem é uma resposta que ninguém lê.
          */}
          {(erro || mensagem) && (
            <div className="shrink-0 px-5 pt-4">
              {erro && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{erro}</span>
                </div>
              )}
              {mensagem && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{mensagem}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <TabsContent value="perfil" className="mt-0 space-y-4">
              <div className="flex items-start gap-4">
                <Avatar nome={nome || currentUser?.name || '?'} url={avatar} tamanho={72} />

                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    ref={entradaDeArquivo}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      // SVG entra inteiro: recortá-lo exigiria rasterizar.
                      if (arquivo) {
                        if (arquivo.type === 'image/svg+xml') void enviarFoto(arquivo);
                        else setFotoARecortar(arquivo);
                      }
                      e.target.value = '';
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary"
                      type="button"
                      disabled={enviando}
                      onClick={() => entradaDeArquivo.current?.click()}
                      className="disabled:cursor-wait"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {enviando ? `Enviando ${progresso}%` : 'Alterar foto'}
                    </Button>
                    {avatar && (
                      <Button variant="ghost"
                        type="button"
                        onClick={() => setAvatar('')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    PNG ou JPG. Você escolhe o enquadramento antes de enviar.
                  </p>
                  {/* O endereço continua alcançável — é por ele que se põe
                      uma foto quando o balde não está configurado —, só não
                      ocupa mais a primeira linha da tela. */}
                  {!colarEndereco && (
                    <Button variant="ghost"
                      type="button"
                      onClick={() => setColarEndereco(true)}
                      className="-ml-2"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Colar endereço
                    </Button>
                  )}
                </div>
              </div>

              {colarEndereco && (
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://..."
                    className={`${CAMPO} pl-9`}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3 h-3" /> Nome
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className={CAMPO}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  É este nome que seus colegas veem na equipe, no kanban e nas aprovações.
                </p>
              </div>

              <Button
                type="button"
                disabled={ocupado || enviando || !perfilMudou}
                onClick={() =>
                  executar(async () => {
                    const { vinculos } = await salvarPerfil({ nome, avatar });
                    await recarregarSessaoPublica();
                    return vinculos === 1
                      ? 'Perfil salvo.'
                      : `Perfil salvo — atualizado em ${vinculos} agências.`;
                  })
                }
                className="w-full"
              >
                {ocupado ? 'Salvando...' : 'Salvar perfil'}
              </Button>
            </TabsContent>

            <TabsContent value="acesso" className="mt-0 space-y-5">
              <Secao titulo="Senha">
                {/* Enquanto a resposta não chega, nada de campo: ver "senha atual"
                    e ele ser trocado meio segundo depois reorganiza o formulário
                    embaixo de quem já começou a digitar. */}
                {temSenha === null && (
                  <p className="text-[11px] text-slate-400">Verificando como esta conta entra...</p>
                )}

                {/*
                  Conta criada pelo Google: não há senha para conferir, e por isso
                  a criação passa pelo e-mail.

                  `updateUser({ password })` aceitaria a senha nova aqui mesmo, sem
                  conferência — e essa é justamente a porta que a exigência da
                  senha atual fecha. Quem senta numa aba esquecida aberta criaria
                  uma senha e passaria a entrar **depois de a sessão morrer**; hoje,
                  sem senha nenhuma, fechar a aba é o fim do acesso dele. O link
                  repõe a prova que a senha atual daria: a caixa de entrada.
                */}
                {temSenha === false && (
                  <>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Esta conta entra pelo Google e ainda não tem senha. Mandamos um link
                      para o seu e-mail — é por ele que a senha é criada, porque não há uma
                      atual para confirmar que é você.
                    </p>

                    <Button
                      variant="outline"
                      type="button"
                      disabled={ocupado || Boolean(linkEnviadoPara)}
                      onClick={() =>
                        executar(async () => {
                          const destino = await pedirLinkParaCriarSenha();
                          setLinkEnviadoPara(destino);
                          return `Link enviado para ${destino}. Abra-o para criar a senha.`;
                        })
                      }
                      className="w-full text-slate-700 dark:text-slate-200"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {linkEnviadoPara ? 'Link enviado' : 'Criar senha de acesso'}
                    </Button>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Criar uma senha não desliga o acesso pelo Google — os dois passam a
                      funcionar.
                    </p>
                  </>
                )}

                {temSenha === true && (
                  <>
                    <div className="relative">
                      <input
                        type={verSenha ? 'text' : 'password'}
                        value={senhaAtual}
                        onChange={(e) => setSenhaAtual(e.target.value)}
                        placeholder="Senha atual"
                        autoComplete="current-password"
                        className={`${CAMPO} pr-9`}
                      />
                      <Button variant="ghost" size="icon-sm"
                        type="button"
                        onClick={() => setVerSenha((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {verSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    </div>

                    <input
                      type={verSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Nova senha (mínimo 8 caracteres)"
                      autoComplete="new-password"
                      className={CAMPO}
                    />

                    {/*
                      **A segunda digitação não é zelo.** Com um campo só, o
                      erro de digitação é gravado em silêncio: o Supabase
                      aceita, a tela diz "senha alterada", e a conta aparece
                      trancada no próximo login — quando já não há como saber
                      o que foi digitado.
                    */}
                    <input
                      type={verSenha ? 'text' : 'password'}
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      placeholder="Confirmar nova senha"
                      autoComplete="new-password"
                      className={`${CAMPO} ${
                        confirmacaoDivergente
                          ? 'border-rose-300 dark:border-rose-800 focus:border-rose-500 focus:ring-rose-500/20'
                          : ''
                      }`}
                    />

                    {confirmacaoDivergente && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">
                        As duas senhas novas estão diferentes.
                      </p>
                    )}

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      A senha atual é pedida de propósito: sem ela, quem sentasse numa aba
                      esquecida aberta trocaria a senha e tomaria a conta.
                    </p>

                    <Button variant="outline"
                      type="button"
                      disabled={
                        ocupado || !senhaAtual || !novaSenha || !confirmacao || confirmacaoDivergente
                      }
                      onClick={() =>
                        executar(async () => {
                          await alterarSenha(senhaAtual, novaSenha, confirmacao);
                          setSenhaAtual('');
                          setNovaSenha('');
                          setConfirmacao('');
                          return 'Senha alterada. A sessão continua aberta.';
                        })
                      }
                      className="w-full text-slate-700 dark:text-slate-200"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Alterar senha
                    </Button>
                  </>
                )}
              </Secao>

              <Secao titulo="E-mail">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-mail de entrada
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {currentUser?.email || '—'}
                  </p>
                </div>

                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder="Novo e-mail"
                  className={CAMPO}
                />

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  A troca só vale depois que você abrir o link de confirmação. Até lá, continue
                  entrando com o e-mail de cima.
                </p>

                <Button variant="outline"
                  type="button"
                  disabled={ocupado || !novoEmail}
                  onClick={() =>
                    executar(async () => {
                      const alvo = await pedirTrocaDeEmail(novoEmail);
                      setNovoEmail('');
                      return `Link de confirmação enviado para ${alvo}. O e-mail muda quando você abrir o link.`;
                    })
                  }
                  className="w-full text-slate-700 dark:text-slate-200"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Enviar link de troca
                </Button>
              </Secao>
            </TabsContent>
          </div>
        </Tabs>

        {/*
          **O rodapé vale nas duas abas, e por isso ele é irmão delas.** Sair
          da conta estava no fim da rolagem, atrás dos campos — e o estado da
          sincronização, que é a resposta de "o que eu fiz chegou ao
          servidor?", estava junto, escondido pelo mesmo motivo.
        */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 flex items-center gap-3">
          <span
            className={`flex-1 min-w-0 flex items-center gap-1.5 text-[11px] leading-tight ${
              syncState === 'error'
                ? 'text-rose-600 dark:text-rose-400'
                : syncState === 'idle'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {syncState === 'error' ? (
              <CloudOff className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Cloud className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {syncState === 'error'
                ? syncError || 'Falha de sincronização.'
                : syncState === 'saving'
                ? 'Salvando no servidor...'
                : syncState === 'loading'
                ? 'Carregando dados do servidor...'
                : 'Dados sincronizados.'}
            </span>
          </span>

          <Button variant="ghost" size="icon-sm"
            onClick={() =>
              executar(async () => {
                const res = await forceSync();
                return res.message;
              })
            }
            disabled={ocupado}
            aria-label="Sincronizar agora"
            title="Sincronizar agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ocupado ? 'animate-spin' : ''}`} />
          </Button>

          <Button variant="destructive"
            onClick={async () => {
              setOcupado(true);
              await logout();
              setOcupado(false);
              onClose();
            }}
            disabled={ocupado}
            className="bg-rose-600 text-white shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </Button>
        </div>
      </DialogContent>

      {/*
        Sem esta linha o `setFotoARecortar` guarda a foto e **nada acontece**:
        escolher o arquivo deixa de fazer efeito, sem erro e sem pista — a
        mesma família do `useConfirmacao()` sem o `{dialogo}` na árvore.
      */}
      {fotoARecortar && (
        <RecorteQuadrado
          arquivo={fotoARecortar}
          aoCancelar={() => setFotoARecortar(null)}
          aoConfirmar={(recortada) => {
            setFotoARecortar(null);
            void enviarFoto(recortada);
          }}
        />
      )}
    </Dialog>
  );
};
