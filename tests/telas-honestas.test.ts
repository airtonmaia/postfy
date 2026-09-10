import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nenhuma tela afirma o que não mediu.
 *
 * O Financeiro do SaaS calculava `MRR = agências × R$ 197` — contando toda
 * agência criada, inclusive as em teste —, projetava o ARR em cima disso, e
 * trazia "100% adimplentes", "+18,4% este mês" e "Ticket Médio R$ 197,00"
 * como texto fixo. Embaixo, quatro "transações" de agências que nunca
 * existiram: Vanguarda Social, Pixel Mídia, Creative Hub.
 *
 * No dia em que isso foi encontrado a realidade era três agências, todas em
 * teste, R$ 0,00 de receita. A tela dizia R$ 591,00.
 *
 * Nada disso quebra tipo, teste ou build: é string. E numa tela financeira o
 * custo não é a tela feia — é a decisão tomada em cima do número.
 */
const varrer = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return varrer(caminho);
    return /\.tsx$/.test(caminho) ? [caminho] : [];
  });

/**
 * Comentário não é tela.
 *
 * O projeto registra nos comentários o que deu errado antes — inclusive os
 * nomes das agências inventadas e os números que a tela afirmava. Sem tirar
 * os comentários, a guarda acusaria justamente a explicação do bug que ela
 * existe para impedir, e a saída seria apagar a memória do bug.
 */
const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const telas = varrer('src/components').map((arquivo) => ({
  arquivo,
  texto: semComentarios(readFileSync(arquivo, 'utf-8')),
}));

describe('telas não inventam dado', () => {
  it('nenhuma agência fictícia aparece como dado', () => {
    // No placeholder de um campo elas são exemplo, e isso é honesto. Como
    // linha de tabela, viram fato.
    const culpados = telas
      .filter(({ texto }) =>
        /(Vanguarda Social|Pixel M[íi]dia|Creative Hub)/.test(
          texto.replace(/placeholder="[^"]*"/g, '')
        )
      )
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('nenhuma tela afirma variação percentual fixa', () => {
    // "+18.4% este mês" não veio de lugar nenhum.
    const culpados = telas
      .filter(({ texto }) => /[+-][0-9]+[.,][0-9]+%\s*(este|neste|no)\s/.test(texto))
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('o Financeiro do SaaS não estima receita', () => {
    const financeiro = semComentarios(
      readFileSync('src/components/admin/AdminFinanceiroView.tsx', 'utf-8')
    );

    // Não há assinatura nem cobrança no banco: qualquer MRR aqui é chute.
    expect(financeiro).not.toMatch(/const\s+mrr\s*=/);
    expect(financeiro).not.toMatch(/const\s+arr\s*=/);
    expect(financeiro).not.toMatch(/adimplentes/);

    // E diz o que falta, com nome — a convenção do projeto para tela que
    // depende de algo que ainda não existe.
    expect(financeiro).toMatch(/não há cobrança ligada ao produto/i);
  });
});
