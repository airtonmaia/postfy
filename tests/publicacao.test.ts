import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  REDES_QUE_PUBLICAM,
  publicaSozinho,
  COMO_PUBLICA,
  quandoDeveSair,
  proximaPassada,
  MINUTOS_ENTRE_PASSADAS,
  textoDoAgendamento,
  textoDaPublicacao,
  type ResultadoDoAgendamento,
  type ResultadoDaPublicacao,
} from '../src/lib/redes';
import { semComentarios } from './util/semComentarios';

/**
 * A tela não promete disparo que o servidor não faz.
 *
 * `JobPlatform` tem seis redes e a tela deixava marcar todas, mas
 * `api/publicar.ts` só fala com o Instagram. Para as outras cinco o conteúdo
 * ficava "Agendado" no quadro e **não publicava nunca** — sem erro em lugar
 * nenhum. Com o multicanal piorou: dá para marcar três redes e duas ficarem
 * mudas.
 *
 * Pior ainda: `agendarPublicacao` existia **sem nenhum chamador**. A
 * `publish_queue` não tinha produtor, então nem o Instagram publicava. A tela
 * chamava de "fila de disparos" a lista de jobs com status `scheduled`, que é
 * outra coisa.
 *
 * É a armadilha 9 no lugar mais caro do produto: o cliente aprovou, a agência
 * confiou na data, e a peça não foi ao ar. Nada disso quebra tipo, teste de
 * componente ou build.
 */

const RAIZ = join(__dirname, '..');


const publicarTs = semComentarios(
  readFileSync(join(RAIZ, 'api', 'publicar.ts'), 'utf-8')
);
const instagramTs = semComentarios(
  readFileSync(join(RAIZ, 'api', '_lib', 'instagram.ts'), 'utf-8')
);

