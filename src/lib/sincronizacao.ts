/**
 * Diff entre o estado anterior e o novo de uma coleção.
 *
 * O contexto tem cerca de 40 mutações, todas no formato
 * `setAllX(prev => ...)`. Em vez de reescrever cada uma para chamar o banco
 * — e correr o risco de esquecer alguma, que passaria a salvar só no
 * navegador —, comparamos os dois estados e derivamos as operações.
 *
 * Assim qualquer mutação, presente ou futura, é persistida sem precisar
 * lembrar de nada.
 */

export interface ComId {
  id: string;
}

export interface Diferenca<T> {
  inseridos: T[];
  atualizados: T[];
  removidos: string[];
}

/**
 * Compara por id e, para os que existem dos dois lados, por conteúdo.
 *
 * A comparação de conteúdo usa JSON: as entidades são objetos de dados puros
 * (sem funções, sem ciclos) e o custo é irrelevante perto de uma ida ao banco.
 */
export const diferenciar = <T extends ComId>(antes: T[], depois: T[]): Diferenca<T> => {
  const mapaAntes = new Map(antes.map((linha) => [linha.id, linha]));
  const mapaDepois = new Map(depois.map((linha) => [linha.id, linha]));

  const inseridos: T[] = [];
  const atualizados: T[] = [];
  const removidos: string[] = [];

  for (const [id, linha] of mapaDepois) {
    const anterior = mapaAntes.get(id);
    if (!anterior) {
      inseridos.push(linha);
    } else if (JSON.stringify(anterior) !== JSON.stringify(linha)) {
      atualizados.push(linha);
    }
  }

  for (const id of mapaAntes.keys()) {
    if (!mapaDepois.has(id)) removidos.push(id);
  }

  return { inseridos, atualizados, removidos };
};

export const temMudanca = <T>(d: Diferenca<T>): boolean =>
  d.inseridos.length > 0 || d.atualizados.length > 0 || d.removidos.length > 0;

/**
 * Identificador gerado no cliente.
 *
 * O banco geraria o uuid, mas aí a interface precisaria esperar a resposta
 * antes de renderizar o item novo. Gerando aqui, a inserção é otimista e o
 * mesmo id vale nos dois lados — sem id temporário para reconciliar depois.
 */
export const novoId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Ambientes sem crypto.randomUUID (navegador antigo, contexto inseguro).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
