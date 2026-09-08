/**
 * Acesso ao localStorage com falha visível.
 *
 * Antes as gravações ficavam num `try { ... } catch(e) {}`: quando a cota
 * estourava (o que acontece rápido, porque mídia entra como base64), o usuário
 * seguia trabalhando achando que estava tudo salvo e perdia tudo no reload.
 * Agora o erro é reportado para a aplicação avisar na tela.
 */

type QuotaListener = (info: { key: string; bytes: number }) => void;

const quotaListeners = new Set<QuotaListener>();

export const onStorageQuotaExceeded = (listener: QuotaListener): (() => void) => {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
};

const isQuotaError = (err: unknown): boolean =>
  err instanceof DOMException &&
  (err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22);

export const readStorage = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[storage] não foi possível ler "${key}":`, err);
    return fallback;
  }
};

/** Retorna true quando gravou; false quando falhou (e já notificou). */
export const writeStorage = (key: string, value: unknown): boolean => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (err) {
    console.error(`[storage] não foi possível serializar "${key}":`, err);
    return false;
  }

  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch (err) {
    if (isQuotaError(err)) {
      const bytes = serialized.length;
      console.error(
        `[storage] cota do navegador excedida ao gravar "${key}" (~${Math.round(bytes / 1024)} KB).`
      );
      quotaListeners.forEach((listener) => listener({ key, bytes }));
    } else {
      console.error(`[storage] falha ao gravar "${key}":`, err);
    }
    return false;
  }
};

export const removeStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage indisponível (aba anônima, cookies bloqueados) — nada a fazer */
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
