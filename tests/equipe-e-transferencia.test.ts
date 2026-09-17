import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios, semComentariosSql } from './util/semComentarios';

/**
 * O e-mail de cada membro, e a transferência da agência.
 *
 * Três decisões, e nenhuma quebra tipo, teste de componente ou build quando
 * violada:
 *
 * 1. **A lista de e-mails confere pertencimento.** `equipe_da_agencia` é
 *    `security definer` e lê `auth.users`; sem a conferência, qualquer sessão
 *    passa o id de outra agência e recebe a lista de e-mails dela.
 * 2. **Só o dono transfere, e a ordem das duas escritas é obrigatória.**
 *    Rebaixar antes de promover deixa a agência momentaneamente sem dono, e o
 *    gatilho `membro_editado` recusa a transferência inteira com `42501`.
 * 3. **A exceção aberta no gatilho é estreita.** Ela existe para o último
 *    passo da transferência (owner → admin); alargá-la reabre a
 *    auto-promoção, que é a razão de o gatilho existir.
 */

const RAIZ = join(__dirname, '..');
const MIGRACOES = join(RAIZ, 'supabase', 'migrations');

const sqlDeTodasAsMigracoes = (): string =>
  readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRACOES, f), 'utf-8'))
    .join('\n');

/**
 * A **última** definição de uma função, pelo nome do arquivo.
 *
 * `create or replace function` aparece em mais de uma migração — o gatilho
 * desta entrega é a segunda versão do que nasceu em
 * `20260909140000_gestao_de_membros.sql`. Ler a primeira que aparecer afirma o
 * corpo de uma versão que o banco já não tem, que é a armadilha registrada em
 * `tests/anotacoes-do-cliente.test.ts`.
 */
const ultimaDefinicao = (nomeCompleto: string): string => {
  const arquivos = readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();

  for (const arquivo of arquivos) {
    const sql = semComentariosSql(readFileSync(join(MIGRACOES, arquivo), 'utf-8'));
    const inicio = sql.indexOf(`function ${nomeCompleto}(`);
    if (inicio === -1) continue;
    const fim = sql.indexOf('$$;', inicio);
    return sql.slice(inicio, fim === -1 ? undefined : fim);
  }
  throw new Error(`função ${nomeCompleto} não existe em nenhuma migração`);
};

const equipe = ultimaDefinicao('public.equipe_da_agencia');
const transferir = ultimaDefinicao('public.transferir_agencia');
const gatilho = ultimaDefinicao('private.checar_edicao_de_membro');

describe('a equipe vem com e-mail, e só para quem é da agência', () => {
  it('a função confere pertencimento antes de devolver qualquer coisa', () => {
    /**
     * A conferência é a função inteira: ela existe **porque** a função lê
     * `auth.users`, que nenhuma sessão autenticada alcança. Sem ela, o
     * parâmetro `p_workspace_id` vira a chave da lista de e-mails de qualquer
     * agência.
     */
    const antesDoAgregado = equipe.slice(0, equipe.indexOf('jsonb_agg'));
    expect(antesDoAgregado, 'a conferência de membro saiu de antes do agregado').toMatch(
      /workspace_members[\s\S]*auth\.uid\(\)/
    );
    expect(antesDoAgregado, 'deixou de sair vazia para quem não é membro').toMatch(
      /return '\[\]'::jsonb/
    );
  });

  it('o e-mail sai de auth.users, não de uma cópia em workspace_members', () => {
    // Uma coluna `email` denormalizada envelhece em silêncio no dia em que
    // alguém troca o endereço da conta: a tela passaria a mostrar o antigo com
    // cara de certo. A função lê a fonte.
    expect(equipe).toMatch(/join auth\.users/);
    expect(equipe).toMatch(/'email', u\.email/);
  });

  it('a tela mostra o e-mail que a lista trouxe', () => {
    /**
     * Aqui dizia `'Membro da agência'` para todo mundo que não fosse o próprio
     * usuário, e numa equipe com dois "Airton" o nome não distingue ninguém.
     * O texto fica como fallback — a função é `left join`, e um vínculo cujo
     * usuário foi apagado ainda aparece —, mas ele não pode voltar a ser a
     * única saída para quem não é você.
     */
    const tela = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'settings', 'tabs', 'SettingsUsers.tsx'), 'utf-8')
    );
    expect(tela, 'a tela voltou a esconder o e-mail dos colegas').toMatch(
      /\{membro\.email \|\|/
    );
  });
});

