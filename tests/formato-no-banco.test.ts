import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import { ultimoCheck, valoresAceitos } from './util/checkDoBanco';

/**
 * O que a tela oferece, o banco aceita.
 *
 * A 2.53.0 acrescentou o formato "Feed + Story" a `FORMATOS_POR_CANAL` — com a
 * coluna `story_media_urls`, o publicador do story e a prévia — e **não**
 * acrescentou o valor ao `check` de `jobs.format`. O insert passou a ser
 * recusado com `23514`, e como a persistência é derivada de diff e roda em
 * segundo plano, **ninguém via o erro**: a tela mostrava o card, o F5 o
 * apagava, e o relato que chegou foi "não está cadastrando".
 *
 * Quatro dias com `tsc`, vitest e `vite build` verdes e o produto perdendo
 * conteúdo. É a armadilha 0: nenhuma ferramenta local conhece o `check` do
 * Postgres.
 *
 * **Lista de valores na tela e `check` no banco são a mesma decisão escrita em
 * dois lugares**, e divergir não quebra nada até alguém escolher o valor novo.
 * Por isso esta guarda **deriva** as duas listas do código e as compara — uma
 * lista literal aqui teria de ser editada junto com o schema, e editar a
 * guarda junto com o código é como ela deixa de guardar.
 */

const RAIZ = join(__dirname, '..');

/*
  O recorte do `check` mora em `tests/util/checkDoBanco.ts`. Ele saiu daqui
  quando a guarda dos avisos do portal passou a precisar da mesma resposta
  para `email_queue.evento` e `notifications.type` — e o histórico de três
  versões erradas do recorte está registrado lá, junto do código que erra.
*/

