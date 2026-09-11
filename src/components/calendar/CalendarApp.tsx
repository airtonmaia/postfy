import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { ListView } from './ListView';

export const CalendarApp: React.FC = () => {
  const { calendarView, garantirJobsDoPeriodo } = usePostfy();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

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
      />

      {/* Calendar Body: Sidebar + Active View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar (Mini-calendar + Filters) */}
        <CalendarSidebar
          currentDate={currentDate}
          onSelectDate={handleSelectDate}
        />

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
