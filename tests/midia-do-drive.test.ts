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
    /*
      Sem `alt=media` vem o JSON com os metadados — e o balde receberia um
      arquivo de trezentos bytes com nome de vídeo, que só daria erro quando
      a Meta tentasse baixá-lo.

      A guarda mudou de arquivo junto com o download: ele saiu do navegador
      porque o Drive redireciona para um domínio que não libera origem
      cruzada, e a aba morre antes do primeiro byte.
    */
    const rota = semComentarios(ler('api', 'upload-url.ts'));
    expect(rota).toMatch(/alt=media/);
  });

  it('o navegador não baixa mais do Drive', () => {
    /*
      Duas formas de fazer a mesma coisa, uma delas quebrada, é como um
      defeito volta. O download no navegador **parece** funcionar — falha só
      em parte dos arquivos, sempre em silêncio.
    */
    for (const arquivo of ['google.ts', 'midiaParaPublicar.ts', 'driveDaAgencia.ts']) {
      const fonte = semComentarios(ler('src', 'lib', arquivo));
      expect(fonte, `${arquivo} voltou a baixar do Drive pelo navegador`).not.toMatch(
        /alt=media/
      );
    }
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
      "Conectado" sem dizer de quem não ajuda — e com **mais de uma conta**
      isso deixa de ser detalhe: o e-mail é o que distingue o Drive da agência
      do Drive do cliente na hora de escolher.
    */
    const cartao = semComentarios(
      ler('src', 'components', 'settings', 'tabs', 'DriveDaAgenciaCard.tsx')
    );

    expect(cartao).toMatch(/conta\.email/);
    expect(cartao).toMatch(/conectarDrive\(/);
    expect(cartao).toMatch(/desconectarDrive\(/);
    expect(cartao, 'a tela voltou a mostrar uma conta só').toMatch(/contas\.map\(/);
  });

  it('não entrou rota nova em api/', () => {
    // São 12 de 12 funções no plano Hobby, e a 13ª derruba o deploy inteiro
    // com tudo verde localmente (armadilha 6). O token do Drive é um **modo**
    // de `social-connect`, não uma rota.
    const rotas = readdirSync(join(RAIZ, 'api')).filter((n) => n.endsWith('.ts'));
    expect(rotas.length).toBeLessThanOrEqual(12);
  });
});

/**
 * **Duas versões desta entrega falharam em silêncio, e pelo mesmo motivo.**
 *
 * "Sem miniatura" é um desfecho válido — a peça continua servindo —, então a
 * falha era capturada e virava `null`. Só que silenciosa ela é
 * indistinguível de defeito: o quadro vazio não dizia se o problema era o
 * Google, o balde ou a autorização, e cada rodada de diagnóstico custou uma
 * versão.
 *
 * É a regra que este projeto já registra em outra roupa: *tela que depende de
 * configuração externa diz o que falta, com nome*. Aqui o nome é o motivo.
 */
describe('a miniatura que não veio diz por que não veio', () => {
  const rota = semComentarios(ler('api', 'upload-url.ts'));
  const corpo = rota.slice(rota.indexOf('const miniaturaDoDrive'), rota.indexOf('const listarDaBiblioteca'));

  it('a guarda está medindo a rota da miniatura', () => {
    expect(corpo.length).toBeGreaterThan(500);
  });

  it('toda saída sem miniatura carrega o motivo', () => {
    /*
      A conferência é por **efeito**: nenhuma resposta pode dizer só
      `url: null`. Uma saída muda é exatamente o que fez esta entrega
      precisar de três versões.
    */
    /*
      A primeira versão desta guarda procurava o literal `json({ url: null })`
      e não pegava a forma quebrada em linhas — que é justamente como a saída
      do final está escrita. Agora ela olha cada `url: null` e exige o motivo
      logo ao lado.
    */
    const mudas: string[] = [];
    for (let i = corpo.indexOf('url: null'); i >= 0; i = corpo.indexOf('url: null', i + 1)) {
      /*
        Até o fecha-chaves do próprio objeto, e não uma janela de tantos
        caracteres: a janela alcançava o `const motivo` do `catch` logo
        abaixo e aprovava uma saída muda. Guarda que aceita o vizinho no
        lugar do alvo não guarda — este arquivo já registra isso três vezes.
      */
      const fim = corpo.indexOf('}', i);
      const objeto = corpo.slice(i, fim < 0 ? i + 140 : fim);
      if (!/motivo/.test(objeto)) mudas.push(objeto.split('\n')[0]);
    }

    expect(mudas, 'voltou uma saída sem miniatura que não diz por quê').toEqual([]);
    expect(corpo).toMatch(/motivo:/);
  });

  it('a tela mostra o motivo em vez de só não desenhar', () => {
    const uploader = semComentarios(ler('src', 'components', 'common', 'MediaUploader.tsx'));
    expect(uploader).toMatch(/semMiniatura/);
    expect(uploader, 'a tela voltou a engolir o motivo').toMatch(/busca\.motivo/);
  });

  it('página de erro do Google não é gravada como imagem', () => {
    /*
      O Google devolve HTML com status 200 quando recusa a miniatura. Gravá-lo
      daria um arquivo no balde que o navegador não desenha — o mesmo quadro
      vazio, agora ocupando espaço e parecendo resolvido.
    */
    expect(corpo).toMatch(/tipo\.startsWith\('image\/'\)/);
  });

  it('há mais de um caminho para a miniatura', () => {
    /*
      `thumbnailLink` só existe quando o Google já gerou a miniatura — para
      vídeo recém-enviado pode demorar, e para alguns formatos não vem nunca.
      O endereço de `drive.google.com/thumbnail` gera sob demanda.
    */
    expect(corpo).toMatch(/thumbnailLink/);
    expect(corpo).toMatch(/drive\.google\.com\/thumbnail/);
    // Com e sem o cabeçalho: arquivo não público recusa sem ele, e alguns
    // endereços recusam com ele.
    expect(corpo).toMatch(/for \(const comToken of \[true, false\]\)/);
  });
});

/**
 * **O seletor precisa dizer de qual projeto ele é, senão não concede nada.**
 *
 * Com escopo `drive.file`, o Google registra a concessão do arquivo
 * escolhido **por app**. Sem `setAppId` no seletor, a escolha acontece — o
 * arquivo entra na peça, com nome e tudo — e toda leitura depois volta
 * **404**. Foi assim que a miniatura falhou; a cópia na hora de agendar
 * falharia igual, já com a data marcada e o cliente esperando.
 *
 * É a família que este projeto mais registra: o passo que falta não dá erro
 * onde foi omitido, e sim longe dali.
 */
describe('o seletor concede acesso ao app', () => {
  const google = semComentarios(ler('src', 'lib', 'google.ts'));

  it('o seletor é construído com o id do projeto', () => {
    const seletor = google.slice(google.indexOf('export const abrirSeletorDoDrive'));
    expect(seletor, 'o seletor parou de informar o id do projeto — as leituras voltam 404')
      .toMatch(/\.setAppId\(/);
  });

  it('o id do projeto vem do servidor, junto do token', () => {
    /*
      Derivado do `client_id` (o número antes do hífen), e não de uma
      variável nova: mais uma variável é mais uma coisa para cadastrar
      errado, e ela repetiria um número que já está no `client_id`.
    */
    const connect = semComentarios(ler('api', 'social-connect.ts'));
    const modo = connect.slice(
      connect.indexOf('const tokenDoDrive'),
      connect.indexOf('async function handler')
    );

    expect(modo).toMatch(/const appId = id\.split\('-'\)\[0\]/);

    // As duas saídas do modo devolvem o id: a que reaproveita o token
    // guardado e a que renova. Uma delas sem ele deixaria o seletor sem
    // concessão de vez em quando — o pior tipo de intermitência.
    const saidas = modo.match(/json\(\{ token: [^}]*\}\)/g) || [];
    expect(saidas.length).toBeGreaterThan(1);
    for (const saida of saidas) {
      expect(saida, 'uma saída do token não devolve o id do projeto').toMatch(/appId/);
    }
  });
});

/**
 * **O cliente aprovava um vídeo sem nunca tê-lo visto.**
 *
 * O portal desenhava toda mídia com uma tag de imagem — inclusive um `.mp4`
 * enviado do computador, que nunca tocou ali. Com a arte no Drive ficou pior:
 * o portal é anônimo, e nenhum endereço do Google abre sem login.
 *
 * Decidir sobre o que não se viu é a pior versão da armadilha 9, porque quem
 * é enganado não é o dono do produto — é o cliente de quem paga por ele.
 */
describe('o cliente vê o vídeo antes de aprovar', () => {
  const portal = semComentarios(ler('src', 'components', 'portal', 'ClientPortalView.tsx'));

  it('o portal toca vídeo em vez de desenhá-lo como imagem', () => {
    expect(portal, 'o portal voltou a desenhar vídeo com tag de imagem').toMatch(/<video/);
    expect(portal).toMatch(/videoParaTocar\(/);
  });

  it('o vídeo não toca sozinho, e tem controles', () => {
    /*
      Som que começa sem alguém pedir é o motivo de tanta gente fechar a aba —
      e quem abre o portal veio decidir, não ser surpreendido.
    */
    /*
      **A decisão mudou de forma, e a guarda foi junto.** Antes o `<video>`
      era montado sempre, com `poster` e sem `autoPlay`. Agora ele só nasce
      depois do clique — e aí toca sozinho, porque a pessoa acabou de pedir
      isso. O que a guarda protege é o mesmo: nada começa a tocar sem alguém
      mandar.
    */
    const player = portal.slice(portal.indexOf('const VideoComCapa'));
    const antesDoClique = player.slice(0, player.indexOf('if (tocando)'));

    expect(antesDoClique.length).toBeGreaterThan(50);
    expect(antesDoClique, 'o vídeo voltou a montar antes do clique').not.toMatch(/<video/);

    const depoisDoClique = player.slice(player.indexOf('if (tocando)'));
    expect(depoisDoClique.slice(0, 500)).toMatch(/controls/);
    // A capa como cartaz: sem ela o quadro fica preto até o primeiro frame,
    // que num vídeo grande demora.
    expect(depoisDoClique.slice(0, 500)).toMatch(/poster=/);
  });

  it('arte do Drive só toca pela cópia', () => {
    /*
      O endereço do Drive não abre sem login, e o portal é anônimo. Devolver
      a referência para a tag de vídeo daria um player quebrado — pior que a
      miniatura parada, que pelo menos mostra a arte.
    */
    const midia = semComentarios(ler('src', 'lib', 'midiaDoDrive.ts'));
    const funcao = midia.slice(midia.indexOf('export const videoParaTocar'));

    expect(funcao.slice(0, 400)).toMatch(/ehDoDrive\(url\) \? copia \|\| null : url/);
  });

  it('a cópia é criada com a peça, num lugar só', () => {
    /*
      **A guarda mudou junto com a decisão.** Ela exigia a cópia no momento
      da aprovação, e amarrá-la a um status fazia a peça passar horas sem
      vídeo nenhum — o tempo em que ela é produzida e conferida na prévia.
      Agora a cópia nasce com a peça, e o gatilho da edição é a **mídia**
      ter mudado, não o status.

      O ponto único continua sendo o que a guarda protege: são quatro
      caminhos que mexem na mídia de uma peça, e repetir a chamada em cada um
      garante esquecer um.
    */
    const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));

    expect(contexto).toMatch(/const garantirMidiaDoDrive/);
    expect(
      contexto,
      'trocar a mídia de uma peça existente deixou de trazer a arte do Drive'
    ).toMatch(/updates\.mediaUrls \|\| updates\.storyMediaUrls\) garantirMidiaDoDrive/);
    expect(contexto, 'conteúdo recém-criado ficou sem a cópia').toMatch(
      /garantirMidiaDoDrive\(newJob\.id\)/
    );

    // Nenhuma tela chama direto: o ponto único é o que impede o quarto
    // caminho de nascer sem ela.
    for (const pasta of ['modals', 'kanban']) {
      const arquivos = readdirSync(join(RAIZ, 'src', 'components', pasta)).filter((n) =>
        n.endsWith('.tsx')
      );
      for (const nome of arquivos) {
        const fonte = semComentarios(readFileSync(join(RAIZ, 'src', 'components', pasta, nome), 'utf-8'));
        expect(fonte, `${nome} chama a cópia direto — ela pertence ao contexto`).not.toMatch(
          /prepararMidiaDoDrive\(/
        );
      }
    }
  });

  it('a cópia sem dono é varrida pelo agendador', () => {
    /*
      Nem toda peça vai ao ar por aqui: uma de LinkedIn é postada à mão, e uma
      reprovada pode ficar meses em ajuste. Sem a varredura, "o balde guarda
      só o que está em trânsito" viraria falso devagar.
    */
    const cron = semComentarios(ler('api', 'publicar.ts'));

    expect(cron).toMatch(/limparCopiasSemDono/);
    expect(cron, 'a varredura deixou de poupar quem ainda usa a cópia').toMatch(
      /ESTADOS_QUE_AINDA_USAM_A_COPIA/
    );
  });

  it('a cópia não é escrita de volta pela persistência', () => {
    /*
      `midia_publicavel` é mapeada só na leitura. Nos dois lados, cada edição
      da peça reescreveria a cópia — e uma tela que não sabe que ela existe a
      apagaria com `undefined`, deixando o portal sem vídeo sem ninguém
      entender por quê.
    */
    const mappers = semComentarios(ler('src', 'lib', 'mappers.ts'));
    const paraLinha = mappers.slice(mappers.indexOf('export const jobParaLinha'));

    expect(mappers).toMatch(/midiaPublicavel: l\.midia_publicavel/);
    expect(paraLinha, 'a cópia entrou no caminho de escrita do diff').not.toMatch(
      /midia_publicavel/
    );
  });
});

