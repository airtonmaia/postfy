import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  deParedeParaUtc,
  deUtcParaParede,
  diaNoFuso,
  mesmoDiaNoFuso,
  definirFusoDaAgencia,
  fusoDaAgencia,
  ehFusoValido,
  cidadeDoFuso,
  FUSOS,
} from '../src/lib/fusoHorario';

/**
 * O horário que a pessoa digita é o horário em que o post sai.
 *
 * `workspaces.timezone` existia desde a primeira migração **sem ninguém ler**
 * — mesma classe do `trial_ends_at`. O que segurava era um acidente:
 * `datetime-local` interpreta no fuso do navegador e a exibição também, então
 * o round-trip fechava desde que fosse tudo no mesmo dispositivo.
 *
 * Os números abaixo são verificáveis à mão, e é de propósito: Cuiabá é UTC−4
 * o ano inteiro (o Brasil não tem horário de verão desde 2019), então 10:00
 * em Cuiabá é 14:00Z. Se alguém trocar a conta por uma constante de offset,
 * o teste de Lisboa — que muda duas vezes por ano — reprova.
 */

describe('parede ↔ UTC', () => {
  it('10:00 em Cuiabá é 14:00Z', () => {
    expect(deParedeParaUtc('2026-09-14T10:00', 'America/Cuiaba').toISOString()).toBe(
      '2026-09-14T14:00:00.000Z'
    );
  });

  it('10:00 em São Paulo é 13:00Z', () => {
    expect(deParedeParaUtc('2026-09-14T10:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-09-14T13:00:00.000Z'
    );
  });

  it('a volta devolve o que foi digitado', () => {
    for (const fuso of ['America/Cuiaba', 'America/Sao_Paulo', 'Europe/Lisbon', 'UTC']) {
      for (const parede of ['2026-09-14T10:00', '2026-01-02T23:45', '2026-06-30T00:00']) {
        expect(deUtcParaParede(deParedeParaUtc(parede, fuso), fuso), `${fuso} ${parede}`).toBe(
          parede
        );
      }
    }
  });

  // Offset fixo não cobre isto: Lisboa é GMT+0 no inverno e GMT+1 no verão.
  it('acompanha o horário de verão onde ele existe', () => {
    const inverno = deParedeParaUtc('2026-01-15T10:00', 'Europe/Lisbon').toISOString();
    const verao = deParedeParaUtc('2026-07-15T10:00', 'Europe/Lisbon').toISOString();

    expect(inverno).toBe('2026-01-15T10:00:00.000Z'); // GMT+0
    expect(verao).toBe('2026-07-15T09:00:00.000Z'); // GMT+1
  });

  it('texto inválido não vira data maluca', () => {
    expect(isNaN(deParedeParaUtc('', 'America/Cuiaba').getTime())).toBe(true);
    expect(deUtcParaParede('nada disso', 'America/Cuiaba')).toBe('');
  });
});

describe('o dia a que a data pertence', () => {
  /**
   * O caso que quebra o calendário: 21:00 em Cuiabá já é o dia seguinte em
   * UTC. Agrupar pelo dia errado faz o post aparecer na casinha errada, e o
   * sintoma parece bug de dados — ninguém procura fuso.
   */
  it('21:00 em Cuiabá ainda é o mesmo dia, mesmo sendo 01:00Z do seguinte', () => {
    const instante = '2026-09-15T01:00:00.000Z';
    expect(diaNoFuso(instante, 'America/Cuiaba')).toBe('2026-09-14');
    expect(diaNoFuso(instante, 'UTC')).toBe('2026-09-15');
  });

  it('mesmoDiaNoFuso segue o fuso, não o do dispositivo', () => {
    expect(
      mesmoDiaNoFuso('2026-09-14T23:00:00.000Z', '2026-09-15T01:00:00.000Z', 'America/Cuiaba')
    ).toBe(true);
  });
});

describe('o fuso guardado', () => {
  it('nome inválido cai no padrão em vez de derrubar a tela', () => {
    // Um fuso que o Intl não conhece estoura com RangeError, e levaria junto
    // toda tela que mostra data.
    definirFusoDaAgencia('Marte/Olympus');
    expect(fusoDaAgencia()).toBe('America/Sao_Paulo');
    expect(ehFusoValido('Marte/Olympus')).toBe(false);

    definirFusoDaAgencia('America/Cuiaba');
    expect(fusoDaAgencia()).toBe('America/Cuiaba');
  });

  it('nulo também', () => {
    definirFusoDaAgencia(null);
    expect(fusoDaAgencia()).toBe('America/Sao_Paulo');
  });
});

describe('a lista oferecida na tela', () => {
  it('tem Cuiabá pelo nome', () => {
    // A lista antiga só tinha Manaus, que é o mesmo UTC−4 — quem é de Mato
    // Grosso teria de descobrir isso sozinho. Fuso que a pessoa não acha pelo
    // nome da própria cidade é fuso configurado errado.
    expect(FUSOS.some((f) => f.valor === 'America/Cuiaba')).toBe(true);
    expect(cidadeDoFuso('America/Cuiaba')).toBe('Cuiabá');
  });

  it('todo fuso da lista é válido para o Intl', () => {
    for (const f of FUSOS) expect(ehFusoValido(f.valor), f.valor).toBe(true);
  });
});

/**
 * As guardas de regressão: os dois lugares por onde o fuso pode escapar.
 */
describe('ninguém escapa do fuso da agência', () => {
  const RAIZ = join(__dirname, '..', 'src');

  const arquivos = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
      const caminho = join(pasta, e.name);
      if (e.isDirectory()) return arquivos(caminho);
      return /\.tsx?$/.test(e.name) ? [caminho] : [];
    });

  it('os formatadores usam o fuso da agência por padrão', () => {
    const utils = readFileSync(join(RAIZ, 'lib', 'utils.ts'), 'utf-8');
    expect(utils).toMatch(/fusoDaAgencia/);
  });

  it('a tela de Preferências salva no banco antes de dizer que salvou', () => {
    // Ela fazia só `setSaved(true)` e mostrava "Preferências salvas com
    // sucesso!". Nenhuma chamada ao banco — a armadilha 9 na forma mais
    // direta: a afirmação do próprio sucesso.
    const tela = readFileSync(
      join(RAIZ, 'components', 'settings', 'tabs', 'SettingsPreferences.tsx'),
      'utf-8'
    );
    expect(tela).toMatch(/await atualizarWorkspace\(/);
    // E o `salvo` só pode vir depois do await, nunca antes.
    expect(tela.indexOf('await atualizarWorkspace(')).toBeLessThan(
      tela.indexOf('setSalvo(true)')
    );
  });

  it('o campo de agendamento converte nos dois sentidos', () => {
    // `datetime-local` sempre interpreta no fuso do navegador. Sem a
    // conversão, quem agenda de outro estado marca um horário e sai outro.
    const modal = readFileSync(
      join(RAIZ, 'components', 'modals', 'CreateJobModal.tsx'),
      'utf-8'
    );
    expect(modal).toMatch(/deParedeParaUtc/);
    expect(modal).toMatch(/deUtcParaParede/);
  });

  it('nenhuma tela formata data com toLocale* sem fuso', () => {
    // O caminho certo são os helpers de `utils.ts`, que já levam o fuso. Uma
    // chamada crua mostra o horário do dispositivo com cara de certo — e foi
    // assim que `JobDetailModal` ganhou uma cópia própria do formatador.
    const excecoes = [
      join(RAIZ, 'lib', 'utils.ts'), // é onde o fuso é aplicado
      join(RAIZ, 'lib', 'fusoHorario.ts'), // e onde ele é calculado
      join(RAIZ, 'components', 'modals', 'ChangelogModal.tsx'), // data fixa, em UTC de propósito
    ];

    for (const caminho of arquivos(RAIZ)) {
      if (excecoes.includes(caminho)) continue;

      // Depois de remover os comentários — mesma razão do `semComentarios` de
      // `telas-honestas` e `instagram`: o projeto registra nos comentários o
      // que deu errado, e aqui o registro cita `toLocaleTimeString()` pelo
      // nome. Sem a limpeza a guarda acusaria a memória do próprio bug, e a
      // saída seria apagar a explicação.
      //
      // As linhas viram vazias em vez de sumirem, para o número da linha no
      // erro continuar batendo com o arquivo.
      const fonte = readFileSync(caminho, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ''))
        .replace(/^\s*\/\/.*$/gm, '');

      // `toLocaleDateString` e `toLocaleTimeString` só existem em data. Já
      // `toLocaleString` também formata **número** — `total.toLocaleString('pt-BR')`
      // é separador de milhar, não tem fuso nenhum. Para esse, só acusa quando
      // a linha tem cara de data: uma opção de data/hora, ou um `Date` à vista.
      const DATA_CERTA = /toLocale(Date|Time)String\(/;
      const TALVEZ_DATA = /toLocaleString\(/;
      const OPCAO_DE_DATA = /dateStyle|timeStyle|\b(day|month|year|hour|minute|second|weekday)\s*:/;
      const TEM_DATA = /new Date\(|\bData\b|\bdata\b|At\b|Date\b/;

      for (const [i, linha] of fonte.split('\n').entries()) {
        if (/timeZone/.test(linha)) continue;

        const suspeita =
          DATA_CERTA.test(linha) ||
          (TALVEZ_DATA.test(linha) && (OPCAO_DE_DATA.test(linha) || TEM_DATA.test(linha)));
        if (!suspeita) continue;

        // Moeda é número, e número não tem fuso.
        if (/style:\s*'currency'|currency:/.test(linha)) continue;

        expect.fail(
          `${caminho.replace(RAIZ, 'src')}:${i + 1} formata data sem fuso — ` +
            `use safeDateFormat/safeDateTimeFormat, que já levam o da agência\n  ${linha.trim()}`
        );
      }
    }
  });
});
