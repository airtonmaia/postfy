import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentariosSql } from './semComentarios';

/**
 * O `check` de uma coluna como o banco o tem hoje.
 *
 * **Isto mora num arquivo só porque duas guardas precisam da mesma resposta**
 * — `formato-no-banco` (formato, status, tipo, prioridade) e
 * `avisos-do-portal` (evento da fila de e-mail, tipo da notificação) —, e a
 * história deste projeto sobre duas cópias é sempre a mesma: elas divergem na
 * primeira pressa. Aqui a divergência seria pior que em tela, porque uma
 * guarda que recorta errado **passa calada**.
 *
 * Três versões do recorte estavam erradas antes de entrar, todas medindo o
 * vizinho em vez do alvo:
 *
 * 1. Procurava `constraint jobs_status_check check` e não achava nada — o
 *    `check` é **inline** no `create table`, e o nome quem dá é o Postgres.
 * 2. Passou a procurar `check (<coluna> in (` em qualquer lugar — e `status`
 *    existe com `check` em **oito** tabelas deste schema.
 * 3. Recortou pela tabela com `create table[^;]*?\bjobs\s*\(` — e
 *    **`public.jobs(id)` é o que uma chave estrangeira escreve**: o recorte
 *    caía dentro da `publish_queue`, que referencia `jobs(id)`, e devolvia o
 *    `check` de `status` *dela*.
 *
 * Por isso não há curinga entre `create table` e o nome da tabela: só
 * `if not exists` e o `public.` opcional.
 */

const MIGRACOES = join(__dirname, '..', '..', 'supabase', 'migrations');

/** O corpo do `create table` e o de cada `alter table` daquela tabela. */
export const trechosDaTabela = (sql: string, tabela: string): string[] => {
  const trechos: string[] = [];

  const criacao = sql.match(
    new RegExp(
      `create table\\s+(?:if not exists\\s+)?(?:public\\.)?${tabela}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`,
      'i'
    )
  );
  if (criacao) trechos.push(criacao[1]);

  for (const m of sql.matchAll(
    new RegExp(`alter table\\s+(?:if exists\\s+)?(?:public\\.)?${tabela}\\b([^;]*);`, 'gi')
  )) {
    trechos.push(m[1]);
  }

  return trechos;
};

/**
 * Vence a **última** migração pelo nome do arquivo, que é a ordem em que o
 * Supabase as aplica: ler a primeira afirmaria sobre uma versão que o banco já
 * não tem.
 */
export const ultimoCheck = (tabela: string, coluna: string): string => {
  const arquivos = readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();

  const padrao = new RegExp(`check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]*)\\)`, 'is');

  for (const arquivo of arquivos) {
    const sql = semComentariosSql(readFileSync(join(MIGRACOES, arquivo), 'utf-8'));
    for (const trecho of trechosDaTabela(sql, tabela)) {
      const achado = trecho.match(padrao);
      if (achado) return achado[1];
    }
  }
  return '';
};

/** Os valores que o `check` aceita, extraídos das strings dentro dele. */
export const valoresAceitos = (corpo: string): Set<string> =>
  new Set([...corpo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