/**
 * **Excluir o conteúdo e deixar a arte no balde é a sobra que ninguém vê
 * crescer.**
 *
 * A Biblioteca passa a listar arquivo de peça que não existe mais, e a
 * agência paga por um acervo que ela acha que apagou. Do outro lado está um
 * risco pior: a mesma arte pode servir a dois conteúdos — é literalmente por
 * isso que a Biblioteca conta usos antes de deixar excluir —, e apagar sem
 * conferir tiraria a imagem de um post que continua no ar, com a falha
 * aparecendo no perfil do cliente.
 */
describe('a peça apagada leva a arte dela junto', () => {
  const limpeza = semComentarios(ler('src', 'lib', 'midiaDaPeca.ts'));
  const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));

  it('excluir o conteúdo apaga a mídia dele', () => {
    expect(contexto, 'excluir o conteúdo deixou de limpar a arte').toMatch(
      /apagarMidiaDaPeca\(jobToDelete\)/
    );
  });

  it('nunca apaga o que outro conteúdo usa', () => {
    /*
      A conferência é o coração desta função. Sem ela, excluir um post
      levaria junto a arte de outro — e o outro continua publicado.
    */
    expect(limpeza).toMatch(/levantarUsos\(\)/);
    expect(limpeza).toMatch(/j\.id !== job\.id/);
    expect(limpeza, 'material do cliente e ficha deixaram de segurar o arquivo').toMatch(
      /uso\?\.outros \|\| 0\) > 0/
    );
  });

  it('o arquivo do Drive não é apagado — ele não é nosso', () => {
    /*
      O que mora no Drive é da agência, na conta dela. O que é nosso é a
      miniatura e a cópia temporária; apagar o original seria o produto
      mexendo no acervo de quem o usa.
    */
    expect(limpeza).toMatch(/ehDoDrive\(url\)/);
    const ramo = limpeza.slice(limpeza.indexOf('if (ehDoDrive(url))'));
    expect(ramo.slice(0, 400)).toMatch(/miniatura/);
    expect(ramo.slice(0, 400)).toMatch(/continue/);
  });

  it('a limpeza não transforma uma exclusão concluída em erro', () => {
    // O conteúdo já saiu quando isto roda. O que sobra no balde aparece na
    // Biblioteca com zero usos e pode ser apagado de lá.
    expect(limpeza).toMatch(/catch/);
    expect(contexto).toMatch(/void apagarMidiaDaPeca/);
  });
});

