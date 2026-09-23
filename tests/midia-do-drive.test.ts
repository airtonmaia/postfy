import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  PREFIXO_DO_DRIVE,
  referenciaDoDrive,
  dadosDoDrive,
  ehDoDrive,
  urlDeExibicao,
  urlNoDrive,
  ehVideo,
  quantasNoDrive,
} from '../src/lib/midiaDoDrive';
import { semComentarios } from './util/semComentarios';

/**
 * A arte mora no Drive; o R2 é passagem.
 *
 * O pedido era que o vídeo não ocupasse espaço no Cloudflare. O que torna
 * isso possível é uma referência `drive://` dentro de `media_urls` — e o que
 * torna isso **perigoso** é que quem baixa a mídia é a Meta, sem sessão: um
 * link do Drive devolve HTML, e publicar com ele sai errado ou não sai, com a
 * fila dizendo que deu certo.
 *
 * Todas as guardas abaixo protegem a mesma decisão: a referência nunca chega
 * à Meta, e a cópia que chega é apagada depois.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf-8');

describe('a referência do Drive vai e volta inteira', () => {
  const arquivo = {
    id: '1AbC_dEf',
    nome: 'corte final.mp4',
    tipo: 'video/mp4',
    miniatura: 'https://lh3.googleusercontent.com/d/1AbC?sz=w200',
  };

  it('guarda e devolve os mesmos dados', () => {
    const referencia = referenciaDoDrive(arquivo);

    expect(referencia.startsWith(PREFIXO_DO_DRIVE)).toBe(true);
    expect(dadosDoDrive(referencia)).toEqual(arquivo);
  });

  it('nome com acento, espaço e E comercial sobrevive', () => {
    // O nome vai para a URL e volta dela. Sem codificar, um E comercial no
    // nome cortaria a miniatura fora — e o defeito só apareceria no arquivo
    // de alguém, meses depois.
    const complicado = { ...arquivo, nome: 'Reels — Ação & Saúde (v2).mp4' };
    expect(dadosDoDrive(referenciaDoDrive(complicado))?.nome).toBe(complicado.nome);
  });

  it('URL comum não é confundida com referência', () => {
    const doR2 = 'https://midia.orquesia.com.br/ws/123-abc-video.mp4';

    expect(ehDoDrive(doR2)).toBe(false);
    expect(dadosDoDrive(doR2)).toBeNull();
    expect(urlDeExibicao(doR2)).toBe(doR2);
    expect(urlNoDrive(doR2)).toBeNull();
  });

  it('o que a tela desenha é a miniatura, nunca a referência', () => {
    /*
      Uma tag de imagem apontando para a referência não desenha nada. O
      tradutor existe para que nenhuma tela precise saber disso.
    */
    expect(urlDeExibicao(referenciaDoDrive(arquivo))).toBe(arquivo.miniatura);
  });

  it('sem miniatura, a tela recebe vazio em vez de um endereço quebrado', () => {
    const semFoto = referenciaDoDrive({ ...arquivo, miniatura: undefined });
    expect(urlDeExibicao(semFoto)).toBe('');
  });

  it('vídeo é reconhecido pelo tipo do Google, não pela extensão', () => {
    // O nome no Drive pode não ter extensão nenhuma.
    expect(ehVideo(referenciaDoDrive({ ...arquivo, nome: 'sem extensao' }))).toBe(true);
    expect(ehVideo(referenciaDoDrive({ ...arquivo, tipo: 'image/png' }))).toBe(false);
    expect(ehVideo('https://midia.orquesia.com.br/a.mp4')).toBe(true);
  });

  it('conta quantas artes ainda estão no Drive, feed e story juntos', () => {
    const doDrive = referenciaDoDrive(arquivo);
    expect(quantasNoDrive([doDrive, 'https://x/y.png'], [doDrive])).toBe(2);
    expect(quantasNoDrive(['https://x/y.png'], undefined)).toBe(0);
  });
});

