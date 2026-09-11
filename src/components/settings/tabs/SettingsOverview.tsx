import React, { useEffect, useState } from 'react';
import {
  Building2,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  User,
} from 'lucide-react';
import { usePostfy } from '../../../context/PostfyContext';
import {
  carregarAcessoDaAgencia,
  abrirCobranca,
  type AcessoDaAgencia,
} from '../../../lib/assinatura';
import { pode } from '../../../lib/permissions';
import { safeDateFormat } from '../../../lib/utils';

/**
 * Visão geral da conta.
 *
 * Esta tela era inteiramente decorativa. Seis campos com `defaultValue`,
 * nenhum controlado, e um botão "Atualizar Perfil" **sem `onClick`**: quem
 * digitava e clicava não salvava nada e não via erro. Dois dos valores eram
 * inventados — telefone `(11) 99999-9999` e "Data de Registro" `01/01/2026`,
 * literais no código, iguais para toda conta.
 *
 * A correção não foi fazer os campos salvarem. Já existe um editor de perfil
 * de verdade (nome, avatar, senha e e-mail, em `src/lib/perfil.ts`), e um
 * segundo formulário para os mesmos dados seria duas verdades para a mesma
 * pergunta — a próxima mudança acertaria um e esqueceria o outro.
 *
 * Então aqui só se **lê**, com o que o banco sabe, e o botão manda para onde
 * a edição acontece de fato. O espaço que sobrou foi para a assinatura, que
 * é a pergunta que esta tela não respondia e alguém precisa responder: até
 * quando esta agência pode usar o produto.
 */

const emReais = (centavos: number, moeda: string): string =>
  (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: (moeda || 'brl').toUpperCase(),
  });

/** O que dizer sobre o acesso, e com que cor. Um lugar só. */
const situacao = (
  acesso: AcessoDaAgencia
): { titulo: string; detalhe: string; tom: 'ok' | 'aviso' | 'ruim' } => {
  switch (acesso.motivo) {
    case 'ativa':
      return {
        titulo: 'Assinatura ativa',
        detalhe: acesso.cancelarNoFim
          ? `Cancelamento agendado: o acesso vai até ${safeDateFormat(acesso.periodoFim)}.`
          : acesso.periodoFim
            ? `Próxima cobrança em ${safeDateFormat(acesso.periodoFim)}.`
            : 'Cobrança em dia.',
        tom: acesso.cancelarNoFim ? 'aviso' : 'ok',
      };
    case 'inadimplente':
      return {
        titulo: 'Pagamento não confirmado',
        detalhe:
          'O Stripe não conseguiu cobrar o cartão. O acesso continua por alguns dias — atualize a forma de pagamento para não ser interrompido.',
        tom: 'aviso',
      };
    case 'vencida':
      return {
        titulo: 'Assinatura vencida',
        detalhe: 'A renovação não foi registrada. Confira a forma de pagamento.',
        tom: 'ruim',
      };
    case 'cancelada':
      return {
        titulo: 'Assinatura cancelada',
        detalhe: 'Assine de novo para voltar a usar o produto.',
        tom: 'ruim',
      };
    case 'teste_vencido':
      return {
        titulo: 'Teste grátis encerrado',
        detalhe: 'Assine para continuar usando.',
        tom: 'ruim',
      };
    default:
      return {
        titulo: 'Em teste grátis',
        detalhe: acesso.testeTerminaEm
          ? `O teste vai até ${safeDateFormat(acesso.testeTerminaEm)}.`
          : 'Sem data de término definida.',
        tom: 'aviso',
      };
  }
};

const CORES = {
  ok: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
  aviso:
    'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300',
  ruim: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300',
} as const;