describe('transferir a agência', () => {
  it('só o dono, e com 42501', () => {
    // Um admin pode quase tudo *dentro* da agência; deixá-lo transferir seria
    // deixá-lo tomá-la, e é a única coisa que separa os dois papéis hoje.
    expect(transferir).toMatch(/is distinct from 'owner'/);
    expect(transferir, 'a recusa deixou de ser 42501').toMatch(
      /is distinct from 'owner'[\s\S]{0,200}42501/
    );
  });

  it('o destino precisa ser membro ativo', () => {
    // Promover quem não está na equipe criaria um dono que a lista de membros
    // não mostra — e ninguém conseguiria desfazer, porque desfazer exige ser
    // o dono.
    expect(transferir).toMatch(/not exists \([\s\S]{0,300}m\.ativo/);
  });

  it('promove antes de rebaixar, e essa ordem é a entrega', () => {
    /**
     * **A guarda que protege a decisão, e não a interação.**
     *
     * O gatilho `membro_editado` recusa deixar a agência sem nenhum dono
     * ativo, e ele olha a tabela na hora. Rebaixando primeiro, o destino ainda
     * é `admin`, não há outro dono, e a transferência inteira falha com
     * `42501` — a função aplica limpa e só quebra quando alguém usa.
     */
    const promove = transferir.indexOf("set role = 'owner'");
    const rebaixa = transferir.indexOf("set role = 'admin'");
    expect(promove, 'a promoção do novo dono desapareceu').toBeGreaterThan(-1);
    expect(rebaixa, 'o rebaixamento de quem transfere desapareceu').toBeGreaterThan(-1);
    expect(
      promove,
      'o rebaixamento subiu para antes da promoção — a transferência falha com 42501'
    ).toBeLessThan(rebaixa);
  });

  it('quem transfere fica na agência', () => {
    // Transferir e ser expulso no mesmo clique é armadilha: quem passa a
    // agência adiante quase sempre continua trabalhando nela.
    expect(transferir).toMatch(/set role = 'admin'[\s\S]{0,150}user_id = auth\.uid\(\)/);
    expect(transferir, 'a transferência passou a apagar o vínculo de quem transfere')
      .not.toMatch(/delete from public\.workspace_members/);
  });

  it('a tela oferece o botão pela lista recarregada, não pelo papel da sessão', () => {
    /**
     * `currentUser.role` é fixado quando a sessão começa: logo depois de
     * transferir, a pessoa continuaria vendo o botão — que o banco recusa,
     * então não é brecha, mas é um botão que promete o que não faz.
     */
    const tela = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'settings', 'tabs', 'SettingsUsers.tsx'), 'utf-8')
    );
    expect(tela, 'o botão de transferir deixou de existir').toMatch(/souODono/);
    expect(tela, 'souODono voltou a sair do papel da sessão').toMatch(
      /souODono = membros\.some/
    );
    // E não se oferece o que a RPC vai recusar.
    expect(tela).toMatch(/souODono && !souEu && membro\.ativo/);
  });
});

describe('a exceção aberta no gatilho continua estreita', () => {
  it('só owner → admin, e com os dois lados ativos', () => {
    /**
     * A regra que a exceção abre um buraco em é a que fecha a auto-promoção —
     * a razão de o gatilho existir. Alargá-la para qualquer `new.role`
     * devolveria ao `admin` o poder de se promover a `owner` pela tabela, sem
     * passar por ninguém.
     */
    expect(gatilho, 'a exceção do auto-rebaixamento saiu do gatilho').toMatch(
      /not \(old\.role = 'owner' and new\.role = 'admin' and old\.ativo and new\.ativo\)/
    );
  });

  it('as outras três regras continuam lá', () => {
    // Elas são o que segura a exceção de pé: a terceira barra a
    // auto-promoção a `owner`, e a última garante que a agência nunca fica
    // sem dono ativo — que é justamente o que torna o auto-rebaixamento
    // seguro.
    expect(gatilho).toMatch(/old\.role = 'owner' and coalesce\(papel_do_ator, ''\) <> 'owner'/);
    expect(gatilho).toMatch(
      /new\.role = 'owner' and old\.role <> 'owner' and coalesce\(papel_do_ator, ''\) <> 'owner'/
    );
    expect(gatilho, 'a regra do último dono ativo saiu').toMatch(/outros_donos = 0/);
  });
});

describe('nome de RPC é string em todo o app, não só no portal', () => {
  it('cada supabase.rpc de src/lib aponta para função que existe', () => {
    /**
     * A guarda equivalente existia só para `src/lib/portal.ts`, porque foi ali
     * que um erro de digitação apareceu na frente do cliente. A classe do bug
     * não é do portal: `tsc` não confere string, o vitest não chama o banco e o
     * `vite build` não sabe o que é RPC — um nome errado em qualquer arquivo
     * passa verde e falha em produção.
     */
    const pasta = join(RAIZ, 'src', 'lib');
    const fonte = readdirSync(pasta)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(join(pasta, f), 'utf-8'))
      .join('\n');
    const sql = sqlDeTodasAsMigracoes();

    const chamadas = [...fonte.matchAll(/supabase\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
    // Uma varredura que não acha nada passaria calada: é a falha da guarda que
    // fatiava a partir de uma string ausente e media o arquivo inteiro.
    expect(chamadas.length).toBeGreaterThan(5);

    for (const nome of new Set(chamadas)) {
      expect(sql, `RPC ${nome} não existe em nenhuma migração`).toContain(
        `function public.${nome}(`
      );
    }
  });

  it('as duas funções novas são executáveis pela sessão autenticada', () => {
    // Sem o grant, a chamada volta 42501 — e o sintoma na tela é a equipe
    // aparecendo vazia, que lê como agência sem ninguém.
    const sql = semComentariosSql(sqlDeTodasAsMigracoes());
    expect(sql).toMatch(
      /grant execute on function public\.equipe_da_agencia\(uuid\) to authenticated/
    );
    expect(sql).toMatch(
      /grant execute on function public\.transferir_agencia\(uuid, uuid\) to authenticated/
    );
  });
});
