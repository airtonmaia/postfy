import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Facebook,
  Instagram,
  Link2,
  Loader2,
  MessageCircle,
  Plug,
  Trash2,
  AtSign,
} from 'lucide-react';

import { usePostfy } from '../../context/PostfyContext';
import {
  conectarConta,
  desconectarConta,
  listarContas,
  REDES_DA_META,
  type ContaConectada,
  type RedeDaMeta,
} from '../../lib/redes';
import { ApiError } from '../../lib/api';
import { ComTooltip } from '../ui/tooltip';

/**
 * As conexões de **um cliente**.
 *
 * A aba de Publicações lista as contas da agência inteira, misturando os
 * clientes. Aqui a pergunta é outra e mais frequente: "o perfil deste cliente
 * está ligado?". Quem abre a ficha do cliente para conferir isso não quer
 * percorrer a lista de todos.
 *
 * **Só as redes da Meta, e só o Instagram conecta.** As outras três aparecem
 * porque a pergunta aparece — mas dizendo o que falta, com nome, em vez de um
 * botão que abre e falha depois do login. Botão assim é pior que botão
 * ausente: ele gasta o clique, gasta a senha digitada, e o erro não nomeia a
 * causa. Foi exatamente esse o custo de ter escolhido o fluxo errado do
 * Instagram, e ele não se repete aqui.
 */

const ICONES: Record<RedeDaMeta['id'], React.FC<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  threads: AtSign,
  whatsapp: MessageCircle,
};

/** A cor de marca de cada rede, para o ícone ser reconhecido de relance. */
const CORES: Record<RedeDaMeta['id'], string> = {
  instagram: 'text-[#E4405F]',
  facebook: 'text-[#1877F2]',
  threads: 'text-[#000000] dark:text-white',
  whatsapp: 'text-[#25D366]',
};

export const ConexoesDoPerfil: React.FC<{ clientId: string; clientName: string }> = ({
  clientId,
  clientName,
}) => {
  const { currentWorkspace } = usePostfy();

  const [contas, setContas] = useState<ContaConectada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  const recarregar = useCallback(() => {
    listarContas()
      .then((todas) => setContas(todas.filter((c) => c.clientId === clientId)))
      .catch((e) =>
        setErro(e instanceof Error ? e.message : 'Falha ao carregar as conexões.')
      )
      .finally(() => setCarregando(false));
  }, [clientId]);

  useEffect(recarregar, [recarregar]);

  // A janela do OAuth avisa quando termina. Sem isto a lista só mudaria no
  // próximo carregamento da página, e pareceria que a conexão falhou.
  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      if (evento.data?.origem !== 'orquesia-social') return;
      setConectando(false);
      if (evento.data.ok) recarregar();
    };
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [recarregar]);

  const conectar = async () => {
    setErro(null);
    setConectando(true);
    try {
      // O cliente não é escolhido aqui: ele é o dono da ficha aberta. É a
      // diferença desta tela para a da agência, e o que a torna um clique só.
      await conectarConta(currentWorkspace.id, clientId);
    } catch (e) {
      setConectando(false);
      setErro(
        e instanceof ApiError && e.code === 'SOCIAL_NOT_CONFIGURED'
          ? 'Conexão com redes sociais ainda não configurada no servidor. Veja Admin → Integrações.'
          : e instanceof Error
            ? e.message
            : 'Falha ao iniciar a conexão.'
      );
    }
  };

  const desconectar = async (id: string, nome: string) => {
    if (
      !window.confirm(
        `Desconectar @${nome}? As publicações agendadas para esta conta serão canceladas.`
      )
    ) {
      return;
    }
    try {
      await desconectarConta(id);
      setContas((atuais) => atuais.filter((c) => c.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desconectar.');
    }
  };

  const contaDaRede = (rede: RedeDaMeta) =>
    contas.find((c) => c.platform === rede.id);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
      <div>
        <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
          Conexões do perfil
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">
          Os canais ligados ao perfil de <strong>{clientName}</strong>. É a conexão
          daqui que permite ao agendador publicar sozinho na data — sem ela, o
          conteúdo é aprovado e agendado normalmente, mas quem posta é você.
        </p>
      </div>

      {erro && (
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="text-xs text-slate-400 flex items-center gap-2 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Consultando as conexões...
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {REDES_DA_META.map((rede) => {
            const Icone = ICONES[rede.id];
            const conta = contaDaRede(rede);

            return (
              <div
                key={rede.id}
                className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0 ${CORES[rede.id]}`}>
                    <Icone className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {rede.rotulo}
                      </span>

                      {conta ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="w-3 h-3" />
                          Conectado
                        </span>
                      ) : (
                        !rede.disponivel && (
                          /* "Ainda não", e não "em breve": não há data, e
                             prometer prazo que ninguém assumiu é a mesma
                             mentira com outra roupa. */
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Ainda não
                          </span>
                        )
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {conta ? `@${conta.accountName}` : rede.pendencia || 'Nenhuma conta ligada a este perfil.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {conta ? (
                    <ComTooltip texto="Desconectar esta conta">
                      <button
                        type="button"
                        onClick={() => desconectar(conta.id, conta.accountName)}
                        aria-label="Desconectar"
                        className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </ComTooltip>
                  ) : rede.disponivel ? (
                    <button
                      type="button"
                      onClick={conectar}
                      disabled={conectando}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {conectando ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      {conectando ? 'Autorizando...' : 'Conectar'}
                    </button>
                  ) : (
                    /* Sem botão desligado: um botão que não faz nada ainda é
                       clicado, e a pessoa passa a desconfiar dos que
                       funcionam. O que falta já está escrito acima. */
                    <Plug className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
