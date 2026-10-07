import React from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { podeAcessarAba } from '../../lib/permissions';
import { menuPlano } from '../layout/menuDaAgencia';
import type { TabType } from '../../types';

/**
 * O menu como ladrilhos, no Dashboard do celular.
 *
 * No telefone a barra lateral é uma gaveta: chegar a qualquer tela custa dois
 * toques, e o primeiro deles é num ícone de hambúrguer que não diz o que tem
 * dentro. O Dashboard é onde a pessoa chega — e era, até aqui, a única tela
 * sem nenhum caminho para as outras.
 *
 * **A lista é derivada, nunca escrita aqui.** Ela sai de `menuDaAgencia`, que
 * é a mesma da barra lateral, e passa pela mesma `podeAcessarAba`. Uma lista
 * própria obrigaria a lembrar deste arquivo ao criar uma tela — e esquecer não
 * quebraria nada visível: a tela nova simplesmente não existiria para quem usa
 * o produto no telefone.
 *
 * **O ladrilho é um `<button>` escrito à mão, e isso é a regra, não a
 * exceção.** Ícone sobre rótulo é conteúdo em bloco: a escala do `Button` fixa
 * a altura (`h-8`) e o conteúdo transbordaria a caixa — é o erro dos nove
 * cards migrados por engano, que `tests/botoes.test.ts` guarda pelo nome.
 */

export const AtalhosDoMenu: React.FC = () => {
  const { currentUser, activeTab, setActiveTab } = usePostfy();

  const itens = menuPlano((aba: TabType) => podeAcessarAba(currentUser?.role, aba));

  if (itens.length === 0) return null;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
        Menu
      </h2>

      {/*
        Quatro colunas em 390px dão ladrilhos de ~80px — cabe o ícone e duas
        linhas de rótulo. Três deixariam o nome inteiro e empurrariam a tela
        para baixo; cinco cortariam "Comercial & Vendas" no meio da palavra.
      */}
      <div className="grid grid-cols-4 gap-2">
        {itens.map((item) => {
          const Icone = item.icon;
          // O WorkFlow acende também no calendário: são duas visões de um item
          // só, e um atalho apagado com a tela aberta faz procurar onde se está.
          const ativo =
            activeTab === item.id ||
            (item.id === 'producao' && activeTab === 'calendario') ||
            (item.id === 'financeiro' && String(activeTab).startsWith('financeiro'));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition text-center cursor-pointer ${
                ativo
                  ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  ativo
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icone className="w-4 h-4" />
              </span>
              {/*
                O rótulo quebra em duas linhas em vez de ser cortado: "Fila de
                Publicações" vira "Fila de" num ladrilho de 80px, e meia palavra
                não diz para onde o toque leva. `leading-tight` é o que faz as
                duas linhas caberem sem esticar o ladrilho.
              */}
              <span
                className={`text-[10px] font-semibold leading-tight line-clamp-2 ${
                  ativo
                    ? 'text-purple-700 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
