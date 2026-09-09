import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EVENTOS_DISPONIVEIS, ACOES_DISPONIVEIS } from '../src/lib/automacoes';

/**
 * As automações eram decorativas: gatilho e ação em texto livre, sem nada que
 * as executasse, e um contador de execuções que ninguém incrementava.
 *
 * O que sustenta o motor agora é um acordo em três pontos — o tipo no
 * TypeScript, o check no Postgres e a chamada no contexto. Se um deles sair
 * de sincronia, a regra é aceita na tela e nunca dispara, sem erro nenhum.
 * É esse acordo que os testes abaixo protegem.
 */

const contexto = readFileSync('src/context/PostfyContext.tsx', 'utf-8');
const migracao = readFileSync(
  'supabase/migrations/20260909090000_automacoes_executaveis.sql',
  'utf-8'
);

describe('eventos oferecidos na tela', () => {
  it('todo evento tem rótulo e explicação de quando dispara', () => {
    for (const e of EVENTOS_DISPONIVEIS) {
      expect(e.rotulo.length, e.valor).toBeGreaterThan(0);
      expect(e.quando.length, e.valor).toBeGreaterThan(0);
    }
  });

  it('todo evento é realmente disparado pelo contexto', () => {
    // Oferecer na tela um gatilho que nenhum código dispara é a versão nova
    // do mesmo problema antigo: a regra fica ligada e não acontece nada.
    for (const e of EVENTOS_DISPONIVEIS) {
      expect(contexto, `${e.valor} não é disparado em lugar nenhum`).toContain(
        `dispararAutomacoes('${e.valor}'`
      );
    }
  });

  it('todo evento é aceito pelo check do banco', () => {
    // Fora do check, o insert falha com 23514 na hora de salvar a regra.
    for (const e of EVENTOS_DISPONIVEIS) {
      expect(migracao, `${e.valor} não está no check`).toContain(`'${e.valor}'`);
    }
  });
});

describe('ações oferecidas na tela', () => {
  it('toda ação é aceita pelo check do banco', () => {
    for (const a of ACOES_DISPONIVEIS) {
      expect(migracao, `${a.valor} não está no check`).toContain(`'${a.valor}'`);
    }
  });

  it('só existem as ações para as quais há execução no motor', () => {
    const motor = readFileSync('src/lib/automacoes.ts', 'utf-8');
    for (const a of ACOES_DISPONIVEIS) {
      expect(motor, `${a.valor} não tem execução`).toContain(`regra.action_type === '${a.valor}'`);
    }
  });
});

describe('o disparo não pode derrubar a ação que o originou', () => {
  it('toda chamada do motor é solta com void, sem await', () => {
    // Aprovar um conteúdo tem que continuar funcionando com o e-mail fora do
    // ar. O `void` deixa isso explícito em vez de depender de o motor nunca
    // lançar.
    const chamadas = contexto.match(/dispararAutomacoes\(/g) || [];
    const soltas = contexto.match(/void dispararAutomacoes\(/g) || [];
    expect(soltas.length).toBe(chamadas.length);
  });
});