/**
 * **A capa com o play por cima, e o vídeo só depois do clique.**
 *
 * O player nativo com `poster` escondia a arte atrás de uma barra cinza —
 * quando aparecia: em parte dos navegadores o botão central só surge depois
 * do primeiro toque, e o card ficava indistinguível de uma imagem parada.
 * Quem abre o portal para aprovar um Reels não adivinha que há vídeo ali.
 */
describe('o play é visível antes de o vídeo existir na tela', () => {
  const portal = semComentarios(ler('src', 'components', 'portal', 'ClientPortalView.tsx'));
  const player = portal.slice(portal.indexOf('const VideoComCapa'));

  it('a guarda está medindo o player', () => {
    expect(player.length).toBeGreaterThan(300);
  });

  it('há um play desenhado por nós sobre a capa', () => {
    const antes = player.slice(0, player.indexOf('if (tocando)'));
    expect(antes, 'o player sumiu ou mudou de forma').toBeTruthy();
    expect(player).toMatch(/<Play /);
    expect(player, 'o play deixou de ser clicável por teclado e leitor de tela').toMatch(
      /aria-label=/
    );
  });

  it('a lista de aprovações não pré-carrega um vídeo por card', () => {
    /*
      Cinco peças com vídeo abririam cinco conexões ao mesmo tempo, no celular
      de alguém. Não montar o `<video>` antes do clique resolve isso de graça
      — e é o mesmo motivo pelo qual ele resolve o afordance.
    */
    const antes = player.slice(0, player.indexOf('if (tocando)'));
    expect(antes).not.toMatch(/<video|preload=/);
  });

  it('a cópia não é refeita a cada abertura da peça', () => {
    /*
      A peça é aberta muitas vezes. Sem a saída antecipada, cada abertura
      baixaria o vídeo e o enviaria de novo, deixando um arquivo órfão no
      balde por vez — o oposto do que esta entrega existe para fazer.
    */
    const preparar = semComentarios(ler('src', 'lib', 'midiaParaPublicar.ts'));

    expect(preparar, 'a cópia deixou de guardar de qual lista ela veio').toMatch(/de: \{ feed:/);
    expect(preparar, 'a cópia voltou a ser refeita mesmo quando já cobre a mídia').toMatch(
      /if \(mesmaLista\) return/
    );
    // Comparar as listas, e não contar itens: trocar uma arte por outra
    // mantém o tamanho, e a cópia velha apontaria para o arquivo errado.
    expect(preparar).toMatch(/JSON\.stringify\(jaCopiado\.feed/);
  });

  it('a cópia anterior sai quando a arte é trocada', () => {
    // Deixá-la no balde seria guardar o vídeo de uma versão que ninguém mais
    // vê — a sobra que esta entrega existe para evitar.
    const preparar = semComentarios(ler('src', 'lib', 'midiaParaPublicar.ts'));
    const grava = preparar.indexOf('update({ midia_publicavel');
    const apaga = preparar.indexOf('excluirArquivo(job.workspace_id, chaveVelha)');

    expect(apaga).toBeGreaterThan(-1);
    expect(apaga, 'a cópia velha passou a ser apagada depois da nova entrar').toBeLessThan(grava);
  });

  it('peça antiga com arte no Drive se resolve ao ser aberta', () => {
    /*
      A cópia passou a nascer com a peça, e o que já existia ficou sem ela.
      Pedir que alguém tire e recoloque a arte seria transferir para quem usa
      um problema que é nosso.
    */
    const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));
    const efeito = contexto.slice(contexto.indexOf('if (!selectedJob) return;'));

    expect(efeito.slice(0, 400)).toMatch(/quantasNoDrive\(/);
    expect(efeito.slice(0, 400)).toMatch(/garantirMidiaDoDrive\(selectedJob\.id\)/);
  });
});

/**
 * **O portal carregava uma vez e ficava parado.**
 *
 * O cliente via o estado de quando abriu a aba: a peça mandada depois não
 * aparecia, a resposta no chat não chegava, e — o caso que trouxe esta
 * correção — o vídeo fica pronto alguns segundos depois de a peça surgir,
 * então ele aprovava olhando uma capa parada, achando que não havia vídeo.
 *
 * Não é caso de borda. A cópia do arquivo acontece no navegador **da
 * agência**, e nada dela alcança a aba do cliente: ou o portal pergunta de
 * novo, ou ele mostra sempre o primeiro instante.
 */
describe('o portal não fica parado no primeiro instante', () => {
  const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));
  const releitura = contexto.slice(contexto.indexOf('const reler = async'));

  it('a guarda está medindo a releitura', () => {
    expect(releitura.length).toBeGreaterThan(200);
  });

  it('relê por intervalo e na volta do foco', () => {
    /*
      Os dois, como o sino e o aviso de atualização: o navegador estrangula
      timer de aba em segundo plano, que é onde a aba do cliente passa a maior
      parte do tempo.
    */
    expect(releitura).toMatch(/setInterval/);
    /*
      Os dois `addEventListener`, e não a palavra solta: `visibilitychange`
      continua aparecendo na limpeza do efeito, então a alternativa frouxa
      aprovava um efeito que tinha deixado de escutar. Conferido ao
      contrário — tirando as duas escutas —, a guarda passava.
    */
    expect(releitura, 'a volta do foco deixou de reler').toMatch(
      /addEventListener\('focus', aoVoltar\)/
    );
    expect(releitura, 'a volta da aba ao primeiro plano deixou de reler').toMatch(
      /addEventListener\('visibilitychange', aoVoltar\)/
    );
  });

  it('a releitura não vira uma visita nova', () => {
    /*
      `registrarAcessoNoPortal` é o aviso de visita. Uma visita que se repete
      a cada minuto encheria o painel da agência — é a mesma razão pela qual
      ele mora no efeito de abertura.
    */
    expect(
      releitura.slice(0, 1200),
      'a releitura passou a avisar a agência a cada minuto'
    ).not.toMatch(/registrarAcessoNoPortal/);
  });

  it('a releitura que falha não derruba o portal', () => {
    // A tela já está pintada com dados válidos. Trocar isso por uma mensagem
    // de erro seria assustar quem está no meio de aprovar.
    expect(releitura.slice(0, 600)).toMatch(/catch\(\(\) => null\)/);
  });

  it('o intervalo é o mesmo do resto do produto', () => {
    // Um minuto. Mais curto encheria de consulta o banco por nada; mais longo
    // faria o cliente esperar sem saber o que esperar.
    expect(releitura).toMatch(/60_000/);
  });
});

