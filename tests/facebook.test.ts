import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * O Facebook é **outro fluxo**, e a armadilha é achar que é o mesmo com outro
 * nome.
 *
 * Publicar numa Página usa o login do Facebook, outro app id, e o token **da
 * Página** — obtido em `/me/accounts`, não o do usuário que o login devolve.
 * E os escopos daqui (`pages_show_list`, `pages_read_engagement`,
 * `pages_manage_posts`) **invalidam a autorização do Instagram** se forem
 * misturados no mesmo pedido.
 *
 * Todas as falhas abaixo têm o mesmo sintoma: erro **depois** de a pessoa já
 * ter digitado a senha, com mensagem que não nomeia a causa. É o que custou
 * quatro rodadas de diagnóstico quando o fluxo errado do Instagram foi
 * escolhido, e é por isso que cada uma tem guarda.
 */

const RAIZ = join(__dirname, '..');


const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf-8');

const facebook = ler('api', '_lib', 'facebook.ts');
const instagram = ler('api', '_lib', 'instagram.ts');
const connect = ler('api', 'social-connect.ts');
const callback = ler('api', 'social-callback.ts');
const publicar = ler('api', 'publicar.ts');

describe('os dois fluxos nunca se misturam', () => {
  it('os escopos de Página não entram no fluxo do Instagram', () => {
    /**
     * `pages_show_list` e `pages_read_engagement` fazem a **tela de
     * autorização do Instagram recusar**, e o erro diz "escopo inválido" sem
     * nomear qual. Foi por isso que `api/_lib/meta.ts` foi apagado em vez de
     * virar um parâmetro.
     */
    for (const escopo of ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']) {
      expect(
        semComentarios(instagram),
        `${escopo} entrou no fluxo do Instagram — a autorização passa a ser recusada ` +
          `depois do login, com um erro que não nomeia o escopo`
      ).not.toContain(escopo);
    }
  });

  it('o Instagram não fala com graph.facebook.com, nem o contrário', () => {
    // Os hosts são a assinatura de qual fluxo é qual. Trocar um pelo outro
    // devolve 400 sem explicar nada.
    expect(semComentarios(instagram)).not.toContain('graph.facebook.com');
    expect(semComentarios(facebook)).not.toContain('graph.instagram.com');
    expect(semComentarios(facebook)).not.toContain('api.instagram.com');
  });

  it('cada rede lê o app id do próprio app', () => {
    /**
     * `FACEBOOK_APP_ID` não é `INSTAGRAM_APP_ID`: são apps diferentes no mesmo
     * painel da Meta. Usar um no lugar do outro falha depois do login, com
     * mensagem que não nomeia a causa.
     */
    for (const fonte of [connect, callback]) {
      expect(fonte).toMatch(/FACEBOOK_APP_ID/);
      expect(fonte).toMatch(/INSTAGRAM_APP_ID/);
      expect(
        semComentarios(fonte),
        'a escolha do app id deixou de depender da rede'
      ).toMatch(/rede === 'facebook'/);
    }
  });
});

