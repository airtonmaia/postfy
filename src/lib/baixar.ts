import { dadosDoDrive, ehDoDrive } from './midiaDoDrive';

/**
 * Baixar a arte, do portal do cliente.
 *
 * ### `download` num endereço de outro domínio não baixa
 *
 * O atributo `download` de um link só vale para o **mesmo domínio**. A arte
 * mora no balde, que é outro domínio, e ali o navegador ignora o atributo e
 * **abre** o arquivo numa aba — imagem vira uma foto na tela, vídeo vira um
 * player. Funciona, e não é o que o botão promete.
 *
 * Por isso o caminho é buscar os bytes e entregá-los como arquivo. Quando a
 * busca não é permitida, abrir a aba é o recuo — melhor que um botão que não
 * faz nada.
 *
 * ### Arquivo do Drive baixa pelo Google
 *
 * O original mora lá, e ele está liberado por link enquanto a peça está em
 * aprovação — que é a mesma permissão que faz o player tocar. O endereço de
 * download do Google entrega o arquivo inteiro, em qualidade original, sem
 * passar pela nossa cópia.
 */

export const urlDeDownloadDoDrive = (id: string): string =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;

/** O nome que a pessoa reconhece, para o arquivo salvo. */
export const nomeParaSalvar = (url: string): string => {
  const doDrive = dadosDoDrive(url);
  if (doDrive) return doDrive.nome;

  try {
    const caminho = new URL(url).pathname.split('/').pop() || 'arquivo';
    /*
      A chave carrega `timestamp-uuid-` na frente para não colidir, e isso não
      diz nada a quem está salvando. O nome de verdade vem depois do terceiro
      traço — e quando o padrão não bate, fica o que veio, que é melhor que
      inventar.
    */
    const partes = decodeURIComponent(caminho).split('-');
    return partes.length > 2 ? partes.slice(2).join('-') : caminho;
  } catch {
    return 'arquivo';
  }
};

/**
 * Baixa o arquivo, ou abre quando não dá para baixar.
 *
 * Nunca lança: o botão é um extra da tela de aprovação, e um erro dele não
 * pode interromper quem está decidindo sobre a peça.
 */
export const baixarArquivo = async (url: string): Promise<void> => {
  // Arte do Drive: o Google entrega o original, e a peça já está liberada
  // por link enquanto está em aprovação.
  if (ehDoDrive(url)) {
    const id = dadosDoDrive(url)?.id;
    if (id) window.open(urlDeDownloadDoDrive(id), '_blank', 'noopener');
    return;
  }

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error('recusado');

    const conteudo = await resposta.blob();
    const endereco = URL.createObjectURL(conteudo);

    const link = document.createElement('a');
    link.href = endereco;
    link.download = nomeParaSalvar(url);
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Sem isto o blob fica na memória da aba até ela fechar, e uma aprovação
    // com dez artes baixadas guarda as dez.
    URL.revokeObjectURL(endereco);
  } catch {
    /*
      O balde pode não liberar leitura de outra origem. Abrir a aba deixa a
      pessoa salvar pelo navegador — o botão continua levando a algum lugar,
      que é o mínimo que ele promete.
    */
    window.open(url, '_blank', 'noopener');
  }
};