describe('a referência do Drive nunca chega à Meta', () => {
  const publicar = semComentarios(ler('api', 'publicar.ts'));

  it('o publicador recusa uma arte que ainda está no Drive', () => {
    /*
      O cinto. A Meta baixa a mídia da URL que mandamos, e a referência não é
      uma URL — e um link do Drive de verdade devolveria HTML. Sem esta
      recusa, a peça publicaria algo que ninguém escolheu, no perfil do
      cliente, e post não volta.
    */
    expect(publicar, 'o publicador deixou de recusar arte que está só no Drive').toMatch(
      /startsWith\('drive:\/\/'\)/
    );
  });

  it('o que vai para a Meta é a cópia, e a cópia vence a lista da tela', () => {
    // `media_urls` é o que o cliente aprovou e pode conter a referência.
    // `midia_publicavel` é a cópia no R2, escrita na hora de agendar.
    expect(publicar).toMatch(/publicavel\.feed \|\| \[\]/);
    expect(publicar).toMatch(/publicavel\.story \|\| \[\]/);
  });

  it('a cópia é feita antes de qualquer linha entrar na fila', () => {
    /*
      Depois seria tarde: o agendador passa de cinco em cinco minutos e
      publicaria uma peça cuja arte está num lugar de onde a Meta não baixa.
    */
    const redes = semComentarios(ler('src', 'lib', 'redes.ts'));
    const agendar = redes.slice(redes.indexOf('export const agendarPublicacao'));
    const preparo = agendar.indexOf('prepararMidiaDoDrive(');
    const fila = agendar.indexOf('enfileirarNaConta(');

    expect(preparo, 'o agendamento deixou de trazer a arte do Drive').toBeGreaterThan(-1);
    expect(preparo).toBeLessThan(fila);
  });

  it('publicar agora também traz a arte antes de chamar o servidor', () => {
    const redes = semComentarios(ler('src', 'lib', 'redes.ts'));
    const agora = redes.slice(redes.indexOf('export const publicarAgora'));
    const preparo = agora.indexOf('prepararMidiaDoDrive(');
    const chamada = agora.indexOf("fetch('/api/publicar'");

    expect(preparo).toBeGreaterThan(-1);
    expect(preparo).toBeLessThan(chamada);
  });

  it('cópia pela metade não agenda nada', () => {
    /*
      Um `midia_publicavel` incompleto faria a peça publicar sem a página que
      faltou — e carrossel incompleto no perfil do cliente não volta.
    */
    const preparar = semComentarios(ler('src', 'lib', 'midiaParaPublicar.ts'));
    const grava = preparar.indexOf('update({ midia_publicavel');
    const desiste = preparar.indexOf('if (falhas.length) return');

    expect(desiste).toBeGreaterThan(-1);
    expect(desiste, 'a gravação passou a acontecer antes da conferência de falhas').toBeLessThan(
      grava
    );
  });
});