/**
 * **A cópia do vídeo saiu do navegador, e a falha saiu do silêncio.**
 *
 * Dois vídeos seguidos ficaram sem cópia enquanto a miniatura — que já era
 * buscada no servidor — passava nos dois. O sinal estava na mesa: o download
 * do Drive redireciona para `googleusercontent.com`, e o destino do
 * redirecionamento não libera origem cruzada. A aba morre antes do primeiro
 * byte, o erro é capturado, e a peça fica sem vídeo calada.
 *
 * Silêncio é o que fez isto levar três rodadas de diagnóstico. As guardas
 * abaixo protegem as duas metades: onde a cópia acontece, e que ela fale
 * quando não acontecer.
 */
describe('a cópia do Drive acontece no servidor, e avisa quando falha', () => {
  const rota = semComentarios(ler('api', 'upload-url.ts'));
  const corpo = rota.slice(rota.indexOf('const copiarDoDrive'), rota.indexOf('const miniaturaDoDrive'));

  it('a guarda está medindo a cópia', () => {
    expect(corpo.length).toBeGreaterThan(400);
  });

  it('a rota confere o membro antes de falar com o Google', () => {
    const membro = corpo.indexOf('papelNaAgencia(');
    const google = corpo.indexOf('googleapis.com');

    expect(membro).toBeGreaterThan(-1);
    expect(membro, 'a rota fala com o Google antes de saber quem pediu').toBeLessThan(google);
  });

  it('há um teto de tamanho, e ele é dito com o número que vale', () => {
    /*
      A função tem memória finita, e há um limite acima do qual nem a cópia em
      rodadas compensa esperar.

      **O número é derivado, nunca escrito à mão na frase.** Ele já ficou para
      trás uma vez: o teto subiu de 100 para 500 MB e a mensagem continuou
      dizendo 100 — a pessoa comprimia o vídeo para caber num limite que não
      existia mais. Guarda que aceita o literal aprova exatamente esse
      descompasso.
    */
    expect(corpo).toMatch(/LIMITE_DA_COPIA/);
    expect(corpo, 'o teto virou um erro mudo').toMatch(/limite de cópia é/);
    expect(corpo, 'o número do limite voltou a ser escrito à mão na frase').not.toMatch(
      /limite de cópia é \d/
    );
  });

  /**
   * Saída sem cópia diz por quê — **ou diz que ainda não acabou**.
   *
   * A pausa não é falha: o envio continua aberto no balde e a chamada
   * seguinte retoma. Ela volta com `pendente` e sem `motivo` de propósito —
   * um motivo ali viraria aviso na tela para algo que está em andamento.
   */
  it('toda saída sem cópia carrega o motivo, ou o estado de quem vai continuar', () => {
    const mudas: string[] = [];
    for (let i = corpo.indexOf('url: null'); i >= 0; i = corpo.indexOf('url: null', i + 1)) {
      const fim = corpo.indexOf('}', i);
      const objeto = corpo.slice(i, fim < 0 ? i + 140 : fim);
      if (!/motivo|pendente/.test(objeto)) mudas.push(objeto.split('\n')[0]);
    }

    expect(mudas, 'voltou uma saída sem cópia que não diz por quê').toEqual([]);
  });

  it('a agência fica sabendo que o vídeo não foi copiado', () => {
    /*
      "Sem cópia" era indistinguível de "não havia vídeo": a peça ia para o
      cliente com a capa parada e ninguém da agência sabia. A faixa de erro
      existe exatamente para este tipo de falha — ela foi criada porque o
      produto perdia dado sem avisar.
    */
    const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));
    const bloco = contexto.slice(contexto.indexOf('const garantirMidiaDoDrive'));

    /*
      Dentro do ramo que trata as falhas, e não em qualquer lugar do bloco: a
      primeira versão procurava a chamada solta e continuava aprovando quando
      o ramo virava um `return` mudo — porque o `catch` logo abaixo tem a
      mesma chamada. É o vizinho no lugar do alvo outra vez.
    */
    const ramo = bloco.slice(
      bloco.indexOf('if (preparo.falhas.length)'),
      bloco.indexOf('} catch')
    );

    expect(ramo.length, 'o ramo das falhas sumiu — confira esta guarda').toBeGreaterThan(50);
    expect(ramo, 'a falha da cópia voltou a ser engolida').toMatch(
      /painelDeErros\.current\.falhou\(\s*'midia-do-drive'/
    );
    expect(
      bloco.slice(0, 1600),
      'a faixa não apaga quando a cópia volta a funcionar'
    ).toMatch(/gravacaoDeuCerto\('midia-do-drive'\)/);
  });
});

