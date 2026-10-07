import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Calendar as CalendarIcon, 
  Filter,
  Columns,
  List,
  Clock
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { CalendarViewMode } from '../../types';
import { AlternarVisaoDoWorkflow } from '../common/AlternarVisaoDoWorkflow';
import { BarraDeFiltrosDoConteudo } from '../common/BarraDeFiltrosDoConteudo';
import { AdicionarConteudo } from '../common/AdicionarConteudo';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../ui/dropdown-menu';
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

  /* O gatilho diz a visão escolhida, não o nome do campo — a mesma regra dos
     chips de filtro ao lado. Visão desconhecida cai no mês, que é o padrão. */
  const visaoAtual = viewOptions.find((v) => v.id === calendarView) ?? viewOptions[0];

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

        {/*
          **A altura é a da escala de botão, como a dos vizinhos.** O grupo
          tinha `p-1` em volta de botões de 32px e fechava em 40px, ao lado de
          quatro chips de filtro de 32 — a mesma inconsistência das doze alturas
          de botão, agora entre um grupo e os controles da mesma linha. `h-8`
          com o respiro só na horizontal mantém o desenho de grupo e devolve os
          8px.
        */}
        <div className="flex items-center gap-0.5 h-8 px-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
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

        {/*
          **Mês / Semana / Dia / Lista virou um seletor, e isso custou uma
          afordância de propósito.**

          Os quatro em fileira levavam ~380px de uma linha que também carrega o
          mês, a navegação, cinco filtros, a troca de visão e o Adicionar — e o
          que cedia era a **barra de filtros**, que quebrava para uma segunda
          linha e roubava a altura de que a grade do mês precisa. Recolhido, o
          seletor ocupa ~110px e a linha fecha inteira.

          O preço é real: em fileira, as quatro opções estão à vista e trocar é
          um clique; recolhido são dois, e quem nunca abrir não descobre que
          "Lista" existe. O que compensa é o gatilho **dizer a visão escolhida**
          — ele não é um botão "Visão", é "Mês" com o ícone do mês —, que é a
          mesma regra dos chips de filtro ao lado: o controle mostra o valor,
          não o nome do campo.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" aria-label={`Visão: ${visaoAtual.label}`}>
              {visaoAtual.icon}
              {visaoAtual.label}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Desenhar o mês como</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={calendarView}
              onValueChange={(v) => setCalendarView(v as CalendarViewMode)}
            >
              {viewOptions.map((view) => (
                <DropdownMenuRadioItem key={view.id} value={view.id}>
                  {view.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* A troca de visão fica colada no botão de criar, à direita: ela não
            é um filtro, é a escolha de qual tela se está olhando. No meio dos
            filtros, lia como mais um recorte do mesmo conteúdo. */}
        <AlternarVisaoDoWorkflow />

        {/* **O mesmo botão do quadro**, com a data que está aberta: criar
            olhando para outubro e a peça nascer em hoje é a tela ignorando o
            contexto do clique. Ele era "Novo Post", criava sempre um conteúdo
            e escondia copy e roteiro de quem cria pelo calendário. */}
        <AdicionarConteudo dataSugerida={currentDate.toISOString()} />
      </div>

    </div>
  );
};
