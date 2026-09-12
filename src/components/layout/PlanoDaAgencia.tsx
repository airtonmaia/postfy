import React from 'react';
import { ChevronRight, CreditCard } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { rotuloDoPlano } from '../../lib/assinatura';

const PONTO = {
  ok: 'bg-emerald-500',
  aviso: 'bg-amber-500',
  ruim: 'bg-rose-500',
} as const;

/**
 * Em que plano a agência está, no rodapé da barra lateral.
 *
 * Ele veio de cima: ficava como "✨ Teste Grátis (7 dias)" embaixo do nome da
 * agência, onde disputava espaço com a marca e repetia em toda tela uma
 * informação de cobrança. Aqui embaixo ele é consultado quando se quer saber,
 * e o clique leva para onde se resolve.
 *
 * **Some inteiro enquanto o banco não respondeu.** `acessoDaAgencia` em
 * `null` é consulta pendente ou que falhou, e um rodapé dizendo "Teste
 * grátis" por padrão afirmaria o que ninguém mediu — a mesma regra que tirou
 * o `MRR = agências × R$ 197` do Financeiro. Em compensação, quando ele
 * aparece, o que está escrito ali veio de `acesso_da_agencia()`.
 *
 * No trilho recolhido ele sai: são duas linhas de texto, e em 64px viram
 * mancha. É o mesmo tratamento do cartão de saúde operacional ao lado.
 */
export const PlanoDaAgencia: React.FC<{ recolhida?: boolean }> = ({
  recolhida = false,
}) => {
  const { acessoDaAgencia, setActiveTab } = usePostfy();

  if (!acessoDaAgencia) return null;

  const { titulo, detalhe, tom } = rotuloDoPlano(acessoDaAgencia);

  return (
    /*
      `<button>` à mão, e não `<Button>`: são duas linhas de texto empilhadas,
      com altura própria. A escala de altura fixa cortaria a segunda — é o
      papel "card clicável" que `tests/botoes.test.ts` nomeia.
    */
    <button
      type="button"
      onClick={() => setActiveTab('configuracoes')}
      title="Assinatura e cobrança"
      className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-left cursor-pointer transition
        bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800
        hover:border-slate-200 dark:hover:border-slate-700 group
        ${recolhida ? 'md:hidden' : ''}`}
    >
      <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />

      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PONTO[tom]}`} />
          <span className="truncate">{titulo}</span>
        </span>
        <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
          {detalhe}
        </span>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 shrink-0" />
    </button>
  );
};