/**
 * **O teto de 100 MB não era decisão de produto — era a memória.**
 *
 * `PutObject` simples obriga a ter o arquivo inteiro na mão, e o primeiro
 * vídeo real a esbarrar no limite tinha **109 MB**: o tamanho de um Reels
 * comum. A mensagem chegou a quem produz ("o arquivo tem 109 MB e o limite é
 * 100 MB") porque a rodada anterior tirou essa falha do silêncio — e foi ela
 * que apontou a correção.
 */
describe('a cópia sobe em partes, e desiste com resposta', () => {
  const r2 = semComentarios(ler('api', '_lib', 'r2.ts'));
  const rota = semComentarios(ler('api', 'upload-url.ts'));

  it('o arquivo não passa inteiro pela memória', () => {
    expect(r2, 'o envio em partes sumiu').toMatch(/CreateMultipartUploadCommand/);
    expect(r2).toMatch(/UploadPartCommand/);
    expect(r2).toMatch(/CompleteMultipartUploadCommand/);

    /*
      O fim é procurado **a partir do começo**: `acessoDoDrive` é declarada
      antes de `copiarDoDrive` no arquivo, e o corte solto devolvia string
      vazia — a guarda passaria a medir nada. É a mesma armadilha da âncora
      que encontra a ocorrência errada, agora por ordem em vez de repetição.
    */
    const inicio = rota.indexOf('const copiarDoDrive');
    const copia = rota.slice(inicio, rota.indexOf('const miniaturaDoDrive', inicio));

    expect(inicio, 'a cópia sumiu da rota').toBeGreaterThan(-1);
    expect(copia.length, 'o corte da guarda ficou vazio').toBeGreaterThan(400);
    expect(copia, 'a cópia voltou a carregar o arquivo inteiro na memória').not.toMatch(
      /arrayBuffer\(\)/
    );
    expect(copia).toMatch(/continuarEnvio\(/);
  });

  it('parte não concluída é abortada', () => {
    /*
      Parte enviada e não concluída **fica no balde ocupando espaço**,
      invisível na listagem, e a Cloudflare cobra por ela até alguém limpar.
    */
    const envio = r2.slice(r2.indexOf('export const continuarEnvio'));
    expect(r2).toMatch(/AbortMultipartUploadCommand/);
    expect(envio, 'o aborto saiu do caminho de erro').toMatch(
      /catch \(erro\)[\s\S]{0,200}abortarEnvio/
    );
  });

  /**
   * **O orçamento pausa; ele não desiste.**
   *
   * Estourar o tempo da função no meio é o pior desfecho — não sobra nem o
   * motivo —, e a versão anterior resolvia isso lançando um erro: a cópia
   * cabia numa invocação ou não acontecia. A 3,5 MB/s, 45 segundos dão uns
   * 160 MB, e o vídeo maior falhava **sempre no mesmo lugar**, com a tela
   * mandando tentar de novo. Era o único conselho que não podia funcionar.
   */
  it('o orçamento devolve o que já subiu, em vez de jogar fora', () => {
    const envio = r2.slice(r2.indexOf('export const continuarEnvio'));
    expect(envio).toMatch(/orcamentoMs/);
    expect(envio, 'o orçamento voltou a abortar o que já tinha subido').toMatch(
      /concluido: false[\s\S]{0,120}copiados/
    );

    // E a rota devolve esse estado a quem chamou, senão ele morre com a
    // invocação e a rodada seguinte recomeça do zero.
    expect(rota).toMatch(/pendente: resultado\.envio/);
    // Retomar sem `Range` faria cada rodada rebaixar o arquivo inteiro para
    // chegar ao ponto certo — e nunca terminar.
    expect(rota).toMatch(/Range: `bytes=/);
  });

  it('o teto subiu junto com a capacidade', () => {
    // Um teto que corta o tamanho de um Reels comum não protege nada: ele só
    // transfere o problema para quem produz.
    expect(rota).toMatch(/const LIMITE_DA_COPIA = 500 \* 1024 \* 1024/);
  });

  it('nenhuma dependência nova entrou por causa disso', () => {
    /*
      `@aws-sdk/lib-storage` faria o mesmo e traria os dois lockfiles para
      atualizar — o CI instala com `--frozen-lockfile`, e este projeto já
      quebrou uma vez exatamente assim.
    */
    const pacote = JSON.parse(ler('package.json'));
    expect(Object.keys(pacote.dependencies || {})).not.toContain('@aws-sdk/lib-storage');
  });
});

/**
 * **O vídeo pesado no celular de quem aprova.**
 *
 * Um `<video>` apontando para o nosso balde entrega o **original**: 109 MB
 * num arquivo comum. O player do Google transcodifica e escolhe a resolução
 * pela conexão — é a diferença entre aprovar no 4G e gastar o pacote do mês.
 *
 * O preço é explícito e foi escolhido sabendo dele: enquanto a liberação
 * existe, quem tem o endereço do arquivo assiste. **O que a torna aceitável
 * é ela acabar** — e é isso que as guardas abaixo protegem.
 */
describe('o portal toca pelo player do Google, e a liberação acaba', () => {
  const portal = semComentarios(ler('src', 'components', 'portal', 'ClientPortalView.tsx'));
  const drive = semComentarios(ler('api', '_lib', 'googleDrive.ts'));

  it('o vídeo do Drive toca pelo player do Google', () => {
    const player = portal.slice(portal.indexOf('const PlayerDoDrive'));
    expect(player.slice(0, 700)).toMatch(/drive\.google\.com\/file\/d\//);
    expect(player.slice(0, 700)).toMatch(/\/preview/);
  });

  it('o player do Drive é montado direto, sem capa nossa por cima', () => {
    /*
      **Eram dois cliques para uma coisa só.** O nosso play abria o player do
      Drive, que pedia o play dele — e o segundo parecia que o primeiro não
      tinha funcionado. O player do Google já mostra um quadro do vídeo e o
      próprio botão; a capa que desenhávamos só adiava o que ele faz melhor.
    */
    /*
      O corte termina no componente seguinte, e não numa contagem de
      caracteres: a janela de 700 alcançava o `VideoComCapa` logo abaixo —
      que **tem** estado, e com razão — e reprovava código correto.
    */
    const inicio = portal.indexOf('const PlayerDoDrive');
    const player = portal.slice(inicio, portal.indexOf('const VideoComCapa', inicio));

    expect(player.length, 'o player do Drive sumiu — confira esta guarda').toBeGreaterThan(100);
    expect(player, 'voltou uma camada de play antes do player do Drive').not.toMatch(
      /useState|setTocando/
    );

    // E o uso é direto, não por dentro do player com capa.
    expect(portal).toMatch(/<PlayerDoDrive/);
    expect(
      semComentarios(portal),
      'o player com capa voltou a receber o id do Drive'
    ).not.toMatch(/noDrive=/);
  });

  it('a lista não monta o player de todos os cards de uma vez', () => {
    // Uma aba de aprovações tem vários cards. Sem isto, abrir a tela monta o
    // player de cada um — e o que carrega é a casca, mas são várias.
    const player = portal.slice(portal.indexOf('const PlayerDoDrive'));
    expect(player.slice(0, 700)).toMatch(/loading="lazy"/);
  });

  it('o play aparece mesmo sem a cópia no balde', () => {
    /*
      A cópia serve à **publicação** — é dela que a Meta baixa a mídia. O
      player do Drive não precisa dela: um vídeo grande demais para copiar, ou
      cuja cópia falhou, continua assistível no portal.
    */
    expect(portal).toMatch(/idDeVideoNoDrive\(/);
    expect(portal, 'o Drive deixou de ter prioridade sobre a cópia').toMatch(
      /idNoDrive \? \(\s*<PlayerDoDrive/
    );
  });

  it('a liberação é de leitura, nunca de escrita', () => {
    // O cliente assiste; ele não mexe no arquivo da agência.
    const liberar = drive.slice(drive.indexOf('export const liberarPorLink'));
    expect(liberar.slice(0, 700)).toMatch(/role: 'reader'/);
    expect(liberar.slice(0, 700)).not.toMatch(/role: 'writer'/);
  });

  it('só vídeo é liberado', () => {
    /*
      Imagem já viaja pela miniatura, que é um arquivo nosso de alguns
      kilobytes. Liberar o que não precisa é exposição sem contrapartida.
    */
    const preparar = semComentarios(ler('src', 'lib', 'midiaParaPublicar.ts'));
    expect(preparar).toMatch(/ehDoDrive\(u\) && ehVideo\(u\)/);
  });

  it('a liberação é retirada quando a peça vai ao ar', () => {
    const cron = semComentarios(ler('api', 'publicar.ts'));
    const limpeza = cron.slice(cron.indexOf('const limparCopiaDoDrive'));

    expect(cron, 'o destrancar sumiu do agendador').toMatch(/const trancarVideosDoDrive/);
    expect(limpeza.slice(0, 1200), 'a peça publicada continua liberada por link').toMatch(
      /trancarVideosDoDrive\(/
    );
  });

  it('a liberação é retirada quando a peça é excluída', () => {
    // Peça excluída não é aprovada por ninguém — e o acesso que nós abrimos
    // é nosso para fechar.
    const limpeza = semComentarios(ler('src', 'lib', 'midiaDaPeca.ts'));
    expect(limpeza).toMatch(/acessoNoDrive\(job\.workspaceId, videos, false\)/);
  });

  it('o arquivo do Drive continua sendo da agência', () => {
    /*
      O que sai é o **acesso que nós abrimos**, nunca o arquivo. Apagar um
      arquivo do Drive de quem usa o produto seria o produto mexendo no
      acervo dela.
    */
    expect(drive, 'entrou uma exclusão de arquivo no Drive').not.toMatch(
      /method: 'DELETE'[\s\S]{0,200}\/files\/\$\{encodeURIComponent\(fileId\)\}['"`]/
    );
    const trancar = drive.slice(drive.indexOf('export const trancarPorLink'));
    expect(trancar.slice(0, 600)).toMatch(/permissions\/anyoneWithLink/);
  });
});

