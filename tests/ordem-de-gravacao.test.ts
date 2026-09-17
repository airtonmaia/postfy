import { describe, it, expect } from 'vitest';
import { diferenciar } from '../src/lib/sincronizacao';
import { readFileSync } from 'node:fs';
import { semComentarios } from './util/semComentarios';

/**
 * Ordem de gravação entre tabelas ligadas por chave estrangeira.
 *
 * Converter um lead em cliente cria o cliente e o contrato dele no mesmo
 * render. Cada coleção tem seu próprio efeito, então os inserts saíam em
 * paralelo e o contrato podia chegar antes do cliente existir: o Postgres
 * recusava com 23503, ninguém repetia, e a tela seguia mostrando um contrato
 * que sumia no reload.
 *
 * A correção serializa as gravações numa fila só. Isso só funciona enquanto
 * os hooks forem declarados na ordem de dependência — é isso que este teste
 * protege, porque reordená-los parece inofensivo.
 */

const fonte = readFileSync('src/context/PostfyContext.tsx', 'utf-8');
/**
 * O mesmo arquivo **sem os comentários**.
 *
 * O projeto registra o porquê de cada correção num comentário ao lado dela, e
 * a guarda de "a bandeira não volta" reprovava exatamente esse registro: o
 * texto que explica por que ela saiu cita o nome dela. Guarda que acusa a
 * própria memória do bug obriga a apagar a memória.
 */
const codigo = semComentarios(fonte);

const posicaoDe = (colecao: string): number => {
  const i = fonte.indexOf(`useColecaoSincronizada('${colecao}'`);
  expect(i, `coleção ${colecao} não está sincronizada`).toBeGreaterThan(-1);
  return i;
};

describe('ordem das coleções sincronizadas', () => {
  // Cada par é uma chave estrangeira real do schema.
  const dependencias: [filho: string, pai: string][] = [
    ['jobs', 'clients'],
    ['contracts', 'clients'],
    ['clientMaterials', 'clients'],
    ['proposals', 'leads'],
  ];

  for (const [filho, pai] of dependencias) {
    it(`${pai} é gravada antes de ${filho}`, () => {
      expect(posicaoDe(pai)).toBeLessThan(posicaoDe(filho));
    });
  }

  it('as gravações passam por uma fila única', () => {
    // Sem a fila, a ordem dos hooks não garante ordem de chegada no banco.
    expect(fonte).toMatch(/filaDeGravacao\.current = filaDeGravacao\.current\.then/);
  });
});

/**
 * O carregamento do banco não pode virar escrita.
 *
 * `hidratado` sozinho não bastava: ele é ligado dentro de carregarTudo, mas
 * `setState` é assíncrono e os efeitos das coleções só rodam no render
 * seguinte, com a bandeira já ligada. O estado anterior estava vazio e o novo
 * cheio, então o carregamento inteiro era interpretado como inserção — a
 * causa da multiplicação de linhas a cada recarga.
 *
 * A correção depende de ordem de declaração: o efeito que baixa a bandeira
 * roda depois dos das coleções porque é declarado depois. Mover para cima
 * reintroduz o bug sem nenhum sintoma no teste de unidade.
 */
/**
 * **O que veio do banco não é gravado de volta; o que o usuário editou nunca
 * é descartado.**
 *
 * As três guardas que moravam aqui olhavam a *bandeira*: que ela era
 * levantada antes de aplicar os dados, baixada depois das coleções, e testada
 * no efeito. Todas as três passavam — e o mecanismo que elas descreviam
 * perdia edição em produção.
 *
 * `garantirJobsDoPeriodo` levantava a bandeira e só então chamava
 * `setAllJobs`, cujo updater devolve a mesma referência quando não há linha
 * nova. Mesma referência = o React **desiste do render**; sem render, o efeito
 * que baixava a bandeira não rodava. Ela ficava erguida, e a primeira edição
 * de verdade depois disso era pulada — com `anterior.current` já avançado,
 * ou seja, nunca mais tentada. A data editada voltava ao valor antigo no F5,
 * e a ideia recém-criada não chegava ao banco.
 *
 * Guarda que descreve o mecanismo aprova qualquer mecanismo que tenha aquela
 * forma. Estas exercitam a **decisão**, com o diff de verdade: linha vinda do
 * banco não vira insert, edição do usuário vira update — e as duas no mesmo
 * lote não se atrapalham.
 */
