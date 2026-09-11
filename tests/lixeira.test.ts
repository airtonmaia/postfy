import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { DIAS_NA_LIXEIRA, diasAteOExpurgo } from '../src/lib/lixeira';

/**
 * A tela promete o prazo que o servidor cumpre.
 *
 * O número existe em dois lugares: aqui, para a tela dizer "faltam N dias", e
 * em `api/expurgar-lixeira.ts`, que é quem realmente apaga. Eles não podem
 * divergir — mudar o cron para 3 dias e esquecer a tela faria o Admin
 * prometer uma semana enquanto a agência some na quarta-feira, e quem confiou
 * na tela não teria como saber.
 *
 * Nada disso quebra tipo, teste de componente ou build: são dois literais em
 * arquivos que nunca se importam. O `api/` nem entra no bundle do front.
 */
describe('prazo da lixeira de agências', () => {
  it('o prazo da tela é o mesmo que o expurgo usa', () => {
    const expurgo = readFileSync('api/expurgar-lixeira.ts', 'utf-8');
    const achado = expurgo.match(/const DIAS_NA_LIXEIRA = (\d+)/);

    expect(achado, 'api/expurgar-lixeira.ts não declara mais DIAS_NA_LIXEIRA').not.toBeNull();
    expect(Number(achado![1])).toBe(DIAS_NA_LIXEIRA);
  });

  it('conta os dias que faltam a partir de quando entrou na lixeira', () => {
    const diasAtras = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

    expect(diasAteOExpurgo(diasAtras(0))).toBe(DIAS_NA_LIXEIRA);
    expect(diasAteOExpurgo(diasAtras(6))).toBe(1);
  });

  it('nunca devolve dia negativo', () => {
    // Passado o prazo a linha ainda está lá até o cron rodar. "Faltam -2
    // dias" não informa nada; zero diz que é agora.
    const doisAtrasada = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    expect(diasAteOExpurgo(doisAtrasada)).toBe(0);
  });

  it('data inválida não vira NaN na tela', () => {
    expect(diasAteOExpurgo('nada disso')).toBe(DIAS_NA_LIXEIRA);
  });
});
