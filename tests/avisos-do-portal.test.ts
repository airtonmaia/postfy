import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios, semComentariosSql } from './util/semComentarios';
import { ultimoCheck, valoresAceitos } from './util/checkDoBanco';

/**
 * A agência fica sabendo o que o cliente faz no portal.
 *
 * O painel já recebia a notificação de aprovar e de pedir ajuste — as RPCs
 * gravam em `notifications` desde que existem. **O e-mail nunca saiu**, e o
 * motivo é estrutural: quem enfileira e-mail é `dispararAutomacoes`, que roda
 * no navegador com sessão, e no portal não há sessão. A ação do cliente
 * morria no painel, com o rótulo em Automações ("quando o cliente aprova um
 * conteúdo") descrevendo um disparo que só acontecia quando a **agência**
 * mudava o status.
 *
 * As guardas aqui olham o efeito, não a forma: que o valor novo esteja nos
 * dois `check`, que a decisão de enviar more num lugar só, e que a chave da
 * tela chegue ao banco.
 */

const RAIZ = join(__dirname, '..');
const MIGRACOES = join(RAIZ, 'supabase', 'migrations');

const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf-8');

/**
 * A definição que **vale** de uma função: a última migração que a declara.
 *
 * `create or replace` substitui a anterior, então ler a primeira que aparecer
 * afirmaria sobre uma versão que o banco já não tem. É a mesma regra da
 * guarda de `portal_dados`.
 */
const ultimaDefinicao = (assinatura: string): string => {
  const arquivos = readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let corpo = '';
  for (const arquivo of arquivos) {
    const texto = semComentariosSql(readFileSync(join(MIGRACOES, arquivo), 'utf-8'));
    const inicio = texto.indexOf(assinatura);
    if (inicio === -1) continue;
    const fim = texto.indexOf('\n$$;', inicio);
    corpo = texto.slice(inicio, fim === -1 ? undefined : fim);
  }
  return corpo;
};

const aprovar = ultimaDefinicao('function public.portal_aprovar');
const pedirAjuste = ultimaDefinicao('function public.portal_pedir_ajuste');
const registrarAcesso = ultimaDefinicao('function public.portal_registrar_acesso');
const enfileirar = ultimaDefinicao('function private.enfileirar_email_do_portal');

