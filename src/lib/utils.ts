import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function safeTimeFormat(dateInput?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return "10:00";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "10:00";
    return d.toLocaleTimeString('pt-BR', options || { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "10:00";
  }
}

export function safeDateFormat(dateInput?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return "Sem data";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "Sem data";
    return d.toLocaleDateString('pt-BR', options);
  } catch {
    return "Sem data";
  }
}

export function safeDateTimeFormat(dateInput?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return "Sem data";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "Sem data";
    return d.toLocaleString('pt-BR', options || { dateStyle: 'short', timeStyle: 'short' });
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


