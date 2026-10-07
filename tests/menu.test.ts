import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  ITENS_DO_MENU,
  FILHOS_DO_FINANCEIRO,
  CABECA_DO_FINANCEIRO,
  menuPlano,
} from '../src/components/layout/menuDaAgencia';
import { abasPermitidas } from '../src/lib/permissions';
import { CAMINHOS } from '../src/lib/rotas';
import type { TabType } from '../src/types';
import { semComentarios } from './util/semComentarios';

/**
 * O menu da agência, e os atalhos que o Dashboard desenha no celular.
 *
 * A lista morava dentro do `App.tsx` e bastou enquanto a barra lateral era a
 * única a desenhá-la. Com os atalhos, duas listas do mesmo menu passariam a
 * existir — e divergir aqui tem um custo próprio: a tela nova que não aparece
 * nos atalhos simplesmente **não é encontrada** por quem usa o produto no
 * telefone, sem nada quebrar.
 */
describe('o menu é uma lista só', () => {
  const atalhos = semComentarios(
    readFileSync('src/components/dashboard/AtalhosDoMenu.tsx', 'utf-8')
  );
  const app = semComentarios(readFileSync('src/App.tsx', 'utf-8'));

  it('os atalhos derivam do menu, em vez de repetir a lista', () => {
    expect(atalhos).toContain("from '../layout/menuDaAgencia'");
    expect(atalhos).toContain('menuPlano(');

    /*
      Nenhum identificador de aba escrito à mão ali: é assim que a segunda
      lista nasce.

      As três exceções são do **realce**, não da lista: o WorkFlow acende
      também no calendário, e a cabeça do Financeiro acende nas cinco telas
      dele. Sem elas, o atalho apagaria com a tela aberta e a pessoa procuraria
      onde está.
    */
    const DO_REALCE: TabType[] = ['producao', 'calendario', 'financeiro'];
    const literais = (Object.keys(CAMINHOS) as TabType[])
      .filter((aba) => !DO_REALCE.includes(aba))
      .filter((aba) => new RegExp(`['"]${aba}['"]`).test(atalhos));
    expect(literais).toEqual([]);
  });

  it('e a barra lateral também', () => {
    expect(app).toContain('ITENS_DO_MENU');
    expect(app).toContain('FILHOS_DO_FINANCEIRO');
    // A lista literal que morava aqui não volta.
    expect(app).not.toMatch(/label: 'WorkFlow'/);
  });

  /**
   * Toda aba do menu tem caminho, e nenhum item aponta para tela que não
   * existe. `tests/rotas.test.ts` já exige o contrário — aqui é o lado do
   * menu.
   */
  it('todo item do menu tem rota', () => {
    for (const item of [...ITENS_DO_MENU, ...FILHOS_DO_FINANCEIRO, CABECA_DO_FINANCEIRO]) {
      expect(CAMINHOS[item.id], `${item.label} sem caminho`).toBeTruthy();
    }
  });
});

describe('o menu plano, que os atalhos desenham', () => {
  const sim = (abas: TabType[]) => (aba: TabType) => abas.includes(aba);

  /**
   * **O Financeiro entra pela cabeça, não pelos cinco filhos.** Um atalho é um
   * toque para chegar a um assunto; cinco ladrilhos de dinheiro ao lado de
   * nove telas diria que o Financeiro é metade do produto.
   */
  it('o Financeiro aparece uma vez, logo depois do Comercial', () => {
    const lista = menuPlano(sim(['dashboard', 'comercial', 'relatorios', 'financeiro']));
    const ids = lista.map((i) => i.id);
    expect(ids).toEqual(['dashboard', 'comercial', 'financeiro', 'relatorios']);
  });

  /** Sem nenhum filho permitido, o grupo não existe — em vez de abrir vazio. */
  it('sem permissão no Financeiro, ele não aparece', () => {
    const ids = menuPlano(sim(['dashboard', 'comercial'])).map((i) => i.id);
    expect(ids).toEqual(['dashboard', 'comercial']);
  });

  /**
   * A reserva não é zelo: um papel com o Financeiro e sem o Comercial perderia
   * o item inteiro sem ninguém notar — a mesma classe da coluna que sumia do
   * quadro.
   */
  it('sem o Comercial, o Financeiro ainda entra', () => {
    const ids = menuPlano(sim(['dashboard', 'financeiro_receber'])).map((i) => i.id);
    expect(ids).toEqual(['dashboard', 'financeiro']);
  });

  it('o papel financeiro vê o menu dele', () => {
    const permitidas = abasPermitidas('financial');
    const ids = menuPlano((aba) => permitidas.includes(aba)).map((i) => i.id);
    expect(ids).toContain('financeiro');
    expect(ids).toContain('clientes');
    expect(ids).not.toContain('configuracoes');
  });

  it('o designer não leva o Financeiro para os atalhos', () => {
    const permitidas = abasPermitidas('designer');
    const ids = menuPlano((aba) => permitidas.includes(aba)).map((i) => i.id);
    expect(ids).not.toContain('financeiro');
    expect(ids).toContain('producao');
  });
});

/**
 * No celular, o cartão de saúde e os insights saem da tela.
 *
 * Os dois ocupam duas telas inteiras de um aparelho de 390px antes do primeiro
 * número, e os dois respondem a mesma coisa — *como a operação está* —, que é
 * consulta, não trabalho.
 */
describe('o Dashboard no celular', () => {
  const tela = semComentarios(
    readFileSync('src/components/dashboard/DashboardView.tsx', 'utf-8')
  );

  /**
   * **A escolha é em JavaScript, não em `lg:hidden`.** Esconder por CSS monta
   * tudo assim mesmo: a arte da personagem é baixada e os insights são
   * calculados, justamente no aparelho onde isso custa mais. É a mesma decisão
   * do assistente da tela de conteúdo.
   */
  it('esconde montando outra coisa, não com classe', () => {
    expect(tela).toContain('useTelaEstreita()');
    expect(tela).toContain('{estreita ? (');

    /*
      O ramo é procurado **a partir da condição**, e não no arquivo inteiro: a
      primeira versão desta guarda pegou o `) : (` de um ternário que mora no
      topo do arquivo, dentro do `TextoDoInsight`, e comparou posições de duas
      coisas sem relação nenhuma. Guarda que mede o vizinho no lugar do alvo
      não guarda.
    */
    const condicao = tela.indexOf('{estreita ? (');
    const atalhos = tela.indexOf('<AtalhosDoMenu />', condicao);
    const outroRamo = tela.indexOf(') : (', condicao);
    const arte = tela.indexOf('<img', condicao);
    expect(atalhos).toBeGreaterThan(-1);
    expect(atalhos).toBeLessThan(outroRamo);
    // A arte da personagem fica no ramo largo: no estreito ela nem é montada,
    // e portanto nem é baixada.
    expect(arte).toBeGreaterThan(outroRamo);
  });

  it('os insights não ganham um segundo caminho por classe', () => {
    expect(tela).not.toMatch(/(^|\s)(lg:hidden|hidden\s+lg:)/);
  });
});
