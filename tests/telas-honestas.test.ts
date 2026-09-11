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

    // O MRR agora existe, mas **vem somado do banco** — nunca calculado aqui.
    // Era o cálculo local (`agências × R$ 197`) que dizia R$ 591,00 num dia
    // de R$ 0,00, e ele volta fácil: basta alguém multiplicar duas variáveis
    // que já estão em tela.
    expect(financeiro).not.toMatch(/const\s+mrr\s*=/);
    expect(financeiro).not.toMatch(/const\s+arr\s*=/);
    expect(financeiro).toMatch(/carregarNumerosDeCobranca/);

    // "100% adimplentes" era texto fixo. Contar inadimplentes agora é
    // legítimo — o que não pode voltar é a **taxa afirmada**, que ninguém
    // media. Por isso o que se proíbe é o número colado na palavra, não a
    // palavra (o rótulo do card é honesto).
    expect(financeiro).not.toMatch(/\d\s*%\s*(de\s+)?a?dimplent/i);

    // E continua dizendo o que falta, com o nome da variável — a convenção
    // do projeto para tela que depende de configuração externa.
    expect(financeiro).toMatch(/STRIPE_SECRET_KEY/);
    expect(financeiro).toMatch(/A cobrança ainda não está ligada/i);
  });

  it('nenhum botão promete uma ação que ele não faz', () => {
    // "Baixar NFS-e" no portal chamava `alert("Baixando comprovante...")` e
    // não baixava nada. O padrão é o mesmo de sempre: a tela afirmando uma
    // coisa que não aconteceu — só que aqui a pessoa fica esperando um
    // arquivo que nunca chega.
    const culpados = telas
      .filter(({ texto }) => /alert\(\s*[`'"][^`'"]*(Baixando|Enviando|Salvando|Gerando)/i.test(texto))
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('Configurações → Visão Geral não volta a ser decorativa', () => {
    const visao = semComentarios(
      readFileSync('src/components/settings/tabs/SettingsOverview.tsx', 'utf-8')
    );

    // Seis campos com `defaultValue`, nenhum controlado, e um botão
    // "Atualizar Perfil" sem `onClick`: quem digitava e clicava não salvava
    // nada e não via erro.
    expect(visao).not.toMatch(/defaultValue=/);

    // Dois dos valores eram literais iguais para toda conta.
    expect(visao).not.toMatch(/99999-9999/);
    expect(visao).not.toMatch(/01\/01\/2026/);
  });

  it('o Financeiro distingue "zero" de "ainda não apurei"', () => {
    const financeiro = semComentarios(
      readFileSync('src/components/admin/AdminFinanceiroView.tsx', 'utf-8')
    );

    // Numa tela financeira, mostrar R$ 0,00 enquanto a resposta não chegou é
    // inventar de novo — só que para baixo. O estado de carregamento tem que
    // ter um símbolo próprio.
    expect(financeiro).toMatch(/cobranca \? /);
    expect(financeiro).toContain("'—'");
  });

  it('a lista de agências não inventa plano nem contagem de usuários', () => {
    const agencias = semComentarios(
      readFileSync('src/components/admin/AdminAgenciasView.tsx', 'utf-8')
    );

    // "👑 Agência PRO" era texto fixo para toda agência sem a marca de
    // teste. Não existe assinatura no banco — o selo afirmava um plano pago
    // que ninguém contratou, na tela de onde se decide excluir a agência.
    expect(agencias).not.toMatch(/Agência PRO/);

    // E o número de usuários caía num literal `3` quando a contagem real
    // não vinha. Agora vem da RPC de admin, porque a RLS esconde os membros
    // das agências de que o admin não participa.
    expect(agencias).not.toMatch(/users\.length\s*:\s*3/);
    expect(agencias).toMatch(/carregarContagensPorAgencia/);
  });
});
