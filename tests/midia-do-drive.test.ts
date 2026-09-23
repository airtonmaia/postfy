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
  /*
    A autorização mudou de lado: era pedida no navegador a cada peça, e agora
    é da agência, com o `refresh_token` guardado no servidor. Por isso a
    guarda do escopo passou a ler o arquivo do servidor — ela estava ancorada
    no lugar onde o escopo morava, não na decisão que ela protege.
  */
  const servidor = semComentarios(ler('api', '_lib', 'googleDrive.ts'));

  it('é drive.file, e não a conta inteira', () => {
    /*
      `drive.file` dá acesso só aos arquivos escolhidos no seletor, um a um, e
      por isso é escopo não sensível — não passa pela verificação do Google.
      `drive.readonly` leria a conta inteira, exigiria verificação e não daria
      nada a mais: a escolha acontece no seletor de qualquer jeito.
    */
    expect(servidor).toMatch(/auth\/drive\.file/);
    expect(servidor, 'entrou um escopo que obriga à verificação do Google').not.toMatch(
      /auth\/drive\.readonly/
    );
  });

  it('a autorização pede acesso continuado, e pede o consentimento de novo', () => {
    /*
      Os dois andam juntos. Sem `access_type=offline` o Google não devolve
      refresh token e a conexão morre em uma hora, calada. Sem
      `prompt=consent` ele só o devolve na **primeira** autorização daquela
      conta — reconectar depois de um problema traria uma resposta sem ele, e
      a tela diria "conectado" sobre algo que não sobrevive à tarde.
    */
    const url = servidor.slice(servidor.indexOf('export const urlDeAutorizacao'));
    expect(url.slice(0, 900)).toMatch(/access_type=offline/);
    expect(url.slice(0, 900)).toMatch(/prompt=consent/);
  });

  it('sem refresh token a conexão não é dada como feita', () => {
    // "Conectado" sobre uma credencial que dura uma hora é a armadilha 9 no
    // lugar mais caro: a peça agendada falha de madrugada.
    const callback = semComentarios(ler('api', 'social-callback.ts'));
    expect(callback).toMatch(/if \(!trocado\.renovacao\)/);
  });

  it('o segredo do Google não vai para o navegador', () => {
    /*
      `VITE_` é o prefixo que o Vite escreve dentro do bundle. O `client_id` e
      a chave de API são públicos por definição; o segredo não é, e um
      `VITE_GOOGLE_CLIENT_SECRET` o publicaria para qualquer um que abrisse o
      código da página.
    */
    expect(servidor).toMatch(/GOOGLE_CLIENT_SECRET/);
    expect(servidor, 'o segredo do Google ganhou o prefixo do bundle').not.toMatch(
      /VITE_GOOGLE_CLIENT_SECRET/
    );

    for (const arquivo of ['google.ts', 'driveDaAgencia.ts', 'midiaParaPublicar.ts']) {
      const fonte = semComentarios(ler('src', 'lib', arquivo));
      expect(fonte, `${arquivo} menciona o segredo do Google`).not.toMatch(
        /GOOGLE_CLIENT_SECRET/
      );
    }
  });

  it('o refresh token nunca é devolvido à aba', () => {
    /*
      Ele é o que dá acesso continuado à conta do Google. No navegador,
      viraria acesso permanente para quem abrisse o console — o que a aba
      recebe é um token de uma hora.
    */
    const connect = semComentarios(ler('api', 'social-connect.ts'));
    const modo = connect.slice(
      connect.indexOf('const tokenDoDrive'),
      connect.indexOf('async function handler')
    );

    expect(modo.length).toBeGreaterThan(200);
    expect(modo).toMatch(/json\(\{ token: /);
    expect(modo, 'a rota passou a devolver o refresh token para o navegador').not.toMatch(
      /json\(\{[^}]*refresh/
    );
  });

  it('o download pede os bytes, não os metadados', () => {
    // Sem `alt=media` vem o JSON com os metadados — e o R2 receberia um
    // arquivo de trezentos bytes com nome de vídeo, que só daria erro quando
    // a Meta tentasse baixá-lo.
    expect(google).toMatch(/alt=media/);
  });

  it('a miniatura vira arquivo nosso, senão o portal não desenha nada', () => {
    /*
      A URL de miniatura do Google é curta de vida e pede a conta que
      autorizou. O **portal do cliente é anônimo**: nenhum endereço do Google
      carrega lá. Foi exatamente o que aconteceu no primeiro vídeo escolhido —
      quadro vazio no app e no portal.
    */
    const rota = semComentarios(ler('api', 'upload-url.ts'));

    expect(rota, 'a busca da miniatura sumiu da rota').toMatch(/const miniaturaDoDrive/);
    expect(rota, 'a miniatura deixou de ser guardada no balde').toMatch(/PutObjectCommand/);

    const uploader = semComentarios(ler('src', 'components', 'common', 'MediaUploader.tsx'));
    const escolha = uploader.slice(uploader.indexOf('const escolherNoDrive'));
    expect(escolha.slice(0, 2000)).toMatch(/miniaturaDoDrive\(/);
  });

  it('a miniatura é buscada no servidor, por causa de CORS', () => {
    /*
      `lh3.googleusercontent.com` **não manda** cabeçalho de origem cruzada: o
      `fetch` da aba falha antes de ler o primeiro byte. A primeira versão
      tentou no navegador e a miniatura vinha sempre vazia — sem erro visível,
      porque a falha é capturada e vira "sem miniatura".

      A guarda mede o efeito: o navegador não pode voltar a falar com o
      endereço de miniatura do Google.
    */
    for (const arquivo of ['google.ts', 'midiaParaPublicar.ts', 'midiaDoDrive.ts']) {
      const fonte = semComentarios(ler('src', 'lib', arquivo));
      expect(
        fonte,
        `${arquivo} busca a miniatura do Google no navegador — o CORS de lá não deixa`
      ).not.toMatch(/thumbnailLink|googleusercontent/);
    }

    const rota = semComentarios(ler('api', 'upload-url.ts'));
    expect(rota).toMatch(/thumbnailLink/);
  });

  it('a tela diz o que falta configurar, com o nome da variável', () => {
    const uploader = semComentarios(ler('src', 'components', 'common', 'MediaUploader.tsx'));

    expect(google).toMatch(/VITE_GOOGLE_API_KEY/);
    expect(uploader, 'o botão do Drive deixou de dizer o que falta').toMatch(/faltaDoGoogle\(\)/);
  });

  it('a conexão é da agência, e a tela diz de qual conta', () => {
    /*
      "Conectado" sem dizer de quem não ajuda: quem conectar a conta errada do
      Google só descobre quando não achar os arquivos no seletor.
    */
    const cartao = semComentarios(
      ler('src', 'components', 'settings', 'tabs', 'DriveDaAgenciaCard.tsx')
    );

    expect(cartao).toMatch(/conexao\.email/);
    expect(cartao).toMatch(/conectarDrive\(/);
    expect(cartao).toMatch(/desconectarDrive\(/);
  });

  it('não entrou rota nova em api/', () => {
    // São 12 de 12 funções no plano Hobby, e a 13ª derruba o deploy inteiro
    // com tudo verde localmente (armadilha 6). O token do Drive é um **modo**
    // de `social-connect`, não uma rota.
    const rotas = readdirSync(join(RAIZ, 'api')).filter((n) => n.endsWith('.ts'));
    expect(rotas.length).toBeLessThanOrEqual(12);
  });
});
