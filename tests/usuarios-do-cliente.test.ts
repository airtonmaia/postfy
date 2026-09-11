import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O recorte por papel mora no banco, e é invisível daqui.
 *
 * Até esta entrega, quem entrava no Portal do Cliente entrava como "o
 * cliente": o token era da linha de `clients`, e `portal_dados` devolvia
 * `to_jsonb(cliente)` — a linha inteira, com `passwords`, `invoices` e
 * `briefing` dentro. Qualquer e-mail cadastrado abria o cofre de senhas.
 *
 * A correção foi recortar **no que a função devolve**, e não esconder aba na
 * tela: uma aba escondida com o dado já no navegador é uma tela mentindo
 * sobre o que entregou. Nada disso quebra tipo, teste de componente ou
 * build — é corpo de função SQL. Se alguém reescrever `portal_dados` sem o
 * recorte, tudo continua verde e o cofre volta a vazar.
 *
 * Esta guarda lê a migração e confere o que a tela não consegue conferir.
 */

const RAIZ = join(__dirname, '..');
const MIGRACOES = join(RAIZ, 'supabase', 'migrations');

const sqlDeTodasAsMigracoes = (): string =>
  readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRACOES, f), 'utf-8'))
    .join('\n');

const migracaoDosUsuarios = readFileSync(
  join(MIGRACOES, '20260910160000_usuarios_do_cliente.sql'),
  'utf-8'
);

/**
 * Comentário não é código — mesma razão do `semComentarios` em
 * tests/instagram.test.ts. A migração explica nos comentários exatamente o
 * que vazava; sem a limpeza, a guarda acharia a explicação e daria por
 * satisfeita.
 */
const semComentarios = (sql: string): string => sql.replace(/^\s*--.*$/gm, '');

/** O corpo de uma função, de `create or replace function <nome>` até o `$$;`. */
const corpoDaFuncao = (sql: string, nome: string): string => {
  const inicio = sql.indexOf(`create or replace function public.${nome}(`);
  expect(inicio, `função ${nome} não existe na migração`).toBeGreaterThan(-1);
  const fim = sql.indexOf('$$;', inicio);
  expect(fim, `função ${nome} sem fim de corpo`).toBeGreaterThan(inicio);
  return sql.slice(inicio, fim);
};

