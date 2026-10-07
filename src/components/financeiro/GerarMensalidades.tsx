import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Repeat } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import {
  Lancamento,
  formatarCentavos,
  gerarMensalidades,
  planejarMensalidades,
  rotuloDoMes,
} from '../../lib/financeiro';
import { diaLegivel } from './pecas';
import type { Client } from '../../types';

/**
 * Transformar o que o cliente paga em contas a receber do mês.
 *
 * O valor já está no cadastro — é o "Investimento mensal" do card do cliente —
 * e digitá-lo de novo todo mês no Financeiro é o caminho mais curto para os
 * dois divergirem.
 *
 * **Três decisões, e a primeira é a que mais importa:**
 *
 * - **É um clique, nunca um efeito.** Gerar na abertura da tela, ou por cron,
 *   criaria cobrança que ninguém decidiu criar — a mesma regra que impede o
 *   arrasto do quadro de enfileirar publicação. Postagem e cobrança são as duas
 *   coisas deste produto que não voltam.
 * - **O plano aparece antes de gravar.** Quem vai ser cobrado, de quanto, e o
 *   total — mais quem foi deixado de fora e por quê. Um botão que gera trinta
 *   contas sem dizer quais é clicado às cegas ou não é clicado.
 * - **Quem recusa o repetido é o banco.** O índice único por
 *   (agência, cliente, competência) existe porque duas pessoas podem clicar no
 *   mesmo dia, e conferir só na tela deixa a janela entre a conferência e a
 *   gravação aberta.
 */

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  mes: string;
  clientes: Client[];
  lancamentosDoMes: Lancamento[];
  workspaceId: string;
  aoGerar: () => void;
}

export const GerarMensalidades: React.FC<Props> = ({
  aberta,
  aoFechar,
  mes,
  clientes,
  lancamentosDoMes,
  workspaceId,
  aoGerar,
}) => {
  const [dia, setDia] = useState(10);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setErro(null);
    setResultado(null);
  }, [aberta]);

  const plano = planejarMensalidades(clientes, lancamentosDoMes, mes, dia);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const { criados, jaExistiam } = await gerarMensalidades(workspaceId, mes, plano.aGerar);
      aoGerar();
      setResultado(
        jaExistiam > 0
          ? `${criados} conta(s) gerada(s). ${jaExistiam} já existia(m) — alguém gerou antes.`
          : `${criados} conta(s) gerada(s) para ${rotuloDoMes(mes)}.`
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar as mensalidades.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="largo" className="p-0 gap-0">
        <div className="shrink-0 p-5 pr-12 border-b border-slate-200 dark:border-slate-800">
          <DialogTitle asChild>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Mensalidades de {rotuloDoMes(mes)}
            </h3>
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            O valor sai do cadastro de cada cliente — o mesmo "Investimento mensal" que aparece
            no card dele.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{erro}</span>
            </div>
          )}
          {resultado && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{resultado}</span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Dia do vencimento
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={dia}
                onChange={(e) => setDia(Number(e.target.value))}
                className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex-1 min-w-[14rem]">
              Em meses curtos o dia é preso ao último: 31 em fevereiro venceria em março, e a
              conta sairia do mês da competência sem ninguém ver.
            </p>
          </div>

          {plano.aGerar.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Nada a gerar neste mês
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {plano.jaLancados.length > 0
                  ? 'As mensalidades deste mês já foram lançadas.'
                  : 'Nenhum cliente ativo tem valor mensal no cadastro.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {plano.aGerar.map(({ cliente, valorCentavos, vencimento }) => (
                <div key={cliente.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {cliente.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      vence {diaLegivel(vencimento)}
                    </p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatarCentavos(valorCentavos)}
                  </span>
                </div>
              ))}
              <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {plano.aGerar.length} conta(s)
                </span>
                <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatarCentavos(plano.totalCentavos)}
                </span>
              </div>
            </div>
          )}

          {/*
            Quem ficou de fora é dito com nome e motivo. Lista que filtra em
            silêncio faz a pessoa procurar o cliente que "sumiu" — e a resposta
            certa ("ele está inativo", "ele não tem valor no cadastro") está a
            uma tela de distância.
          */}
          {(plano.jaLancados.length > 0 || plano.semValor.length > 0) && (
            <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {plano.jaLancados.length > 0 && (
                <p>
                  <strong>{plano.jaLancados.length}</strong> cliente(s) já têm a mensalidade
                  deste mês lançada, e não entram de novo:{' '}
                  {plano.jaLancados.map((j) => j.cliente.name).join(', ')}.
                </p>
              )}
              {plano.semValor.length > 0 && (
                <p>
                  <strong>{plano.semValor.length}</strong> cliente(s) ativo(s) estão sem valor
                  mensal no cadastro, então não são cobrados:{' '}
                  {plano.semValor.map((c) => c.name).join(', ')}. O valor vem dos serviços na
                  ficha do cliente.
                </p>
              )}
              <p>Clientes inativos nunca entram.</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={aoFechar} disabled={gerando}>
            {resultado ? 'Fechar' : 'Cancelar'}
          </Button>
          <Button
            onClick={() => void gerar()}
            disabled={gerando || plano.aGerar.length === 0 || Boolean(resultado)}
          >
            <Repeat className="w-3.5 h-3.5" />
            {gerando
              ? 'Gerando...'
              : `Gerar ${plano.aGerar.length} conta(s) — ${formatarCentavos(plano.totalCentavos)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
