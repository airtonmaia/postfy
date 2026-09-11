import { describe, it, expect } from 'vitest';

import {
  CAMPOS_POR_CANAL,
  LIMITE_DE_HASHTAGS,
  LIMITE_DO_CANAL,
  contarHashtags,
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

describe('acessórios atrás de ícone', () => {
  const ICONES_QUE_A_TELA_DESENHA = ['localizacao', 'comentario', 'marcacao'];

  /**
   * A regra do projeto: ícone sozinho tem tooltip.
   *
   * Sem rótulo a pessoa descobre clicando, o que num formulário significa
   * abrir três modais até achar o certo. A guarda existe para o quarto ícone
   * não nascer sem — nada quebra quando ele nasce, ele só fica mudo.
   */
  it('todo atalho tem dica para o tooltip', () => {
    for (const campos of Object.values(CAMPOS_POR_CANAL)) {
      for (const campo of campos.filter((c) => c.atalho)) {
        expect(campo.atalho!.dica.trim(), campo.chave).not.toBe('');
      }
    }
  });

  it('todo ícone de atalho é um que a tela sabe desenhar', () => {
    for (const campos of Object.values(CAMPOS_POR_CANAL)) {
      for (const campo of campos.filter((c) => c.atalho)) {
        expect(ICONES_QUE_A_TELA_DESENHA, campo.chave).toContain(
          campo.atalho!.icone
        );
      }
    }
  });

  it('acessório nunca é o texto principal', () => {
    // Os dois juntos poriam a fileira de ícones dentro do próprio campo que
    // ela abre, e o campo sumiria do formulário sem nada no lugar.
    for (const campos of Object.values(CAMPOS_POR_CANAL)) {
      for (const campo of campos.filter((c) => c.atalho)) {
        expect(campo.barra, campo.chave).toBeFalsy();
      }
    }
  });
});

describe('hashtags somam entre legenda e primeiro comentário', () => {
  /**
   * É assim que o Instagram conta. Passar as hashtags para o comentário
   * limpa a legenda e não aumenta o teto — quem não sabe divide 40 entre os
   * dois campos achando que resolveu.
   */
  it('soma os dois campos', () => {
    expect(contarHashtags('#a #b', '#c')).toBe(3);
  });

  it('a mesma hashtag nos dois campos conta uma vez', () => {
    expect(contarHashtags('#marketing', '#marketing')).toBe(1);
    expect(contarHashtags('#Marketing', '#marketing')).toBe(1);
  });

  it('acento e número entram; pontuação encerra a hashtag', () => {
    expect(contarHashtags('#promoção #ano2026')).toBe(2);
    expect(contarHashtags('#fim, #outra.')).toBe(2);
  });

  it('campo vazio ou ausente não conta nada', () => {
    expect(contarHashtags('', undefined)).toBe(0);
    expect(contarHashtags('texto sem hashtag')).toBe(0);
  });

  it('só entra rede cujo teto foi conferido', () => {
    expect(LIMITE_DE_HASHTAGS.instagram).toBe(30);

    // Inventar número para as outras seria a armadilha 9 num contador: a tela
    // diria "12 de 30" numa rede que não tem esse teto.
    for (const [canal, teto] of Object.entries(LIMITE_DE_HASHTAGS)) {
      expect(teto, canal).toBeGreaterThan(0);
    }
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
