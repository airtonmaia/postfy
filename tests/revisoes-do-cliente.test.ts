import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * Revisões: o cliente responde na aprovação, e o job para de vazar o interno.
 *
 * Duas coisas, e a segunda foi encontrada ao escrever a primeira.
 *
 * **1. O chat precisa gravar de verdade.** No portal não há sessão, então
 * `useColecaoSincronizada` sai cedo e toda mutação feita de lá morre no estado
 * da aba: a tela mostra o resultado, o banco nunca é chamado, e o F5 apaga
 * tudo sem erro nenhum. Foi assim que o envio de material do cliente ficou
 * decorativo por meses (armadilha 10) — e um chat mudo é pior, porque o
 * cliente escreve e fica esperando resposta de uma mensagem que nunca chegou.
 *
 * **2. `portal_dados` devolvia a linha inteira do job.** É a armadilha 10 de
 * novo, agora em `jobs`: a regra estava escrita para `clients` e ninguém
 * aplicou o mesmo raciocínio ao `to_jsonb(j)` do lado. Ia para o navegador do
 * cliente, sem ninguém ter decidido, o `draft` — que o próprio CLAUDE.md
 * descreve como "o que o cliente falou na reunião" —, os minutos gastos na
 * peça, quem da equipe a fez, o checklist interno e a estratégia de funil.
 */

const RAIZ = join(__dirname, '..');
const MIGRACOES = join(RAIZ, 'supabase', 'migrations');

/** Todas as migrações, na ordem em que o Supabase as aplica. */
const arquivosDeMigracao = (): string[] =>
  readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql')).sort();

/**
 * A definição que **vale** de uma função: a última pelo nome do arquivo.
 *
 * `create or replace` substitui a anterior, então ler a primeira que aparecer
 * afirmaria o recorte de uma versão que o banco já não tem.
 */
const ultimaDefinicao = (nome: string): string => {
  let corpo = '';
  for (const arquivo of arquivosDeMigracao()) {
    const texto = readFileSync(join(MIGRACOES, arquivo), 'utf-8');
    const inicio = texto.indexOf(`create or replace function public.${nome}`);
    if (inicio === -1) continue;
    const fim = texto.indexOf('\n$$;', inicio);
    corpo = texto.slice(inicio, fim === -1 ? undefined : fim);
  }
  return semComentarios(corpo);
};

const portalDados = ultimaDefinicao('portal_dados');
const portalComentar = ultimaDefinicao('portal_comentar');

const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));
const contexto = ler('src', 'context', 'PostfyContext.tsx');
const conversa = ler('src', 'components', 'portal', 'ConversaComAAgencia.tsx');
const portalView = ler('src', 'components', 'portal', 'ClientPortalView.tsx');
const revisoes = ler('src', 'components', 'jobs', 'PainelDeRevisoes.tsx');

describe('o portal não recebe o interno da agência dentro do job', () => {
  it('a definição de portal_dados foi encontrada', () => {
    expect(portalDados, 'portal_dados sumiu das migrações').toContain('to_jsonb(j)');
  });

  /**
   * A lista é escrita aqui porque **cada item é uma decisão**, não uma
   * derivação: o que sai é o que a agência não vende junto com a peça. O
   * inverso — derivar da tabela — reprovaria toda coluna nova, inclusive as
   * que o cliente precisa ver.
   */
  for (const coluna of [
    'draft',
    'timesheet_minutes',
    'designer_id',
    'copywriter_id',
    'social_media_id',
    'checklist',
    'campaign',
    'target_audience',
    'funnel_stage',
  ]) {
    it(`${coluna} é subtraído do job que vai ao portal`, () => {
      expect(
        portalDados,
        `portal_dados devolve ${coluna} ao cliente: to_jsonb(j) leva a linha inteira, ` +
          `e o que é interno da agência iria junto`
      ).toContain(`- '${coluna}'`);
    });
  }

  it('a subtração vale para todos os papéis, inclusive o editor', () => {
    /**
     * **O editor é o cliente.** Uma subtração dentro do `if usuario.role`
     * pouparia só o aprovador, e o papel mais alto do portal continuaria
     * recebendo tudo — que é exatamente o erro que `passwords` e `briefing`
     * cometeram na primeira versão.
     *
     * A guarda mede pela fatia: o trecho que monta `'jobs'` não pode
     * consultar o papel.
     */
    const inicio = portalDados.indexOf("'jobs',");
    expect(inicio, "a chave 'jobs' sumiu de portal_dados").toBeGreaterThan(-1);

    const fim = portalDados.indexOf("'materiais',", inicio);
    const blocoDosJobs = portalDados.slice(inicio, fim === -1 ? undefined : fim);

    expect(
      blocoDosJobs,
      'o recorte do job passou a depender do papel — o editor, que é o cliente, volta a receber tudo'
    ).not.toMatch(/usuario\.role/);
  });

  it('o prazo de aprovação continua indo', () => {
    // Ele não é segredo: é a data que a agência já combinou, e o portal a
    // mostra. Tirá-lo junto quebraria a tela do cliente.
    expect(portalDados, 'deadline_approval foi subtraído junto e o portal perdeu o prazo')
      .not.toContain("- 'deadline_approval'");
  });
});

