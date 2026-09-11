import { describe, it, expect } from 'vitest';
import { descreverBuild } from '../src/components/common/VersaoDoApp';

/**
 * O rodapé responde "já subiu?" sem ambiguidade. Se ele mentir, é pior que
 * não existir: durante a caçada ao crash das rotas /api, saber qual build
 * estava servindo teria economizado um ciclo inteiro.
 *
 * **O fuso vai explícito em toda asserção**, e isso é correção de um defeito
 * do próprio teste. Antes ele escrevia `new Date('2026-09-09T09:13:00')` — que
 * o JS lê no fuso de quem está rodando — e conferia a saída formatada no mesmo
 * fuso. Os dois lados se cancelavam, então o teste passava em qualquer
 * máquina **sem nunca ter afirmado em que fuso o rodapé deveria estar**. Era
 * um teste que não testava o que mais importa aqui.
 */
describe('descrição da build', () => {
  const FUSO = 'America/Cuiaba'; // UTC−4 o ano inteiro
  // 13:30 em Cuiabá.
  const hoje = new Date('2026-09-09T17:30:00Z');

  it('mostra só a hora quando a build é de hoje', () => {
    // 09:13 em Cuiabá.
    expect(descreverBuild('2026-09-09T13:13:00Z', hoje, FUSO)).toBe('atualizado às 09h13');
  });

  // A hora sozinha engana: numa build de ontem, "9h13" parece recente.
  it('mostra a data quando a build não é de hoje', () => {
    expect(descreverBuild('2026-09-08T13:13:00Z', hoje, FUSO)).toBe(
      'atualizado em 08/09 às 09h13'
    );
  });

  it('distingue mesmo dia de mesmo dia em outro mês', () => {
    expect(descreverBuild('2026-08-09T13:13:00Z', hoje, FUSO)).toContain('09/08');
  });

  /**
   * O caso que o fuso resolve, e que o teste antigo não conseguia expressar:
   * o mesmo instante é "ontem à noite" num fuso e "hoje de madrugada" noutro.
   * Sem fuso fixo, o rodapé dizia uma coisa para quem estava em Cuiabá e
   * outra para quem estava em Lisboa, olhando a mesma build.
   */
  it('a virada do dia segue o fuso da agência, não o do aparelho', () => {
    const instante = '2026-09-10T02:50:00Z'; // 22:50 de 09/09 em Cuiabá, 03:50 de 10/09 em Lisboa
    const agora = new Date('2026-09-10T14:00:00Z'); // 10:00 de 10/09 em Cuiabá, 15:00 em Lisboa

    expect(descreverBuild(instante, agora, 'America/Cuiaba')).toBe(
      'atualizado em 09/09 às 22h50'
    );
    expect(descreverBuild(instante, agora, 'Europe/Lisbon')).toBe('atualizado às 03h50');
  });

  it('não quebra com valor inválido', () => {
    // Melhor dizer que não sabe do que renderizar "Invalid Date".
    expect(descreverBuild('não é uma data')).toBe('horário indisponível');
    expect(descreverBuild('')).toBe('horário indisponível');
  });
});
