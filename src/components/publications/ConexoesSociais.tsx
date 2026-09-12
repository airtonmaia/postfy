import React, { useEffect, useState, useCallback } from 'react';
import { Radio, Plus, Trash2, AlertCircle, CheckCircle2, Instagram } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { listarContas, conectarConta, desconectarConta, type ContaConectada } from '../../lib/redes';
import { ApiError } from '../../lib/api';
import { Button } from '../ui/button';

/**
 * Contas de rede social da agência.
 *
 * O bloco que ficava aqui era um aviso fixo dizendo que nada estava
 * conectado, com uma fileira de rótulos "não conectado" para cinco redes.
 * Agora ele mostra o que existe de fato, e conecta.
 *
 * Só Instagram por enquanto, e a tela diz isso: cada rede exige revisão de
 * app própria, e prometer LinkedIn e TikTok num rótulo seria o mesmo tipo de
 * promessa vazia que o aviso antigo fazia.
 *
 * **A conta é de um cliente, não da agência.** Uma agência atende muitos
 * clientes, cada um com o seu perfil, e quem publica precisa saber em qual
 * deles postar. A coluna `client_id` existia desde o começo sem ninguém
 * escrever: toda conexão nascia órfã, e por isso nenhum conteúdo achava onde
 * ir. Escolher o cliente aqui, antes de autorizar, é o que fecha esse elo.
 */

export const ConexoesSociais: React.FC = () => {
  const { currentWorkspace, clients } = usePostfy();

  const [contas, setContas] = useState<ContaConectada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [clienteAlvo, setClienteAlvo] = useState('');

  // Sem cliente escolhido a conexão nasceria órfã, e conexão órfã não publica
  // nada: todo conteúdo tem cliente, e é por ele que o agendador acha o
  // perfil. Oferecer "conta da agência" seria oferecer um botão que não faz
  // nada — que é como a coluna `client_id` ficou vazia até aqui.
  const semClientes = clients.length === 0;

  const recarregar = useCallback(() => {
    listarContas()
      .then(setContas)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar as contas.'))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(recarregar, [recarregar]);

  // A janela do OAuth avisa quando termina. Sem isto, a lista só atualizaria
  // no próximo carregamento da página e pareceria que a conexão falhou.
  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      if (evento.data?.origem !== 'orquesia-social') return;
      setConectando(false);
      if (evento.data.ok) recarregar();
    };
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [recarregar]);

  const nomeDoCliente = (id?: string) => clients.find((c) => c.id === id)?.name;

  const conectar = async () => {
    if (!clienteAlvo) {
      setErro('Escolha de qual cliente é esta conta antes de conectar.');
      return;
    }
    setErro(null);
    setConectando(true);
    try {
      await conectarConta(currentWorkspace.id, clienteAlvo);
    } catch (e) {
      setConectando(false);
      setErro(
        e instanceof ApiError && e.code === 'SOCIAL_NOT_CONFIGURED'
          ? 'Conexão com redes sociais ainda não configurada no servidor.'
          : e instanceof Error
          ? e.message
          : 'Falha ao iniciar a conexão.'
      );
    }
  };

  const desconectar = async (id: string, nome: string) => {
    if (!window.confirm(`Desconectar @${nome}? As publicações agendadas para ela serão canceladas.`)) {
      return;
    }
    try {
      await desconectarConta(id);
      setContas((atuais) => atuais.filter((c) => c.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desconectar.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Contas conectadas
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
              Cada conta pertence a um cliente: é assim que o agendador sabe em qual
              perfil publicar. Por enquanto só Instagram — cada rede exige uma revisão
              de app própria.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          {/* O cliente é escolhido antes de autorizar, e não depois: quem
              volta da Meta não traz sessão, então uma escolha feita no retorno
              não teria como ser conferida. */}
          <select
            value={clienteAlvo}
            onChange={(e) => setClienteAlvo(e.target.value)}
            className="text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
          >
            <option value="">De qual cliente?</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Button
            onClick={conectar}
            disabled={conectando || !clienteAlvo}
          >
            <Plus className="w-3.5 h-3.5" />
            {conectando ? 'Aguardando autorização...' : 'Conectar Instagram'}
          </Button>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 mt-4 text-xs p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {semClientes && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
          Cadastre um cliente antes de conectar: a conta do Instagram é ligada a
          um deles, e é assim que o agendador sabe onde publicar.
        </p>
      )}

      {!carregando && contas.length === 0 && !erro && !semClientes && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
          Nenhuma conta conectada. A conta precisa ser Profissional no Instagram e
          estar ligada a uma página do Facebook.
        </p>
      )}

      {contas.length > 0 && (
        <div className="space-y-2 mt-4">
          {contas.map((conta) => (
            <div
              key={conta.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  @{conta.accountName}
                </span>
                {/* De quem é a conta, à vista: publicar no perfil errado não
                    tem volta, e "conta da agência" não publica conteúdo de
                    cliente nenhum. */}
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  {conta.clientId
                    ? nomeDoCliente(conta.clientId) ?? 'cliente removido'
                    : 'sem cliente — não publica'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectada
                </span>
              </div>

              <Button variant="destructive" size="icon-sm"
                onClick={() => desconectar(conta.id, conta.accountName)}
                title="Desconectar"
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
