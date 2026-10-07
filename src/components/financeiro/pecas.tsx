import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { SituacaoDoLancamento } from '../../lib/financeiro';

/**
 * As peças que as cinco telas do Financeiro dividem.
 *
 * Elas moram aqui pelo motivo de sempre: escritas em cada tela, divergem na
 * primeira pressa — e divergir num selo de situação é pior que em outro lugar,
 * porque "vencido" em duas cores diferentes faz a pessoa procurar a diferença
 * que não existe.
 */

export const Cartao: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div
    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${className}`}
  >
    {children}
  </div>
);

/**
 * Em que pé está a conta.
 *
 * Três estados e nada mais: pago, vencido, em aberto. "Parcial" não existe no
 * banco — e um selo para um estado que a tabela não guarda seria a tela
 * afirmando o que ninguém mediu.
 */
export const SeloDaSituacao: React.FC<{
  situacao: SituacaoDoLancamento;
  tipo: 'receber' | 'pagar';
}> = ({ situacao, tipo }) => {
  const mapa = {
    liquidado: {
      texto: tipo === 'receber' ? 'Recebido' : 'Pago',
      icone: CheckCircle2,
      cor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    },
    vencido: {
      texto: 'Vencido',
      icone: AlertTriangle,
      cor: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
    },
    aberto: {
      texto: 'Em aberto',
      icone: Clock,
      cor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    },
  }[situacao];

  const Icone = mapa.icone;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${mapa.cor}`}
    >
      <Icone className="w-3 h-3 shrink-0" />
      {mapa.texto}
    </span>
  );
};

/**
 * O vazio diz **por que** está vazio.
 *
 * "Nenhum lançamento" depois de uma falha de leitura é a frase que faz a
 * pessoa concluir que perdeu os dados — a mesma lição da Biblioteca, onde o
 * estado vazio não aparece quando a leitura falhou. Por isso quem monta isto
 * só o monta depois de a leitura ter dado certo.
 */
export const Vazio: React.FC<{ titulo: string; detalhe?: string }> = ({ titulo, detalhe }) => (
  <div className="py-10 text-center">
    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{titulo}</p>
    {detalhe && (
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
        {detalhe}
      </p>
    )}
  </div>
);

/** A data de parede, escrita como se lê. Sem `Date`: o texto já é o dia. */
export const diaLegivel = (dia?: string): string => {
  if (!dia) return '—';
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
};
