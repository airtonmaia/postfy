import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cobrança: o que promete precisa acontecer.
 *
 * A 2.16.0 anunciou "o teste grátis agora termina" e não terminava. Faltavam
 * as duas metades: `criar_agencia` não escrevia em `trial_ends_at` — nenhuma
 * agência da base tinha data —, e nada no app lia `acesso_da_agencia()` para
 * bloquear. A coluna existia no schema e parecia uma regra.
 *
 * É a armadilha 9 aplicada à cobrança, e ela não quebra tipo, teste de
 * componente nem build: é uma coluna que ninguém preenche e uma função que
 * ninguém chama. Tudo verde, promessa falsa.
 */

const RAIZ = join(__dirname, '..');
const MIGRACOES = join(RAIZ, 'supabase', 'migrations');

const sqlDeTodasAsMigracoes = (): string =>
  readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRACOES, f), 'utf-8'))
    .join('\n');

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('o teste grátis tem prazo, e alguém o lê', () => {
  it('criar_agencia escreve a data de fim do teste', () => {
    const sql = sqlDeTodasAsMigracoes();
    // A última definição da função é a que vale.
    const ultima = sql.lastIndexOf('function public.criar_agencia(');
    expect(ultima).toBeGreaterThan(-1);

    const corpo = sql.slice(ultima, sql.indexOf('$$;', ultima));
    expect(corpo, 'criar_agencia voltou a não definir trial_ends_at').toContain(
      'trial_ends_at'
    );
  });

  it('criar_agencia mantém o default do segundo parâmetro', () => {
    // O cadastro chama `criar_agencia(nome)` com um argumento só. Um
    // `create or replace` sem o `default null` é recusado pelo Postgres — e
    // se alguém contornar com `drop function`, o cadastro quebra em produção.
    const sql = sqlDeTodasAsMigracoes();
    const ultima = sql.lastIndexOf('function public.criar_agencia(');
    const assinatura = sql.slice(ultima, sql.indexOf(')', ultima));
    expect(assinatura.toLowerCase()).toContain('default null');
  });

  it('o app bloqueia de verdade quando o acesso acaba', () => {
    const app = semComentarios(readFileSync(join(RAIZ, 'src', 'App.tsx'), 'utf-8'));

    // Sem isto, `acesso_da_agencia()` seria uma consulta que ninguém usa e o
    // teste vencido não mudaria nada na tela.
    expect(app).toMatch(/acessoDaAgencia && !acessoDaAgencia\.liberado/);
    expect(app).toContain('AcessoBloqueado');
  });

  it('o bloqueio não dispara sem resposta do banco', () => {
    const app = semComentarios(readFileSync(join(RAIZ, 'src', 'App.tsx'), 'utf-8'));

    // `acessoDaAgencia` em null é "ainda não sei". Se o guard virar
    // `!acessoDaAgencia?.liberado`, uma falha de rede derruba a agência
    // inteira — e o sintoma seria indistinguível de cobrança funcionando.
    expect(app).not.toMatch(/!acessoDaAgencia\?\.liberado/);
  });

  it('o admin da plataforma e o portal ficam fora do bloqueio', () => {
    const app = semComentarios(readFileSync(join(RAIZ, 'src', 'App.tsx'), 'utf-8'));

    // A ordem é a regra: o dono do produto não pode perder o /admin por
    // causa de uma agência de teste dele, e o cliente que entra no portal
    // não decide nada sobre a cobrança da agência.
    const bloqueio = app.indexOf('acessoDaAgencia && !acessoDaAgencia.liberado');
    expect(app.indexOf('ehAbaDeAdmin(activeTab)')).toBeLessThan(bloqueio);
    expect(app.indexOf('if (isClientPortalOpen)')).toBeLessThan(bloqueio);
  });

  it('a assinatura não é escrita pelo navegador', () => {
    const sql = sqlDeTodasAsMigracoes();

    // `subscriptions` só tem política de SELECT. Uma de insert ou update
    // deixaria qualquer dono de agência se marcar como pagante.
    const politicas = [...sql.matchAll(/create policy "[^"]+"\s*\n\s*on public\.subscriptions for (\w+)/g)]
      .map((m) => m[1]);

    expect(politicas.length).toBeGreaterThan(0);
    expect(politicas.every((p) => p === 'select')).toBe(true);
  });
});