describe('REDES_QUE_PUBLICAM não afirma mais do que existe', () => {
  it('toda rede da lista tem publicador no servidor', () => {
    // A guarda central: acrescentar 'facebook' aqui sem escrever o
    // publicador faz este teste falhar antes de a promessa chegar à tela.
    const servidor = `${publicarTs}\n${instagramTs}`;

    for (const rede of REDES_QUE_PUBLICAM) {
      expect(
        servidor.includes(`publicarNo${rede[0].toUpperCase()}${rede.slice(1)}`),
        `${rede} está na lista mas não tem publicarNo${rede} no servidor`
      ).toBe(true);
    }
  });

  it('a rota recusa conexão de rede que não publica', () => {
    /*
      O cinto: mesmo que a fila receba um item de outra rede, a rota não tenta
      publicar às cegas.

      **A guarda saiu da sintaxe.** Ela exigia o literal
      `conexao.platform !== 'instagram' && conexao.platform !== 'facebook'` e
      reprovou no dia em que as duas comparações viraram uma chamada a
      `publicaSozinho` — que é a mesma decisão, derivada da lista em vez de
      repetida. Guarda presa à forma obriga a editá-la junto com o código, e é
      assim que ela deixa de guardar. Agora mede o efeito: a recusa acontece, e
      quem decide quem passa é a lista.
    */
    const corpo = publicarTs.slice(publicarTs.indexOf('const publicarItem'));
    const recusa = corpo.slice(0, corpo.indexOf('ainda não implementada'));

    expect(recusa).toMatch(/publicaSozinho\(conexao\.platform\)|conexao\.platform !== '/);
    expect(publicarTs).toMatch(/ainda não implementada/);
  });

  it('toda rede do tipo tem uma explicação, inclusive as que não publicam', () => {
    // Sem isto, uma rede nova entra no seletor sem dizer o que acontece — que
    // é exatamente como as cinco chegaram aqui.
    const redes = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'] as const;
    for (const rede of redes) {
      expect(COMO_PUBLICA[rede], `${rede} sem explicação`).toBeTruthy();
    }
  });

  it('toda rede automática tem publicador no servidor', () => {
    /**
     * A guarda que segurou o Facebook até ele existir de verdade: `tela deriva
     * de `REDES_QUE_PUBLICAM` o que dizer, então acrescentar um nome ali é
     * **prometer disparo**. Sem o publicador no servidor, a promessa vira um
     * card "Agendado" cuja data passa e nada acontece.
     */
    const servidor = readdirSync(join(RAIZ, 'api', '_lib'))
      .map((f) => readFileSync(join(RAIZ, 'api', '_lib', f), 'utf-8'))
      .join('\n');

    for (const rede of REDES_QUE_PUBLICAM) {
      const nome = rede.charAt(0).toUpperCase() + rede.slice(1);
      expect(
        servidor,
        `${rede} está em REDES_QUE_PUBLICAM sem publicarNo${nome} no servidor — ` +
          `a tela promete disparo que não existe`
      ).toMatch(new RegExp(`export const publicarNo${nome}\\b`));
    }
  });

  it('quem não publica sozinho diz que a postagem é sua', () => {
    const redes = ['linkedin', 'tiktok', 'youtube', 'twitter'] as const;
    for (const rede of redes) {
      expect(publicaSozinho(rede), `${rede} virou automática sem publicador`).toBe(false);
      expect(COMO_PUBLICA[rede]).toMatch(/manual/i);
    }
  });
});

describe('a fila de publicação tem produtor', () => {
  const tela = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'publications', 'PublicationsView.tsx'), 'utf-8')
  );

  it('alguma tela chama agendarPublicacao', () => {
    // Ela existia sem chamador: a fila nunca recebia nada, e o agendador
    // nunca publicou — nem no Instagram.
    expect(tela).toContain('agendarPublicacao');
  });

  it('a tela mostra a fila de verdade, não os jobs com status scheduled', () => {
    expect(tela).toContain('listarFila');
  });

  it('enfileirar é explícito, nunca automático', () => {
    // Publicar no perfil do cliente não tem volta. Enfileirar ao montar a
    // tela, ou ao arrastar o card para "Agendado", publicaria sem ninguém
    // ter decidido — e postagem publicada não volta.
    //
    // A guarda é por ausência: nenhum efeito pode disparar o enfileiramento.
    // Procurar "está dentro de um onClick" seria frágil, porque a chamada
    // vive numa função nomeada declarada antes dos handlers.
    for (const efeito of tela.split('useEffect(').slice(1)) {
      // O fim do efeito é a chave que fecha a callback, seguida da lista de
      // dependências (`}, []);`) ou do fecha-parênteses direto (`})`).
      const fim = efeito.search(/\n\s*\}\s*[,)]/);
      const corpo = fim === -1 ? efeito : efeito.slice(0, fim);
      expect(corpo, 'um efeito passou a enfileirar sozinho').not.toMatch(
        /enfileirar\(|agendarPublicacao\(/
      );
    }

    // E continua saindo de um clique: toda chamada tem um onClick perto
    // acima dela. Casar o handler inteiro com regex não funciona — o corpo
    // da arrow tem chaves, e `[^}]*` para na primeira.
    const chamadas = [...tela.matchAll(/void enfileirar\(/g)];
    expect(chamadas.length, 'ninguém chama enfileirar').toBeGreaterThan(0);
    for (const chamada of chamadas) {
      expect(
        tela.slice(Math.max(0, (chamada.index ?? 0) - 200), chamada.index),
        'enfileirar chamado fora de um onClick'
      ).toContain('onClick=');
    }
  });

  it('dá para tirar da fila antes de ir ao ar', () => {
    // `cancelarPublicacao` também existia sem chamador. Fila sem porta de
    // saída obriga a mexer no banco para desmarcar um agendamento.
    expect(tela).toContain('cancelarPublicacao');
  });

  it('o seletor de canais avisa quem não publica sozinho', () => {
    /**
     * O aviso vive **onde a escolha é feita**, e a escolha passou a ser feita
     * num lugar só: o formulário compartilhado pelo cadastro e pelo editor.
     * A guarda apontava para `CreateJobModal.tsx` e seguiu o arquivo, não a
     * decisão — quando o seletor mudou de casa ela passou a medir uma tela
     * que já não tem seletor nenhum.
     */
    const formulario = semComentarios(
      readFileSync(
        join(RAIZ, 'src', 'components', 'jobs', 'FormularioDoConteudo.tsx'),
        'utf-8'
      )
    );
    expect(formulario).toContain('publicaSozinho');
    expect(formulario).toContain('REDES_QUE_PUBLICAM');
  });
});

/**
 * De quem é a conta conectada.
 *
 * `social_connections.client_id` estava no schema desde o começo e **nenhum
 * código escrevia nela**: toda conexão nascia órfã. O efeito não era uma
 * coluna vazia — era o agendador sem saber em qual perfil publicar, e por
 * isso a fila nunca recebia nada. É a mesma classe de bug de
 * `workspaces.trial_ends_at`: coluna que parece uma regra e não é.
 */
/**
 * O caminho de sessão em `api/publicar.ts` — o "Publicar agora (teste)".
 *
 * É a única porta da rota que não usa o segredo do cron, e ela publica no
 * perfil de um cliente de verdade. Três coisas não podem afrouxar:
 */
