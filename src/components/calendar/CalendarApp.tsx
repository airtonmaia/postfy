import React, { useEffect, useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { CalendarHeader } from './CalendarHeader';
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      {/* Calendar Top Header */}
      <CalendarHeader
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        aoAbrirFiltros={() => setFiltrosAbertos(true)}
      />

      {/* Calendar Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/*
          **A barra lateral saiu, e o que ela tinha de próprio foi reposto
          antes de ela sair.**

          Ela era `w-64` de uma tela que já tem os mesmos filtros no topo:
          cliente e rede existiam nos dois lugares, com desenhos diferentes, e
          a navegação por mês já está no cabeçalho, ao lado do "Hoje". O que
          ela tinha de único era o **filtro de etapa** — e tirá-la sem ele
          seria a tela recortando conteúdo por um controle que não existe mais,
          que é a razão de ela ter virado gaveta no celular em vez de sumir.

          Hoje esse filtro é o `comStatus` da barra de cima, derivado do fluxo
          da agência: ele ganhou as duas etapas que a lista da lateral não
          tinha e passou a respeitar os nomes que a agência escolheu.

          **O que foi embora junto, e é bom dizer qual:** o mini-calendário,
          que era o único caminho para pular para um mês distante. Resta ‹ ›
          e "Hoje". Se fizer falta, o lugar dela é o título do mês no
          cabeçalho, não uma coluna de 256px.
        */}
        <Dialog open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <DialogContent className="lg:hidden p-0 gap-0">
            <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle>Filtros do calendário</DialogTitle>
            </DialogHeader>
            {/*
              No celular os chips não cabem no cabeçalho — eles ocupavam duas
              linhas da altura que a grade do mês precisa. Aqui é a mesma peça
              do computador, empilhada, e com o mesmo filtro de etapa.
            */}
            <div className="p-4">
              <BarraDeFiltrosDoConteudo empilhada comStatus />
            </div>
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
