import React from 'react';
import { TrendingUp, TrendingDown, Scale, AlertTriangle, Repeat } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Lancamento,
  ResumoDoFinanceiro,
  LadoDoResumo,
  formatarCentavos,
} from '../../lib/financeiro';
import { Cartao, Vazio, diaLegivel } from './pecas';
import type { Client } from '../../types';

/**
 * A primeira tela do Financeiro: o mês em três números.
 *
 * **Competência e caixa aparecem separados, e isso é a decisão central.**
 * *Quanto vence neste mês* e *quanto entrou neste mês* são perguntas
 * diferentes — uma conta de setembro paga em outubro responde as duas em meses
 * distintos. Juntá-las numa linha só produziria um número que não fecha nem
 * com o extrato nem com o contrato, e é esse número que vai para a decisão de
 * contratar alguém ou segurar uma compra.
 *
 * Nada aqui é projetado. Não há "+18,4% este mês" nem média de nada: o
 * Financeiro do SaaS já ensinou o preço disso — ele dizia R$ 591,00 num dia de
 * R$ 0,00 porque multiplicava agências por um preço de tabela.
 */

const Numero: React.FC<{
  rotulo: string;
  valor: string;
  cor?: string;
  forte?: boolean;
}> = ({ rotulo, valor, cor = 'text-slate-900 dark:text-white', forte }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className={`text-[11px] ${forte ? 'font-bold text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
      {rotulo}
    </span>
    <span className={`text-xs font-bold tabular-nums ${cor}`}>{valor}</span>
  </div>
);

const CartaoDoLado: React.FC<{
  titulo: string;
  icone: React.ElementType;
  tom: string;
  lado: LadoDoResumo;
  tipo: 'receber' | 'pagar';
}> = ({ titulo, icone: Icone, tom, lado, tipo }) => (
  <Cartao className="p-5 space-y-3">
    <div className="flex items-center gap-2">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tom}`}>
        <Icone className="w-3.5 h-3.5" />
      </span>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
    </div>

    <Numero
      rotulo="Vence no mês"
      valor={formatarCentavos(lado.previsto)}
      forte
    />
    <Numero
      rotulo={tipo === 'receber' ? 'Recebido no mês' : 'Pago no mês'}
      valor={formatarCentavos(lado.liquidado)}
      cor="text-emerald-600 dark:text-emerald-400"
    />
    <Numero rotulo="Em aberto, no prazo" valor={formatarCentavos(lado.aberto)} />
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
      <Numero
        rotulo={`Vencido (${lado.contasVencidas})`}
        valor={formatarCentavos(lado.vencido)}
        cor={
          lado.vencido > 0
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-400 dark:text-slate-500'
        }
      />
    </div>
  </Cartao>
);

const ListaDeVencidos: React.FC<{
  titulo: string;
  lancamentos: Lancamento[];
  clientes: Client[];
}> = ({ titulo, lancamentos, clientes }) => (
  <Cartao className="p-5 space-y-3">
    <div className="flex items-center gap-2">
      <AlertTriangle
        className={`w-3.5 h-3.5 ${
          lancamentos.length > 0 ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'
        }`}
      />
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        ({lancamentos.length})
      </span>
    </div>

    {lancamentos.length === 0 ? (
      <p className="text-xs text-slate-500 dark:text-slate-400">Nada vencido. </p>
    ) : (
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {lancamentos.slice(0, 6).map((l) => (
          <div key={l.id} className="py-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {l.descricao}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {clientes.find((c) => c.id === l.clientId)?.name || l.contraparte || '—'} · venceu{' '}
                {diaLegivel(l.vencimento)}
              </p>
            </div>
            <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {formatarCentavos(l.valorCentavos)}
            </span>
          </div>
        ))}
        {lancamentos.length > 6 && (
          <p className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
            e mais {lancamentos.length - 6} — a lista inteira está na tela da aba.
          </p>
        )}
      </div>
    )}
  </Cartao>
);

export interface Recorrente {
  /** A soma do "Investimento mensal" dos clientes ativos. */
  contratado: number;
  /** O que já virou conta a receber neste mês, a partir do cadastro. */
  lancado: number;
  clientes: number;
}

interface Props {
  recorrente: Recorrente;
  aoGerarMensalidades: () => void;
  resumo: ResumoDoFinanceiro;
  doMes: Lancamento[];
  vencidos: Lancamento[];
  clientes: Client[];
  rotuloDoMes: string;
}

