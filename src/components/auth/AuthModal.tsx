import React, { useEffect, useRef, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import {
  X, LogOut, ShieldCheck, Building2, Mail, RefreshCw, CloudOff, Cloud,
  Upload, KeyRound, Check, AlertTriangle, Eye, EyeOff, Link2, User as UserIcon,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { arquivosApi } from '../../lib/api';
import { salvarPerfil, alterarSenha, pedirTrocaDeEmail } from '../../lib/perfil';
import { Button } from '../ui/button';

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
 */

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none';

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800 first:pt-0 first:border-t-0">
    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h4>
    {children}
  </section>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser, currentWorkspace, logout, syncState, syncError, forceSync,
    recarregarSessaoPublica,
  } = usePostfy();

  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [nome, setNome] = useState('');
  const [avatar, setAvatar] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  const [novoEmail, setNovoEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);

  // Reabrir a modal tem que trazer o que está gravado, e não o rascunho que
  // ficou de uma edição abandonada.
  useEffect(() => {
    if (!isOpen) return;
    setNome(currentUser?.name || '');
    setAvatar(currentUser?.avatar || '');
    setNovoEmail('');
    setSenhaAtual('');
    setNovaSenha('');
    setMensagem(null);
    setErro(null);
  }, [isOpen, currentUser?.name, currentUser?.avatar]);

  if (!isOpen) return null;

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

  const enviarFoto = async (arquivo: File) => {
    if (!currentWorkspace?.id) {
      setErro('Sem agência aberta não dá para enviar arquivo. Cole o endereço da imagem.');
      return;
    }
    setErro(null);
    setEnviando(true);
    setProgresso(0);
    try {
      setAvatar(await arquivosApi.enviar(arquivo, currentWorkspace.id, setProgresso));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  };

  const perfilMudou =
    nome.trim() !== (currentUser?.name || '') || avatar.trim() !== (currentUser?.avatar || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Sua conta</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sessão autenticada no servidor
            </p>
          </div>
          <Button variant="ghost" size="icon-sm"
            onClick={onClose}
            className="dark:hover:text-white"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
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

          <Secao titulo="Perfil">
            <div className="flex items-start gap-3">
              <Avatar nome={nome || currentUser?.name || '?'} url={avatar} tamanho={56} />

              <div className="flex-1 min-w-0 space-y-2">
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://... ou envie um arquivo"
                    className={`${CAMPO} pl-9`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={entradaDeArquivo}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      if (arquivo) void enviarFoto(arquivo);
                      e.target.value = '';
                    }}
                  />
                  <Button variant="secondary" size="sm"
                    type="button"
                    disabled={enviando}
                    onClick={() => entradaDeArquivo.current?.click()}
                    className="disabled:cursor-wait"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {enviando ? `Enviando ${progresso}%` : 'Enviar foto'}
                  </Button>
                  {avatar && (
                    <Button variant="destructive" size="sm"
                      type="button"
                      onClick={() => setAvatar('')}
                      className="text-slate-500"
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

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

            <Button size="lg"
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
          </Secao>

          <Secao titulo="Senha">
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

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              A senha atual é pedida de propósito: sem ela, quem sentasse numa aba
              esquecida aberta trocaria a senha e tomaria a conta.
            </p>

            <Button variant="outline" size="lg"
              type="button"
              disabled={ocupado || !senhaAtual || !novaSenha}
              onClick={() =>
                executar(async () => {
                  await alterarSenha(senhaAtual, novaSenha);
                  setSenhaAtual('');
                  setNovaSenha('');
                  return 'Senha alterada. A sessão continua aberta.';
                })
              }
              className="w-full text-slate-700 dark:text-slate-200"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Alterar senha
            </Button>
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

            <Button variant="outline" size="lg"
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

          <Secao titulo="Sessão">
            {/* Leitura, e sem botão: quem muda papel é quem administra a
                agência, e mudar o próprio seria escalonamento de privilégio.
                O banco recusa de qualquer forma — o trigger `membro_editado`
                barra alteração de papel na própria linha. */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Papel
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {ROTULO_PAPEL[currentUser?.role] || currentUser?.role || '—'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Agência
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {currentWorkspace?.name || '—'}
                </p>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                syncState === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {syncState === 'error' ? (
                <CloudOff className="w-4 h-4 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 shrink-0" />
              )}
              <span className="font-medium">
                {syncState === 'error'
                  ? syncError || 'Falha de sincronização.'
                  : syncState === 'saving'
                  ? 'Salvando no servidor...'
                  : syncState === 'loading'
                  ? 'Carregando dados do servidor...'
                  : 'Dados sincronizados com o servidor.'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Button variant="outline" size="lg"
                onClick={() =>
                  executar(async () => {
                    const res = await forceSync();
                    return res.message;
                  })
                }
                disabled={ocupado}
                className="flex-1 text-slate-700 dark:text-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${ocupado ? 'animate-spin' : ''}`} />
                Sincronizar agora
              </Button>
              <Button variant="destructive" size="lg"
                onClick={async () => {
                  setOcupado(true);
                  await logout();
                  setOcupado(false);
                  onClose();
                }}
                disabled={ocupado}
                className="flex-1 bg-rose-600 text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair da conta
              </Button>
            </div>
          </Secao>
        </div>
      </div>
    </div>
  );
};