describe('a cópia no R2 é temporária de verdade', () => {
  const publicar = semComentarios(ler('api', 'publicar.ts'));

  const limpeza = publicar.slice(
    publicar.indexOf('const limparCopiaDoDrive'),
    publicar.indexOf('const MARGEM_DE_RENOVACAO_MS')
  );

  it('a guarda está medindo a limpeza', () => {
    expect(limpeza.length).toBeGreaterThan(100);
  });

  it('o agendador apaga a cópia depois de a peça ir ao ar', () => {
    // Sem isto, "não ocupar espaço" vira "ocupar o mesmo espaço com um passo
    // a mais", que é pior que não ter feito nada.
    expect(publicar).toMatch(/limparCopiaDoDrive/);
    expect(publicar).toMatch(/apagarObjeto\(chave\)/);
  });

  it('só apaga o que a própria peça nomeia', () => {
    /*
      Derivar a chave da URL pública seria adivinhar o caminho, e um engano
      ali apaga arte que a agência subiu do computador — a que não tem cópia
      em lugar nenhum.
    */
    expect(limpeza).toMatch(/midia_publicavel\?\.chaves/);
    expect(limpeza, 'a limpeza passou a derivar a chave do endereço público').not.toMatch(
      /R2_PUBLIC_BASE_URL/
    );
  });

  it('não apaga enquanto outra rede ainda espera a peça', () => {
    /*
      Um conteúdo marcado para Instagram e Facebook tem duas linhas na fila.
      Apagar depois da primeira deixaria a segunda sem arquivo, e a rede que
      falta falharia com "não foi possível baixar a mídia" — sem nada
      indicando que o problema fomos nós.
    */
    const confere = limpeza.indexOf("in('status', ['pendente', 'publicando'])");
    const apaga = limpeza.indexOf('apagarObjeto(');

    expect(confere).toBeGreaterThan(-1);
    expect(confere).toBeLessThan(apaga);
  });

  it('a limpeza nunca derruba a passada', () => {
    // A peça já está no ar. Um arquivo que sobrou no balde é desperdício;
    // uma exceção aqui atrasaria a publicação de todo mundo.
    expect(limpeza).toMatch(/try \{/);
    expect(limpeza).toMatch(/catch/);
  });
});

describe('toda tela que desenha arte passa pelo tradutor', () => {
  /**
   * A lista é **derivada**, não escrita à mão: tela nova que desenhe
   * `mediaUrls` e esqueça o tradutor mostra um quadro vazio para a arte que
   * veio do Drive — e ninguém descobre até um cliente abrir o portal.
   *
   * Lista literal teria de ser editada junto com o código, e é assim que uma
   * guarda deixa de guardar.
   */
  const arquivosDeTela = (pasta: string): string[] => {
    const cheio = join(RAIZ, 'src', 'components', pasta);
    return readdirSync(cheio)
      .filter((n) => n.endsWith('.tsx'))
      .map((n) => join(cheio, n));
  };

  const telas = [
    'calendar',
    'common',
    'jobs',
    'kanban',
    'modals',
    'portal',
    'publications',
  ].flatMap(arquivosDeTela);

  it('a varredura encontra as telas', () => {
    expect(telas.length).toBeGreaterThan(15);
  });

  it('nenhuma tela desenha uma URL de mídia crua', () => {
    /*
      As duas formas que existem hoje: a arte tirada de mediaUrls e a arte
      recebida por prop num componente de prévia.

      A primeira versão desta guarda ancorava a alternativa do url com início
      e fim de linha, e as âncoras nunca casam no meio da linha: a forma por
      prop passava intacta. Conferida ao contrário nas duas formas, agora
      reprova as duas.
    */
    for (const caminho of telas) {
      const fonte = semComentarios(readFileSync(caminho, 'utf-8'));

      /*
        O recorte importa: `Avatar.tsx` também desenha um `src={url}`, e é a
        foto de uma pessoa, não a arte da peça. Reprovar código correto ensina
        a ignorar a guarda — foi o que a primeira versão desta fez.

        O corte é o arquivo falar de mídia de conteúdo. As duas prévias
        recebem a arte por prop e citam `midia`; o avatar não cita nenhum dos
        dois.
      */
      if (!/mediaUrls|midia/.test(fonte)) continue;

      const achados: string[] =
        fonte.match(/src=\{(?!urlDeExibicao)(url|mediaUrl|[\w$.]*mediaUrls\[0\])\}/g) || [];

      /*
        Quem chama `ehDoDrive` decide caso a caso, e o `MediaUploader` é
        exatamente isso: ele desenha a miniatura no ramo do Drive e a URL
        crua no ramo do R2 — onde ela está certa, porque aquele ramo só roda
        para arte que já é publicável.

        O corte é derivado (o arquivo citar `ehDoDrive`), não uma lista de
        nomes: lista de nomes teria de ser editada junto com o código. E ele
        vale só para a forma por prop; `mediaUrls[0]` continua sendo cobrado
        em todo lugar.
      */
      const decidePorConta = fonte.includes('ehDoDrive');
      const cruas = decidePorConta ? achados.filter((a) => a.includes('mediaUrls')) : achados;

      expect(
        cruas,
        `${caminho.split(/[\\/]/).pop()} desenha a arte sem urlDeExibicao — a peça do ` +
          'Drive aparece como quadro vazio'
      ).toEqual([]);
    }
  });
});

describe('o escopo do Google é o que não exige verificação', () => {
  const google = semComentarios(ler('src', 'lib', 'google.ts'));

  it('é drive.file, e não a conta inteira', () => {
    /*
      `drive.file` dá acesso só aos arquivos escolhidos no seletor, um a um, e
      por isso é escopo não sensível — não passa pela verificação do Google.
      `drive.readonly` leria a conta inteira, exigiria verificação e não daria
      nada a mais: a escolha acontece no seletor de qualquer jeito.
    */
    expect(google).toMatch(/auth\/drive\.file/);
    expect(google, 'entrou um escopo que obriga à verificação do Google').not.toMatch(
      /auth\/drive\.readonly/
    );
  });

  it('o download pede os bytes, não os metadados', () => {
    // Sem `alt=media` vem o JSON com os metadados — e o R2 receberia um
    // arquivo de trezentos bytes com nome de vídeo, que só daria erro quando
    // a Meta tentasse baixá-lo.
    expect(google).toMatch(/alt=media/);
  });

  it('a tela diz o que falta configurar, com o nome da variável', () => {
    const uploader = semComentarios(ler('src', 'components', 'common', 'MediaUploader.tsx'));

    expect(google).toMatch(/VITE_GOOGLE_CLIENT_ID/);
    expect(google).toMatch(/VITE_GOOGLE_API_KEY/);
    expect(uploader, 'o botão do Drive deixou de dizer o que falta').toMatch(/faltaDoGoogle\(\)/);
  });

  it('não entrou rota nova em api/', () => {
    // São 12 de 12 funções no plano Hobby, e a 13ª derruba o deploy inteiro
    // com tudo verde localmente (armadilha 6).
    const rotas = readdirSync(join(RAIZ, 'api')).filter((n) => n.endsWith('.ts'));
    expect(rotas.length).toBeLessThanOrEqual(12);
  });
});

/**
 * **O seletor do Google abria e não deixava clicar em nada.**
 *
 * O Radix torna a modal *modal* de três formas ao mesmo tempo: põe
 * `pointer-events: none` no `body`, prende o foco dentro dela, e fecha ao
 * primeiro clique de fora. Uma janela injetada direto no `body` — que é como
 * o seletor do Google funciona — cai nas três.
 *
 * O sintoma engana: ela aparece **visível e por cima**, então parece
 * z-index. Não é; é o clique que não atravessa. E nada local acusa: `tsc`
 * compila, o vitest não monta componente e o `vite build` não mede caixa. É a
 * armadilha 0 outra vez, na camada em que só abrir a tela mostra.
 */
describe('janela de terceiro por cima de uma modal recebe clique', () => {
  const dialogo = semComentarios(ler('src', 'components', 'ui', 'dialog.tsx'));
  const css = ler('src', 'index.css');

  it('o clique volta a atravessar até a janela de fora', () => {
    // `pointer-events: auto` é o que devolve o clique. Sem ele a janela
    // aparece e não responde a nada.
    expect(css).toMatch(/\.picker-dialog[^{]*\{[^}]*pointer-events:\s*auto\s*!important/);
  });

  it('a regra fica fora de camada, para vencer sem depender de especificidade', () => {
    // Mesma razão da folha de marca injetada pelo tema: fora de `@layer`
    // vence o que está dentro, e foi medido no Chromium.
    const regra = css.indexOf('.picker-dialog');
    const ultimaCamada = css.lastIndexOf('@layer');

    expect(regra).toBeGreaterThan(-1);
    expect(regra, 'a regra do seletor entrou dentro de uma camada').toBeGreaterThan(ultimaCamada);
  });

  it('clicar na janela de fora não fecha a modal por baixo', () => {
    /*
      Para o Radix, clicar no seletor é "clicar fora". Fechar ali perderia o
      formulário inteiro, com a pessoa no meio de escolher a arte.
    */
    /*
      Os três, e **cada um com a exceção dentro**. A primeira versão desta
      guarda só exigia que os nomes aparecessem: tirando o `preventDefault`
      de um deles, ela continuava aprovando — e é justamente o do foco que
      faz o campo de busca do seletor aceitar o que se digita.
    */
    for (const gancho of ['onPointerDownOutside', 'onInteractOutside', 'onFocusOutside']) {
      const corpo = dialogo.slice(dialogo.indexOf(`${gancho}={`));

      expect(corpo.length, `${gancho} sumiu do primitivo`).toBeGreaterThan(0);
      expect(
        corpo.slice(0, 200),
        `${gancho} deixou de abrir exceção para a janela de fora`
      ).toMatch(/veioDeJanelaDeFora\(evento\.target\)\) evento\.preventDefault\(\)/);
    }
  });

  it('a exceção vale só para a janela de fora', () => {
    /*
      Clique no fundo continua fechando — é o que o Esc e o clique fora
      existem para fazer. Um `preventDefault` incondicional trocaria um
      defeito por outro, e o outro seria a modal que não fecha.
    */
    const guarda = dialogo.slice(dialogo.indexOf('onPointerDownOutside'));
    expect(guarda.slice(0, 300)).toMatch(/if \(veioDeJanelaDeFora/);
  });

  it('a regra mora no primitivo, não em cada tela', () => {
    // Repetida em cada modal, a próxima nasceria sem ela — é a história das
    // doze alturas de botão e das sete barras de abas.
    const modais = readdirSync(join(RAIZ, 'src', 'components', 'modals')).filter((n) =>
      n.endsWith('.tsx')
    );

    for (const nome of modais) {
      const fonte = semComentarios(readFileSync(join(RAIZ, 'src', 'components', 'modals', nome), 'utf-8'));
      expect(
        fonte,
        `${nome} escreve a exceção da janela de fora à mão — ela pertence ao primitivo`
      ).not.toMatch(/picker-dialog/);
    }
  });
});
