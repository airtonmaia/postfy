import React, { useState } from 'react';
import { Sparkles, X, ChevronDown, Plus, ArrowUp, Wrench } from 'lucide-react';

import { CHANGELOG, type EntradaDoChangelog } from '../../data/changelog';
import { Button } from '../ui/button';

/**
 * Novidades: linha do tempo das versões.
 *
 * O conteúdo vive em `src/data/changelog.ts` e é atualizado a cada entrega.
 * Antes ele morava aqui dentro, num array de objetos com ícone e gradiente
 * por item — e foi assim que a lista acumulou três funcionalidades que nunca
 * existiram: mexer no changelog exigia mexer em interface, então ninguém
 * mexia, e o que estava escrito envelheceu sozinho.
 *
 * A estrutura é a de uma página de release notes: a data é o título, a versão
 * é uma etiqueta ao lado, e cada entrega recolhe. Só a primeira abre sozinha —
 * quem abre a tela quer saber o que mudou agora, e o resto é histórico.
 */

/**
 * A data é ISO puro (`2026-09-09`), que o JS lê como meia-noite **UTC**. Em
 * fuso negativo — o nosso — formatar isso no fuso local devolve o dia
 * anterior. Daí o `timeZone: 'UTC'`: a data do changelog é um rótulo, não um
 * instante, e não deveria mudar conforme quem lê.
 */
export const formatarData = (iso: string): string => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

type Secao = {
  chave: keyof Pick<EntradaDoChangelog, 'novidades' | 'melhorias' | 'corrigido'>;
  rotulo: string;
  Icone: React.FC<{ className?: string }>;
  cor: string;
};

const SECOES: Secao[] = [
  {
    chave: 'novidades',
    rotulo: 'Novidades',
    Icone: Plus,
    cor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    chave: 'melhorias',
    rotulo: 'Melhorias',
    Icone: ArrowUp,
    cor: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
  },
  {
    chave: 'corrigido',
    rotulo: 'Corrigido',
    Icone: Wrench,
    cor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
  },
];

const BlocoDaSecao: React.FC<{ secao: Secao; itens: string[] }> = ({ secao, itens }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <span className={`p-1 rounded-md ${secao.cor}`}>
        <secao.Icone className="w-3 h-3" />
      </span>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {secao.rotulo}
      </span>
    </div>
    <ul className="space-y-1.5 pl-1">
      {itens.map((item) => (
        <li
          key={item}
          className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2"
        >
          <span className="text-slate-300 dark:text-slate-600 select-none">—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Entrega: React.FC<{ entrada: EntradaDoChangelog; abertaPorPadrao: boolean }> = ({
  entrada,
  abertaPorPadrao,
}) => {
  const [aberta, setAberta] = useState(abertaPorPadrao);
  const secoes = SECOES.map((s) => ({ secao: s, itens: entrada[s.chave] ?? [] })).filter(
    ({ itens }) => itens.length > 0
  );

  return (
    <li className="relative pl-8 pb-8 last:pb-0">
      {/* O ponto cobre a linha; por isso tem o fundo da modal atrás. */}
      <span className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-purple-600 ring-4 ring-white dark:ring-slate-900" />

      <Button variant="ghost"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
            {formatarData(entrada.data)}
          </h4>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            v{entrada.versao}
          </span>
          <ChevronDown
            className={`w-4 h-4 ml-auto text-slate-400 transition-transform ${aberta ? 'rotate-180' : ''}`}
          />
        </div>

        {/* O resumo fica fora do recolhimento: dá para percorrer a lista
            inteira sem abrir nada e ainda saber o que cada versão fez. */}
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 pr-6 leading-relaxed">
          {entrada.resumo}
        </p>
      </Button>

      {aberta && secoes.length > 0 && (
        <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
          {secoes.map(({ secao, itens }) => (
            <BlocoDaSecao key={secao.chave} secao={secao} itens={itens} />
          ))}
        </div>
      )}
    </li>
  );
};

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Novidades do Orquesia
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tudo o que mudou, da entrega mais recente para a mais antiga.
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="dark:hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* A linha vertical vem da borda do <ul>, e não de um elemento
              próprio: assim ela termina junto com o último item. */}
          <ul className="border-l border-slate-200 dark:border-slate-800 ml-1.5">
            {CHANGELOG.map((entrada, i) => (
              <Entrega key={entrada.versao} entrada={entrada} abertaPorPadrao={i === 0} />
            ))}
          </ul>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {CHANGELOG.length} entregas · versão atual v{CHANGELOG[0]?.versao}
          </span>
          <Button
            onClick={onClose}
            className="shrink-0"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
