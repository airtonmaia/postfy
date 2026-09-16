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
} from '../src/lib/redes';

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

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
    // O cinto: mesmo que a fila receba um item de outra rede, a rota não
    // tenta publicar às cegas.
    expect(publicarTs).toMatch(
      /conexao\.platform !== 'instagram' && conexao\.platform !== 'facebook'/
    );
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
    const modal = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'modals', 'CreateJobModal.tsx'), 'utf-8')
    );
    // O aviso vive onde a escolha é feita. Descobrir na data agendada é tarde.
    expect(modal).toContain('publicaSozinho');
    expect(modal).toContain('REDES_QUE_PUBLICAM');
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

  it('as duas telas dizem a janela', () => {
    const modal = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'modals', 'CreateJobModal.tsx'), 'utf-8')
    );
    expect(modal).toMatch(/quandoDeveSair\(/);
    expect(modal).toMatch(/de 5 em 5 minutos/);

    const publicacoes = semComentarios(
      readFileSync(
        join(RAIZ, 'src', 'components', 'publications', 'PublicationsView.tsx'),
        'utf-8'
      )
    );
    expect(publicacoes).toMatch(/quandoDeveSair\(/);
    expect(publicacoes).toMatch(/sai até/);
  });
});
