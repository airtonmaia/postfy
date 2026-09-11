import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { DollarSign, Building2, Clock, AlertTriangle, Plug, CreditCard } from 'lucide-react';
import { carregarNumerosDeCobranca, type NumerosDeCobranca } from '../../lib/numerosDoSaas';
import { statusApi, type StatusDoServidor } from '../../lib/api';

/**
 * Financeiro do SaaS.
 *
 * Esta tela afirmava um faturamento que não existe. Ela calculava
 * `MRR = agências × R$ 197` — contando como pagante toda agência criada,
 * inclusive as em teste —, projetava o ARR em cima disso, e exibia
 * "100% adimplentes", "+18,4% este mês" e "Ticket Médio R$ 197,00" como
 * texto fixo. Abaixo, uma tabela de "Últimas Transações do SaaS" com quatro
 * pagamentos de agências inventadas: Vanguarda Social, Pixel Mídia e Creative
 * Hub, que nunca existiram na base.
 *
 * No dia em que isso foi corrigido, a realidade era: três agências, todas em
 * teste, nenhuma pagante, R$ 0,00 de receita. A tela mostrava R$ 591,00.
 *
 * Agora existe cobrança: `subscriptions` guarda a assinatura de cada agência
 * com o produto, e o MRR é a **soma do que está assinado e ativo**, vinda de
 * `admin_numeros_de_cobranca()`. Zero aqui passou a ser um zero apurado.
 *
 * O que não mudou é a regra: número inventado em tela financeira é pior que
 * tela vazia, porque é usado para decidir. Enquanto não houver cobrança de
 * verdade, aqui só entra o que o
 * banco sabe — quantas agências existem, quais estão em teste e desde quando.
 *
 * O que falta para esta tela ter faturamento está escrito nela, com nome:
 * não há tabela de assinatura da agência com o SaaS, nem de pagamentos.
 * `plans` é outra coisa — é o catálogo que cada agência monta para os
 * clientes dela.
 */

const formatarData = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Centavos → "R$ 1.234,56". Zero é zero, e é dito assim. */
const emReais = (centavos: number): string =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const AdminFinanceiroView: React.FC = () => {
  const { workspaces } = usePostfy();

  /**
   * Os números de cobrança, medidos.
   *
   * `null` = a RPC ainda não respondeu. A distinção importa nesta tela mais
   * que em qualquer outra: "carregando" e "R$ 0,00" são coisas diferentes, e
   * mostrar zero enquanto a resposta não chegou seria inventar de novo — só
   * que para baixo.
   */
  const [cobranca, setCobranca] = useState<NumerosDeCobranca | null>(null);
  const [status, setStatus] = useState<StatusDoServidor | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [numeros, servidor] = await Promise.all([
          carregarNumerosDeCobranca(),
          statusApi.consultar().catch(() => null),
        ]);
        if (cancelado) return;
        setCobranca(numeros);
        setStatus(servidor);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível apurar.');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const total = workspaces.filter((w) => !w.deletedAt).length;
  const emTeste = workspaces.filter((w) => !w.deletedAt && w.isTrial).length;

  // Enquanto o Stripe não está configurado, ninguém consegue assinar — e
  // dizer isso é diferente de dizer "R$ 0,00 de receita".
  const cobrancaLigada = Boolean(status?.cobranca && status?.cobrancaPreco);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
            Financeiro
          </span>
          <span className="text-xs text-slate-400">• Situação das agências</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Financeiro & Faturamento do SaaS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Situação das agências cadastradas no produto.
        </p>
      </div>

      {erro && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">{erro}</p>
        </div>
      )}

      {/*
        O aviso vem antes dos números, e não num rodapé: quem abre uma tela
        chamada "Financeiro" espera receita, e precisa saber de onde ela vem
        antes de ler qualquer coisa.

        Agora há dois avisos possíveis, e eles dizem coisas diferentes: sem
        Stripe configurado **ninguém consegue assinar**, e um zero aqui não é
        medida de nada. Com Stripe ligado, zero é um zero apurado.
      */}
      {status && !cobrancaLigada && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              A cobrança ainda não está ligada
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed max-w-3xl">
              Falta{' '}
              <code className="font-mono">
                {!status.cobranca ? 'STRIPE_SECRET_KEY' : 'STRIPE_PRICE_ID'}
              </code>{' '}
              no servidor. Enquanto isso, nenhuma agência consegue assinar e os números
              abaixo são todos zero — zero porque não há assinatura, não porque a receita
              não foi apurada. <strong>Admin → Integrações</strong> mostra o que falta e a
              URL do webhook para cadastrar no Stripe.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed max-w-3xl">
              Não confundir com <code className="font-mono">plans</code>: aquele é o
              catálogo que cada agência monta para os clientes dela.
            </p>
          </div>
        </div>
      )}

      {/*
        Quatro números, todos medidos.

        O MRR é a soma de `preco_centavos` das assinaturas ativas — não
        `agências × preço de tabela`, que era o cálculo que dizia R$ 591,00
        num dia de R$ 0,00. "—" enquanto a RPC não responde: zero e
        "ainda não sei" não são a mesma resposta numa tela financeira.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Receita recorrente (MRR)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {cobranca ? emReais(cobranca.mrrCentavos) : '—'}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {cobranca
              ? `soma de ${cobranca.assinaturas.ativas} assinatura${cobranca.assinaturas.ativas === 1 ? '' : 's'} ativa${cobranca.assinaturas.ativas === 1 ? '' : 's'}`
              : 'apurando...'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Assinaturas ativas</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {cobranca ? cobranca.assinaturas.ativas : '—'}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {cobranca && cobranca.assinaturas.cancelamNoFim > 0
              ? `${cobranca.assinaturas.cancelamNoFim} cancela no fim do período`
              : 'nenhuma cancelando'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Inadimplentes</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {cobranca ? cobranca.assinaturas.inadimplentes : '—'}
          </div>
          {/* O rótulo não diz "0% de inadimplência": a tela antiga trazia
              "100% adimplentes" como texto fixo. */}
          <span className="text-[11px] text-slate-400 block mt-1">
            pagamento recusado no Stripe
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Em teste grátis</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{emTeste}</div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {cobranca && cobranca.agencias.testeVencido > 0
              ? `${cobranca.agencias.testeVencido} com o teste já vencido`
              : total > 0
                ? `de ${total} agências na base`
                : 'nenhuma agência ainda'}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Agências na base</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cada agência cadastrada e a situação do teste. Aqui ficava um histórico de
            transações que era exemplo, não dado.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="p-8 text-center">
            <Plug className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Nenhuma agência cadastrada ainda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3">Agência</th>
                  <th className="px-5 py-3">Endereço</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3">Teste termina em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workspaces.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                        {w.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">{w.slug}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          w.isTrial
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {w.isTrial ? 'Em teste' : 'Fora do teste'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {formatarData(w.trialEndsAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
