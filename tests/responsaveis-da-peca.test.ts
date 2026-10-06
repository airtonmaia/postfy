import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import { dataJaPassou, avisosDosCanais } from '../src/lib/avisosDaPeca';

/**
 * Quem da equipe toca a peça, e os avisos que agora vêm antes do clique.
 *
 * O campo "Responsável" da modal mostrava `currentUser.name` — quem está
 * **olhando** a tela, não quem fez a peça. Numa agência de quatro pessoas,
 * cada uma abria a mesma peça e lia o próprio nome, e aquilo passava por
 * informação porque tinha cara de campo. `designerId`, `copywriterId` e
 * `socialMediaId` estavam no schema desde a primeira migração com ninguém
 * escrevendo neles: a família do `trial_ends_at`, com um rótulo em cima.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

describe('a coluna nova não vaza para o portal do cliente', () => {
  /**
   * **Coluna nova em `jobs` nasce visível no portal**, e esta é a armadilha
   * 10 deste projeto: `portal_dados` responde com `to_jsonb(j)`, a linha
   * inteira. Foi assim que `draft`, as horas lançadas e a estratégia de
   * campanha foram parar no navegador do cliente sem ninguém ter decidido.
   *
   * `responsaveis` é exatamente a categoria que já saía dali — quem da equipe
   * fez a peça, ao lado de `designer_id` e companhia.
   *
   * A guarda lê a **última** definição da função pelo nome do arquivo:
   * `portal_dados` é redefinida por `create or replace` em várias migrações, e
   * ler a primeira afirmaria o recorte de uma versão que o banco já não tem.
   */
  const ultima = () => {
    const dir = join(RAIZ, 'supabase', 'migrations');
    const arquivo = readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .reverse()
      .find((n) =>
        semComentarios(readFileSync(join(dir, n), 'utf-8')).includes(
          'create or replace function public.portal_dados'
        )
      );
    expect(arquivo, 'nenhuma migração define portal_dados').toBeTruthy();
    return semComentarios(readFileSync(join(dir, arquivo!), 'utf-8'));
  };

  it('a última definição subtrai responsaveis junto do resto do interno', () => {
    const sql = ultima();
    const corpo = sql.slice(sql.indexOf('create or replace function public.portal_dados'));

    for (const chave of [
      'responsaveis',
      'draft',
      'timesheet_minutes',
      'designer_id',
      'copywriter_id',
      'social_media_id',
    ]) {
      expect(
        corpo,
        `"${chave}" deixou de ser subtraído: ele vai para o navegador do cliente`
      ).toMatch(new RegExp(`- '${chave}'`));
    }
  });

  it('a coluna é criada de forma repetível', () => {
    /*
      O banco é compartilhado e é o de produção: a outra máquina pode aplicar
      de novo sem saber que já foi.
    */
    const dir = join(RAIZ, 'supabase', 'migrations');
    const arquivo = readdirSync(dir).find((n) => n.includes('responsaveis_da_peca'));
    expect(arquivo, 'a migração dos responsáveis sumiu').toBeTruthy();

    const sql = semComentarios(readFileSync(join(dir, arquivo!), 'utf-8')).toLowerCase();
    expect(sql).toMatch(/add column if not exists responsaveis/);
  });
});

describe('o campo que mentia saiu', () => {
  const modal = ler('src', 'components', 'modals', 'JobDetailModal.tsx');
  const formulario = ler('src', 'components', 'jobs', 'FormularioDoConteudo.tsx');

  it('a modal não rotula mais quem está olhando como responsável', () => {
    /*
      A guarda mede o **efeito**: nenhum rótulo "Responsável" ao lado de
      `currentUser` na modal. Procurar a string antiga inteira aprovaria
      qualquer reescrita com a mesma mentira.
    */
    const i = modal.indexOf('Responsável');
    if (i >= 0) {
      expect(
        modal.slice(i, i + 200),
        'o rótulo "Responsável" voltou a mostrar quem está olhando a tela'
      ).not.toMatch(/currentUser/);
    }
  });

  it('quem responde agora é um campo gravado, no formulário das duas telas', () => {
    expect(formulario, 'o seletor de responsáveis sumiu do formulário').toMatch(
      /<ResponsaveisDaPeca/
    );
    expect(formulario, 'o campo saiu de DadosDoConteudo e deixaria de ser gravado').toMatch(
      /responsaveis: string\[\]/
    );
  });
});

describe('os avisos vêm antes do clique', () => {
  it('"já passou" é comparação de instante, e vazio não acusa nada', () => {
    const agora = new Date('2026-10-06T12:00:00.000Z');

    expect(dataJaPassou('2026-10-05T12:00:00.000Z', agora)).toBe(true);
    expect(dataJaPassou('2026-10-07T12:00:00.000Z', agora)).toBe(false);

    /*
      Sem data é um estado legítimo — peça aprovada antes de alguém marcar
      quando ela sai. Acusar atraso ali seria inventar um prazo que ninguém
      combinou, que é a regra de `post_metrics` aplicada ao tempo.
    */
    expect(dataJaPassou('', agora)).toBe(false);
    expect(dataJaPassou(undefined, agora)).toBe(false);
    expect(dataJaPassou('não é data', agora)).toBe(false);
  });

  it('o canal sem conta conectada é nomeado, e o que publica sozinho também', () => {
    /*
      Este aviso saía de `textoDoAgendamento` — ou seja, **depois** de a peça
      já estar na fila. A tela oferecia "Agendar publicação", a peça entrava
      como agendada, e no dia ninguém publicava.
    */
    const semConta = avisosDosCanais(['instagram'], []);
    expect(semConta[0].automatico, 'sem conta conectada o disparo não é automático').toBe(false);
    expect(semConta[0].texto).toMatch(/não conectado/);

    const comConta = avisosDosCanais(['instagram'], ['instagram']);
    expect(comConta[0].automatico).toBe(true);

    /*
      Rede que o produto não dispara nunca é automática, **mesmo com conta
      conectada**: é o LinkedIn, o TikTok e o X. Tratá-los pela conta faria a
      tela prometer um disparo que `REDES_QUE_PUBLICAM` não honra.
    */
    const manual = avisosDosCanais(['linkedin'], ['linkedin']);
    expect(manual[0].automatico, 'uma rede que não publica sozinha virou automática').toBe(false);
  });
});