describe('o cliente responde, e a resposta chega ao banco', () => {
  it('portal_comentar existe e é alcançável por quem não tem sessão', () => {
    expect(portalComentar, 'portal_comentar sumiu das migrações').not.toBe('');
    expect(portalComentar, 'portal_comentar deixou de ser security definer').toContain(
      'security definer'
    );

    const sql = arquivosDeMigracao()
      .map((f) => readFileSync(join(MIGRACOES, f), 'utf-8'))
      .join('\n');
    expect(sql, 'portal_comentar sem grant para anon').toMatch(
      /grant execute on function public\.portal_comentar\([^)]*\) to anon/
    );
  });

  it('o autor é decidido no banco, nunca recebido', () => {
    /**
     * Como parâmetro, quem chamasse a função escolheria aparecer como a
     * **agência** dentro da própria thread do cliente — e a tela da agência
     * leria aquilo como se fosse dela.
     */
    expect(portalComentar, 'isClient virou parâmetro da função').not.toMatch(
      /p_is_client|p_isclient/i
    );
    expect(portalComentar, 'o autor deixou de ser carimbado no banco').toMatch(
      /'isClient',\s*true/
    );
  });

  it('o job tem que ser do cliente deste token', () => {
    // Sem esta linha, quem tivesse um token qualquer comentaria no conteúdo de
    // outro cliente — e o comentário apareceria para a agência como se fosse
    // dele.
    expect(portalComentar, 'o vínculo entre job e cliente saiu da função').toMatch(
      /from public\.jobs where id = p_job_id and client_id = cliente\.id/
    );
  });

  it('a agência é avisada', () => {
    // Sem isto o chat é uma caixa onde a mensagem entra e ninguém olha — pior
    // que não ter chat, porque o cliente fica esperando resposta.
    expect(portalComentar, 'a notificação para a agência saiu').toContain(
      'insert into public.notifications'
    );
  });

  it('o comentário do portal passa pelo desvio, não pela persistência por diff', () => {
    /**
     * `useColecaoSincronizada` sai cedo quando `isAuthenticated` é falso.
     * Sem o `if (noPortal)`, a mensagem apareceria na tela, o banco nunca
     * seria chamado e o F5 apagaria tudo — sem erro nenhum (armadilha 10).
     */
    const bloco = contexto.slice(contexto.indexOf('const addJobComment ='));
    const corpo = bloco.slice(0, bloco.indexOf('logActivity('));

    expect(corpo, 'o chat do portal voltou a gravar pela persistência por diff').toMatch(
      /if \(noPortal && portalToken\)/
    );
    expect(corpo, 'o desvio deixou de chamar a RPC').toMatch(/comentarNoPortal\(/);
  });
});

describe('a conversa é uma só, nos dois lados', () => {
  it('o chat está na tela de aprovação do cliente', () => {
    expect(portalView, 'a conversa saiu do card de aprovação').toMatch(
      /<ConversaComAAgencia job=\{job\}/
    );
  });

  it('a agência lê a mesma thread, com o lado de quem falou à vista', () => {
    /**
     * `jobs.comments` é uma lista só. Duas listas separadas fariam cada lado
     * ver metade da conversa — o pior desfecho possível numa tela cujo
     * propósito é alinhar os dois. E sem distinguir quem falou, responder
     * achando que era a equipe é o erro caro.
     */
    expect(revisoes, 'o painel de revisões deixou de ler a thread do job').toMatch(
      /job\.comments\.map/
    );
    expect(revisoes, 'a marca de quem falou sumiu da conversa').toMatch(/cm\.isClient/);
    expect(conversa, 'o portal deixou de distinguir quem falou').toMatch(/cm\.isClient/);
  });

  it('a tela do cliente diz o que a mensagem não faz', () => {
    /**
     * Sem isto o cliente escreveria "troque a foto" no chat e esperaria uma
     * versão nova: a agência lê, mas a peça continua aguardando a decisão
     * dele, e os dois ficam esperando o outro. É a armadilha 9 numa frase
     * ausente.
     */
    expect(conversa, 'o aviso de que a mensagem não decide nada saiu').toMatch(
      /não pede ajuste nem aprova/
    );
  });
});
