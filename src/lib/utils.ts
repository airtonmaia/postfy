import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { fusoDaAgencia } from "./fusoHorario";

/**
 * Toda data é formatada no fuso da agência — e o padrão mora aqui, num lugar
 * só.
 *
 * São 72 pontos que mostram data, em 26 arquivos. Passar o fuso em cada
 * chamada significaria esquecer algum, e esquecer aqui **não quebra nada
 * visível**: mostra o horário do dispositivo de quem abriu, com cara de
 * certo. Quem agenda de outro estado veria um horário e o cliente veria
 * outro.
 *
 * `com()` junta o fuso da agência às opções de cada chamada, deixando quem
 * passar `timeZone` explicitamente vencer — é o que o ChangelogModal faz,
 * onde a data é rótulo fixo e tem de ser lida em UTC.
 */
const com = (opcoes?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({
  timeZone: fusoDaAgencia(),
  ...opcoes,
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", com({
      day: "2-digit",
      month: "short",
      year: "numeric",
    })).format(date);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", com({
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Dinheiro em real, com as duas casas sempre.
 *
 * **Esta função existia e não tinha um único chamador.** Os treze lugares que
 * mostram valor escreviam `R$ {valor.toLocaleString('pt-BR')}` à mão — e esse
 * formato **não força as casas decimais**: R$ 1.200,50 sai como
 * `R$ 1.200,5`, e R$ 1.200,05 sai como `R$ 1.200,05` só por sorte do
 * arredondamento. Dois deles nem passavam por formatação: `R$ {plan.price}`
 * escreve o número cru, com **ponto** decimal, no meio de uma tela em
 * português.
 *
 * O pior lugar em que isso aparecia é o corpo do **contrato** que a agência
 * manda para o cliente dela — a mesma regra do alcance em Relatórios: quem é
 * enganado não é o dono do produto, é o cliente de quem paga por ele.
 *
 * **Valor ausente vale zero, e isso é decisão.** Antes, metade dos pontos
 * escrevia `(valor || 0)` e a outra metade confiava no número: `null` ali
 * derruba a tela com `TypeError`, e `undefined` imprimia a palavra
 * "undefined" ao lado do cifrão. Um campo de dinheiro em branco neste produto
 * é um lead sem valor estimado ou um plano sem preço — zero é a leitura certa,
 * e é melhor que as três saídas que existiam.
 */
export function formatCurrency(value: number | null | undefined): string {
  const numero = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero);
}

export function safeTimeFormat(dateInput?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return "10:00";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "10:00";
    return d.toLocaleTimeString('pt-BR', com(options || { hour: '2-digit', minute: '2-digit' }));
  } catch {
    return "10:00";
  }
}

export function safeDateFormat(dateInput?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return "Sem data";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "Sem data";
    return d.toLocaleDateString('pt-BR', com(options));
  } catch {
    return "Sem data";
  }
}

export function safeDateTimeFormat(dateInput?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return "Sem data";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "Sem data";
    return d.toLocaleString('pt-BR', com(options || { dateStyle: 'short', timeStyle: 'short' }));
  } catch {
    return "Sem data";
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API error:', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('Fallback clipboard copy error:', err);
    return false;
  }
}