describe('o valor novo entra nas duas listas fechadas', () => {
  /**
   * Lista da tela e `check` do banco são a mesma decisão em dois lugares, e
   * divergir não quebra nada até alguém escolher o valor novo — longe de quem
   * o escreveu, e com a perda em silêncio. Foi o `feed_story` recusado por
   * quatro dias com tudo verde.
   */
  const eventos = valoresAceitos(ultimoCheck('email_queue', 'evento'));

  it('a guarda encontrou o check da fila — senão ela não guarda nada', () => {
    expect(eventos.size, 'nenhuma migração define o check de email_queue.evento').toBeGreaterThan(
      3
    );
  });

  it('a fila aceita o aviso de acesso ao portal', () => {
    expect(
      eventos.has('portal_aberto'),
      'o insert do aviso de acesso seria recusado com 23514 — e a recusa some ' +
        'dentro da fila de gravação, sem erro em tela nenhuma'
    ).toBe(true);
  });

  it('recriar o check não derrubou os eventos que já existiam', () => {
    /**
     * **Este caso aconteceu escrevendo a migração.** O Postgres não tem
     * `alter constraint` para mudar a expressão, então acrescentar um valor é
     * reescrever a lista inteira — e a primeira versão saiu sem
     * `lote_aguardando_aprovacao`, que a aprovação em massa usa.
     *
     * Esquecer um valor que já existe é pior que esquecer o novo: o
     * `add constraint` valida as linhas gravadas, então a migração falharia
     * na agência que já usou o lote — ou, sem linha nenhuma, passaria limpa e
     * derrubaria o próximo aviso em massa.
     */
    for (const evento of [
      'conteudo_aguardando_aprovacao',
      'conteudo_aprovado',
      'pedido_de_ajuste',
      'lote_aguardando_aprovacao',
    ]) {
      expect(
        eventos.has(evento),
        `o check de email_queue.evento perdeu "${evento}" ao ser recriado`
      ).toBe(true);
    }
  });

  it('todo tipo de notificação da tela cabe no check do banco', () => {
    /**
     * Derivado da união do TypeScript, nunca de uma lista literal: lista
     * literal teria de ser editada junto com o código, e editar a guarda
     * junto com o código é como ela deixa de guardar.
     */
    const tipos = semComentarios(ler('src', 'types', 'index.ts'));
    const uniao = tipos.match(
      /interface Notification \{[\s\S]*?\n {2}type:\s*([^;]+);/
    );
    expect(uniao, 'não encontrei a união de Notification["type"]').not.toBeNull();

    const daTela = [...(uniao?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(daTela.length, 'a união de tipos ficou vazia').toBeGreaterThan(3);

    const aceitos = valoresAceitos(ultimoCheck('notifications', 'type'));
    expect(aceitos.size, 'não encontrei o check de notifications.type').toBeGreaterThan(3);

    for (const tipo of daTela) {
      expect(
        aceitos.has(tipo),
        `a tela cria notificação do tipo "${tipo}" e o check do banco a recusa`
      ).toBe(true);
    }
  });
});

describe('a ação do cliente no portal chega à fila de e-mail', () => {
  it('as três funções do portal foram encontradas', () => {
    expect(aprovar, 'portal_aprovar sumiu das migrações').toContain('portal_usuario');
    expect(pedirAjuste, 'portal_pedir_ajuste sumiu das migrações').toContain('portal_usuario');
    expect(registrarAcesso, 'portal_registrar_acesso não existe em migração nenhuma').toContain(
      'portal_usuario'
    );
  });

  for (const [nome, corpo, evento] of [
    ['portal_aprovar', () => aprovar, 'conteudo_aprovado'],
    ['portal_pedir_ajuste', () => pedirAjuste, 'pedido_de_ajuste'],
    ['portal_registrar_acesso', () => registrarAcesso, 'portal_aberto'],
  ] as const) {
    it(`${nome} enfileira o e-mail`, () => {
      const texto = corpo();
      expect(
        texto,
        `${nome} voltou a gravar só a notificação do painel — o e-mail da ação ` +
          'do cliente não sai, e não há erro em lugar nenhum'
      ).toContain('enfileirar_email_do_portal');
      expect(texto, `${nome} enfileira, mas com o evento errado`).toContain(`'${evento}'`);
    });
  }

  it('o pedido de ajuste enfileira depois de gravar o feedback', () => {
    /**
     * O modelo tira `{{feedback}}` de `jobs.last_feedback`, que o `update`
     * desta mesma função acabou de gravar. Enfileirar antes mandaria o texto
     * do pedido **anterior** — e o e-mail sairia bonito, com o conteúdo
     * errado, que é a falha que ninguém confere.
     */
    const gravou = pedirAjuste.indexOf('last_feedback = texto');
    const enfileirou = pedirAjuste.indexOf('enfileirar_email_do_portal');
    expect(gravou, 'o update do feedback sumiu').toBeGreaterThan(-1);
    expect(
      gravou,
      'o e-mail é enfileirado antes de o feedback ser gravado: o modelo mandaria o texto anterior'
    ).toBeLessThan(enfileirou);
  });

  it('o registro de acesso é chamável de quem não tem sessão', () => {
    const sql = semComentariosSql(
      readdirSync(MIGRACOES)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => readFileSync(join(MIGRACOES, f), 'utf-8'))
        .join('\n')
    );
    expect(
      /grant execute on function public\.portal_registrar_acesso\(text\) to [^;]*anon/.test(sql),
      'sem grant para anon a função é inalcançável do portal, que é anônimo por definição'
    ).toBe(true);
  });
});

describe('a preferência da agência decide, e ela mora num lugar só', () => {
  it('a decisão de enviar está em enfileirar_email_do_portal', () => {
    /**
     * A mesma razão de `enfileirarEmail` conferir `notificacao_aprovacao` em
     * vez de cada tela conferir: o evento sai de três funções diferentes, e
     * filtrar em cada uma garante esquecer uma. Esquecer aqui é o pior caso —
     * a agência desliga o aviso na tela e continua recebendo, e a preferência
     * vira enfeite.
     */
    expect(enfileirar, 'private.enfileirar_email_do_portal não existe').not.toBe('');
    expect(
      enfileirar,
      'a chave de acesso ao portal deixou de ser conferida na hora de enfileirar'
    ).toContain('avisar_acesso_do_portal');
    expect(
      enfileirar,
      'a chave das ações do cliente deixou de ser conferida na hora de enfileirar'
    ).toContain('avisar_acoes_do_cliente');
  });

  it('nenhuma outra função do portal confere a chave por conta própria', () => {
    for (const [nome, corpo] of [
      ['portal_aprovar', aprovar],
      ['portal_pedir_ajuste', pedirAjuste],
    ] as const) {
      expect(
        corpo.includes('avisar_acoes_do_cliente'),
        `${nome} passou a filtrar a preferência por conta própria — são duas ` +
          'respostas para a mesma pergunta, e elas divergem na primeira pressa'
      ).toBe(false);
    }
  });

  it('a tela de Preferências grava as duas chaves', () => {
    /**
     * A tela já mentiu uma vez: o botão de salvar era `setSaved(true)` e mais
     * nada, seguido de "Preferências salvas com sucesso!". Campo que não faz
     * nada é pior que campo ausente — ele é configurado, e a pessoa passa a
     * contar com o que ele promete.
     */
    const tela = semComentarios(
      ler('src', 'components', 'settings', 'tabs', 'SettingsPreferences.tsx')
    );

    /**
     * O recorte começa no objeto e **termina na chamada que o usa**, não na
     * primeira ocorrência de `atualizarWorkspace` no arquivo: essa é a linha
     * do `import`, lá em cima, e a janela saía vazia — com a asserção
     * reprovando uma tela correta na primeira versão desta guarda. É a mesma
     * família do `slice(0, 1400)` que mediu a função vizinha e **passou** com
     * o bug dentro.
     */
    const inicio = tela.indexOf('const mudancas');
    const fim = tela.indexOf('await atualizarWorkspace', inicio);
    expect(inicio, 'não achei o objeto de mudanças da tela').toBeGreaterThan(-1);
    expect(fim, 'não achei a gravação que usa o objeto de mudanças').toBeGreaterThan(inicio);
    const salvar = tela.slice(inicio, fim);
    for (const campo of ['avisarAcessoDoPortal', 'avisarAcoesDoCliente']) {
      expect(
        salvar,
        `a tela mostra a chave "${campo}" e não a manda para o banco ao salvar`
      ).toContain(campo);
    }
  });

  it('as duas chaves fazem a volta inteira no mapper', () => {
    /**
     * Ida e volta, porque faltar um lado não quebra nada visível: sem a ida, o
     * clique não grava; sem a volta, a tela mostra o padrão e o próximo salvar
     * escreve por cima do que a agência tinha escolhido.
     */
    const mapper = semComentarios(ler('src', 'lib', 'mappers.ts'));
    for (const coluna of ['avisar_acesso_do_portal', 'avisar_acoes_do_cliente']) {
      expect(
        mapper.split(coluna).length - 1,
        `"${coluna}" precisa aparecer na leitura e na escrita do workspace`
      ).toBeGreaterThan(1);
    }
  });
});

describe('o sino mostra o que chegou enquanto a aba estava aberta', () => {
  const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));

  it('há sondagem, e ela também acorda quando a aba volta ao foco', () => {
    /**
     * Tudo o que o cliente faz no portal é gravado por RPC, no servidor, e
     * portanto **nunca chegava a uma aba já aberta**: as notificações vinham
     * na carga inicial e só.
     *
     * Só o intervalo não basta — o navegador estrangula timer de aba em
     * segundo plano, que é justamente onde o Orquesia passa a manhã.
     */
    expect(contexto, 'a sondagem das notificações sumiu').toContain(
      'buscarNotificacoesRecentes'
    );
    expect(contexto, 'a sondagem perdeu o intervalo').toMatch(
      /setInterval\(\s*sondar/
    );
    expect(contexto, 'a sondagem deixou de acordar na volta do foco').toMatch(
      /visibilitychange['"],\s*sondar/
    );
  });

  it('o que vem da sondagem é invisível para o diff', () => {
    /**
     * Sem a marca, `useColecaoSincronizada` vê linha nova e tenta **gravar de
     * volta** o que acabou de ler: a chave primária recusa uma a uma, em
     * silêncio, dentro da fila de gravação.
     */
    const bloco = contexto.slice(
      contexto.indexOf('buscarNotificacoesRecentes()'),
      contexto.indexOf('setInterval(')
    );
    expect(
      bloco,
      'a sondagem junta as notificações sem marcá-las como vindas do banco'
    ).toContain("marcarComoVindoDoBanco('notifications'");
  });

  it('o popover não volta a prometer tempo real', () => {
    /**
     * Ele anunciava "Tempo Real" sem assinatura nem sondagem nenhuma — a
     * armadilha 9 dentro do próprio painel de avisos. Com sondagem de um
     * minuto, o rótulo diz o intervalo em vez de prometer o instante.
     */
    const app = semComentarios(ler('src', 'App.tsx'));
    expect(
      /Tempo Real/i.test(app),
      'o painel voltou a afirmar tempo real; a sondagem é de um minuto'
    ).toBe(false);
  });
});
