import type { ClientFile } from '../types';

/**
 * Arquivo anexado ou link? E qual ícone a linha mostra?
 *
 * Mora aqui, e não na tela, porque a mesma pergunta aparece em três lugares —
 * a lista da aba Arquivos, o botão de ação e o ícone — e três respostas
 * ligeiramente diferentes para a mesma coisa é como nasce o "aqui é PDF e ali
 * não é".
 */

/**
 * O que a linha é.
 *
 * São **três**: anexo nosso, link da pasta de outra pessoa, e bloco de notas.
 * O terceiro entrou aqui, e não numa lista à parte, porque para quem usa os
 * três respondem a mesma pergunta — *o que a agência guardou sobre este
 * cliente?* — e duas listas empilhadas pediam a mesma decisão duas vezes.
 *
 * Linha gravada antes de `kind` existir não tem o campo, e é a maioria: a
 * derivação abaixo é para elas.
 *
 * **`size === 'Nuvem'` é a marca do link, e não é chute:** é o valor literal
 * que `FileUpload` grava no modo "inserir link" (`handleUrlSubmit`), onde não
 * há bytes para medir. Arquivo enviado sempre traz tamanho formatado
 * ("2,4 MB"). Quando nem isso resolve, sobra o endereço: `drive.google.com`,
 * `docs.google.com`, `dropbox`, `notion` e afins são pasta de alguém, não
 * arquivo nosso.
 */
export const tipoDoArquivo = (file: ClientFile): 'arquivo' | 'link' | 'nota' => {
  if (file.kind) return file.kind;
  if (file.size === 'Nuvem') return 'link';

  const url = (file.url || '').toLowerCase();
  const hospedagemDeTerceiro =
    /(?:drive|docs|sheets|slides)\.google\.com|dropbox\.com|onedrive|sharepoint|notion\.so|figma\.com|wetransfer/.test(
      url
    );
  return hospedagemDeTerceiro ? 'link' : 'arquivo';
};

/**
 * Extensão, para escolher o ícone.
 *
 * Sai do **nome** antes da URL: a chave do R2 é
 * `workspaceId/timestamp-uuid-nome`, então a extensão está nos dois lugares —
 * mas o nome é o que a pessoa vê, e é ele que decide o que ela espera.
 */
export const extensaoDoArquivo = (file: ClientFile): string => {
  const de = (texto: string): string =>
    (texto.split('?')[0].split('#')[0].split('/').pop() || '')
      .split('.')
      .slice(1)
      .pop()
      ?.toLowerCase() ?? '';

  return de(file.name) || de(file.url || '');
};

export type FamiliaDeArquivo = 'pdf' | 'imagem' | 'video' | 'planilha' | 'documento' | 'outro';

/**
 * A família que decide o ícone.
 *
 * O PDF tem família própria porque foi o pedido e porque é o formato que mais
 * aparece em contrato e briefing — um ícone de pasta genérico em cima de um
 * contrato não diz nada sobre o que vai abrir.
 */
export const familiaDoArquivo = (file: ClientFile): FamiliaDeArquivo => {
  if (tipoDoArquivo(file) === 'link') return 'outro';

  const ext = extensaoDoArquivo(file);
  if (ext === 'pdf') return 'pdf';
  if (/^(jpe?g|png|gif|webp|avif|svg|ico|bmp|heic)$/.test(ext)) return 'imagem';
  if (/^(mp4|mov|webm|avi|mkv|m4v)$/.test(ext)) return 'video';
  if (/^(xlsx?|csv|numbers|ods)$/.test(ext)) return 'planilha';
  if (/^(docx?|txt|rtf|pages|odt|pptx?|key)$/.test(ext)) return 'documento';
  return 'outro';
};