export const VisaoGeralDoFinanceiro: React.FC<Props> = ({
  recorrente,
  aoGerarMensalidades,
  resumo,
  doMes,
  vencidos,
  clientes,
  rotuloDoMes,
}) => {
  const positivo = resumo.resultadoDeCaixa >= 0;

  /*
    **A faixa compara o contratado com o lançado, e é ela que avisa quando os
    dois lados saíram do lugar.** O valor do cliente mora na ficha dele; o
    financeiro só sabe dele quando alguém gera a conta. Sem esta linha, a
    diferença entre "a agência vende R$ 12.000/mês" e "o mês tem R$ 4.000
    lançados" não apareceria em tela nenhuma — e a primeira coisa que alguém
    concluiria, olhando o resultado, é que o mês foi ruim.
  */
  const faltam = Math.max(0, recorrente.contratado - recorrente.lancado);

  return (
    <div className="space-y-6">
      {recorrente.contratado > 0 && (
        <Cartao className="p-4 flex flex-wrap items-center gap-4">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
            <Repeat className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Recorrente contratado: {formatarCentavos(recorrente.contratado)} /mês
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {recorrente.clientes} cliente(s) ativo(s) com valor no cadastro.{' '}
              {faltam > 0 ? (
                <>
                  Neste mês, <strong>{formatarCentavos(recorrente.lancado)}</strong> viraram conta
                  a receber — faltam {formatarCentavos(faltam)}.
                </>
              ) : (
                <>Tudo lançado neste mês.</>
              )}
            </p>
          </div>
          <Button variant={faltam > 0 ? 'primary' : 'outline'} onClick={aoGerarMensalidades}>
            <Repeat className="w-3.5 h-3.5" />
            Gerar mensalidades
          </Button>
        </Cartao>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <CartaoDoLado
          titulo="A receber"
          icone={TrendingUp}
          tom="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
          lado={resumo.receber}
          tipo="receber"
        />
        <CartaoDoLado
          titulo="A pagar"
          icone={TrendingDown}
          tom="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
          lado={resumo.pagar}
          tipo="pagar"
        />

        <Cartao className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Scale className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Resultado</h3>
          </div>

          <Numero
            rotulo="Entrou no mês"
            valor={formatarCentavos(resumo.receber.liquidado)}
            cor="text-emerald-600 dark:text-emerald-400"
          />
          <Numero
            rotulo="Saiu no mês"
            valor={formatarCentavos(resumo.pagar.liquidado)}
            cor="text-rose-600 dark:text-rose-400"
          />
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Numero
              rotulo={`Sobrou em ${rotuloDoMes}`}
              valor={formatarCentavos(resumo.resultadoDeCaixa)}
              forte
              cor={
                positivo
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }
            />
          </div>
          {/*
            O previsto fica embaixo e menor **de propósito**: ele é o que
            aconteceria se tudo que vence fosse pago, e tratá-lo como o número
            principal é prometer um caixa que ninguém mediu.
          */}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Pelo que vence no mês, o resultado seria{' '}
            <strong>{formatarCentavos(resumo.resultadoPrevisto)}</strong>. Acima está o que
            entrou e saiu de verdade.
          </p>
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListaDeVencidos
          titulo="Recebimentos vencidos"
          lancamentos={vencidos.filter((l) => l.tipo === 'receber')}
          clientes={clientes}
        />
        <ListaDeVencidos
          titulo="Pagamentos vencidos"
          lancamentos={vencidos.filter((l) => l.tipo === 'pagar')}
          clientes={clientes}
        />
      </div>

      <Cartao className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Movimento de {rotuloDoMes}
        </h3>
        {doMes.length === 0 ? (
          <Vazio
            titulo="Nenhum lançamento neste mês"
            detalhe="Cadastre uma conta a receber ou a pagar — a visão geral, o caixa e os relatórios saem toda dos lançamentos, e não de estimativa nenhuma."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {doMes.slice(0, 12).map((l) => (
              <div key={l.id} className="py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {l.descricao}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {clientes.find((c) => c.id === l.clientId)?.name || l.contraparte || '—'} ·
                    vence {diaLegivel(l.vencimento)}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold tabular-nums ${
                    l.tipo === 'receber'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {l.tipo === 'receber' ? '+' : '−'} {formatarCentavos(l.valorCentavos)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
};
