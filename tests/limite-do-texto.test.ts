import { describe, it, expect } from 'vitest';

import {
  CAMPOS_POR_CANAL,
  LIMITE_DO_CANAL,
  limiteMaisApertado,
} from '../src/lib/camposDoCanal';
import { TIPOS_DE_JOB, definicaoDoTipo } from '../src/lib/tiposDeJob';
import type { JobPlatform } from '../src/types';

/**
 * O contador de caracteres afirma um limite, e afirmação em tela é a
 * armadilha 9.
 *
 * O número que aparece decide o que a pessoa escreve: dizer 2.200 com o X
 * marcado junto faria escrever 2.199 caracteres que não publicam, e o erro
 * só apareceria depois de o cliente ter aprovado o texto. Estas guardas
 * existem porque nada disso quebra visivelmente quando erra — a tela segue
 * mostrando um número, só que o errado.
 */

const CANAIS = Object.keys(LIMITE_DO_CANAL) as JobPlatform[];

describe('limite do texto por rede', () => {
  it('toda rede que mostra a barra tem limite publicado', () => {
    for (const canal of CANAIS) {
      const temBarra = (CAMPOS_POR_CANAL[canal] || []).some((c) => c.barra);
      if (!temBarra) continue;

      expect(LIMITE_DO_CANAL[canal], `${canal} sem limite`).toBeGreaterThan(0);
    }
  });

  it('todo campo com barra é o texto principal, e mora em coluna própria', () => {
    for (const canal of CANAIS) {
      const comBarra = (CAMPOS_POR_CANAL[canal] || []).filter((c) => c.barra);

      // Mais de uma barra na mesma tela daria dois botões de IA competindo
      // pelo mesmo lugar, e nenhum deles diria qual campo vai preencher.
      expect(comBarra.length, `${canal} tem ${comBarra.length} campos com barra`)
        .toBeLessThanOrEqual(1);

      for (const campo of comBarra) {
        expect(campo.chave, `${canal}`).toBe('caption');
        expect(campo.destino, `${canal}`).toBe('job');
        expect(campo.tipo, `${canal}`).toBe('textoLongo');
      }
    }
  });

  it('o limite de várias redes é o da mais apertada, e ela é nomeada', () => {
    expect(limiteMaisApertado(['instagram'])).toEqual({
      limite: 2200,
      canal: 'instagram',
    });

    // O X é sempre o teto quando está na lista: é o menor de todos.
    expect(limiteMaisApertado(['instagram', 'twitter'])).toEqual({
      limite: 280,
      canal: 'twitter',
    });
    expect(limiteMaisApertado(['twitter', 'facebook', 'linkedin'])).toEqual({
      limite: 280,
      canal: 'twitter',
    });

    expect(limiteMaisApertado(['facebook', 'linkedin'])).toEqual({
      limite: 3000,
      canal: 'linkedin',
    });
  });

  it('sem canal não há limite para afirmar', () => {
    expect(limiteMaisApertado([])).toBeNull();
  });

  it('a ordem dos canais não muda o resultado', () => {
    const direto = limiteMaisApertado(['instagram', 'twitter', 'youtube']);
    const invertido = limiteMaisApertado(['youtube', 'twitter', 'instagram']);
    expect(direto).toEqual(invertido);
  });
});

describe('roteiro não recebe limite de rede', () => {
  /**
   * Roteiro é documento de gravação, não texto de post. Um teto ali faria
   * alguém encurtar direção de cena para caber num número que não mede nada
   * — e a rede nunca vai ver esse texto.
   */
  it('só conteúdo e copy respeitam o limite', () => {
    expect(definicaoDoTipo('conteudo').respeitaLimiteDaRede).toBe(true);
    expect(definicaoDoTipo('copy').respeitaLimiteDaRede).toBe(true);
    expect(definicaoDoTipo('roteiro').respeitaLimiteDaRede).toBe(false);
  });

  it('todo tipo declara se respeita ou não — nenhum fica no escuro', () => {
    for (const tipo of TIPOS_DE_JOB) {
      expect(typeof tipo.respeitaLimiteDaRede, tipo.valor).toBe('boolean');
    }
  });
});