describe('publicar agora, por sessão', () => {
  it('reconfere o papel no banco, não no que o navegador diz', () => {
    // A mesma lista que a policy de INSERT da publish_queue aceita. Sem esta
    // conferência, qualquer membro publicaria no perfil do cliente.
    expect(publicarTs).toMatch(/PAPEIS_QUE_PUBLICAM/);
    expect(publicarTs).toMatch(/from\('workspace_members'\)/);
    expect(publicarTs).toMatch(/403/);
  });

  it('o que vai para a Meta sai do banco, nunca do corpo da requisição', () => {
    // A rota lê só o `jobId`. Aceitar legenda ou mídia do navegador deixaria
    // a sessão escolher o que é postado, sem passar pela aprovação.
    const corpoLido = publicarTs.match(/const \{ ([^}]*) \} = corpo \|\| \{\};/);
    expect(corpoLido?.[1].trim()).toBe('jobId');
  });

  it('conteúdo já publicado não é publicado de novo', () => {
    // Publicar duplicado é pior que não publicar, e um upsert cego por cima
    // de uma linha `publicado` faria exatamente isso.
    expect(publicarTs).toMatch(/JA_PUBLICADO/);
  });
});

describe('a conta conectada pertence a um cliente', () => {
  const callback = semComentarios(
    readFileSync(join(RAIZ, 'api', 'social-callback.ts'), 'utf-8')
  );
  const connect = semComentarios(
    readFileSync(join(RAIZ, 'api', 'social-connect.ts'), 'utf-8')
  );
  const conexoes = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'publications', 'ConexoesSociais.tsx'), 'utf-8')
  );

  it('o retorno do OAuth grava client_id', () => {
    expect(callback).toMatch(/client_id:\s*dados\.clientId/);
  });

  it('o cliente vem do estado assinado, nunca da query do retorno', () => {
    // Quem volta da Meta não traz sessão. Um clientId na URL do retorno
    // seria escolhido por quem quisesse — e postaria o conteúdo de um
    // cliente no perfil de outro.
    expect(callback).not.toMatch(/searchParams\.get\(['"]client/);
    expect(connect).toContain('montarEstado(workspaceId, usuario.id, segredo, clientId');
  });

  it('a rota confere que o cliente é da agência antes de assinar o estado', () => {
    expect(connect).toMatch(/from\('clients'\)/);
    expect(connect).toMatch(/\.eq\('workspace_id', workspaceId\)/);
  });

  it('a tela não deixa conectar sem escolher o cliente', () => {
    // Conexão sem cliente não publica nada: seria um botão que não faz nada,
    // que é exatamente como a coluna ficou vazia.
    expect(conexoes).toMatch(/disabled=\{conectando \|\| !clienteAlvo\}/);
    expect(conexoes).toContain('Escolha de qual cliente é esta conta');
  });
});

/**
 * Quando o item sai de fato.
 *
 * A tela dizia "na fila para 15:10" e o post saiu 15:15 — porque o clique
 * aconteceu às 15:10:07, sete segundos **depois** da passada das 15:10. Nada
 * estava quebrado, e mesmo assim pareceu falha: a tela contou a data marcada
 * e omitiu a cadência do agendador, que é o que fechava a expectativa.
 *
 * Omitir o que muda a expectativa é a armadilha 9 pela porta dos fundos.
 */
describe('a tela diz quando o post sai, não só a data marcada', () => {
  /**
   * O arredondamento, testado em `proximaPassada` e **não** em
   * `quandoDeveSair`.
   *
   * A primeira versão usava `quandoDeveSair` com uma data fixa de 2026-09-14,
   * e passou por cinco dias: `quandoDeveSair` trata data no passado como
   * agora — de propósito, é a regra do "agendei para agora" — então, assim
   * que o calendário alcançou a data escrita aqui, as duas asserções
   * passaram a receber a próxima passada a partir de *hoje*.
   *
   * O teste não pegou bug nenhum: ele apodreceu sozinho, com o código
   * intacto. É a mesma armadilha do teste de `descreverBuild` (8.2), e a
   * regra que fica é a mesma: **asserção com instante absoluto vai na função
   * que não olha o relógio.** A que olha tem o teste logo abaixo, que usa
   * `Date.now()` e por isso não envelhece.
   */
  const passada = (iso: string) => proximaPassada(new Date(iso)).toISOString();

  it('arredonda para a próxima passada de 5 minutos', () => {
    // O caso real: agendado para as 15:10, clicado 7 segundos depois.
    const agendado = new Date(Date.now() + 60_000); // daqui a um minuto
    const saida = quandoDeveSair(agendado);

    expect(saida.getTime()).toBeGreaterThanOrEqual(agendado.getTime());
    expect(saida.getTime() % (MINUTOS_ENTRE_PASSADAS * 60_000)).toBe(0);
    // Nunca mais de uma passada de espera.
    expect(saida.getTime() - agendado.getTime()).toBeLessThanOrEqual(
      MINUTOS_ENTRE_PASSADAS * 60_000
    );
  });

  it('um instante exatamente na passada não espera a seguinte', () => {
    // Meia-noite em UTC é múltiplo de 5 minutos.
    expect(passada('2026-09-14T00:05:00.000Z')).toBe('2026-09-14T00:05:00.000Z');
  });

  it('a conta sai do epoch, não do relógio local', () => {
    // O pg_cron dispara nos minutos múltiplos de 5 **em UTC**. Fuso de meia
    // hora (Índia) ou de 45 minutos (Nepal) não cai nos mesmos múltiplos que
    // o relógio de lá — usar `getMinutes()` erraria por minutos, em silêncio.
    expect(passada('2026-09-14T00:01:00.000Z')).toBe('2026-09-14T00:05:00.000Z');
    expect(passada('2026-09-14T00:04:59.999Z')).toBe('2026-09-14T00:05:00.000Z');
  });

  it('nenhuma asserção fixa data absoluta contra quem olha o relógio', () => {
    /**
     * A guarda que faltava quando os dois testes acima apodreceram.
     *
     * `quandoDeveSair` clampa data passada para agora, então qualquer
     * asserção que case a saída dela com um instante literal só vale
     * enquanto esse instante estiver no futuro — e o calendário sempre
     * alcança. Arredondamento se testa em `proximaPassada`, que não lê o
     * relógio; a regra do clamp se testa com `Date.now()`, que acompanha.
     */
    const fonte = readFileSync(join(RAIZ, 'tests', 'publicacao.test.ts'), 'utf-8');

    // O helper das asserções absolutas tem que sair da função que **não** lê
    // o relógio. A primeira versão desta guarda procurava o literal colado em
    // `quandoDeveSair(` e não achava nada: na prática o literal chega por um
    // helper, que era exatamente o caso real. Guarda que só procura o que
    // você lembrou de escrever não é guarda — a lição já está registrada em
    // `tests/tema-shadcn.test.ts`, e valeu de novo aqui.
    expect(
      fonte,
      'o helper das datas absolutas voltou a usar quandoDeveSair, que clampa ' +
        'para agora — as asserções expiram sozinhas quando o calendário alcança a data'
    ).toMatch(/const passada = \(iso: string\) => proximaPassada\(/);
  });

  it('data no passado vale como agora', () => {
    // "Agendei para agora" é o caso mais comum do botão, e o mais fácil de
    // errar: sem isto a conta devolveria uma passada que já aconteceu.
    const saida = quandoDeveSair(new Date(Date.now() - 3 * 60 * 60_000));
    expect(saida.getTime()).toBeGreaterThanOrEqual(Date.now());
  });

  it('quem monta o texto do agendamento diz a janela', () => {
    /**
     * **Esta guarda apontava para as telas, e o texto mudou de casa.**
     *
     * Ela exigia `de 5 em 5 minutos` dentro da `CreateJobModal` e `sai até`
     * dentro da `PublicationsView` — e as duas frases eram cópias, numa
     * mensagem que cada tela montava à mão. Foi por isso que as três telas
     * ficaram com o mesmo `find` errado ao lado: o que se copia, diverge.
     *
     * Agora quem monta é `textoDoAgendamento`, num lugar só, e é ele que a
     * guarda mede. O que ela protege é a decisão, não o arquivo: a espera de
     * até cinco minutos precisa estar **escrita**, senão ela parece falha —
     * quem agenda para 15:10 e clica às 15:10:07 espera até 15:15, e foi
     * exatamente o que aconteceu no primeiro teste do caminho agendado.
     */
    const redes = semComentarios(readFileSync(join(RAIZ, 'src', 'lib', 'redes.ts'), 'utf-8'));
    const corpo = redes.slice(redes.indexOf('export const textoDoAgendamento'));

    expect(corpo, 'o texto do agendamento deixou de calcular a próxima passada').toMatch(
      /quandoDeveSair\(/
    );
    expect(
      corpo,
      'o texto deixou de dizer o intervalo do agendador — a espera volta a parecer falha'
    ).toMatch(/MINUTOS_ENTRE_PASSADAS/);
    expect(corpo, 'o texto deixou de dizer até quando a peça deve sair').toMatch(/deve sair até/);

    // E ele chega às telas: função que ninguém chama é a armadilha do
    // `agendarPublicacao` sem chamador, que deixou a fila vazia por meses.
    const chamam = ['modals/CreateJobModal', 'modals/JobDetailModal', 'publications/PublicationsView'];
    for (const rel of chamam) {
      const fonte = semComentarios(
        readFileSync(join(RAIZ, 'src', 'components', `${rel}.tsx`), 'utf-8')
      );
      expect(fonte, `${rel} não usa textoDoAgendamento`).toMatch(/textoDoAgendamento\(/);
    }
  });
});

/**
 * O texto do agendamento, exercitado de verdade.
 *
 * `textoDoAgendamento` é **pura**, então dá para afirmar a saída em vez de
 * procurar strings na fonte — que é a diferença entre exercitar a decisão e
 * descrever o mecanismo. As asserções não olham a data: `quandoDeveSair` lê o
 * relógio, e teste com instante absoluto apodrece sozinho (foi o que aconteceu
 * com os dois testes de `quandoDeveSair` cinco dias depois de escritos).
 */
describe('o que a tela diz depois de agendar', () => {
  const conta = (nome: string, platform: 'instagram' | 'facebook') => ({
    id: `c-${nome}`,
    workspaceId: 'w1',
    clientId: 'cli1',
    platform,
    accountId: '1',
    accountName: nome,
    createdAt: '2026-01-01',
  });

  const vazio: ResultadoDoAgendamento = {
    enfileiradas: [],
    jaNaFila: [],
    semConta: [],
    manuais: [],
  };
  const quando = new Date(Date.now() + 3600_000).toISOString();

  it('nomeia as duas contas quando as duas entram na fila', () => {
    // O bug era exatamente este caso: a mensagem dizia uma conta só, porque
    // uma conta só tinha ido para a fila.
    const r = textoDoAgendamento(
      { ...vazio, enfileiradas: [conta('perfil_ig', 'instagram'), conta('pagina_fb', 'facebook')] },
      quando
    );
    expect(r.ok).toBe(true);
    expect(r.texto).toContain('@perfil_ig');
    expect(r.texto).toContain('@pagina_fb');
  });

  it('diz o que entrou E o que ficou de fora, na mesma mensagem', () => {
    /**
     * "Agendei em uma de duas" precisa ser dito por inteiro. A mensagem antiga
     * só falava da conta que entrou — e quem lia concluía que estava tudo
     * agendado.
     */
    const r = textoDoAgendamento(
      { ...vazio, enfileiradas: [conta('perfil_ig', 'instagram')], semConta: ['facebook'] },
      quando
    );
    expect(r.ok).toBe(true);
    expect(r.texto).toContain('@perfil_ig');
    expect(r.texto).toContain('Facebook');
    expect(r.texto).toContain('não tem conta conectada');
  });

  it('nada na fila não é sucesso', () => {
    /**
     * **A decisão que mais importa aqui.** A versão antiga devolvia
     * `ok: true` com "a postagem na data é sua" — verde, com cara de
     * resolvido, para um conteúdo que não vai sair sozinho. Foi o que fez o
     * primeiro agendamento parecer pronto sem estar.
     */
    const r = textoDoAgendamento({ ...vazio, semConta: ['instagram'] }, quando);
    expect(r.ok).toBe(false);
    expect(r.texto).toContain('Instagram');
  });

  it('rede que não publica sozinha é nomeada como manual', () => {
    const r = textoDoAgendamento({ ...vazio, manuais: ['linkedin', 'tiktok'] }, quando);
    expect(r.ok).toBe(false);
    expect(r.texto).toContain('LinkedIn');
    expect(r.texto).toContain('TikTok');
    expect(r.texto).toMatch(/manual/i);
  });

  it('já estar na fila não vira erro nem silêncio', () => {
    // A unicidade do banco recusa o par conteúdo/conta, e com vários canais
    // isso não pode derrubar os outros nem passar calado.
    const r = textoDoAgendamento({ ...vazio, jaNaFila: [conta('perfil_ig', 'instagram')] }, quando);
    expect(r.texto).toContain('já estava na fila');
    expect(r.texto).toContain('@perfil_ig');
  });

  it('conteúdo sem canal nenhum diz isso, em vez de mensagem vazia', () => {
    const r = textoDoAgendamento(vazio, quando);
    expect(r.ok).toBe(false);
    expect(r.texto.length).toBeGreaterThan(10);
  });
});

describe('nenhuma tela nomeia as redes automáticas à mão', () => {
  /**
   * **Uma frase da tela de Publicações dizia "O Instagram publica sozinho na
   * data", e a etiqueta logo ao lado dizia "instagram, facebook".**
   *
   * A frase foi escrita quando `REDES_QUE_PUBLICAM` tinha uma rede só. O
   * Facebook entrou na 2.53.0, a etiqueta — que deriva da constante — se
   * atualizou sozinha, e o parágrafo não: a mesma tela passou a se
   * contradizer, e nada acusou.
   *
   * É a armadilha 9 na direção inofensiva — em vez de prometer o que não
   * existe, ela escondia o que existe —, e custa igual de descobrir.
   *
   * A guarda procura o **efeito**: uma afirmação sobre quem publica sozinho
   * com o nome da rede escrito na frase. `COMO_PUBLICA` e `REDES_DA_META`
   * ficam de fora de propósito: ali o nome da rede **é** a chave, e é a fonte
   * de onde as telas derivam o texto.
   */
  it('a afirmação sai da constante, não de um nome digitado', () => {
    const telas = ['publications/PublicationsView', 'jobs/FormularioDoConteudo'];

    for (const rel of telas) {
      const fonte = semComentarios(
        readFileSync(join(RAIZ, 'src', 'components', `${rel}.tsx`), 'utf-8')
      );
      for (const rede of ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube']) {
        expect(
          fonte,
          `${rel} afirma que ${rede} publica sozinho com o nome escrito na frase — ` +
            'rede nova passa a contradizer a etiqueta derivada de REDES_QUE_PUBLICAM'
        ).not.toMatch(new RegExp(`${rede} publica sozinh`));
      }
    }
  });
});

describe('a publicação avisa quem precisa saber', () => {
  /**
   * **`type: 'publication'` existia desde a primeira migração e não tinha um
   * único produtor.** O cron publicava no perfil do cliente, ou falhava, e não
   * havia nada no sino, nada por e-mail e nada no celular — o único lugar em
   * que a falha aparecia era a tela de Publicações, que alguém precisava
   * abrir. Um post marcado para as 9h que falhou de madrugada só era
   * descoberto quando o cliente perguntava.
   *
   * É a família do `trial_ends_at`: um valor declarado que parece uma regra e
   * não é. Quem lê o schema conclui que o aviso existe.
   */
  const corpoDoCron = publicarTs.slice(
    publicarTs.indexOf('for (const item of itens)'),
    publicarTs.indexOf('const publicarUmAgora')
  );

  it('a guarda está medindo o laço do cron', () => {
    // Sem isto, um marcador que mudasse de nome deixaria `slice` devolver
    // string vazia e **todas** as asserções abaixo passariam sem medir nada —
    // que é exatamente como a guarda do `aria-label` afirmou sobre o lugar
    // errado sem falhar.
    expect(corpoDoCron.length).toBeGreaterThan(200);
    expect(corpoDoCron).toMatch(/publicarItem\(/);
    expect(publicarTs.indexOf('const publicarUmAgora')).toBeGreaterThan(0);
  });

  it('o tipo que não tinha produtor passou a ter', () => {
    expect(publicarTs).toMatch(/type: 'publication'/);
    expect(publicarTs).toMatch(/from\('notifications'\)\s*\.insert\(/);
  });

  it('avisa nos três desfechos, e cada um lê diferente', () => {
    // "Publicado" e "publicado pela metade" lendo igual seria o desfecho que
    // mais passa despercebido voltando a passar: a fila diz `publicado`, o
    // story não saiu, e `last_error` guarda um motivo que ninguém abre.
    expect(corpoDoCron).toMatch(/tipo: 'publicado'/);
    expect(corpoDoCron).toMatch(/tipo: 'parcial'/);
    expect(corpoDoCron).toMatch(/tipo: 'falhou'/);
  });

  it('a falha só avisa depois de esgotar as tentativas', () => {
    /*
      Entre as tentativas o item volta para `pendente` e a passada seguinte
      tenta de novo. Avisar ali daria três avisos para uma falha que talvez se
      resolvesse sozinha — e ensinar a ignorar o sino é perder justamente o
      aviso que importa.
    */
    const aviso = corpoDoCron.indexOf("{ tipo: 'falhou'");
    expect(aviso, 'o aviso de falha sumiu do laço').toBeGreaterThan(-1);

    const linha = corpoDoCron.slice(corpoDoCron.lastIndexOf('\n', aviso) + 1, aviso);
    expect(linha, 'o aviso de falha deixou de depender de `esgotou`').toMatch(
      /if \(esgotou\)/
    );
  });

  it('o aviso nunca derruba a passada', () => {
    // Ele roda dentro do laço que publica. Uma exceção ali trocaria o
    // compromisso da rota — publicar — pelo acessório dela. É a mesma regra
    // de `empurrarNotificacoes`.
    const fn = publicarTs.slice(publicarTs.indexOf('const avisarNoPainel'));
    const corpo = fn.slice(0, fn.indexOf('\n};'));

    expect(corpo.length).toBeGreaterThan(200);
    expect(corpo, 'o aviso passou a poder lançar').toMatch(/try \{/);
    expect(corpo).toMatch(/catch/);
  });

  it('só o cron avisa — "publicar agora" tem alguém olhando a tela', () => {
    /*
      O caminho manual devolve o desfecho para quem clicou, e a tela mostra na
      hora. Um aviso para o que já está à vista é ruído — é a mesma razão de o
      webhook não ter ido para a fila de e-mail.
    */
    const inicioDoManual = publicarTs.indexOf('const publicarUmAgora');
    const chamadas = [...publicarTs.matchAll(/await avisarNoPainel\(/g)].map(
      (m) => m.index!
    );

    expect(chamadas.length, 'o aviso sumiu do cron').toBeGreaterThan(1);
    for (const posicao of chamadas) {
      expect(
        posicao,
        'o caminho de "publicar agora" passou a avisar — a tela já mostra'
      ).toBeLessThan(inicioDoManual);
    }
  });

  it('o aviso leva para a fila, onde o motivo está à vista', () => {
    expect(publicarTs).toMatch(/tab: 'publicacoes'/);
  });
});

/**
 * **Publicar agora saía no perfil errado.**
 *
 * A rota escolhia a conta com `.eq('platform', 'instagram').maybeSingle()` e
 * **ignorava `job.canais`**. Uma peça marcada só como Facebook era publicada
 * no Instagram do cliente, e a tela respondia "Publicado em @conta" — a conta
 * certa, a rede errada, nada acusando. Aconteceu em produção.
 *
 * No cadastro o botão nem aparecia (`dados.canais.includes('instagram')`), o
 * que escondia metade do problema: quem marcasse só Facebook não via o botão
 * na modal de criação e via na de detalhe, onde ele publicava no lugar errado.
 *
 * As duas metades são o mesmo erro — um nome de rede escrito à mão onde
 * `REDES_QUE_PUBLICAM` já decide —, e é isso que estas guardas medem.
 */
describe('publicar agora segue os canais da peça', () => {
  it('a rota lê os canais do conteúdo', () => {
    // Sem `canais` na consulta, a rede marcada não chega à decisão — que é
    // exatamente como o Instagram virou destino de um post de Facebook.
    expect(publicarTs).toMatch(/\.select\('id, workspace_id, client_id, canais, platform'\)/);
  });

  it('a conta é escolhida pela rede do canal, não por uma rede escrita à mão', () => {
    const rotaAgora = publicarTs.slice(publicarTs.indexOf('const publicarUmAgora'));
    const escolha = rotaAgora.slice(
      rotaAgora.indexOf("from('social_connections')"),
      rotaAgora.indexOf('const publicadas')
    );

    expect(escolha).toMatch(/\.in\('platform',/);
    expect(
      escolha,
      'a escolha da conta voltou a fixar uma rede: uma peça de Facebook sai no Instagram'
    ).not.toMatch(/\.eq\('platform', '\w+'\)/);
  });

  it('publica em todos os canais automáticos, não no primeiro', () => {
    const rotaAgora = publicarTs.slice(publicarTs.indexOf('const publicarUmAgora'));
    // O laço é o que separa "publiquei numa de duas" de "publiquei nas duas".
    expect(rotaAgora).toMatch(/for \(const \[rede, conexao\] of porRede\)/);
    expect(rotaAgora).toMatch(/publicadas\.push/);
  });

  it('o que o servidor honra espelha o que a tela promete', () => {
    // Duas listas, dois lados. Divergir não quebra nada até alguém marcar o
    // canal novo — a mesma classe do `check` de `jobs.format`.
    const doServidor = publicarTs
      .match(/const REDES_QUE_PUBLICAM = \[([^\]]*)\] as const;/)?.[1]
      .split(',')
      .map((r) => r.trim().replace(/'/g, ''))
      .filter(Boolean);

    expect(doServidor, 'api/publicar.ts não declara mais a lista de redes').toBeTruthy();
    expect([...(doServidor as string[])].sort()).toEqual([...REDES_QUE_PUBLICAM].sort());
  });

  it('o conteúdo só vira publicado se alguma rede aceitou', () => {
    const rotaAgora = publicarTs.slice(publicarTs.indexOf('const publicarUmAgora'));
    const marcaOJob = rotaAgora.indexOf("status: 'published'");
    const guarda = rotaAgora.lastIndexOf('if (publicadas.length)', marcaOJob);

    expect(
      guarda >= 0 && guarda < marcaOJob,
      'o job é marcado como publicado sem conferir se alguma rede aceitou'
    ).toBe(true);
  });

  it('nenhuma tela decide o botão de publicar por um nome de rede', () => {
    /*
      A guarda procura o **efeito**: uma tela perguntando se um canal
      específico está marcado. `publicaSozinho` é a resposta certa, e ela
      acompanha REDES_QUE_PUBLICAM sozinha.
    */
    const pasta = join(RAIZ, 'src', 'components', 'modals');
    const arquivos = readdirSync(pasta).filter((n) => n.endsWith('.tsx'));
    expect(arquivos.length).toBeGreaterThan(0);

    for (const nome of arquivos) {
      const fonte = semComentarios(readFileSync(join(pasta, nome), 'utf-8'));
      for (const rede of REDES_QUE_PUBLICAM) {
        expect(
          fonte,
          `${nome} pergunta por '${rede}' à mão — rede nova entra em REDES_QUE_PUBLICAM ` +
            'e o botão continua escondido, que foi o caso do Facebook'
        ).not.toMatch(new RegExp(`canais\\.includes\\('${rede}'\\)`));
      }
    }
  });

  it('as duas modais dizem em qual rede a peça saiu', () => {
    // `Publicado em @conta` não nomeia a rede, e foi essa frase que deixou o
    // post de Facebook aparecer no Instagram com a tela em verde.
    for (const nome of ['CreateJobModal', 'JobDetailModal']) {
      const fonte = semComentarios(
        readFileSync(join(RAIZ, 'src', 'components', 'modals', `${nome}.tsx`), 'utf-8')
      );
      expect(fonte, `${nome} não usa textoDaPublicacao`).toMatch(/textoDaPublicacao\(/);
      expect(fonte, `${nome} volta a montar o texto da publicação à mão`).not.toMatch(
        /Publicado em @\$\{/
      );
    }
  });
});

describe('o que a tela diz depois de publicar', () => {
  const vazio = (): ResultadoDaPublicacao => ({
    publicadas: [],
    falhas: [],
    semConta: [],
    manuais: [],
  });

  it('nomeia a rede, não só a conta', () => {
    const { ok, texto } = textoDaPublicacao({
      ...vazio(),
      publicadas: [{ rede: 'facebook', conta: 'Minha Página', externalId: '1' }],
    });

    expect(ok).toBe(true);
    expect(texto).toContain('Facebook');
    expect(texto).toContain('@Minha Página');
    // A prova do bug: com a rede na frase, "saiu no Instagram" é legível.
    expect(texto).not.toContain('Instagram');
  });

  it('duas redes publicadas aparecem as duas', () => {
    const { texto } = textoDaPublicacao({
      ...vazio(),
      publicadas: [
        { rede: 'instagram', conta: 'cliente', externalId: '1' },
        { rede: 'facebook', conta: 'Página', externalId: '2' },
      ],
    });

    expect(texto).toContain('Instagram');
    expect(texto).toContain('Facebook');
  });

  it('uma saiu e a outra não é problema, não sucesso', () => {
    const { ok, texto } = textoDaPublicacao({
      ...vazio(),
      publicadas: [{ rede: 'instagram', conta: 'cliente', externalId: '1' }],
      falhas: [{ rede: 'facebook', conta: 'Página', motivo: 'Token expirado.' }],
    });

    expect(ok).toBe(false);
    expect(texto).toContain('Instagram');
    expect(texto).toContain('Facebook: Token expirado.');
  });

  it('o aviso do story não se perde no meio do sucesso', () => {
    const { ok, texto } = textoDaPublicacao({
      ...vazio(),
      publicadas: [
        { rede: 'instagram', conta: 'cliente', externalId: '1', aviso: 'O feed saiu. O story não.' },
      ],
    });

    expect(ok).toBe(false);
    expect(texto).toContain('O story não.');
  });

  it('rede sem conta conectada é nomeada, não silenciada', () => {
    const { ok, texto } = textoDaPublicacao({ ...vazio(), semConta: ['facebook'] });

    expect(ok).toBe(false);
    expect(texto).toContain('Facebook');
    expect(texto).toContain('não tem conta conectada');
  });

  it('conteúdo sem canal automático diz isso em vez de mensagem vazia', () => {
    const { ok, texto } = textoDaPublicacao(vazio());
    expect(ok).toBe(false);
    expect(texto.length).toBeGreaterThan(0);
  });
});
