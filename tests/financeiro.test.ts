import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  centavosDe,
  limitesDoMes,
  mesVizinho,
  resumoDoPeriodo,
  saldoDoCaixa,
  situacaoDoLancamento,
  porCategoria,
  type Lancamento,
  type Caixa,
} from '../src/lib/financeiro';
import { abasPermitidas } from '../src/lib/permissions';
import type { Role } from '../src/types';
import { semComentarios } from './util/semComentarios';

/**
 * O Financeiro da agência.
 *
 * A tela mais perigosa do produto é a que mostra dinheiro: o Financeiro do
 * SaaS dizia **R$ 591,00** num dia de R$ 0,00 porque multiplicava agências por
 * um preço de tabela. A regra que saiu daquilo vale aqui inteira — a tela
 * mostra o que foi lançado, e nomeia o que não calcula.
 *
 * As somas são exercitadas, não descritas: elas são puras de propósito, e é
 * por isso que moram em `src/lib/financeiro.ts` e não dentro do componente.
 */

const lancamento = (parcial: Partial<Lancamento>): Lancamento => ({
  id: Math.random().toString(36).slice(2),
  workspaceId: 'ws',
  tipo: 'receber',
  descricao: 'teste',
  valorCentavos: 10000,
  vencimento: '2026-10-10',
  ...parcial,
});

// ---------------------------------------------------------------------
// Dinheiro digitado
// ---------------------------------------------------------------------