describe('jobs.format: a tela e o banco falam a mesma língua', () => {
  const check = ultimoCheck('jobs', 'format');
  const aceitos = valoresAceitos(check);

  it('a guarda encontrou o check — senão ela não guarda nada', () => {
    /**
     * Uma varredura que não acha nada passa calada, e é assim que uma guarda
     * deixa de ser guarda. Este projeto já teve uma que fatiava a partir de
     * uma string ausente, media o arquivo inteiro e **passava** afirmando
     * sobre o lugar errado.
     */
    expect(check, 'nenhuma migração define o check de jobs.format').not.toBe('');
    expect(aceitos.size, 'o check foi encontrado mas sem valor nenhum dentro').toBeGreaterThan(3);
  });

  it('todo formato de FORMATOS_POR_CANAL é aceito pelo banco', () => {
    const fonte = semComentarios(readFileSync(join(RAIZ, 'src', 'lib', 'formatos.ts'), 'utf-8'));
    const daTela = [...fonte.matchAll(/valor:\s*'([a-z_]+)'/g)].map((m) => m[1]);

    expect(daTela.length, 'a tabela de formatos ficou sem nenhum valor').toBeGreaterThan(5);

    for (const formato of new Set(daTela)) {
      expect(
        aceitos.has(formato),
        `a tela oferece o formato "${formato}" e o check de jobs.format o recusa — ` +
          'o insert falha com 23514 dentro da fila de gravação, sem erro na tela'
      ).toBe(true);
    }
  });

  it('todo valor de JobFormat é aceito pelo banco', () => {
    /**
     * A união do tipo é a lista mais ampla: um formato pode existir em
     * `JobFormat` e ainda não estar oferecido em nenhuma rede — e é exatamente
     * essa a janela em que o valor chega ao banco por outro caminho (edição,
     * duplicação, migração de dado) e é recusado.
     */
    const tipos = semComentarios(readFileSync(join(RAIZ, 'src', 'types', 'index.ts'), 'utf-8'));
    const inicio = tipos.indexOf('export type JobFormat');
    const corpo = tipos.slice(inicio, tipos.indexOf(';', inicio));
    const doTipo = [...corpo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

    expect(doTipo.length, 'JobFormat ficou sem valores').toBeGreaterThan(5);

    for (const formato of new Set(doTipo)) {
      expect(
        aceitos.has(formato),
        `JobFormat tem "${formato}" e o check de jobs.format o recusa`
      ).toBe(true);
    }
  });

  it('o check continua fechado: não virou "qualquer texto"', () => {
    // Largar o `check` resolveria o sintoma e perderia o que ele protege: um
    // formato digitado errado passaria a ser gravado, e só a prévia (ou a
    // publicação) revelaria, tarde.
    expect(aceitos.has('feed'), 'o check de formato deixou de listar valores').toBe(true);
  });
});

describe('as outras listas fechadas de jobs', () => {
  /**
   * O formato foi o que quebrou, mas a classe do bug é de toda coluna com
   * `check` alimentada por uma lista do cliente. Estas três nunca divergiram —
   * e é para continuarem assim que estão aqui.
   */
  const tipos = semComentarios(readFileSync(join(RAIZ, 'src', 'types', 'index.ts'), 'utf-8'));

  const doTipo = (nome: string): string[] => {
    const inicio = tipos.indexOf(`export type ${nome}`);
    if (inicio === -1) return [];
    const corpo = tipos.slice(inicio, tipos.indexOf(';', inicio));
    return [...corpo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };

  it.each([
    ['JobStatus', 'status'],
    ['JobTipo', 'tipo'],
    ['JobPriority', 'priority'],
  ])('%s cabe no check de jobs.%s', (tipo, coluna) => {
    const valores = doTipo(tipo);
    if (!valores.length) return; // o tipo mudou de nome: outro teste pega isso
    const aceitos = valoresAceitos(ultimoCheck('jobs', coluna));
    expect(aceitos.size, `o check de jobs.${coluna} não foi encontrado`).toBeGreaterThan(1);
    for (const v of new Set(valores)) {
      expect(aceitos.has(v), `${tipo} tem "${v}" e o check de jobs.${coluna} o recusa`).toBe(true);
    }
  });
});

describe('toda coluna que o app escreve existe numa migração', () => {
  /**
   * **`jobs.canais` esteve em produção por dez dias sem migração nenhuma.**
   *
   * Ela foi aplicada à mão pelo SQL Editor, e o registro ficou só na tabela de
   * histórico do banco. Quem reconstruísse o schema a partir de
   * `supabase/migrations/` — a pasta que este projeto trata como fonte de
   * verdade — ficaria sem a coluna, e o multicanal quebraria em silêncio: o
   * mapper lê `l.canais`, não acharia nada e cairia sempre no `[l.platform]`,
   * um canal só, sem erro em lugar nenhum.
   *
   * É a armadilha do agendador ao contrário, e a segunda vez que ela aparece:
   * antes foi `adicionar_membro_existente`, uma função que estava no banco e
   * em migração nenhuma. Lá a guarda criada olhava `supabase.rpc`; o buraco
   * que sobrou era a **coluna**, que nenhum `rpc` nomeia.
   *
   * Nada local acusa: `tsc` não conhece coluna do Postgres, o vitest não fala
   * com o banco e o `vite build` não sabe o que é schema.
   *
   * A lista é **derivada** dos `*ParaLinha` de `mappers.ts` — eles são a
   * fronteira por onde tudo o que o app grava passa. Lista literal teria de
   * ser editada junto com o código, e é assim que uma guarda deixa de
   * guardar.
   */
  const mapeadores = semComentarios(
    readFileSync(join(RAIZ, 'src', 'lib', 'mappers.ts'), 'utf-8')
  );

  const sqlDeTodasAsMigracoes = (() => {
    const dir = join(RAIZ, 'supabase', 'migrations');
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    return readdirSync(dir)
      .filter((a) => a.endsWith('.sql'))
      .map((a) => semComentarios(readFileSync(join(dir, a), 'utf-8')))
      .join('\n')
      .toLowerCase();
  })();

  /** As chaves de primeiro nível de cada `*ParaLinha`. */
  const colunasEscritas = (() => {
    const achadas = new Map<string, string>();

    for (const m of mapeadores.matchAll(/export const (\w+ParaLinha)\b/g)) {
      const inicio = m.index!;
      const abre = mapeadores.indexOf('{', mapeadores.indexOf('=>', inicio));
      if (abre === -1) continue;

      let profundidade = 0;
      let fim = abre;
      for (let i = abre; i < mapeadores.length; i++) {
        const c = mapeadores[i];
        if (c === '{' || c === '(' || c === '[') profundidade++;
        if (c === '}' || c === ')' || c === ']') profundidade--;
        if (profundidade === 0) {
          fim = i;
          break;
        }
      }

      const corpo = mapeadores.slice(abre + 1, fim);
      // Só o primeiro nível: um objeto aninhado é conteúdo de uma coluna
      // jsonb, não uma coluna.
      let nivel = 0;
      for (const linha of corpo.split('\n')) {
        const chave = nivel === 0 && linha.match(/^\s{4}([a-z][a-z0-9_]*)\s*:/);
        if (chave) achadas.set(chave[1], m[1]);
        for (const c of linha) {
          if (c === '{' || c === '(' || c === '[') nivel++;
          if (c === '}' || c === ')' || c === ']') nivel--;
        }
      }
    }

    return achadas;
  })();

  it('a guarda achou os mapeadores e as migrações', () => {
    // Sem isto, um `mappers.ts` renomeado faria a extração devolver zero
    // colunas e a asserção abaixo passaria sem medir nada — que é como a
    // guarda do `aria-label` afirmou sobre o lugar errado sem falhar.
    expect(colunasEscritas.size).toBeGreaterThan(40);
    expect(sqlDeTodasAsMigracoes.length).toBeGreaterThan(10000);
    expect([...colunasEscritas.keys()]).toContain('canais');
  });

  it('nenhuma coluna gravada pelo app falta nas migrações', () => {
    const orfas = [...colunasEscritas.entries()]
      .filter(([coluna]) => !sqlDeTodasAsMigracoes.includes(coluna))
      .map(([coluna, mapeador]) => `${coluna} (escrita por ${mapeador})`);

    expect(
      orfas,
      'coluna gravada pelo app e criada por migração nenhuma: quem reconstruir ' +
        'o banco a partir de supabase/migrations/ fica sem ela, e a gravação ' +
        'falha em segundo plano, sem erro em lugar nenhum'
    ).toEqual([]);
  });
});