describe('a rede viaja no estado assinado', () => {
  it('o callback lê a rede do estado, não da query', () => {
    /**
     * Quem chega no retorno veio da Meta, **sem sessão**. Uma `rede` na URL
     * seria escolhida por quem quisesse: o retorno do Instagram cairia no
     * fluxo do Facebook, que bate em outro endpoint com outro segredo, e o
     * erro sairia como "código inválido" — que não aponta para nada.
     */
    const corpo = semComentarios(callback);
    expect(corpo, 'a rede passou a vir da query do retorno').toMatch(
      /const rede = dados\.rede/
    );
    expect(corpo).not.toMatch(/searchParams\.get\(['"]rede['"]\)/);
  });

  it('a rede só é lida depois de a assinatura conferir', () => {
    // Lida antes, ela viria de um estado que ainda pode ser forjado — e a
    // escolha do app secret sairia do que o atacante mandou.
    const corpo = semComentarios(callback);
    expect(corpo.indexOf('conferirEstado(estado, segredo)')).toBeLessThan(
      corpo.indexOf('const rede = dados.rede')
    );
  });
});

describe('o token guardado é o da Página', () => {
  it('o callback troca o token do usuário pelo da Página', () => {
    /**
     * O login devolve o token **do usuário**, que só serve para listar as
     * Páginas. Guardar ele faz a publicação falhar com "permissão
     * insuficiente" depois de a conexão já parecer pronta — o pior momento
     * para descobrir.
     */
    expect(semComentarios(callback)).toMatch(/paginasDoUsuario\(/);
    expect(semComentarios(callback)).toMatch(/tokenDaPagina/);
  });

  it('sem Página administrada, a conexão recusa em vez de gravar vazio', () => {
    expect(semComentarios(callback)).toMatch(/if \(!paginas\.length\)/);
  });
});

describe('publicar despacha pela rede da conexão', () => {
  it('o cron chama o publicador certo', () => {
    /**
     * A âncora é o **despacho**, não a forma de escrevê-lo.
     *
     * A primeira versão exigia o ternário literal
     * `conexao.platform === 'facebook' ? publicarNoFacebook`, e reprovou
     * quando o bloco virou um `if` — porque o caminho do Instagram passou a
     * ter dois passos (feed e story) e não cabia mais numa expressão.
     *
     * O comportamento não mudou, só a sintaxe. Guarda presa à forma obriga a
     * editá-la junto com o código, e editar a guarda junto com o código é como
     * ela deixa de guardar.
     */
    const corpo = semComentarios(publicar);
    const inicio = corpo.indexOf("conexao.platform === 'facebook'");
    expect(inicio, 'o despacho por rede saiu de publicarItem').toBeGreaterThan(-1);

    /**
     * O fim do trecho é **estrutural**, não um número de caracteres.
     *
     * A primeira versão desta âncora recortava 260 caracteres a partir do
     * `if`, e quebrou na entrega seguinte: o bloco que recusa feed+story no
     * Facebook entrou antes da chamada e empurrou ela para fora da janela.
     * Guarda medida em caracteres envelhece a cada linha acrescentada — o
     * limite certo é onde o próximo caminho começa.
     */
    const ramoDoFacebook = corpo.slice(inicio, corpo.indexOf('publicarNoInstagram(', inicio));

    expect(
      ramoDoFacebook,
      'a rede facebook deixou de cair no publicador do Facebook'
    ).toMatch(/publicarNoFacebook\(/);
    expect(corpo, 'o publicador do Instagram saiu do caminho').toMatch(
      /publicarNoInstagram\(/
    );
  });

  it('rede fora das duas continua sendo recusada', () => {
    /*
      O cinto: mesmo que a fila receba um item de outra rede, a rota não tenta
      publicar às cegas.

      A guarda media a **sintaxe** das duas comparações e reprovou quando elas
      viraram uma chamada a `publicaSozinho` — mesma decisão, derivada da lista
      em vez de repetida. Agora mede o efeito, e a lista do servidor é conferida
      contra `REDES_QUE_PUBLICAM` em `tests/publicacao.test.ts`.
    */
    const corpo = semComentarios(publicar);
    const item = corpo.slice(corpo.indexOf('const publicarItem'));
    const recusa = item.slice(0, item.indexOf('ainda não implementada'));

    expect(recusa).toMatch(/publicaSozinho\(conexao\.platform\)|conexao\.platform !== '/);
    expect(corpo).toMatch(/ainda não implementada/);
  });

  it('a medição de métrica continua só do Instagram', () => {
    /**
     * `buscarMetricas` fala com `graph.instagram.com`. Medir um post de Página
     * por ali falha sempre, e encheria `ultimo_erro` de falha previsível —
     * escondendo as reais no meio.
     */
    const corpo = semComentarios(publicar);
    const medicao = corpo.slice(corpo.indexOf('const atualizarMetricas'));

    /**
     * Ancorada em `data: aMedir`, que é a **fila de medição** — e não no
     * primeiro `.from('post_metrics')`, que é o upsert do *backfill*, nem em
     * qualquer `.eq('platform', ...)` do arquivo.
     *
     * As duas âncoras erradas foram tentadas antes desta, e cada uma passou
     * com a fila sem filtro nenhum: a primeira casava com o filtro de
     * `social_connections`, a segunda com o upsert logo acima. Guarda que casa
     * com a linha errada é pior que guarda nenhuma — ela dá a impressão de
     * cobrir o que não cobre.
     */
    const fila = medicao.slice(medicao.indexOf('data: aMedir'));
    expect(
      fila.slice(0, 400),
      'a fila de medição deixou de filtrar por Instagram e vai tentar medir Página do Facebook'
    ).toMatch(/\.eq\('platform', 'instagram'\)/);
  });
});

describe('a tela não promete o que não está configurado', () => {
  it('a rota recusa com o nome da variável quando falta credencial', () => {
    // A regra da aba Integrações: quem depende de configuração externa diz o
    // que falta, com nome — nunca finge sucesso.
    expect(connect).toMatch(/FACEBOOK_APP_ID, /);
    expect(connect).toMatch(/SOCIAL_NOT_CONFIGURED/);
  });

  it('o /api/status reporta o par do Facebook separado do Instagram', () => {
    const status = ler('api', 'status.ts');
    expect(status).toMatch(/facebook: temTodas\('FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'\)/);
  });

  it('o .env.example avisa que é outro app', () => {
    const env = ler('.env.example');
    expect(env).toMatch(/FACEBOOK_APP_ID/);
    expect(env).toMatch(/FACEBOOK_APP_SECRET/);
  });
});

/**
 * **Quem administra duas Páginas conectava uma em silêncio.**
 *
 * O retorno ficava com `paginas[0]` — a primeira que a Meta devolvesse — e a
 * tela dizia "Conta conectada: @Página". Com uma Página só, certo; com duas,
 * o servidor decidia sozinho o que era da pessoa decidir, e possivelmente a
 * errada: os posts do cliente sairiam no perfil de outro negócio dela.
 *
 * É a mesma família do `find` que enfileirava uma rede de duas e do
 * `.eq('platform', 'instagram')` que publicava Facebook no Instagram. O
 * comentário no código chegava a dizer que a tela "ainda não existe" — o que
 * é honesto sobre o código e não ajuda quem clicou.
 */
describe('a Página é escolhida por quem autoriza', () => {
  const semCom = semComentarios(callback);

  it('com mais de uma Página, a conexão não é gravada sozinha', () => {
    // A guarda central: voltar a `paginas[0]` sem passar pela escolha faz
    // este teste falhar antes de alguém perder um post no perfil errado.
    expect(semCom, 'a tela de escolha sumiu do retorno').toMatch(/paginaDeEscolha\(/);
    expect(semCom, 'a conexão direta deixou de ser o caso de uma Página só').toMatch(
      /paginas\.length === 1/
    );
  });

  it('uma Página só conecta direto', () => {
    // Perguntar o óbvio é ruído, e custaria um clique em toda conexão do caso
    // mais comum. A lista continua sendo buscada, que é o que
    // `pages_show_list` justifica.
    const ramo = semCom.slice(semCom.indexOf('paginas.length === 1'));
    expect(ramo.slice(0, 400)).toMatch(/guardarConexao\(/);
  });

  it('nenhum token vai para o HTML da escolha', () => {
    /*
      A tela lista Páginas de terceiro, e a saída fácil é mandar o token de
      cada uma num campo escondido para o passo dois não precisar buscar. Isso
      o colocaria no DOM, no histórico e em qualquer captura — e captura de
      tela é exatamente o que se faz desta tela ao gravar o vídeo da revisão
      da Meta.
    */
    const tela = semCom.slice(
      semCom.indexOf('const paginaDeEscolha'),
      semCom.indexOf('const guardarConexao')
    );

    expect(tela.length).toBeGreaterThan(100);
    expect(tela, 'o token da Página vazou para o HTML da escolha').not.toMatch(
      /tokenDaPagina|access_token/
    );
  });

  it('o passo dois busca o token no servidor', () => {
    // Sem isto não haveria como publicar: o código da Meta é de uso único, e
    // o token da Página só vem de `/me/accounts`.
    const passoDois = semCom.slice(semCom.indexOf('if (pendente && paginaEscolhida)'));
    expect(passoDois.slice(0, 1500)).toMatch(/paginasDoUsuario\(/);
    expect(passoDois.slice(0, 1500)).toMatch(/escolhida\.tokenDaPagina/);
  });

  it('a agência sai do estado assinado, nunca da query', () => {
    /*
      A mesma regra do cliente no passo um: quem chega aqui veio da Meta, sem
      sessão. Uma agência na URL seria escolhida por quem quisesse, e a Página
      de um cliente viraria conexão na agência de outro.
    */
    const passoDois = semCom.slice(
      semCom.indexOf('if (pendente && paginaEscolhida)'),
      semCom.indexOf('const base =')
    );

    expect(passoDois).not.toMatch(/searchParams\.get\('workspace|searchParams\.get\('client/);
    expect(semCom, 'o passo dois deixou de exigir o estado assinado').toMatch(
      /!estado \|\| \(!codigo/
    );
  });

  it('a autorização pendente morre depois de usada, e as vencidas saem sozinhas', () => {
    // Ela guarda um token de usuário. Token esquecido numa tabela é sobra que
    // ninguém vê envelhecer.
    expect(semCom).toMatch(
      /from\('social_autorizacoes_pendentes'\)\s*\.delete\(\)\s*\.eq\('id'/
    );
    expect(semCom, 'as pendentes vencidas deixaram de ser varridas').toMatch(
      /from\('social_autorizacoes_pendentes'\)\s*\.delete\(\)\s*\.lt\('criado_em'/
    );
    expect(semCom, 'a pendente deixou de ter prazo').toMatch(/VALIDADE_DA_PENDENTE_MS/);
  });

  it('nome de Página não entra cru no HTML', () => {
    // O nome é escolhido por quem cadastrou a Página, e a tela é servida do
    // nosso domínio — com a sessão do Orquesia aberta na aba que a abriu.
    const tela = semCom.slice(
      semCom.indexOf('const paginaDeEscolha'),
      semCom.indexOf('const guardarConexao')
    );

    expect(tela).toMatch(/escapar\(p\.accountName\)/);
    expect(tela, 'a foto da Página entrou no HTML sem escapar').toMatch(/escapar\(p\.fotoUrl\)/);
  });

  it('a tabela da pendente é inalcançável por sessão nenhuma', () => {
    /*
      RLS ligada e **zero políticas**, como `social_tokens` e `portal_codigos`:
      ela guarda um token de terceiro, e o dono da agência não é exceção.
    */
    const migracao = ler(
      'supabase',
      'migrations',
      '20260923150000_escolha_da_pagina_do_facebook.sql'
    );

    expect(migracao).toMatch(
      /alter table public\.social_autorizacoes_pendentes enable row level security/
    );
    expect(
      migracao,
      'a tabela da autorização pendente ganhou política — ela guarda token de usuário'
    ).not.toMatch(/create policy[^;]*social_autorizacoes_pendentes/);
    // Repetível: a outra máquina aplica sem saber que já foi aplicada.
    expect(migracao).toMatch(/create table if not exists/);
  });
});

/**
 * **A lista de Páginas chegava cortada, e nada acusava.**
 *
 * Relato de uso: "não listou todas as minhas páginas, tenho várias". Duas
 * causas independentes, e as duas silenciosas — a tela mostra uma lista
 * completa de um conjunto incompleto, que é a armadilha 9 no momento em que a
 * pessoa está escolhendo onde o conteúdo do cliente dela vai sair.
 */
describe('a lista de Páginas não chega cortada', () => {
  const semCom = semComentarios(facebook);

  it('a paginação de /me/accounts é seguida', () => {
    /*
      `/me/accounts` devolve 25 por vez e o resto em `paging.next`. Lendo só a
      primeira resposta, quem administra trinta Páginas via as primeiras — sem
      erro e sem aviso.
    */
    const lista = semCom.slice(semCom.indexOf('export const paginasDoUsuario'));
    const corpo = lista.slice(0, lista.indexOf('export const publicarNoFacebook'));

    expect(corpo, 'a paginação de /me/accounts deixou de ser seguida').toMatch(
      /paging\?\.next/
    );
    expect(corpo, 'o limite por resposta voltou ao padrão de 25').toMatch(/limit=100/);
    // Sem teto, uma resposta com `next` sempre presente prende a função até o
    // tempo dela estourar.
    expect(corpo).toMatch(/MAX_PAGINACOES/);
  });

  it('a autorização pede a escolha das Páginas de novo', () => {
    /*
      A Meta guarda quais Páginas foram liberadas. Sem `auth_type=rerequest`,
      uma segunda tentativa **pula o diálogo** e devolve exatamente a mesma
      Página: reconectar não conserta uma liberação curta, e não há erro que
      explique isso.
    */
    const url = semCom.slice(semCom.indexOf('export const urlDeAutorizacao'));
    expect(url.slice(0, 700), 'a autorização voltou a reaproveitar a liberação anterior').toMatch(
      /auth_type=rerequest/
    );
  });

  it('uma Página só diz que foi a única que a Meta liberou', () => {
    /*
      Uma Página liberada e uma Página existente são indistinguíveis daqui. Sem
      a frase, quem administra várias conclui que o Orquesia não achou as
      outras — foi exatamente essa a conclusão de quem usou primeiro.
    */
    const semComCallback = semComentarios(callback);
    const ramo = semComCallback.slice(semComCallback.indexOf('paginas.length === 1'));

    expect(ramo.slice(0, 900)).toMatch(/única Página que o Facebook liberou/);
  });

  it('a tela de escolha diz o que fazer quando falta Página', () => {
    const semComCallback = semComentarios(callback);
    const tela = semComCallback.slice(
      semComCallback.indexOf('const paginaDeEscolha'),
      semComCallback.indexOf('const guardarConexao')
    );

    expect(tela).toMatch(/Não está vendo todas as suas Páginas/);
  });
});

/**
 * **`pages_read_engagement` era pedida e nunca usada.**
 *
 * A análise da Meta exige uma chamada de API bem-sucedida com a permissão
 * para liberá-la, e o Orquesia não fazia nenhuma: listar Páginas é
 * `pages_show_list`, publicar é `pages_manage_posts`. O envio simplesmente
 * não fechava, e o motivo não estava escrito em lugar nenhum.
 *
 * A saída não foi uma chamada de fachada — é a família do `trial_ends_at`,
 * agora ao contrário: uma permissão declarada sem uso. `dadosDaPagina` tem
 * leitor na tela, e é o que distingue duas Páginas de nome parecido antes de
 * o post do cliente sair no perfil errado.
 */
describe('a Página conectada é lida, e o número tem data', () => {
  const semCom = semComentarios(facebook);

  it('existe uma leitura da Página, e ela usa o token da Página', () => {
    expect(semCom, 'a leitura da Página sumiu — pages_read_engagement volta a ser pedida sem uso')
      .toMatch(/export const dadosDaPagina/);

    const corpo = semCom.slice(semCom.indexOf('export const dadosDaPagina'));
    expect(corpo.slice(0, 900)).toMatch(/fields=name,followers_count/);
    expect(corpo.slice(0, 900)).toMatch(/tokenDaPagina/);
  });

  it('a leitura não derruba a conexão quando falha', () => {
    // Seguidor é enfeite perto de conectar. Uma leitura que estoura não pode
    // custar a conexão inteira, que é o que a pessoa veio fazer.
    const corpo = semCom.slice(
      semCom.indexOf('export const dadosDaPagina'),
      semCom.indexOf('export const publicarNoFacebook')
    );

    expect(corpo).toMatch(/try \{/);
    expect(corpo).toMatch(/catch/);
  });

  it('nulo é não medi, nunca zero', () => {
    /*
      `?? 0` faria uma leitura falha parecer uma Página sem ninguém — a mesma
      regra de `post_metrics`, onde nenhuma coluna tem `default 0`.
    */
    const corpo = semCom.slice(
      semCom.indexOf('export const dadosDaPagina'),
      semCom.indexOf('export const publicarNoFacebook')
    );

    expect(corpo).not.toMatch(/followers_count \?\? 0|followers_count \|\| 0/);

    const migracao = ler('supabase', 'migrations', '20260923170000_seguidores_da_pagina.sql');
    expect(migracao).toMatch(/add column if not exists seguidores integer;/);
    expect(migracao, 'seguidores ganhou default — conexão antiga viraria Página sem ninguém')
      .not.toMatch(/seguidores integer[^;]*default/);
  });

  it('o número só aparece na tela com a data em que foi medido', () => {
    /*
      Seguidor muda todo dia. O número sozinho afirma o de hoje com o dado de
      quando a conexão foi criada — é a armadilha 9 num lugar barato de
      evitar, e a mesma razão de `post_metrics` ter `medido_em`.
    */
    const tela = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'clients', 'ConexoesDoPerfil.tsx'), 'utf-8')
    );

    expect(tela).toMatch(/seguidores/);
    // A frase, não o nome do campo: `conta.seguidoresEm` pode continuar no
    // arquivo com a data já fora da tela, que foi o que uma primeira versão
    // desta guarda deixou passar.
    expect(tela, 'o número de seguidores perdeu a data da medição').toMatch(/medido em/);
  });

  it('o agendador mantém o número verdadeiro', () => {
    // Conexão é coisa de uma vez só: sem esta passada, a tela mostraria para
    // sempre o número do dia em que a Página entrou, com cara de hoje.
    const cron = semComentarios(publicar);
    expect(cron).toMatch(/atualizarSeguidoresDasPaginas/);
    expect(cron, 'a atualização deixou de ter intervalo — seria uma chamada por passada')
      .toMatch(/INTERVALO_DE_SEGUIDORES_MS/);
  });
});