describe('carregamento do banco não é gravado de volta', () => {
  type Linha = { id: string; v?: number };

  /**
   * O recorte que o `useColecaoSincronizada` faz, isolado.
   *
   * Copiar a regra para o teste seria descrevê-la de novo; o que está aqui é
   * o **contrato**: dado o diff e os ids que vieram do banco, o que sai para
   * o repositório.
   */
  const aGravar = (antes: Linha[], depois: Linha[], idsDoBanco: string[]) => {
    const d = diferenciar(antes, depois);
    const doBanco = new Set(idsDoBanco);
    return {
      inseridos: d.inseridos.filter((l) => !doBanco.has(l.id)).map((l) => l.id),
      atualizados: d.atualizados.map((l) => l.id),
      removidos: d.removidos,
    };
  };

  it('a carga do banco não vira insert', () => {
    const saida = aGravar([], [{ id: 'a' }, { id: 'b' }], ['a', 'b']);
    expect(saida.inseridos, 'o carregamento voltou a ser gravado como inserção').toEqual([]);
  });

  it('a edição do usuário continua virando update', () => {
    const saida = aGravar([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }], []);
    expect(saida.atualizados, 'a edição do usuário deixou de ser gravada').toEqual(['a']);
  });

  it('carga e edição no mesmo lote não se atrapalham', () => {
    /**
     * **É este o caso que a bandeira errava.** Ela pulava o commit inteiro:
     * a linha vinda do banco não era inserida — certo — e a edição do usuário
     * ia junto, sem chance de nova tentativa.
     */
    const saida = aGravar(
      [{ id: 'a', v: 1 }],
      [{ id: 'a', v: 2 }, { id: 'b' }],
      ['b']
    );
    expect(saida.inseridos, 'a linha vinda do banco voltou a ser inserida').toEqual([]);
    expect(
      saida.atualizados,
      'a edição do usuário foi descartada junto com a carga — é o bug da bandeira'
    ).toEqual(['a']);
  });

  it('a marca é consumida por commit, e não fica pendurada', () => {
    // A bandeira presa em `true` era o bug. A marca é limpa pelo próprio
    // efeito que a lê, então ela não sobrevive ao commit que a criou.
    expect(fonte, 'a marca deixou de ser consumida').toMatch(/doBanco\.clear\(\)/);
  });

  it('a marca é criada dentro do updater, onde o estado muda mesmo', () => {
    /**
     * Fora do updater ela valeria mesmo quando não há linha nova — e aí o
     * `setAllJobs` devolve a mesma referência, o React desiste do render, e a
     * marca fica esperando um commit que não vem. Foi exatamente assim que a
     * bandeira ficou presa.
     */
    const bloco = fonte.slice(fonte.indexOf('const garantirJobsDoPeriodo'));
    const corpo = bloco.slice(0, bloco.indexOf('const filaDeGravacao'));
    const desiste = corpo.indexOf('if (!novos.length) return atuais;');
    const marca = corpo.indexOf("marcarComoVindoDoBanco('jobs'");

    expect(desiste, 'a saída sem linha nova sumiu').toBeGreaterThan(-1);
    expect(marca, 'a marca sumiu da busca por período').toBeGreaterThan(-1);
    expect(
      desiste,
      'a marca voltou a ser feita antes de saber se o estado muda — ela fica pendurada'
    ).toBeLessThan(marca);
  });

  it('a bandeira global não volta', () => {
    // Ela é o mecanismo que perdia edição em silêncio.
    expect(
      codigo.match(/aplicandoCargaDoBanco/)?.[0] ?? null,
      'a bandeira global de carga voltou'
    ).toBeNull();
  });
});