/**
 * **Mais de uma conta do Drive por agência.**
 *
 * Uma agência tem o Drive dela e, com frequência, o do cliente. Com uma
 * conta só, buscar no outro exigia desconectar e reconectar — e o pior não
 * era o trabalho: cada arte já escolhida deixava de ter miniatura, cópia e
 * player, porque a credencial que as busca tinha ido embora.
 *
 * O que torna duas contas seguro é a **referência lembrar de qual veio**.
 * `drive.file` é por app **e por conta**: o token de uma não alcança o
 * arquivo da outra, e a resposta é 404 — o mesmo sintoma do arquivo sem
 * concessão, que já custou três rodadas de diagnóstico.
 */
describe('a agência pode ter mais de uma conta do Drive', () => {
  const uploader = semComentarios(ler('src', 'components', 'common', 'MediaUploader.tsx'));

  it('a arte guarda de qual conta veio', () => {
    const midia = semComentarios(ler('src', 'lib', 'midiaDoDrive.ts'));

    expect(midia, 'a referência parou de gravar a conta').toMatch(
      /campos\.set\('conta', arquivo\.conta\)/
    );
    expect(midia).toMatch(/conta: campos\.get\('conta'\)/);
    expect(uploader, 'a escolha não grava mais a conta na referência').toMatch(/conta: conta\?\.id/);
  });

  it('a escolha da conta vem antes do seletor', () => {
    /*
      Abrir o seletor sem perguntar faria a pessoa procurar no lugar errado —
      e, pior, o arquivo escolhido carregaria a conta errada para sempre.
    */
    expect(uploader).toMatch(/contas\.length > 1/);
    expect(uploader).toMatch(/escolherNoDrive\(conta\)/);
    // Com uma conta só não há o que escolher: perguntar o óbvio custaria um
    // clique em toda escolha do caso mais comum.
    expect(uploader).toMatch(/escolherNoDrive\(contas\[0\]\)/);
  });

  it('o servidor confere que a conta é da agência', () => {
    /*
      Sem isso, um id de conta de outra agência daria acesso ao Drive dela. É
      o mesmo cuidado da chave do balde, conferida contra o prefixo da
      agência antes de apagar.
    */
    for (const rota of ['upload-url.ts', 'social-connect.ts']) {
      const fonte = semComentarios(ler('api', rota));
      const escolha = fonte.slice(fonte.indexOf("from('drive_contas')"));

      expect(escolha.slice(0, 500), `${rota} aceita a conta sem conferir a agência`).toMatch(
        /\.eq\('workspace_id', workspaceId\)/
      );
    }
  });

  it('referência antiga cai na conta mais antiga', () => {
    /*
      Ela não diz de qual conta veio porque só existia uma quando foi
      gravada. Cair na mais recente daria 404 na arte que funcionava ontem.
    */
    for (const rota of ['upload-url.ts', 'social-connect.ts']) {
      const fonte = semComentarios(ler('api', rota));
      expect(fonte, `${rota} não tem o recuo para a conta mais antiga`).toMatch(
        /\.order\('conectado_em'\)\.limit\(1\)/
      );
    }
  });

  it('trancar por link agrupa por conta', () => {
    /*
      Cada arte pode ter vindo de uma conta diferente, e o token de uma não
      alcança o arquivo da outra: uma volta só, com um token só, deixaria
      metade das liberações de pé.
    */
    const cron = semComentarios(ler('api', 'publicar.ts'));
    const trancar = cron.slice(cron.indexOf('const trancarVideosDoDrive'));

    expect(trancar.slice(0, 2000)).toMatch(/porConta/);
    expect(trancar.slice(0, 2000)).toMatch(/for \(const \[contaId, arquivos\] of porConta\)/);
  });

  it('reconectar a mesma conta não cria uma irmã', () => {
    /*
      Sem o índice único, autorizar de novo depois de um problema deixaria
      duas entradas com o mesmo nome na tela de escolha — uma delas com
      credencial morta, e nada distinguindo as duas.
    */
    const migracao = ler(
      'supabase',
      'migrations',
      '20260924140000_varias_contas_do_drive.sql'
    );

    expect(migracao).toMatch(/create unique index if not exists drive_contas_agencia_email_idx/);
    expect(semComentarios(ler('api', 'social-callback.ts'))).toMatch(
      /onConflict: 'workspace_id,email'/
    );
  });

  it('a credencial de cada conta continua inalcançável', () => {
    const migracao = ler(
      'supabase',
      'migrations',
      '20260924140000_varias_contas_do_drive.sql'
    );

    expect(migracao).toMatch(
      /alter table public\.drive_contas_credenciais enable row level security/
    );
    expect(
      migracao,
      'a tabela da credencial ganhou política — ela guarda acesso continuado ao Drive'
    ).not.toMatch(/create policy[^;]*drive_contas_credenciais/);
  });

  it('o que já estava conectado vira a primeira conta', () => {
    /*
      Sem a cópia, quem conectou ontem abriria a tela hoje e veria "nenhuma
      conta" — e as peças daquela conta perderiam miniatura, cópia e player.
      Migração que perde configuração é migração que gera chamado.
    */
    const migracao = ler(
      'supabase',
      'migrations',
      '20260924140000_varias_contas_do_drive.sql'
    );

    expect(migracao).toMatch(/insert into public\.drive_contas[\s\S]*from public\.drive_da_agencia/);
    expect(migracao).toMatch(
      /insert into public\.drive_contas_credenciais[\s\S]*from public\.drive_credenciais/
    );
    // E as tabelas velhas ficam: a `main` publicada ainda as lê, e um `drop`
    // aqui derrubaria o produto entre a migração e o deploy.
    expect(migracao, 'a migração apaga tabela que a versão publicada ainda usa').not.toMatch(
      /drop table/
    );
  });
});