describe('o valor que a pessoa digita', () => {
  it('entende o teclado brasileiro e o que vem colado de planilha', () => {
    expect(centavosDe('1.234,56')).toBe(123456);
    expect(centavosDe('1234.56')).toBe(123456);
    expect(centavosDe('R$ 1.000,00')).toBe(100000);
    expect(centavosDe('10')).toBe(1000);
    expect(centavosDe('0,05')).toBe(5);
  });

  /**
   * `1.234` é mil duzentos e trinta e quatro, não um real e vinte e três. O
   * que separa os centavos é a **última** pontuação, e só quando sobram duas
   * casas ou menos depois dela.
   */
  it('não confunde o ponto de milhar com centavos', () => {
    expect(centavosDe('1.234')).toBe(123400);
    expect(centavosDe('1.234.567')).toBe(123456700);
  });

  /**
   * **`null` não é zero, e é esta a razão de a função existir.**
   * `parseFloat('abc')` devolve `NaN`, e `NaN || 0` devolve zero: um campo
   * digitado errado viraria um lançamento de R$ 0,00 gravado com cara de
   * certo, dentro de uma soma que alguém vai levar para uma decisão.
   */
  it('devolve nulo para o que não entendeu, nunca zero', () => {
    expect(centavosDe('abc')).toBeNull();
    expect(centavosDe('')).toBeNull();
    expect(centavosDe('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Competência e caixa
// ---------------------------------------------------------------------

describe('o resumo do mês', () => {
  /**
   * **A conta de setembro paga em outubro aparece nos dois meses, em colunas
   * diferentes.** É a distinção inteira entre competência e caixa, e juntá-las
   * numa linha só produziria um número que não fecha nem com o extrato nem com
   * o contrato.
   */
  it('separa o que vence do que andou', () => {
    const contas = [
      lancamento({ vencimento: '2026-09-30', liquidadoEm: '2026-10-05', valorCentavos: 50000 }),
      lancamento({ vencimento: '2026-10-20', valorCentavos: 30000 }),
      lancamento({ tipo: 'pagar', vencimento: '2026-10-05', liquidadoEm: '2026-10-05', valorCentavos: 20000 }),
    ];

    const outubro = resumoDoPeriodo(contas, [], '2026-10', '2026-10-10');
    // Vence em outubro: só os 300. Entrou em outubro: os 500 de setembro.
    expect(outubro.receber.previsto).toBe(30000);
    expect(outubro.receber.liquidado).toBe(50000);
    expect(outubro.receber.aberto).toBe(30000);
    expect(outubro.resultadoDeCaixa).toBe(30000);
    expect(outubro.resultadoPrevisto).toBe(10000);
  });

  /**
   * Os vencidos chegam **por fora** da lista do mês, e não podem sair dela: a
   * conta esquecida há dois meses não vence nem é liquidada dentro do mês que
   * está na tela, então ela não apareceria em mês nenhum.
   */
  it('conta os vencidos de qualquer mês', () => {
    const atrasados = [
      lancamento({ vencimento: '2026-08-01', valorCentavos: 70000 }),
      lancamento({ tipo: 'pagar', vencimento: '2026-07-15', valorCentavos: 15000 }),
    ];
    const r = resumoDoPeriodo([], atrasados, '2026-10', '2026-10-10');
    expect(r.receber.vencido).toBe(70000);
    expect(r.receber.contasVencidas).toBe(1);
    expect(r.pagar.vencido).toBe(15000);
  });

  it('e não conta como vencido o que já foi liquidado', () => {
    const r = resumoDoPeriodo(
      [],
      [lancamento({ vencimento: '2026-08-01', liquidadoEm: '2026-09-02' })],
      '2026-10',
      '2026-10-10'
    );
    expect(r.receber.vencido).toBe(0);
    expect(r.receber.contasVencidas).toBe(0);
  });
});

describe('a situação de uma conta', () => {
  /**
   * Conta paga com atraso é **paga**, não vencida. Mantê-la vermelha para
   * sempre faria a lista de pendências nunca esvaziar — e é assim que se
   * aprende a ignorar o vermelho.
   */
  it('paga com atraso lê como paga', () => {
    expect(
      situacaoDoLancamento(
        lancamento({ vencimento: '2026-09-01', liquidadoEm: '2026-10-01' }),
        '2026-10-10'
      )
    ).toBe('liquidado');
  });

  it('vencida é só a que não foi liquidada', () => {
    expect(situacaoDoLancamento(lancamento({ vencimento: '2026-09-01' }), '2026-10-10')).toBe('vencido');
    expect(situacaoDoLancamento(lancamento({ vencimento: '2026-10-20' }), '2026-10-10')).toBe('aberto');
  });

  /** Vence hoje ainda está no prazo: o dia não acabou. */
  it('o vencimento de hoje ainda está em aberto', () => {
    expect(situacaoDoLancamento(lancamento({ vencimento: '2026-10-10' }), '2026-10-10')).toBe('aberto');
  });
});

// ---------------------------------------------------------------------
// Caixa
// ---------------------------------------------------------------------

describe('o saldo do caixa', () => {
  const caixa: Caixa = {
    id: 'cx',
    workspaceId: 'ws',
    nome: 'Banco',
    saldoInicialCentavos: 100000,
    arquivado: false,
  };

  /**
   * **Só o que foi liquidado entra.** Saldo que soma conta a receber é
   * previsão com cara de extrato — e extrato é justamente o que se confere
   * contra o banco.
   */
  it('soma o que andou, e ignora o que está em aberto', () => {
    const saldo = saldoDoCaixa(caixa, [
      lancamento({ caixaId: 'cx', liquidadoEm: '2026-10-01', valorCentavos: 50000 }),
      lancamento({ caixaId: 'cx', tipo: 'pagar', liquidadoEm: '2026-10-02', valorCentavos: 20000 }),
      lancamento({ caixaId: 'cx', valorCentavos: 999999 }),
      lancamento({ caixaId: 'outro', liquidadoEm: '2026-10-03', valorCentavos: 999999 }),
    ]);
    expect(saldo).toBe(100000 + 50000 - 20000);
  });

  it('sem movimentação nenhuma, o saldo é o inicial', () => {
    expect(saldoDoCaixa(caixa, [])).toBe(100000);
  });
});

describe('as somas por categoria', () => {
  it('agrupam só o liquidado, e nomeiam o que não tem categoria', () => {
    const dados = porCategoria(
      [
        lancamento({ tipo: 'pagar', categoria: 'Ferramentas', liquidadoEm: '2026-10-01', valorCentavos: 5000 }),
        lancamento({ tipo: 'pagar', categoria: 'Ferramentas', liquidadoEm: '2026-10-02', valorCentavos: 3000 }),
        lancamento({ tipo: 'pagar', liquidadoEm: '2026-10-03', valorCentavos: 9000 }),
        lancamento({ tipo: 'pagar', categoria: 'Equipe', valorCentavos: 100000 }),
      ],
      'pagar'
    );
    expect(dados).toEqual([
      { categoria: 'Sem categoria', total: 9000 },
      { categoria: 'Ferramentas', total: 8000 },
    ]);
  });
});

// ---------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------

describe('os limites do mês', () => {
  /**
   * A conta sai de `Date.UTC` de propósito: `new Date(ano, mes, 0)` decidiria
   * o último dia pelo fuso do **aparelho**, e em fevereiro isso é a diferença
   * entre 28 e 29 — a armadilha 8.2 na tela do fechamento.
   */
  it('acertam fevereiro, inclusive no ano bissexto', () => {
    expect(limitesDoMes('2026-02')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(limitesDoMes('2028-02')).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
  });

  it('e a volta do mês atravessa o ano', () => {
    expect(mesVizinho('2026-01', -1)).toBe('2025-12');
    expect(mesVizinho('2026-12', 1)).toBe('2027-01');
    expect(mesVizinho('2026-10', -5)).toBe('2026-05');
  });
});

// ---------------------------------------------------------------------
// O banco, e quem o alcança
// ---------------------------------------------------------------------

describe('a migração do financeiro', () => {
  const PASTA = 'supabase/migrations';
  const arquivo = readdirSync(PASTA).filter((n) => n.includes('financeiro_da_agencia')).sort().pop();
  const sql = readFileSync(join(PASTA, arquivo as string), 'utf-8');

  /**
   * **Dinheiro é inteiro em centavos.** `numeric` chega ao JavaScript como
   * `number`, e `0.1 + 0.2` ali é `0.30000000000000004` — um centavo de
   * diferença por soma, invisível numa linha e visível no fechamento do mês.
   */
  it('o valor é inteiro, nunca numeric nem float', () => {
    expect(sql).toMatch(/valor_centavos\s+bigint/);
    expect(sql).not.toMatch(/valor\s+(numeric|real|double)/);
    expect(sql).toMatch(/check \(valor_centavos > 0\)/);
  });

  /**
   * Conta vence num **dia**, não num instante: `timestamptz` seria convertido
   * pelo fuso e moveria o vencimento um dia para quem abre a tela de outro
   * estado (armadilha 8.2).
   */
  it('vencimento e liquidação são data de parede', () => {
    expect(sql).toMatch(/vencimento\s+date not null/);
    expect(sql).toMatch(/liquidado_em\s+date/);
    expect(sql).not.toMatch(/vencimento\s+timestamptz/);
  });

  /**
   * **Não existe segunda tabela de movimentação**, e a ausência é a decisão:
   * duas tabelas respondendo "quanto entrou este mês" divergem, e aí o saldo
   * do caixa e o relatório ficam certos cada um pelo seu lado.
   */
  it('o caixa não ganha uma tabela de movimentação paralela', () => {
    const tabelas = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(tabelas.sort()).toEqual(['financeiro_caixas', 'financeiro_lancamentos']);
  });

  /**
   * **A RLS é quem recorta, não o menu.** Esconder o item deixando a tabela
   * legível para a equipe inteira seria a armadilha 9 com a conta bancária
   * dentro: o designer não vê o menu e a consulta responde do mesmo jeito.
   */
  it('a leitura não é liberada para todo membro da agência', () => {
    const politicas = sql.slice(sql.indexOf('create policy'));
    expect(politicas).not.toContain('e_membro');
    expect(politicas).toMatch(/papel_na_agencia/);
  });

  /**
   * E a lista de papéis do menu é **a mesma** da política. Duas listas
   * divergem na primeira pressa, e divergir aqui dá os dois piores desfechos:
   * ou um papel vê o menu e leva `42501` ao abrir, ou não vê o menu e lê a
   * tabela por outro caminho.
   */
  it('os papéis do menu são os mesmos da política do banco', () => {
    const naPolitica = new Set(
      [...sql.matchAll(/papel_na_agencia\(workspace_id\)\) in \(([^)]+)\)/g)]
        .flatMap((m) => m[1].split(',').map((p) => p.trim().replace(/'/g, '')))
    );

    // Os papéis saem do próprio arquivo de permissões — lista literal aqui
    // teria de ser editada junto com o código, que é como a guarda deixa de
    // guardar.
    const fonte = readFileSync('src/lib/permissions.ts', 'utf-8');
    const bloco = fonte.slice(
      fonte.indexOf('const ABAS_POR_PAPEL'),
      fonte.indexOf('export type Permissao')
    );
    const papeis = [...bloco.matchAll(/^  (\w+): \[/gm)].map((m) => m[1] as Role);
    expect(papeis.length).toBeGreaterThan(5);

    const noMenu = new Set(papeis.filter((p) => abasPermitidas(p).includes('financeiro')));
    expect([...noMenu].sort()).toEqual([...naPolitica].sort());
  });
});

// ---------------------------------------------------------------------
// As telas
// ---------------------------------------------------------------------

describe('as telas do financeiro', () => {
  const PASTA = 'src/components/financeiro';
  const fontes = readdirSync(PASTA).map((nome) => ({
    nome,
    texto: semComentarios(readFileSync(join(PASTA, nome), 'utf-8')),
  }));

  const casca = fontes.find((f) => f.nome === 'FinanceiroView.tsx')!.texto;
  const relatorio = fontes.find((f) => f.nome === 'RelatorioFinanceiro.tsx')!.texto;

  /**
   * **Leitura que falha não vira tela vazia.** "Nenhum lançamento" depois de
   * um erro é a frase que faz a pessoa concluir que perdeu o histórico — a
   * mesma lição da Biblioteca com o balde sem credencial. O aviso diz que o
   * que está embaixo pode estar incompleto.
   */
  it('a falha de leitura é declarada, e o que sobra é dito incompleto', () => {
    expect(casca).toContain('incompleto');
    const aviso = casca.indexOf('incompleto');
    const conteudo = casca.indexOf('<VisaoGeralDoFinanceiro');
    expect(aviso).toBeLessThan(conteudo);
  });

  /**
   * O relatório **diz o que não calcula**. A referência que originou a tela
   * trazia um DRE com dedução de impostos "classificada automaticamente por
   * nome de categoria (heurística)" — adivinhar que uma linha chamada "DAS" é
   * imposto produz um lucro líquido que ninguém conferiu, numa tela que existe
   * para decidir.
   */
  it('o relatório nomeia o imposto que ele não deduz', () => {
    /*
      A guarda mede o **efeito**, não a palavra. A primeira versão dela proibia
      "lucro líquido" no arquivo — e reprovou a frase que diz, na tela, que ele
      não é calculado. Guarda que acusa a explicação do bug obriga a apagar a
      explicação para ficar verde, e é a quinta vez que este projeto registra
      esse mesmo erro.
    */
    expect(relatorio).toMatch(/imposto/i);
    expect(relatorio).not.toMatch(/const\s+\w*(imposto|tributo|deducao)/i);
    // Alíquota escrita à mão é o começo da dedução adivinhada.
    expect(relatorio).not.toMatch(/\*\s*0\.\d+/);
  });

  /**
   * Nenhuma tela daqui grava pelo estado global: a persistência por diff
   * mostra o resultado antes de o banco responder, e foi assim que dez
   * conteúdos se perderam em silêncio. Em dinheiro, a gravação é explícita e
   * a falha aparece.
   */
  it('nenhuma grava por setAll — a chamada é explícita', () => {
    const culpadas = fontes.filter((f) => /setAll[A-Z]/.test(f.texto)).map((f) => f.nome);
    expect(culpadas).toEqual([]);
  });
});
