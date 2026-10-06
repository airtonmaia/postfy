import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { ListView } from './ListView';
import { BarraDeFiltrosDoConteudo } from '../common/BarraDeFiltrosDoConteudo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export const CalendarApp: React.FC = () => {
  const { calendarView, garantirJobsDoPeriodo } = usePostfy();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  /**
   * Navegar para trás pede os jobs daquele mês.
   *
   * A carga inicial traz os abertos e os concluídos dos últimos 90 dias — um
   * mês de março do ano passado não está em memória, e sem isto o calendário
   * mostraria o mês vazio como se nada tivesse sido publicado. Um mês de
   * folga para cada lado porque a semana da virada aparece nos dois.
   */
  useEffect(() => {
    const inicio = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const fim = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
    void garantirJobsDoPeriodo(inicio, fim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (calendarView === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (calendarView === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (calendarView === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (calendarView === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      {/* Calendar Top Header */}
      <CalendarHeader
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onChangeDate={handleSelectDate}
        aoAbrirFiltros={() => setFiltrosAbertos(true)}
      />

      {/* Calendar Body: Sidebar + Active View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/*
          **A barra lateral some abaixo do `lg`, e isso era um bug, não um
          ajuste de gosto.**

          Ela é `w-64` — 256px de uma tela de 390. O `<main>` do App é
          `overflow-hidden`, então o que sobrava da grade do mês não ficava
          apertado: ficava **cortado e inalcançável**, sem barra de rolagem e
          sem nada indicando que havia mês ali. Sete colunas em 134px.

          Esconder e pronto custaria o filtro de status, que só existe aqui —
          e filtro que some sem aviso é a tela escondendo conteúdo. Por isso
          ela vira gaveta, com o mesmo componente: um lugar só continua
          decidindo o que a barra mostra.
        */}
        <CalendarSidebar
          currentDate={currentDate}
          onSelectDate={handleSelectDate}
          className="w-64 border-r border-slate-200 dark:border-slate-800 shrink-0 hidden lg:flex"
        />

        <Dialog open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <DialogContent className="lg:hidden p-0 gap-0">
            <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle>Filtros do calendário</DialogTitle>
            </DialogHeader>
            {/*
              **A barra de filtros entra na gaveta junto com a lateral.**

              No celular ela aparecia nas duas: quatro chips no cabeçalho e o
              botão "Filtros" logo abaixo, dois caminhos para a mesma pergunta
              — e os quatro chips ocupavam duas linhas da altura que a grade do
              mês precisa. Aqui é a mesma peça do computador, empilhada.
            */}
            <div className="px-4 pt-4">
              <BarraDeFiltrosDoConteudo empilhada />
            </div>

            <CalendarSidebar
              currentDate={currentDate}
              onSelectDate={handleSelectDate}
              className="w-full flex-1 min-h-0"
              aoEscolher={() => setFiltrosAbertos(false)}
            />
          </DialogContent>
        </Dialog>

        {/* View Switcher Output */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {calendarView === 'month' && <MonthView currentDate={currentDate} />}
          {calendarView === 'week' && <WeekView currentDate={currentDate} />}
          {calendarView === 'day' && <DayView currentDate={currentDate} />}
          {calendarView === 'list' && <ListView />}
        </main>
      </div>
    </div>
  );
};