/**
 * **O portal mostrava só a primeira página do carrossel.**
 *
 * Um conteúdo de cinco artes era aprovado com uma vista, e as outras quatro
 * iam ao ar sem ninguém ter olhado — o oposto do que a tela de aprovação
 * existe para fazer. É a armadilha 9 na direção mais cara: quem é enganado
 * não é o dono do produto, é o cliente de quem paga por ele.
 *
 * E o cliente que aprova quer o arquivo depois — para o site, para uma
 * impressão, para guardar. Sem o botão, o caminho era pedir à agência por
 * WhatsApp um arquivo que já estava na tela.
 */
describe('o portal mostra a peça inteira, e deixa baixar', () => {
  const portal = semComentarios(ler('src', 'components', 'portal', 'ClientPortalView.tsx'));

  it('todas as páginas da peça chegam à tela', () => {
    expect(portal, 'o portal voltou a mostrar só a primeira arte').toMatch(
      /urls=\{job\.mediaUrls\}/
    );
    expect(portal).toMatch(/<GaleriaDaPeca/);
  });

  it('com uma arte só, não há carrossel', () => {
    /*
      Setas e bolinhas sobre uma imagem única são ruído, e sugerem uma página
      que não existe.
    */
    const galeria = portal.slice(portal.indexOf('const GaleriaDaPeca'));
    expect(galeria.slice(0, 900)).toMatch(/urls\.length === 1/);
  });

  it('a contagem de páginas fica à vista', () => {
    /*
      As bolinhas não são enfeite: são elas que dizem **quantas páginas
      existem**, e é isso que o cliente usa para saber se viu a peça inteira
      antes de aprovar.
    */
    const carrossel = semComentarios(ler('src', 'components', 'ui', 'carousel.tsx'));
    expect(portal).toMatch(/<CarouselDots \/>/);
    expect(carrossel).toMatch(/total <= 1/);
  });

  it('o carrossel não volta ao começo sozinho', () => {
    /*
      Numa lista de páginas, dar a volta sem aviso faz a pessoa perder a
      conta de quantas já viu — e a conta é o que ela usa para decidir.
    */
    const carrossel = semComentarios(ler('src', 'components', 'ui', 'carousel.tsx'));
    expect(carrossel).toMatch(/loop = false/);
  });

  it('toda arte tem o botão de baixar', () => {
    /*
      Ele mora no componente que desenha **uma** arte, e não em cada tela:
      repetido por fora, a próxima tela nasceria sem ele.
    */
    const midia = portal.slice(portal.indexOf('const MidiaDaPeca'), portal.indexOf('const GaleriaDaPeca'));

    expect(midia.length).toBeGreaterThan(200);
    expect(midia, 'a arte perdeu o botão de baixar').toMatch(/<BotaoBaixar url=\{url\} \/>/);
  });

  it('baixar não dispara o que está embaixo', () => {
    /*
      A arte costuma ser clicável — abre a prévia, troca o quadro. Sem parar
      a propagação, baixar também abriria a peça, e a pessoa acharia que
      clicou errado.
    */
    const botao = portal.slice(portal.indexOf('const BotaoBaixar'), portal.indexOf('const PlayerDoDrive'));
    expect(botao).toMatch(/stopPropagation\(\)/);
  });

  it('arquivo do Drive baixa pelo Google', () => {
    /*
      O original mora lá, e a peça já está liberada por link enquanto está em
      aprovação — a mesma permissão que faz o player tocar. Baixar a nossa
      cópia entregaria um arquivo que some depois da publicação.
    */
    const baixar = semComentarios(ler('src', 'lib', 'baixar.ts'));
    expect(baixar).toMatch(/uc\?export=download/);
    expect(baixar).toMatch(/if \(ehDoDrive\(url\)\)/);
  });

  it('o download de outro domínio não confia no atributo', () => {
    /*
      `download` só vale para o mesmo domínio. A arte mora no balde, que é
      outro — ali o navegador ignora o atributo e **abre** o arquivo. Por isso
      os bytes são buscados e entregues como arquivo, com a abertura da aba
      como recuo quando a leitura não é permitida.
    */
    const baixar = semComentarios(ler('src', 'lib', 'baixar.ts'));
    expect(baixar).toMatch(/URL\.createObjectURL/);
    expect(baixar, 'o blob fica na memória da aba até ela fechar').toMatch(
      /URL\.revokeObjectURL/
    );
    expect(baixar).toMatch(/window\.open\(url/);
  });
});

/**
 * A cópia que atravessa mais de uma invocação.
 *
 * **O tempo da função era um teto de tamanho disfarçado.** A 3,5 MB/s, 45
 * segundos dão uns 160 MB — e o vídeo maior que isso falhava *sempre*, com a
 * tela dizendo "tente de novo": a tentativa seguinte refazia o mesmo percurso
 * e parava no mesmo lugar. O relato que trouxe isto tinha 160 MB e um nome:
 * "Efeitos colaterais da caneta".
 *
 * O que estas guardas protegem não é o mecanismo, são as três coisas que, se
 * saírem, não quebram nada visível: a conferência da agência antes de gravar,
 * a recusa de emendar um `Range` que o Google não honrou, e a limpeza do
 * envio abandonado.
 */
describe('a cópia continua na chamada seguinte', () => {
  const rota = semComentarios(ler('api', 'upload-url.ts'));
  const api = semComentarios(ler('src', 'lib', 'api.ts'));

  const copia = rota.slice(
    rota.indexOf('const copiarDoDrive'),
    rota.indexOf('const miniaturaDoDrive', rota.indexOf('const copiarDoDrive'))
  );

  /**
   * **A conferência que não pode sair.**
   *
   * O estado da cópia viaja pelo navegador e volta, então a chave vem de
   * fora. Sem exigir que ela comece pelo `workspaceId` de quem chamou, quem
   * tem uma agência qualquer manda a chave de outra e passa a gravar dentro
   * dela — a checagem de membro logo acima vira enfeite. É a mesma lição da
   * exclusão na Biblioteca, onde `abc` casava com `abcdef/`.
   */
  it('a chave que volta do navegador é conferida contra a agência', () => {
    expect(copia).toMatch(/startsWith\(`\$\{workspaceId\}\/`\)/);

    const confere = copia.indexOf('startsWith(`${workspaceId}/`)');
    const grava = copia.indexOf('continuarEnvio(');
    expect(confere, 'a rota grava antes de conferir de quem é a chave').toBeLessThan(grava);
  });

  /**
   * Retomar sem o Google ter honrado o `Range` grava o começo do vídeo no
   * meio dele: **um arquivo corrompido com o tamanho certo**, que nada
   * acusa. Recomeçar custa uma rodada; emendar errado custa o post.
   */
  it('só emenda quando o Google devolveu o pedaço pedido', () => {
    expect(copia).toMatch(/status !== 206/);
    expect(copia, 'o envio errado ficou aberto no balde').toMatch(
      /status !== 206[\s\S]{0,300}abortarEnvio/
    );
  });

  it('quem desiste limpa o que já subiu', () => {
    // Parte enviada e não concluída fica no balde, invisível na listagem, e
    // é cobrada até alguém limpar. O balde não adivinha que ninguém volta.
    expect(copia).toMatch(/if \(desistir\)/);
    expect(api, 'o navegador desiste sem avisar o balde').toMatch(/desistir: true/);
  });

  /**
   * O laço tem fim, e ele existe para a espera acabar — não para proteger o
   * servidor. Sem teto, uma conexão lenta prende quem agenda para sempre.
   */
  it('o navegador insiste, mas não para sempre', () => {
    const copiar = api.slice(api.indexOf('copiarDoDrive:'), api.indexOf('acessoNoDrive:'));
    expect(copiar).toMatch(/TETO_DE_RODADAS/);
    expect(copiar, 'o estado não volta para a rodada seguinte').toMatch(/continuar: pendente/);
  });
});

/**
 * O que a faixa diz quando a cópia falha.
 *
 * Ela dizia *"a peça segue com a imagem de capa, e o cliente não consegue
 * assistir"* — e isso **deixou de ser verdade** quando o portal passou a
 * montar o player do Google para vídeo do Drive. O cliente assiste; quem fica
 * sem arquivo é a publicação automática, porque a rede social baixa a mídia
 * de um endereço nosso.
 *
 * Mensagem que descreve um estrago que não existe custa duas vezes: manda
 * procurar o que está certo, e esconde o que está errado.
 */
describe('a falha da cópia nomeia a consequência certa', () => {
  const contexto = semComentarios(ler('src', 'context', 'PostfyContext.tsx'));

  it('não afirma que o cliente ficou sem assistir', () => {
    expect(contexto).not.toMatch(/não consegue assistir/);
  });

  it('nomeia a publicação, que é o que fica sem arquivo', () => {
    const aviso = contexto.slice(contexto.indexOf('O vídeo do Google Drive não foi copiado'));
    expect(aviso.slice(0, 600)).toMatch(/publicação automática/);
  });

  /**
   * E a faixa não pode abrir com "uma alteração não chegou ao banco": o
   * conteúdo **está** salvo, e mandar recarregar faz procurar um estrago
   * inexistente enquanto o de verdade passa batido.
   */
  it('a faixa ganha o título da falha, em vez do da gravação', () => {
    expect(contexto).toMatch(/TITULO_DA_MIDIA/);

    const app = semComentarios(ler('src', 'App.tsx'));
    expect(app, 'a faixa voltou a afirmar a frase da gravação para toda falha').toMatch(
      /\{syncTitulo \|\|/
    );
  });
});
