import { excluirArquivo, levantarUsos } from './biblioteca';
import { arquivosApi } from './api';
import { dadosDoDrive, ehDoDrive, idDeVideoNoDrive } from './midiaDoDrive';
import type { Job } from '../types';

/**
 * Os arquivos que uma peça deixa no balde quando ela é apagada.
 *
 * Excluir o conteúdo e deixar a arte no R2 é o tipo de sobra que ninguém vê
 * crescer: a Biblioteca passa a listar arquivos de peças que não existem
 * mais, e a agência paga por um acervo que ela acha que apagou.
 *
 * **Mas nem tudo que a peça aponta é dela.** A mesma arte pode servir a dois
 * conteúdos — é literalmente por isso que a Biblioteca conta usos antes de
 * deixar excluir. Apagar sem conferir tiraria a imagem de um post que
 * continua no ar, e a falha só apareceria no perfil do cliente.
 */

/** As chaves do balde que esta peça aponta — as dela e as que ela copiou. */
const arquivosDaPeca = (job: Job): string[] => {
  const urls: string[] = [];

  for (const url of [...(job.mediaUrls || []), ...(job.storyMediaUrls || [])]) {
    if (!url) continue;

    if (ehDoDrive(url)) {
      /*
        O arquivo em si mora no Drive e não é nosso para apagar. O que é
        nosso é a miniatura, que foi guardada aqui justamente porque o portal
        do cliente é anônimo.
      */
      const miniatura = dadosDoDrive(url)?.miniatura;
      if (miniatura) urls.push(miniatura);
      continue;
    }

    urls.push(url);
  }

  // A cópia temporária do vídeo, quando ela ainda não foi apagada pela
  // publicação.
  urls.push(...(job.midiaPublicavel?.feed || []), ...(job.midiaPublicavel?.story || []));

  return [...new Set(urls)];
};

/** A chave dentro do balde, tirada do endereço público. */
const chaveDaUrl = (url: string): string | null => {
  try {
    // Sem o primeiro `/`: a chave é `agencia/arquivo`, como `upload-url` a
    // monta. Um endereço de outro domínio vira uma chave que a rota recusa,
    // porque ela confere o prefixo da agência antes de apagar.
    return new URL(url).pathname.replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
};

/**
 * Apaga do balde o que só esta peça usava.
 *
 * Nunca lança: o conteúdo já foi excluído quando esta função roda, e um erro
 * de limpeza não pode transformar uma exclusão concluída em mensagem de
 * falha. O que sobra no balde aparece na Biblioteca, com o contador de usos
 * em zero, e pode ser apagado de lá.
 */
export const apagarMidiaDaPeca = async (job: Job): Promise<number> => {
  try {
    if (!job.workspaceId) return 0;

    /*
      A liberação por link sai junto. Ela existe para o cliente assistir no
      portal enquanto aprova — e uma peça excluída não é aprovada por
      ninguém. O arquivo em si continua no Drive da agência; o que sai é o
      acesso que nós abrimos.
    */
    const videos = [...(job.mediaUrls || []), ...(job.storyMediaUrls || [])]
      .map((u) => idDeVideoNoDrive(u))
      .filter(Boolean) as string[];

    await arquivosApi.acessoNoDrive(job.workspaceId, videos, false);

    const candidatos = arquivosDaPeca(job);
    if (!candidatos.length) return 0;

    /*
      A conferência vai ao **banco**, não ao estado carregado: `carregarTudo`
      traz só 90 dias de conteúdo concluído, então uma arte usada por um post
      mais antigo apareceria como livre — e seria apagada de um conteúdo que
      continua publicado. É a mesma razão de a Biblioteca contar usos assim.
    */
    const usos = await levantarUsos();
    let apagados = 0;

    for (const url of candidatos) {
      const uso = usos.get(url);
      // Outro conteúdo, um material do cliente ou a ficha dele: qualquer um
      // deles mantém o arquivo vivo.
      const usadoPorOutro =
        (uso?.jobs || []).some((j) => j.id !== job.id) || (uso?.outros || 0) > 0;
      if (usadoPorOutro) continue;

      const chave = chaveDaUrl(url);
      if (!chave) continue;

      try {
        await excluirArquivo(job.workspaceId, chave);
        apagados += 1;
      } catch {
        /* Um arquivo que resiste não pode impedir os outros de saírem. */
      }
    }

    return apagados;
  } catch {
    return 0;
  }
};
