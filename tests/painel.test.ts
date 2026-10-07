import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BLOCOS_DO_PAINEL,
  alternarBloco,
  blocoVisivel,
  blocosDaLargura,
  type IdDoBloco,
} from '../src/lib/blocosDoPainel';
import { semComentarios } from './util/semComentarios';

/**
 * O que o painel mostra, e quem decide.
 *
 * A escolha é **da pessoa**, guardada em `user_settings` — no `localStorage`
 * ficaria presa a um navegador (armadilha 4), e a mesma pessoa abriria o
 * celular com tudo de volta.
 */

describe('a lista guardada é a do que está escondido', () => {
  /**
   * **A inversão é a decisão inteira.** Guardando a lista do que *aparece*,
   * todo bloco novo nasceria fora dela — e nunca chegaria a quem já salvou a
   * preferência uma vez, sem erro em lugar nenhum. É a mesma razão de
   * `sanearFluxo` não gravar as sete etapas na primeira abertura: o que a
   * pessoa não mexeu não é guardado, senão o padrão de hoje congela.
   */
  it('bloco desconhecido nasce visível', () => {
    expect(blocoVisivel('bloco-que-ainda-nao-existe' as IdDoBloco, [])).toBe(true);
    expect(blocoVisivel('bloco-que-ainda-nao-existe' as IdDoBloco, ['atalhos'])).toBe(true);
  });

  it('e o escondido continua escondido', () => {
    expect(blocoVisivel('atalhos', ['atalhos'])).toBe(false);
    expect(blocoVisivel('atalhos', [])).toBe(true);
  });

  /**
   * Id repetido na lista não muda nada visível e cresce para sempre — é o
   * tipo de erro que só aparece quando alguém abre a coluna no banco.
   */
  it('alternar não repete nem perde o resto', () => {
    expect(alternarBloco('atalhos', [], false)).toEqual(['atalhos']);
    expect(alternarBloco('atalhos', ['atalhos'], false)).toEqual(['atalhos']);
    expect(alternarBloco('atalhos', ['atalhos', 'clientes'], true)).toEqual(['clientes']);
    expect(alternarBloco('clientes', ['atalhos'], false)).toEqual(['atalhos', 'clientes']);
  });
});

describe('a lista oferecida é a da largura', () => {
  /**
   * Um interruptor para o que a tela não tem seria oferecer o que não
   * acontece — a família do "Feed + Story" no Facebook antes de existir
   * publicador de story lá.
   */
  it('no celular não se liga o que o celular não desenha', () => {
    const ids = blocosDaLargura(true).map((b) => b.id);
    expect(ids).toContain('atalhos');
    expect(ids).not.toContain('saude');
    expect(ids).not.toContain('insights');
  });

  it('e no computador não se liga o que é só do celular', () => {
    const ids = blocosDaLargura(false).map((b) => b.id);
    expect(ids).toContain('saude');
    expect(ids).toContain('insights');
    expect(ids).not.toContain('atalhos');
  });

  it('os blocos de sempre aparecem nas duas', () => {
    for (const largura of [true, false]) {
      const ids = blocosDaLargura(largura).map((b) => b.id);
      expect(ids).toContain('indicadores');
      expect(ids).toContain('publicacoes');
      expect(ids).toContain('clientes');
      expect(ids).toContain('atividades');
    }
  });
});

describe('a lista e a tela não divergem', () => {
  const painel = semComentarios(
    readFileSync('src/components/dashboard/DashboardView.tsx', 'utf-8')
  );

  /**
   * **Derivada da lista, nunca escrita à mão.** Bloco acrescentado a
   * `BLOCOS_DO_PAINEL` sem a guarda na tela vira um interruptor que não
   * desliga nada; bloco na tela sem entrada na lista vira um pedaço que
   * ninguém consegue esconder. Os dois são mudos.
   */
  it('todo bloco da lista é desenhado sob a preferência', () => {
    const semGuarda = BLOCOS_DO_PAINEL.filter(
      (bloco) => !painel.includes(`mostra('${bloco.id}')`)
    ).map((b) => b.id);
    expect(semGuarda).toEqual([]);
  });

  /**
   * Dois blocos dividem uma linha, e com um escondido a linha continuaria
   * reservando o espaço do que saiu: o card fica com metade da largura e um
   * vazio ao lado, que lê como defeito e não como escolha.
   */
  it('a linha encolhe quando sobra um lado só', () => {
    expect(painel).toContain('const topoCheio');
    expect(painel).toContain('const meioCheio');
    expect(painel).toMatch(/topoCheio \? 'lg:grid-cols-3' : ''/);
    expect(painel).toMatch(/meioCheio \? 'lg:grid-cols-2' : ''/);
  });

  /**
   * O botão mora na tela que ele personaliza. No cabeçalho do app ele
   * apareceria em todas as outras, oferecendo um ajuste que não existe lá.
   */
  it('o botão de personalizar fica no painel, não no cabeçalho do app', () => {
    expect(painel).toContain('Personalizar o painel');
    const app = semComentarios(readFileSync('src/App.tsx', 'utf-8'));
    expect(app).not.toContain('PersonalizarPainel');
  });
});

describe('a preferência vai para o banco', () => {
  const prefs = semComentarios(readFileSync('src/lib/preferencias.ts', 'utf-8'));

  it('é lida e gravada em user_settings', () => {
    expect(prefs).toContain('painel_oculto');
    expect(prefs).toContain('painelOculto');
  });

  /**
   * A coluna é um array com padrão vazio e **sem lista fechada**: um id
   * desconhecido ali não quebra nada — a tela ignora o que não reconhece —,
   * enquanto um `check` faria o bloco renomeado no código derrubar a gravação
   * inteira das preferências, que é a troca errada para aparência.
   */
  it('a coluna nasce vazia e não tem check de lista fechada', () => {
    const PASTA = 'supabase/migrations';
    const arquivo = readdirSync(PASTA).filter((n) => n.includes('blocos_do_painel')).sort().pop();
    const sql = readFileSync(join(PASTA, arquivo as string), 'utf-8');
    expect(sql).toMatch(/painel_oculto text\[\] not null default '\{\}'/);
    expect(sql).not.toMatch(/check \(/);
  });
});

describe('o interruptor é uma peça só', () => {
  const varrer = (dir: string): string[] =>
    readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) return varrer(caminho);
      return /\.tsx$/.test(caminho) ? [caminho] : [];
    });

  /**
   * Ele existia escrito à mão numa tela só, e passou a existir em duas — que é
   * onde as doze alturas de botão começaram. A guarda **deriva**: quem
   * escrever o trilho do interruptor fora do primitivo aparece aqui.
   */
  it('ninguém desenha o trilho fora do primitivo', () => {
    const culpados = varrer('src')
      .filter((arquivo) => !arquivo.endsWith(join('ui', 'interruptor.tsx')))
      .filter((arquivo) => semComentarios(readFileSync(arquivo, 'utf-8')).includes('peer-checked'))
      .map((a) => a.replace(/\\/g, '/'));
    expect(culpados).toEqual([]);
  });
});