export const SettingsOverview: React.FC = () => {
  const { currentUser, currentWorkspace, setIsProfileModalOpen } = usePostfy();

  const [acesso, setAcesso] = useState<AcessoDaAgencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  const podeAssinar = pode(currentUser?.role, 'gerenciar_workspace');

  /**
   * Voltando do checkout.
   *
   * O Stripe devolve a pessoa antes de o webhook necessariamente ter chegado
   * — são dois caminhos diferentes, e o dela costuma ser mais rápido. Sem
   * isto, quem acabou de pagar veria "em teste grátis" e concluiria que o
   * pagamento não passou.
   */
  const voltandoDoCheckout = (() => {
    try {
      return new URLSearchParams(window.location.search).get('assinatura') === 'ok';
    } catch {
      return false;
    }
  })();

  const [esperandoWebhook, setEsperandoWebhook] = useState(voltandoDoCheckout);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    let cancelado = false;
    let tentativas = 0;

    const consultar = async () => {
      try {
        const dados = await carregarAcessoDaAgencia(currentWorkspace.id);
        if (cancelado) return;
        setAcesso(dados);

        // Insiste enquanto a assinatura não aparece, e desiste depois de
        // ~15s: o webhook pode falhar, e ficar consultando para sempre
        // esconderia isso de quem precisa saber.
        if (voltandoDoCheckout && !dados.temAssinatura && tentativas < 5) {
          tentativas++;
          setTimeout(() => void consultar(), 3000);
        } else {
          setEsperandoWebhook(false);
        }
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : 'Não foi possível consultar.');
          setEsperandoWebhook(false);
        }
      }
    };

    void consultar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id]);

  const irParaOStripe = async (acao: 'checkout' | 'portal') => {
    setIndo(true);
    setErro(null);
    try {
      const url = await abrirCobranca(acao, currentWorkspace.id);
      window.location.href = url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir a cobrança.');
      setIndo(false);
    }
  };

  const s = acesso ? situacao(acesso) : null;

  return (
    <div className="space-y-6">
      {/* Assinatura */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-purple-600" />
          Assinatura do Orquesia
        </h4>

        {erro && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            {erro}
          </div>
        )}

        {esperandoWebhook && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
            Pagamento recebido. A confirmação do Stripe chega em instantes — esta tela
            atualiza sozinha.
          </div>
        )}

        {!acesso ? (
          <div className="py-6 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className={`p-4 rounded-2xl border ${CORES[s!.tom]}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                {s!.tom === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : s!.tom === 'aviso' ? (
                  <Clock className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                {s!.titulo}
              </div>
              <p className="text-[11px] mt-1 leading-relaxed opacity-90">{s!.detalhe}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Plano</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {acesso.plano || (acesso.temAssinatura ? 'sem nome no Stripe' : 'nenhum')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {acesso.precoCentavos != null
                    ? `${emReais(acesso.precoCentavos, acesso.moeda)}/mês`
                    : '—'}
                </span>
              </div>
            </div>

            {podeAssinar ? (
              <button
                onClick={() => void irParaOStripe(acesso.temAssinatura ? 'portal' : 'checkout')}
                disabled={indo}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                {indo
                  ? 'Abrindo...'
                  : acesso.temAssinatura
                    ? 'Gerenciar cobrança'
                    : 'Assinar o Orquesia'}
              </button>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Só o proprietário ou um administrador da agência mexe na assinatura.
              </p>
            )}
          </>
        )}
      </div>

      {/* Dados da conta — só leitura */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          Dados da Conta
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          O que o banco tem sobre esta conta. Nome, avatar, senha e e-mail se editam no
          perfil.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {[
            { rotulo: 'Nome', valor: currentUser.name },
            { rotulo: 'E-mail', valor: currentUser.email },
            { rotulo: 'Agência', valor: currentWorkspace.name },
            { rotulo: 'Endereço do portal', valor: currentWorkspace.slug, mono: true },
            { rotulo: 'Seu papel na agência', valor: currentUser.role },
            { rotulo: 'Fuso horário', valor: currentWorkspace.timezone || 'America/Sao_Paulo' },
          ].map((campo) => (
            <div
              key={campo.rotulo}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {campo.rotulo}
              </span>
              <span
                className={`text-slate-900 dark:text-white font-bold break-all ${
                  campo.mono ? 'font-mono' : ''
                }`}
              >
                {campo.valor || '—'}
              </span>
            </div>
          ))}
        </div>

        {/*
          Os campos "Celular (WhatsApp)", "CPF/CNPJ" e "Data de Registro"
          saíram. Os dois primeiros não existem no schema — eram caixas que
          não gravavam em coluna nenhuma —, e o terceiro trazia 01/01/2026
          literal, igual para toda conta.
        */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <User className="w-4 h-4" />
            Editar perfil
          </button>
        </div>
      </div>
    </div>
  );
};