describe('papel do usuário do cliente', () => {
  const sql = semComentarios(migracaoDosUsuarios);

  it('portal_dados não devolve senhas, notas, briefing nem arquivos para quem não é editor', () => {
    const corpo = corpoDaFuncao(sql, 'portal_dados');

    expect(corpo).toContain("usuario.role <> 'editor'");
    for (const campo of ['passwords', 'invoices', 'briefing', 'files']) {
      expect(corpo, `${campo} continua saindo para o aprovador`).toContain(`- '${campo}'`);
    }
  });

  it('portal_dados nunca devolve o portal_token, nem para o editor', () => {
    const corpo = corpoDaFuncao(sql, 'portal_dados');
    // Fora do `if` do papel: a credencial do link não serve para quem já
    // provou quem é pela sessão, e devolvê-la só amplia o estrago de um
    // vazamento de tela.
    expect(corpo).toContain("cliente_json - 'portal_token'");
  });

  it('toda escrita de editor confere o papel antes de gravar', () => {
    const soEditor = [
      'portal_salvar_dados',
      'portal_usuarios',
      'portal_criar_usuario',
      'portal_remover_usuario',
      'portal_enviar_material',
    ];

    for (const nome of soEditor) {
      expect(corpoDaFuncao(sql, nome), `${nome} não confere o papel`).toContain(
        "usuario.role <> 'editor'"
      );
    }
  });

  it('o editor não altera nota fiscal pelo portal', () => {
    const corpo = corpoDaFuncao(sql, 'portal_salvar_dados');
    // Quem emite nota é a agência. A lista fechada é o que impede um campo
    // novo de entrar sem alguém decidir que ele pode.
    expect(corpo).toContain("array['files', 'passwords', 'briefing']");
    expect(corpo).not.toContain("'invoices',");
  });

  it('aprovar e pedir ajuste valem para os dois papéis', () => {
    // É o que o aprovador existe para fazer. Se alguém colar a checagem de
    // editor aqui por simetria, o aprovador vira espectador.
    for (const nome of ['portal_aprovar', 'portal_pedir_ajuste']) {
      expect(corpoDaFuncao(sql, nome), `${nome} passou a exigir editor`).not.toContain(
        "usuario.role <> 'editor'"
      );
    }
  });

  it('o resolvedor antigo, que ignorava o papel, foi derrubado', () => {
    // `private.portal_cliente` achava o cliente pelo `clients.portal_token` e
    // devolvia a linha inteira. De pé, ele é um segundo caminho para o que
    // o recorte fecha.
    expect(sql).toContain('drop function if exists private.portal_cliente(text)');
    expect(sql).toContain('drop function if exists private.portal_cliente_por_email(text)');
  });

  it('portal_sessoes tem RLS ligada e nenhuma política', () => {
    // Mesmo padrão de `social_tokens` e `portal_codigos`: a tabela guarda
    // credencial de sessão e é inalcançável por qualquer sessão do Supabase.
    // Quem lê é `private.portal_usuario`, security definer.
    expect(sql).toContain('alter table public.portal_sessoes enable row level security');
    expect(sql).not.toMatch(/create policy .* on public\.portal_sessoes/);
  });

  it('ninguém perde o acesso que já tinha: o backfill entra como editor', () => {
    // Quem entrava antes podia tudo. Rebaixar a aprovador na virada tiraria
    // capacidade sem ninguém pedir.
    expect(sql).toMatch(/insert into public\.client_users[\s\S]*'editor'/);
  });
});

describe('as RPCs que o portal chama existem no banco', () => {
  it('cada supabase.rpc do portal tem função correspondente numa migração', () => {
    // Nome de RPC é string: um erro de digitação passa por tsc, por vitest e
    // por vite build, e só falha na frente do cliente — sem sessão para
    // reportar o erro a ninguém.
    const fonte = readFileSync(join(RAIZ, 'src', 'lib', 'portal.ts'), 'utf-8');
    const sql = sqlDeTodasAsMigracoes();

    const chamadas = [...fonte.matchAll(/supabase\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
    expect(chamadas.length).toBeGreaterThan(0);

    for (const nome of new Set(chamadas)) {
      expect(sql, `RPC ${nome} não existe em nenhuma migração`).toContain(
        `function public.${nome}(`
      );
    }
  });

  it('as funções do portal são executáveis por quem não tem sessão', () => {
    // Quem chega ao portal é anônimo para o Supabase: a credencial é o token
    // da sessão, e é ele que a função recorta. Sem o grant para `anon`, toda
    // chamada volta 42501 depois de a pessoa já ter digitado o código.
    const sql = semComentarios(migracaoDosUsuarios);
    const fonte = readFileSync(join(RAIZ, 'src', 'lib', 'portal.ts'), 'utf-8');
    const chamadas = new Set(
      [...fonte.matchAll(/supabase\.rpc\(\s*'(portal_[a-z_]+)'/g)].map((m) => m[1])
    );

    for (const nome of chamadas) {
      // `marca_da_agencia` e as funções de código ficam fora: as duas de
      // código só podem ser chamadas pela rota serverless, com a chave de
      // serviço, porque uma devolve o código em claro e a outra seria força
      // bruta em seis dígitos.
      if (nome === 'portal_emitir_codigo' || nome === 'portal_conferir_codigo') continue;
      expect(sql, `${nome} sem grant para anon`).toMatch(
        new RegExp(`grant execute on function public\\.${nome}\\([^)]*\\) to anon`)
      );
    }
  });
});
