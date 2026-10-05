import React from 'react';
import { CalendarDays, Kanban } from 'lucide-react';

import { usePostfy } from '../../context/PostfyContext';
import { podeAcessarAba } from '../../lib/permissions';
import type { TabType } from '../../types';

/**
 * Quadro ou Calendário — a mesma tela, duas leituras do mesmo conteúdo.
 *
 * **Eram dois itens de menu, e isso era a pergunta errada.** "Calendário" e
 * "WorkFlow" não são lugares diferentes: são a mesma fila de conteúdo
 * desenhada por etapa ou por data. Quem queria ver o que sai na terça e quem
 * queria ver o que está parado em aprovação abriam menus diferentes para olhar
 * o mesmo dado — e, pior, cada um com os filtros do outro invisíveis.
 *
 * **As duas visões continuam com URL própria** (`/kanban` e `/calendario`), e
 * isso não é detalhe: o endereço do calendário está em favorito de gente que
 * trabalha aqui, e o F5 nele tem de continuar abrindo o calendário. Por isso a
 * troca mexe no `activeTab` — o mesmo estado que a barra lateral usa —, e não
 * num estado novo de "visão": dois estados para a mesma pergunta é como a URL
 * e a tela passam a discordar, sem erro em lugar nenhum.
 *
 * A barra lateral mostra **WorkFlow** aceso nas duas, porque é um item só.
 *
 * O desenho é o do seletor de visão do calendário (Mês/Semana/Dia/Lista),
 * copiado classe por classe: é o vocabulário de "alternar entre leituras da
 * mesma tela" que este produto já tem, e inventar um segundo faria a mesma
 * pessoa achar que mudou de lugar ao clicar.
 */

const VISOES: { id: TabType; rotulo: string; Icone: React.FC<{ className?: string }> }[] = [
  { id: 'producao', rotulo: 'Quadro', Icone: Kanban },
  { id: 'calendario', rotulo: 'Calendário', Icone: CalendarDays },
];

export const AlternarVisaoDoWorkflow: React.FC = () => {
  const { activeTab, setActiveTab, currentUser } = usePostfy();

  /*
    Papel que não alcança uma das visões não vê o botão dela. Hoje todos os
    papéis têm as duas, mas um botão que leva a uma tela que a permissão
    recusa é a família do "botão que não faz nada": gasta o clique e devolve
    a tela vazia, sem dizer por quê.
  */
  const visoes = VISOES.filter((v) => podeAcessarAba(currentUser?.role, v.id));
  if (visoes.length < 2) return null;

  return (
    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
      {visoes.map(({ id, rotulo, Icone }) => {
        const ativo = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-pressed={ativo}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
              ativo
                ? 'bg-white dark:bg-slate-900 text-purple-700 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
            }`}
          >
            <Icone className="w-3.5 h-3.5" />
            <span>{rotulo}</span>
          </button>
        );
      })}
    </div>
  );
};
