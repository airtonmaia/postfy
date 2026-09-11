import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { REDES_DA_META } from '../src/lib/redes';

/**
 * A agência e o cliente olham para o mesmo conteúdo por duas portas.
 *
 * A ficha do cliente (`ClientDetail`) e o portal (`ClientPortalView`) listam
 * as mesmas coisas — arquivos, senhas, notas, briefing — e chamavam cada uma
 * por um nome diferente: "Cofre de Senhas" de um lado, "Senhas" do outro;
 * "Arquivos & Drive" contra "Arquivos".
 *
 * Isso não quebra tela nenhuma, que é o motivo desta guarda existir. O atrito
 * aparece na conversa: a agência diz "está no Cofre de Senhas" e o cliente
 * responde que ali só tem "Senhas". Divergir de novo é fácil — as duas listas
 * moram em arquivos diferentes e ninguém abre os dois juntos.
 */

const FICHA = 'src/components/clients/ClientDetail.tsx';
const PORTAL = 'src/components/portal/ClientPortalView.tsx';

/** Extrai `id -> rótulo` de uma lista de abas, seja `label:` ou `rotulo:`. */
const abasDe = (caminho: string, chaveDoRotulo: string): Map<string, string> => {
  const fonte = readFileSync(caminho, 'utf8');
  const encontradas = new Map<string, string>();

  const padrao = new RegExp(
    `id:\\s*'([^']+)'\\s*,\\s*${chaveDoRotulo}:\\s*'([^']+)'`,
    'g'
  );

  for (const [, id, rotulo] of fonte.matchAll(padrao)) {
    encontradas.set(id, rotulo);
  }
  return encontradas;
};

describe('a ficha do cliente e o portal falam a mesma língua', () => {
  const ficha = abasDe(FICHA, 'label');
  const portal = abasDe(PORTAL, 'rotulo');

  it('as duas listas foram encontradas', () => {
    // Se o formato da lista mudar, esta guarda passaria a comparar dois
    // conjuntos vazios e ficaria verde sem conferir nada.
    expect(ficha.size, 'abas da ficha').toBeGreaterThan(3);
    expect(portal.size, 'abas do portal').toBeGreaterThan(3);
  });

  it('aba com o mesmo id tem o mesmo rótulo nos dois lados', () => {
    const divergentes: string[] = [];

    for (const [id, rotuloDaFicha] of ficha) {
      const rotuloDoPortal = portal.get(id);
      if (rotuloDoPortal && rotuloDoPortal !== rotuloDaFicha) {
        divergentes.push(`${id}: ficha diz "${rotuloDaFicha}", portal diz "${rotuloDoPortal}"`);
      }
    }

    expect(divergentes, divergentes.join(' | ')).toEqual([]);
  });

  it('os quatro compartilhados existem dos dois lados', () => {
    // Cadastro e Conexões só existem na ficha (são da agência); Aprovações,
    // Cronograma e Fotos e Materiais só no portal. O que sobra é comum, e é
    // justamente onde os nomes divergiam.
    for (const id of ['arquivos', 'senhas', 'notas', 'briefing']) {
      expect(ficha.has(id), `ficha sem ${id}`).toBe(true);
      expect(portal.has(id), `portal sem ${id}`).toBe(true);
    }
  });
});

describe('conexões do perfil: só o que conecta de verdade', () => {
  /**
   * A aba lista as quatro redes da Meta, e só o Instagram conecta. Marcar
   * outra como disponível sem escrever o fluxo daria um botão que abre, pede
   * a senha e falha depois — que é pior que botão ausente, e foi exatamente
   * o custo de ter escolhido o fluxo errado do Instagram uma vez.
   */
  it('só o Instagram está disponível, porque só ele tem OAuth escrito', () => {
    const disponiveis = REDES_DA_META.filter((r) => r.disponivel).map((r) => r.id);
    expect(disponiveis).toEqual(['instagram']);
  });

  it('toda rede indisponível diz o que falta, com nome', () => {
    for (const rede of REDES_DA_META.filter((r) => !r.disponivel)) {
      expect(rede.pendencia, `${rede.id} sem pendência escrita`).toBeTruthy();

      // "Em breve" não é resposta: não há data, e prometer prazo que ninguém
      // assumiu é a mesma mentira com outra roupa. É a regra do COMO_PUBLICA.
      expect(rede.pendencia!.toLowerCase(), rede.id).not.toContain('em breve');
      expect(rede.pendencia!.toLowerCase(), rede.id).not.toContain('em desenvolvimento');
    }
  });

  it('a tela não oferece botão de conectar para rede indisponível', () => {
    const tela = readFileSync('src/components/clients/ConexoesDoPerfil.tsx', 'utf8');

    // O botão só existe dentro do ramo `rede.disponivel`. Um botão desligado
    // ainda é clicado, e faz a pessoa desconfiar dos que funcionam.
    expect(tela).toMatch(/rede\.disponivel \?/);
    expect(tela).not.toMatch(/disabled=\{!rede\.disponivel\}/);
  });
});
