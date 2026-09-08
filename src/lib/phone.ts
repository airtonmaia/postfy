/**
 * Comparação de telefones brasileiros.
 *
 * Extraído da tela de login do portal para poder ser testado. A implementação
 * anterior casava por substring nos dois sentidos
 * (`a.includes(b) || b.includes(a)`), então digitar "999" batia com quase
 * qualquer cliente da base e abria o portal dele.
 */

export const somenteDigitos = (valor: string): string => (valor || '').replace(/\D/g, '');

/**
 * Formas equivalentes do mesmo número: com e sem o DDI 55, com e sem o nono
 * dígito. Evita rejeitar um número correto por causa da formatação.
 */
export const variacoesDoNumero = (digitos: string): string[] => {
  if (!digitos) return [];
  const saida = new Set<string>();

  const semDdi = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos;
  saida.add(semDdi);

  // 11 dígitos com nono dígito -> versão de 10
  if (semDdi.length === 11 && semDdi[2] === '9') {
    saida.add(semDdi.slice(0, 2) + semDdi.slice(3));
  }
  // 10 dígitos -> versão com nono dígito
  if (semDdi.length === 10) {
    saida.add(semDdi.slice(0, 2) + '9' + semDdi.slice(2));
  }

  return [...saida];
};

/**
 * Verdadeiro apenas quando os dois representam o mesmo telefone.
 * Exige no mínimo 10 dígitos (DDD + número) para evitar casamento acidental.
 */
export const mesmoTelefone = (a: string, b: string): boolean => {
  const va = variacoesDoNumero(somenteDigitos(a));
  const vb = variacoesDoNumero(somenteDigitos(b));
  return va.some((x) => x.length >= 10 && vb.includes(x));
};
