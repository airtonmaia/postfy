import type { JobPlatform } from '../types';
import { publicaSozinho, NOME_DA_REDE } from './redes';

/**
 * O que a peça tem de errado **antes** de alguém clicar.
 *
 * O produto só dizia essas coisas depois da ação: a data vencida aparecia no
 * resultado do agendamento, e "este cliente não tem conta conectada" saía de
 * `textoDoAgendamento`, isto é, depois de a peça já ter ido para a fila. É a
 * mesma lição de `faltaArteDoStory`, que foi movida para antes da ação pelo
 * mesmo motivo: descobrir no fim custa o clique, e às vezes custa a peça.
 *
 * Tudo aqui é **puro e sem rede**, com uma exceção nomeada: saber se o cliente
 * tem conta conectada depende de uma consulta, então quem busca é a tela e
 * esta função recebe a resposta pronta.
 */

/**
 * A data já passou?
 *
 * **Comparação de instantes, e por isso ela não passa pelo fuso da agência.**
 * O fuso decide como a data é *escrita* (armadilha 8.2); qual das duas veio
 * antes é a mesma resposta em qualquer lugar do mundo.
 *
 * Texto vazio ou inválido devolve `false`: "sem data" é um estado legítimo —
 * peça aprovada antes de alguém marcar quando ela sai — e acusar atraso ali
 * seria inventar um prazo que ninguém combinou.
 */
export const dataJaPassou = (
  /**
   * Instante, não hora de parede. Quem tem o texto de um `datetime-local`
   * converte com `deParedeParaUtc` antes — ele interpreta no fuso do
   * navegador, e "já passou?" no fuso errado erra por horas (armadilha 8.2).
   */
  quando: string | Date | undefined | null,
  agora: Date = new Date()
): boolean => {
  if (!quando) return false;
  const instante = quando instanceof Date ? quando.getTime() : new Date(quando).getTime();
  if (Number.isNaN(instante)) return false;
  return instante < agora.getTime();
};

export interface AvisoDoCanal {
  canal: JobPlatform;
  rede: string;
  /** `true` quando a peça sai sozinha na data. */
  automatico: boolean;
  texto: string;
}

/**
 * O que acontece na data, canal por canal.
 *
 * Três desfechos, e a diferença entre eles é o que a agência precisa saber
 * **antes** de prometer a data ao cliente:
 *
 * - a rede publica sozinha e o cliente tem conta conectada → sai na data;
 * - a rede publica sozinha e **não** há conta conectada → a postagem é manual,
 *   e isso é o caso que mais engana: a tela oferece "Agendar publicação", a
 *   peça entra como agendada, e no dia ninguém publica;
 * - a rede não publica sozinha (LinkedIn, TikTok, X, YouTube) → sempre manual,
 *   e dizer isso aqui evita a descoberta na data agendada.
 */
export const avisosDosCanais = (
  canais: JobPlatform[],
  /** As redes em que **este cliente** tem conta conectada. */
  conectadas: JobPlatform[]
): AvisoDoCanal[] =>
  canais.map((canal) => {
    const rede = NOME_DA_REDE[canal] ?? canal;

    if (!publicaSozinho(canal)) {
      return {
        canal,
        rede,
        automatico: false,
        texto: `${rede}: o Orquesia não dispara sozinho, a postagem é manual.`,
      };
    }

    if (!conectadas.includes(canal)) {
      return {
        canal,
        rede,
        automatico: false,
        texto: `${rede} não conectado: a publicação fica manual. Conecte a conta do cliente para o disparo automático.`,
      };
    }

    return { canal, rede, automatico: true, texto: `${rede}: sai sozinho na data agendada.` };
  });
