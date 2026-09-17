import React, { useEffect, useState } from 'react';
import { Timer, Play, Square, Plus, Check } from 'lucide-react';
import type { Job } from '../../types';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateFormat } from '../../lib/utils';
import { Button } from '../ui/button';

/**
 * As horas gastas nesta peça: cronômetro, lançamento manual e histórico.
 *
 * **Dois cartões saíram daqui, e é a armadilha 9.** "Custo estimado da
 * agência" multiplicava as horas por `R$ 85,00` — uma tarifa que não existe
 * em lugar nenhum do banco, escrita no componente — e "Rentabilidade do job"
 * dizia *Excelente Margem / Dentro do escopo planejado* como texto fixo,
 * trocando para *Alerta Horas* acima de três horas e pronto. Nenhum dos dois
 * media nada.
 *
 * É o mesmo caso do Financeiro que dizia R$ 591,00 num dia de R$ 0,00, com o
 * agravante de que este número seria usado para decidir se o contrato do
 * cliente vale a pena. Enquanto não houver valor-hora no cadastro da agência
 * e valor do contrato ligado ao job, a tela mostra **o que o banco sabe** — o
 * tempo — e diz o que falta.
 */
export const PainelDeTimesheet: React.FC<{ job: Job }> = ({ job }) => {
  const { timesheetLogs, addTimesheetLog, currentUser, clients, setSelectedJob } = usePostfy();

  const [rodando, setRodando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [notas, setNotas] = useState('');
  const [minutosManuais, setMinutosManuais] = useState(30);

  useEffect(() => {
    if (!rodando) return;
    const intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(intervalo);
  }, [rodando]);

  const cliente = clients.find((c) => c.id === job.clientId);
  const registros = timesheetLogs.filter((t) => t.jobId === job.id);
  const total = job.timesheetMinutes || 0;

  const registrar = (minutes: number, motivo: string) => {
    addTimesheetLog({
      jobId: job.id,
      jobTitle: job.title,
      clientId: job.clientId,
      clientName: cliente?.name || 'Cliente',
      userId: currentUser.id,
      userName: currentUser.name,
      minutes,
      notes: notas || motivo,
    });
    setNotas('');
    setSelectedJob({ ...job, timesheetMinutes: total + minutes });
  };

  const pararESalvar = () => {
    const minutos = Math.max(1, Math.round(segundos / 60));
    registrar(minutos, 'Tempo registrado via timer ao vivo');
    setRodando(false);
    setSegundos(0);
  };

  const cartao =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs';

  const dois = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="space-y-4">
      <div className={cartao}>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Tempo total investido
        </span>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-black text-purple-600">
            {Math.floor(total / 60)}h {total % 60}m
          </span>
          <span className="text-xs text-slate-400 font-medium">({total} minutos)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cronômetro */}
        <div className={`${cartao} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-purple-600" />
              Cronômetro ao vivo
            </span>
            {rodando && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Gravando
              </span>
            )}
          </div>

          <div className="text-center py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-3xl sm:text-4xl font-mono font-black text-slate-900 dark:text-white tracking-widest">
              {dois(Math.floor(segundos / 3600))}:{dois(Math.floor((segundos % 3600) / 60))}:
              {dois(segundos % 60)}
            </span>
          </div>

          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Descrição da atividade (ex: criação da arte...)"
            className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          />

          <div className="flex items-center gap-2">
            {!rodando ? (
              <Button type="button" onClick={() => setRodando(true)} className="flex-1">
                <Play className="w-4 h-4 fill-white" />
                Iniciar timer
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setRodando(false)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                Pausar
              </Button>
            )}

            <Button variant="success" type="button" disabled={segundos === 0} onClick={pararESalvar}>
              <Square className="w-4 h-4 fill-white" />
              Salvar
            </Button>
          </div>
        </div>

        {/* Lançamento manual */}
        <div className={`${cartao} space-y-3`}>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-purple-600" />
            Lançamento manual de horas
          </span>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
              Tempo em minutos:
            </label>
            {/* `flex-wrap`: cinco botões de 32px não cabem na metade da grade
                num celular, e sem quebrar eles saíam do cartão. */}
            <div className="flex items-center gap-2 flex-wrap">
              {[15, 30, 45, 60, 120].map((mins) => (
                <Button
                  key={mins}
                  /* Escolha entre opções, não ação: o roxo aqui quer dizer
                     "selecionado". */
                  variant={minutosManuais === mins ? 'primary' : 'outline'}
                  type="button"
                  onClick={() => setMinutosManuais(mins)}
                >
                  +{mins}m
                </Button>
              ))}
            </div>
          </div>

          <input
            type="number"
            value={minutosManuais}
            onChange={(e) => setMinutosManuais(Number(e.target.value))}
            className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
            placeholder="Minutos"
          />

          <Button
            type="button"
            onClick={() => minutosManuais > 0 && registrar(minutosManuais, 'Lançamento manual de horas')}
            className="w-full bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white"
          >
            <Check className="w-4 h-4" />
            Registrar {minutosManuais} minutos
          </Button>
        </div>
      </div>

      {/* Histórico */}
      <div className={`${cartao} space-y-2`}>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
          Histórico de registros ({registros.length})
        </span>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {registros.map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <strong className="text-slate-800 dark:text-slate-200">{log.userName}</strong>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                  {log.notes || 'Sem descrição'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-purple-600">{log.minutes} min</span>
                <span className="text-[10px] text-slate-400 block">
                  {safeDateFormat(log.createdAt)}
                </span>
              </div>
            </div>
          ))}

          {registros.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">
              Nenhum tempo lançado para este conteúdo até o momento.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
