import { supabase } from './supabase';
import { arquivosApi } from './api';
import { baixarDoDrive } from './google';
import { tokenDoDrive } from './driveDaAgencia';
import { dadosDoDrive, ehDoDrive } from './midiaDoDrive';

/**
 * Traz para o R2 a arte que está no Drive, na hora de publicar.
 *
 * ### Por que não na hora de escolher
 *
 * Porque o objetivo é o R2 **não** guardar o acervo. Copiando ao escolher, o
 * Drive vira só um explorador de arquivos e o vídeo fica nos dois lugares
 * para sempre. Copiando aqui, o balde guarda apenas o que está em trânsito
 * entre agendar e publicar — e o agendador apaga depois que a peça foi ao ar.
 *
 * ### Por que no navegador
 *
 * O token do Google é de quem está agendando, e ele nunca sai daqui. O
 * servidor não tem esse token, não tem sessão no cron, e uma função
 * serverless de 60 segundos não é lugar para um vídeo de dezenas de
 * megabytes. Aqui o arquivo vai do Drive para o R2 pela mesma URL
 * pré-assinada de sempre.
 *
 * ### E por que a `media_urls` não muda
 *
 * Ela é o que a tela desenha e o que o cliente aprovou. Reescrevê-la com a
 * URL do R2 faria a peça deixar de apontar para o Drive — e a cópia é
 * apagada depois de publicar, então a peça ficaria apontando para um arquivo
 * que não existe mais. A cópia mora em `midia_publicavel`, que só o
 * publicador lê.
 */

export interface MidiaPublicavel {
  feed: string[];
  story: string[];
  /** As chaves no balde. É o que o agendador apaga, e nada além disso. */
  chaves: string[];
}

export interface PreparoDaMidia {
  /** Quantos arquivos foram copiados agora. Zero é o caso normal. */
  copiados: number;
  /** O que não deu para copiar, com o motivo — nomeando o arquivo. */
  falhas: { nome: string; motivo: string }[];
}

const nomeDoArquivo = (url: string): string => dadosDoDrive(url)?.nome || 'arquivo';

/**
 * Copia para o R2 o que ainda está no Drive, e grava `midia_publicavel`.
 *
 * Não lança quando um arquivo falha: devolve a falha com o nome dele. Uma
 * exceção aqui esconderia os que deram certo, e quem agenda precisa saber
 * exatamente qual arte não vai sair — é a mesma razão de
 * `agendarPublicacao` devolver o que ficou de fora em vez de estourar.
 */
export const prepararMidiaDoDrive = async (jobId: string): Promise<PreparoDaMidia> => {
  const { data: job } = await supabase
    .from('jobs')
    .select('workspace_id, media_urls, story_media_urls, midia_publicavel')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) return { copiados: 0, falhas: [] };

  const doFeed: string[] = job.media_urls || [];
  const doStory: string[] = job.story_media_urls || [];

  if (!doFeed.some(ehDoDrive) && !doStory.some(ehDoDrive)) {
    return { copiados: 0, falhas: [] };
  }

  /*
    O token é o da agência, pedido ao servidor. Antes a janela do Google
    abria aqui — no meio do "Agendar", depois de a pessoa já ter escolhido o
    arquivo horas antes.
  */
  const acesso = await tokenDoDrive(job.workspace_id);
  const falhas: PreparoDaMidia['falhas'] = [];
  const chaves: string[] = [];
  let copiados = 0;

  const resolver = async (urls: string[]): Promise<string[]> => {
    const saida: string[] = [];

    for (const url of urls) {
      const doDrive = dadosDoDrive(url);
      if (!doDrive) {
        // Arte que já está no R2 entra como está: a peça pode misturar as
        // duas origens, e nada obriga a recopiar o que já é publicável.
        saida.push(url);
        continue;
      }

      try {
        const conteudo = await baixarDoDrive(doDrive.id, acesso);
        const arquivo = new File([conteudo], doDrive.nome, {
          type: doDrive.tipo || conteudo.type || 'application/octet-stream',
        });

        const { url: publica, chave } = await arquivosApi.enviarComChave(arquivo, job.workspace_id);
        saida.push(publica);
        chaves.push(chave);
        copiados += 1;
      } catch (erro) {
        falhas.push({
          nome: nomeDoArquivo(url),
          motivo: erro instanceof Error ? erro.message : 'Falha ao copiar do Drive.',
        });
      }
    }

    return saida;
  };

  const feed = await resolver(doFeed);
  const story = await resolver(doStory);

  /*
    Nada é gravado se alguma cópia falhou: uma `midia_publicavel` pela metade
    faria a peça publicar sem a página que faltou, e carrossel incompleto no
    perfil do cliente não volta. Melhor não agendar e dizer qual arquivo é.
  */
  if (falhas.length) return { copiados, falhas };

  const publicavel: MidiaPublicavel = { feed, story, chaves };
  await supabase.from('jobs').update({ midia_publicavel: publicavel }).eq('id', jobId);

  return { copiados, falhas };
};
