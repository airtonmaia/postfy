import type { ArquivoDoDrive } from './midiaDoDrive';

/**
 * A ponte com o Google Drive: autorização, seletor e download.
 *
 * ### O escopo é `drive.file`, e isso não é detalhe
 *
 * Ele dá acesso **só aos arquivos que a pessoa escolher** na janela do
 * Google, um a um, e por isso é escopo não sensível: não passa pela
 * verificação do Google, que é o processo que a revisão da Meta está
 * custando semanas neste mesmo produto. `drive.readonly` leria a conta
 * inteira, precisaria de verificação, e não daria nada a mais — o seletor é
 * onde a escolha acontece de qualquer jeito.
 *
 * ### Tudo acontece no navegador, e isso também é decisão
 *
 * Não há rota `/api` aqui: o `api/` está em 12 de 12 funções do plano Hobby,
 * e a 13ª **derruba o deploy inteiro** com tudo verde localmente (armadilha
 * 6). E não é só economia — o arquivo é um vídeo de dezenas de megabytes, e
 * passá-lo por uma função serverless de 60 segundos seria trocar um caminho
 * que funciona por um que estoura no meio.
 *
 * O navegador pega o token, baixa do Drive e manda para o R2 pela mesma URL
 * pré-assinada de sempre. O servidor nunca vê o token do Google.
 */

/**
 * A chave de API do seletor, e só ela.
 *
 * **O `client_id` saiu daqui.** Ele agora vive no servidor, junto do segredo,
 * porque a autorização deixou de ser por aba e passou a ser da agência: quem
 * guarda o `refresh_token` é o servidor, e a aba pede um token de uma hora
 * quando precisa. Uma segunda forma de obter token no navegador seria uma
 * segunda verdade sobre quem está conectado.
 *
 * A chave de API é pública por definição — ela vai no bundle e o que a
 * protege são as restrições de origem e de API no console do Google.
 */
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

/** Se o **seletor** pode abrir. Se a agência conectou é outra pergunta. */
export const googleConfigurado = (): boolean => Boolean(API_KEY);

/** O que falta, com o nome da variável — a mesma regra da aba Integrações. */
export const faltaDoGoogle = (): string[] => (API_KEY ? [] : ['VITE_GOOGLE_API_KEY']);

const carregado = new Map<string, Promise<void>>();

/**
 * Carrega o script do Google uma vez só.
 *
 * Duas chamadas simultâneas — o seletor do feed e o do story — pediriam o
 * mesmo arquivo duas vezes e a segunda continuaria antes de a primeira
 * definir o global. O mapa guarda a **promessa**, não o fato.
 */
const carregarScript = (src: string): Promise<void> => {
  const existente = carregado.get(src);
  if (existente) return existente;

  const promessa = new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error('Não foi possível carregar o Google.'));
    document.head.appendChild(tag);
  });

  carregado.set(src, promessa);
  return promessa;
};

/**
 * Abre o seletor do Google e devolve o que a pessoa escolheu.
 *
 * O seletor é do Google de propósito: ele mostra as pastas compartilhadas, a
 * busca e os drives de equipe — e é **ele** que concede o acesso de cada
 * arquivo ao `drive.file`. Uma lista montada por nós precisaria ler a conta
 * inteira, que é exatamente o escopo que obriga à verificação.
 */
export const abrirSeletorDoDrive = async (
  token: string,
  quantos: number
): Promise<ArquivoDoDrive[]> => {
  if (!API_KEY) throw new Error('Integração com o Google Drive não configurada.');

  await carregarScript('https://apis.google.com/js/api.js');
  const gapi = (window as any).gapi;

  await new Promise<void>((resolve, reject) =>
    gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('Não foi possível carregar o seletor.')) })
  );

  const picker = (window as any).google.picker;

  return new Promise<ArquivoDoDrive[]>((resolve) => {
    const vista = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      // Só imagem e vídeo: a peça é arte, e deixar escolher um PDF daria um
      // item na lista que nenhuma rede aceita — o erro apareceria na
      // publicação, longe de quem escolheu.
      .setMimeTypes('image/png,image/jpeg,image/webp,video/mp4,video/quicktime');

    const construtor = new picker.PickerBuilder()
      .addView(vista)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setLocale('pt-BR')
      .setTitle('Escolha a arte no seu Drive');

    /*
      Escolha múltipla só onde ela cabe: o uploader do story aceita um arquivo,
      e deixar marcar dois ali ofereceria uma escolha que seria descartada
      depois — a família de defeito que este projeto mais registra.
    */
    if (quantos > 1) construtor.enableFeature(picker.Feature.MULTISELECT_ENABLED);

    const seletor = construtor
      .setCallback((dados: any) => {
        if (dados.action === picker.Action.CANCEL) resolve([]);
        if (dados.action !== picker.Action.PICKED) return;

        const escolhidos: ArquivoDoDrive[] = (dados.docs || [])
          .slice(0, quantos)
          .map((doc: any) => ({
            id: String(doc.id),
            nome: doc.name || 'arquivo do Drive',
            tipo: doc.mimeType || '',
            miniatura: doc.thumbnailUrl || undefined,
          }));

        resolve(escolhidos);
      })
      .build();

    seletor.setVisible(true);
  });
};

/**
 * Baixa o arquivo do Drive para a memória do navegador.
 *
 * `alt=media` é o que devolve os bytes; sem ele vem o JSON com os metadados —
 * e o R2 receberia um arquivo de trezentos bytes com nome de vídeo, que só
 * daria erro na hora de a Meta tentar baixá-lo.
 */
export const baixarDoDrive = async (id: string, token: string): Promise<Blob> => {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resposta.ok) {
    throw new Error(
      resposta.status === 404
        ? 'O arquivo não está mais no Drive, ou o acesso foi retirado.'
        : `O Google recusou o download (${resposta.status}).`
    );
  }

  return await resposta.blob();
};
