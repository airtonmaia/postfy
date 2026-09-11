import React, { useEffect, useState } from 'react';
import { safeTimeFormat } from '../../lib/utils';
import {
  BarChart3,
  Building2,
  Users,
  FileText,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';

import { carregarNumerosDoSaas, type NumerosDoSaas } from '../../lib/numerosDoSaas';

/**
 * Relatórios do produto.
 *
 * Regra única desta tela, e ela vem de um bug real: **só entra o que o banco
 * conta**. O Financeiro do SaaS já mostrou R$ 591,00 de receita num dia em que
 * havia três agências em teste e R$ 0,00 — o número saía de agências × R$ 197,
 * com "transações" de empresas que nunca existiram na base.
 *
 * Então aqui não há taxa de conversão, churn, projeção nem meta: nenhuma
 * dessas coisas tem de onde sair hoje. Há contagem, e o que falta está dito
 * com nome no fim da tela.
 *
 * Os números vêm de `admin_numeros_do_saas()`, que devolve só agregado —
 * nenhum conteúdo de agência nenhuma passa por aqui.
 */

const STATUS_DE_JOB: Record<string, string> = {
  briefing: 'Briefing',
  in_production: 'Em produção',
  for_approval: 'Aguardando aprovação',
  in_adjustment: 'Em ajuste',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  published: 'Publicado',
};

const STATUS_DA_FILA: Record<string, string> = {
  pending: 'Na fila',
  processing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
};

const Cartao: React.FC<{
  icone: React.FC<{ className?: string }>;
  titulo: string;
  valor: number;
  detalhe: string;
}> = ({ icone: Icone, titulo, valor, detalhe }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
    <div className="flex items-center gap-2 mb-2">
      <Icone className="w-4 h-4 text-slate-400" />
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {titulo}
      </span>
    </div>
    <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums block">
      {valor.toLocaleString('pt-BR')}
    </span>
    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{detalhe}</p>
  </div>
);

/**
 * Barras em CSS, sem biblioteca de gráfico.
 *
 * São doze valores inteiros; carregar uma dependência de gráfico para isso
 * pesaria mais que a tela toda. A escala é o maior mês da série, e um mês
 * zerado aparece como uma faixa vazia — que é a informação.
 */
const Serie: React.FC<{
  titulo: string;
  meses: { mes: string; valor: number }[];
}> = ({ titulo, meses }) => {
  const maior = Math.max(1, ...meses.map((m) => m.valor));
  return (
    <div className="space-y-3">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{titulo}</span>
      <div className="flex items-end gap-1.5 h-28">
        {meses.map((m) => (
          <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              {m.valor}
            </span>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-md bg-purple-500/80 dark:bg-purple-500/60 min-h-[2px]"
                style={{ height: `${(m.valor / maior) * 100}%` }}
                title={`${m.mes}: ${m.valor}`}
              />
            </div>
            <span className="text-[9px] text-slate-400 font-mono truncate w-full text-center">
              {m.mes.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Distribuicao: React.FC<{
  titulo: string;
  vazio: string;
  rotulos: Record<string, string>;
  dados: Record<string, number>;
}> = ({ titulo, vazio, rotulos, dados }) => {
  const linhas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const total = linhas.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
      <h2 className="text-sm font-black text-slate-900 dark:text-white">{titulo}</h2>

      {linhas.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{vazio}</p>
      ) : (
        <div className="space-y-2.5">
          {linhas.map(([status, valor]) => (
            <div key={status} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  {rotulos[status] || status}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {valor}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{ width: `${total ? (valor / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminRelatoriosView: React.FC = () => {
  const [dados, setDados] = useState<NumerosDoSaas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = () => {
    setCarregando(true);
    setErro(null);
    carregarNumerosDoSaas()
      .then(setDados)
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setCarregando(false));
  };

  useEffect(buscar, []);

  if (carregando && !dados) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 flex items-start gap-3 max-w-2xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Não foi possível apurar os números
            </p>
            <p className="text-xs text-rose-800 dark:text-rose-300/90 mt-1 leading-relaxed">{erro}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dados) return null;

  const apurado = dados.apuradoEm ? new Date(dados.apuradoEm) : null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Relatórios do produto
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            O tamanho da base
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Contagem direta do banco, somando todas as agências.
            {apurado && ` Apurado às ${safeTimeFormat(apurado)}.`}
          </p>
        </div>

        <button
          type="button"
          onClick={buscar}
          disabled={carregando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Cartao
          icone={Building2}
          titulo="Agências"
          valor={dados.agencias.total}
          detalhe={`${dados.agencias.emTeste} em teste · ${dados.agencias.foraDoTeste} fora do teste`}
        />
        <Cartao
          icone={Users}
          titulo="Contas"
          valor={dados.usuarios.total}
          detalhe={`${dados.usuarios.ativos30d} entraram nos últimos 30 dias`}
        />
        <Cartao
          icone={Users}
          titulo="Clientes atendidos"
          valor={dados.conteudo.clientes}
          detalhe="Somando os clientes de todas as agências"
        />
        <Cartao
          icone={FileText}
          titulo="Conteúdos"
          valor={dados.conteudo.jobs}
          detalhe={`${dados.conteudo.jobs30d} criados nos últimos 30 dias`}
        />
      </div>

      {/* Sinais que costumam esconder problema. Não são métrica de vaidade:
          conta sem agência foi o sintoma do bug do convite, e convite
          pendente antigo é alguém que nunca conseguiu entrar. */}
      {(dados.usuarios.semAgencia > 0 || dados.usuarios.convitesPendentes > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Vale olhar
            </p>
            <ul className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed space-y-0.5">
              {dados.usuarios.semAgencia > 0 && (
                <li>
                  <strong>{dados.usuarios.semAgencia}</strong>{' '}
                  {dados.usuarios.semAgencia === 1 ? 'conta está' : 'contas estão'} sem agência
                  nenhuma — quem cai nessa situação abre o sistema vazio e conclui que ele não
                  funciona.
                </li>
              )}
              {dados.usuarios.convitesPendentes > 0 && (
                <li>
                  <strong>{dados.usuarios.convitesPendentes}</strong>{' '}
                  {dados.usuarios.convitesPendentes === 1 ? 'convite ainda válido não foi aceito' : 'convites ainda válidos não foram aceitos'}.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Últimos 12 meses</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quantidade criada em cada mês. Mês sem nada aparece zerado de propósito.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Serie
            titulo="Agências criadas"
            meses={dados.porMes.map((m) => ({ mes: m.mes, valor: m.agencias }))}
          />
          <Serie
            titulo="Contas criadas"
            meses={dados.porMes.map((m) => ({ mes: m.mes, valor: m.usuarios }))}
          />
          <Serie
            titulo="Conteúdos criados"
            meses={dados.porMes.map((m) => ({ mes: m.mes, valor: m.jobs }))}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Distribuicao
          titulo="Conteúdos por etapa"
          vazio="Nenhum conteúdo criado ainda em nenhuma agência."
          rotulos={STATUS_DE_JOB}
          dados={dados.jobsPorStatus}
        />
        <Distribuicao
          titulo="Fila de publicação"
          vazio="A fila está vazia. Ela só recebe conteúdo aprovado com data e conta conectada."
          rotulos={STATUS_DA_FILA}
          dados={dados.filaDePublicacao}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Cartao
          icone={Users}
          titulo="Vínculos"
          valor={dados.usuarios.vinculos}
          detalhe="Pessoa × agência. Uma conta pode estar em mais de uma."
        />
        <Cartao
          icone={Users}
          titulo="E-mails confirmados"
          valor={dados.usuarios.confirmados}
          detalhe={`de ${dados.usuarios.total} contas`}
        />
        <Cartao
          icone={FileText}
          titulo="Leads"
          valor={dados.conteudo.leads}
          detalhe="No funil comercial das agências"
        />
        <Cartao
          icone={FileText}
          titulo="Contratos"
          valor={dados.conteudo.contratos}
          detalhe="Entre agências e os clientes delas"
        />
      </div>

      {/* A mesma regra da aba Integrações e do Financeiro: dizer o que falta,
          com nome, em vez de calcular em cima de dado que não existe. */}
      <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            O que esta tela não mostra, e por quê
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Não há receita, churn, conversão de teste em pagante nem projeção. Falta a
            assinatura de cada agência com o SaaS e o registro das cobranças — as duas
            coisas não existem no banco, e sem elas qualquer número desses seria chute.
            Foi assim que o Financeiro chegou a mostrar R$ 591,00 num dia de R$ 0,00.
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Também não há tempo médio de aprovação nem produtividade por agência: o
            histórico de mudança de etapa não é gravado, então não dá para saber quando
            um conteúdo entrou em cada estado.
          </p>
        </div>
      </div>
    </div>
  );
};
