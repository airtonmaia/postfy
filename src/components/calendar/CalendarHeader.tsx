import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Filter,
  Layers,
  Columns,
  List,
  Clock
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { CalendarViewMode } from '../../types';
import { AlternarVisaoDoWorkflow } from '../common/AlternarVisaoDoWorkflow';
import { BarraDeFiltrosDoConteudo } from '../common/BarraDeFiltrosDoConteudo';
import { Button } from '../ui/button';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Abre a gaveta de filtros. Só existe abaixo do `lg`, onde a barra some. */
  aoAbrirFiltros: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrev,
  onNext,
  onToday,
  aoAbrirFiltros
}) => {
  const { 
    calendarView, 
    setCalendarView, 
    clients, 
    clientFilter, 
    setClientFilter,
    openCreateJobModal
  } = usePostfy();


  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentMonthName = monthNames[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  const viewOptions: { id: CalendarViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'month', label: 'Mês', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
    { id: 'week', label: 'Semana', icon: <Columns className="w-3.5 h-3.5" /> },
    { id: 'day', label: 'Dia', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'list', label: 'Lista', icon: <List className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/*
        Left: Month Navigation & Today

        **`flex-wrap` e `min-w-0`.** Sem os dois, o título do mês, a navegação e
        os quatro filtros disputam uma linha só: no celular a barra de filtros
        era empurrada para fora da tela, e como o `<main>` do App corta, ela
        ficava inalcançável em vez de apertada.
      */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{currentMonthName}</span>
            <span className="text-slate-400 font-normal text-base">{currentYear}</span>
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <Button variant="ghost" size="icon-sm"
            id="btn-cal-prev"
            onClick={onPrev}
            className="hover:bg-white dark:bg-slate-900 dark:text-white"
            title="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost"
            id="btn-cal-today"
            onClick={onToday}
            className="text-slate-700 dark:text-slate-300 hover:bg-white dark:bg-slate-900"
          >
            Hoje
          </Button>
          <Button variant="ghost" size="icon-sm"
            id="btn-cal-next"
            onClick={onNext}
            className="hover:bg-white dark:bg-slate-900 dark:text-white"
            title="Próximo"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/*
          A mesma barra do quadro — cliente, formato, rede e data.

          Ela fica **ao lado da navegação do mês**, e não junto dos botões da
          direita: ali ela divide a linha com o seletor de visão, o Grid e o
          Novo Conteúdo, e num notebook a linha quebra em duas. À esquerda o
          espaço estava vazio, e o agrupamento lê melhor — de um lado o que
          recorta o conteúdo, do outro o que muda a tela e cria peça.

          O seletor de clientes que morava na direita saiu junto: eram dois
          controles para o mesmo filtro, com desenhos diferentes, e o daqui não
          tinha formato nem janela de datas. Filtro que existe numa visão e não
          na outra é a tela escondendo conteúdo sem dizer que escondeu.
        */}
        {/* Abaixo do `lg` ela mora na gaveta, junto da barra lateral: aqui os
            quatro chips ocupavam duas linhas da altura que a grade do mês
            precisa, e o botão "Filtros" já estava logo ao lado oferecendo a
            mesma coisa. */}
        <div className="hidden lg:flex">
          <BarraDeFiltrosDoConteudo comStatus />
        </div>
      </div>

      {/* Right: View Switcher & Action buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/*
          **A porta para o que a barra lateral guarda, e ela só existe onde a
          barra não está.** Acima do `lg` a barra está à vista e um botão para
          abri-la seria um segundo caminho para a mesma coisa.

          O filtro de status mora só lá dentro: sem este botão, escondê-la no
          celular tiraria um filtro sem dizer que tirou — a tela recortando
          conteúdo por um controle que não existe mais.
        */}
        <Button
          variant="secondary"
          className="lg:hidden"
          onClick={aoAbrirFiltros}
          aria-label="Abrir os filtros do calendário"
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </Button>

        {/* View Switcher: Month, Week, Day, List */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
          {viewOptions.map(view => {
            const isActive = calendarView === view.id;
            return (
              <button
                key={view.id}
                id={`btn-cal-view-${view.id}`}
                onClick={() => setCalendarView(view.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-purple-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                }`}
              >
                {view.icon}
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>

        {/* A troca de visão fica colada no botão de criar, à direita: ela não
            é um filtro, é a escolha de qual tela se está olhando. No meio dos
            filtros, lia como mais um recorte do mesmo conteúdo. */}
        <AlternarVisaoDoWorkflow />

        {/* Add Content Button */}
        <Button
          id="btn-header-add-content"
          onClick={() => openCreateJobModal(currentDate.toISOString())}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Post</span>
        </Button>
      </div>

    </div>
  );
};
