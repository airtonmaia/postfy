import { describe, it, expect } from 'vitest';
import { descreverBuild } from '../src/components/common/VersaoDoApp';

/**
 * O rodapé responde "já subiu?" sem ambiguidade. Se ele mentir, é pior que
 * não existir: durante a caçada ao crash das rotas /api, saber qual build
 * estava servindo teria economizado um ciclo inteiro.
 */
describe('descrição da build', () => {
  const hoje = new Date('2026-09-09T13:30:00');

  it('mostra só a hora quando a build é de hoje', () => {
    const build = new Date('2026-09-09T09:13:00');
    expect(descreverBuild(build.toISOString(), hoje)).toBe('atualizado às 09h13');
  });

  // A hora sozinha engana: numa build de ontem, "9h13" parece recente.
  it('mostra a data quando a build não é de hoje', () => {
    const build = new Date('2026-09-08T09:13:00');
    expect(descreverBuild(build.toISOString(), hoje)).toBe('atualizado em 08/09 às 09h13');
  });

  it('distingue mesmo dia de mesmo dia em outro mês', () => {
    const build = new Date('2026-08-09T09:13:00');
    expect(descreverBuild(build.toISOString(), hoje)).toContain('09/08');
  });

  it('não quebra com valor inválido', () => {
    // Melhor dizer que não sabe do que renderizar "Invalid Date".
    expect(descreverBuild('não é uma data')).toBe('horário indisponível');
    expect(descreverBuild('')).toBe('horário indisponível');
  });
});
