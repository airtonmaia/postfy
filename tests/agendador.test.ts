import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Quem agenda a publicação, e quantos agendam.
 *
 * O agendamento mudou de casa: saiu do `schedule` do GitHub Actions, que
 * rodou **15 vezes em 52,6 horas** quando o cron pedia 631, e passou para o
 * `pg_cron`, dentro do Postgres.
 *
 * As três guardas abaixo protegem invariantes que **não quebram nada visível
 * quando violadas** — que é o motivo de elas existirem. Um segundo agendador
 * não dá erro: ele publica, e esconde que o primeiro morreu. Um segredo numa
 * migração não dá erro: ele só vai para o git e fica lá.
 */

const WORKFLOW = '.github/workflows/publicar.yml';
const MIGRACOES = 'supabase/migrations';

const migracaoDoAgendador = (): string => {
  const arquivo = readdirSync(MIGRACOES).find((f) =>
    f.includes('agendador_no_banco')
  );
  if (!arquivo) throw new Error('migração do agendador não encontrada');
  return readFileSync(`${MIGRACOES}/${arquivo}`, 'utf8');
};

describe('um agendador só', () => {
  /**
   * Deixar o workflow agendado "como reserva" pareceria prudente e é o
   * contrário: os dois esconderiam a morte um do outro, e ninguém notaria o
   * `pg_cron` parado enquanto posts saíssem horas atrasados. Com um só, a
   * parada aparece na fila da tela de Publicações.
   */
  it('o workflow do GitHub não agenda mais nada', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // Só as linhas de verdade: o porquê da remoção está nos comentários, e
    // sem esta limpeza a guarda acusaria a própria memória da decisão.
    const semComentarios = yml
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('#'))
      .join('\n');

    expect(semComentarios).not.toMatch(/^\s*schedule:/m);
    expect(semComentarios).not.toMatch(/cron:/);
  });

  it('o disparo manual continua — é como se testa sem esperar o ciclo', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');
    expect(yml).toMatch(/workflow_dispatch:/);
  });

  /**
   * `vercel.json` com `crons` derruba o deploy inteiro em conta Hobby, que
   * só aceita cron diário — e o CI fica verde, porque nada local lê esse
   * arquivo (armadilha 6).
   */
  it('o vercel.json continua sem cron', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.crons).toBeUndefined();
  });

  it('o pg_cron agenda a cada 5 minutos, e só uma vez', () => {
    const sql = migracaoDoAgendador();

    expect(sql).toMatch(/cron\.schedule\(/);
    expect(sql).toMatch(/'\*\/5 \* \* \* \*'/);

    // Um `schedule` só. Dois com o mesmo nome duplicam em algumas versões do
    // pg_cron em vez de substituir.
    expect(sql.match(/cron\.schedule\(/g)?.length).toBe(1);

    // E ele precisa remover o anterior: aplicar a migração de novo — que o
    // banco compartilhado torna provável — não pode deixar dois agendamentos.
    expect(sql).toMatch(/cron\.unschedule\(/);
  });
});

describe('o segredo não entra no git', () => {
  /**
   * O projeto já carrega uma pendência exatamente assim: uma senha em dois
   * commits antigos, que só sai reescrevendo a branch. Migração é arquivo
   * versionado como qualquer outro.
   */
  it('a migração lê o segredo do Vault em vez de embutir', () => {
    const sql = migracaoDoAgendador();

    expect(sql).toMatch(/vault\.decrypted_secrets/);
    expect(sql).toMatch(/'cron_secret'/);
  });

  /**
   * Guarda bruta de propósito, como a de `telas-honestas`: ela acusa
   * `create_secret(` em qualquer lugar que não seja comentário, inclusive
   * dentro de uma mensagem de erro. O falso positivo custa reescrever uma
   * frase; o falso negativo custa um segredo no histórico do git, que só sai
   * reescrevendo a branch.
   */
  it('nenhuma migração cria segredo com valor literal', () => {
    for (const arquivo of readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql'))) {
      const sql = readFileSync(`${MIGRACOES}/${arquivo}`, 'utf8');

      // O porquê de o segredo ficar fora está escrito nos comentários, e o
      // exemplo de uso do `create_secret` mora lá — por isso a varredura
      // acontece depois de removê-los.
      const semComentarios = sql
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n');

      expect(
        semComentarios,
        `${arquivo} chama create_secret fora de comentário`
      ).not.toMatch(/create_secret\s*\(/i);
    }
  });
});

/**
 * O disparo em si — e é aqui que ele falhou de verdade.
 *
 * `extensions.net.http_get(...)` não é schema errado: é nome de três partes,
 * que o Postgres lê como *banco*.*schema*.*função* e recusa com
 * `0A000: cross-database references are not implemented`. O pg_net fixa o
 * schema `net` no próprio control file — `with schema extensions` registra a
 * extensão, não move as funções.
 *
 * O veneno é o momento em que isso aparece. **A migração aplica limpa**:
 * PL/pgSQL só resolve nome na execução, então `create or replace function`
 * aceita o corpo sem conferir nada e o `cron.schedule` grava. A falha chega na
 * primeira passada, como uma linha em `cron.job_run_details` que ninguém abre
 * — nada publica, a fila enche de `pendente`, e não há erro em lugar nenhum.
 * Exatamente o sintoma que o `pg_cron` veio resolver.
 */
describe('o disparo chama a função onde ela mora', () => {
  it('usa net.http_get, e não um nome de três partes', () => {
    const sql = migracaoDoAgendador();

    expect(sql).toMatch(/perform\s+net\.http_get\(/);
    // `net` tem que estar no search_path: a função é `security definer` com
    // caminho fixo, então o schema não entra por herança da sessão.
    expect(sql).toMatch(/set search_path = [^\n]*\bnet\b/);
  });

  it('nenhuma migração usa extensions.net.x', () => {
    for (const arquivo of readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql'))) {
      // Depois de remover os comentários: o porquê da correção está escrito
      // neles, e sem a limpeza a guarda acusaria a memória do próprio bug.
      const semComentarios = readFileSync(`${MIGRACOES}/${arquivo}`, 'utf8')
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n');

      expect(
        semComentarios,
        `${arquivo}: extensions.net.x é lido como banco.schema.função e só falha ao executar`
      ).not.toMatch(/\bextensions\.net\./);
    }
  });
});
