/**
 * O fuso horário da agência — e por que ele mora num lugar só.
 *
 * `workspaces.timezone` existe desde a primeira migração, com default
 * `America/Sao_Paulo`, e até aqui **ninguém lia**. Aparecia como rótulo em
 * duas telas e nada mais. Quem lesse o schema concluiria que o produto tinha
 * controle de fuso; era a mesma armadilha do `trial_ends_at` — coluna que
 * parece uma regra e não é.
 *
 * O que funcionava por acidente: `datetime-local` interpreta no fuso **do
 * navegador**, e a exibição também. Round-trip certo, desde que quem agenda e
 * quem lê estejam no mesmo dispositivo. Quebra em três casos reais:
 *
 *  - membro da equipe em outro estado vê um horário diferente do colega, para
 *    o mesmo post;
 *  - o **portal do cliente** formata no fuso do dispositivo dele — "sai às
 *    10:00" vira 11:00 para um cliente em Brasília;
 *  - celular com fuso automático errado agenda errado, sem aviso nenhum.
 *
 * ### Por que um módulo com estado, e não um parâmetro
 *
 * São 72 pontos que formatam data, em 26 arquivos. Passar o fuso em cada
 * chamada significa esquecer um — e esquecer aqui não quebra nada visível:
 * mostra o horário errado, com cara de certo. O fuso fica guardado aqui, é
 * definido num lugar só (o contexto, quando a agência carrega) e os
 * formatadores o leem por padrão. Mesma ideia da persistência derivada de
 * diff: o caminho certo é o que não exige lembrar de nada.
 */

/** Sem agência carregada ainda. É o mesmo default da coluna no banco. */
const PADRAO = 'America/Sao_Paulo';

let fusoAtual = PADRAO;

export const definirFusoDaAgencia = (fuso?: string | null): void => {
  fusoAtual = ehFusoValido(fuso) ? (fuso as string) : PADRAO;
};

export const fusoDaAgencia = (): string => fusoAtual;

/**
 * Um fuso que o navegador não conhece derruba o `Intl` com `RangeError`, e
 * derrubaria junto toda tela que mostra data. Um nome errado no banco vira
 * o default, não uma tela branca.
 */
export const ehFusoValido = (fuso?: string | null): boolean => {
  if (!fuso) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
};

/** Os pedaços de uma data, já no fuso pedido. */
const partesNoFuso = (data: Date, fuso: string) => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(data);

  const mapa: Record<string, string> = {};
  for (const p of partes) if (p.type !== 'literal') mapa[p.type] = p.value;

  return {
    ano: Number(mapa.year),
    mes: Number(mapa.month),
    dia: Number(mapa.day),
    // `hour12: false` devolve 24 para a meia-noite em alguns motores.
    hora: Number(mapa.hour) % 24,
    minuto: Number(mapa.minute),
    segundo: Number(mapa.second),
  };
};

/**
 * Quantos milissegundos o fuso está à frente do UTC **naquele instante**.
 *
 * Depende do instante porque horário de verão existe: Lisboa muda duas vezes
 * por ano. O Brasil não tem desde 2019, mas escrever isso como constante
 * seria uma dessas suposições que ninguém revisita.
 */
const deslocamentoMs = (data: Date, fuso: string): number => {
  const p = partesNoFuso(data, fuso);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  // Os milissegundos não vêm nas partes; descontá-los evita erro de até 999ms.
  return comoSeFosseUtc - (data.getTime() - data.getMilliseconds());
};

/**
 * "2026-09-14T10:00" no fuso da agência → o instante UTC correspondente.
 *
 * É a metade que o `datetime-local` não faz: ele sempre interpreta no fuso do
 * navegador. Sem esta conversão, quem agenda de São Paulo para uma agência de
 * Cuiabá marca 10:00 e o post sai às 09:00.
 */
export const deParedeParaUtc = (parede: string, fuso = fusoAtual): Date => {
  // O formato é conferido antes de o `Date` ver o texto, e não depois: o V8 é
  // permissivo de um jeito perigoso aqui — `new Date(':00Z')` devolve
  // **1º de janeiro de 2000**, não uma data inválida. Um campo vazio viraria
  // um agendamento em 2000, que o cron publicaria na primeira passada por já
  // estar vencido.
  const formato = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2})?$/.exec(parede?.trim() ?? '');
  if (!formato) return new Date(NaN);

  const palpite = new Date(`${formato[0].slice(0, 16)}:00Z`);
  if (isNaN(palpite.getTime())) return new Date(NaN);

  const primeiro = new Date(palpite.getTime() - deslocamentoMs(palpite, fuso));
  // Segunda passada: na virada do horário de verão o deslocamento do palpite
  // não é o mesmo do instante corrigido, e uma passada só erraria em uma hora.
  return new Date(palpite.getTime() - deslocamentoMs(primeiro, fuso));
};

/** O instante UTC → "2026-09-14T10:00", para pôr no `datetime-local`. */
export const deUtcParaParede = (iso: string | Date, fuso = fusoAtual): string => {
  const data = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(data.getTime())) return '';

  const p = partesNoFuso(data, fuso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.ano}-${z(p.mes)}-${z(p.dia)}T${z(p.hora)}:${z(p.minuto)}`;
};

/**
 * O dia a que a data pertence **no fuso da agência**, como "2026-09-14".
 *
 * É o que o calendário e o quadro usam para agrupar. Sem isto, um post das
 * 21:00 em Cuiabá (00:00Z do dia seguinte) cai na casinha errada para quem
 * abrir o app de um fuso à frente — e o erro parece um bug de dados.
 */
export const diaNoFuso = (data: Date | string, fuso = fusoAtual): string => {
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return '';
  const p = partesNoFuso(d, fuso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.ano}-${z(p.mes)}-${z(p.dia)}`;
};

/**
 * A hora do dia (0–23) no fuso da agência.
 *
 * A grade da semana empilha os conteúdos por faixa de hora, e usava
 * `getHours()` — a hora do dispositivo. Num fuso diferente o post aparecia na
 * faixa errada, ainda que no dia certo.
 */
export const horaNoFuso = (data: Date | string, fuso = fusoAtual): number => {
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return 0;
  return partesNoFuso(d, fuso).hora;
};

/**
 * A chave "2026-09-14" de uma casinha do calendário.
 *
 * As casinhas do mês são **rótulos**, não instantes: a célula "14 de setembro"
 * é o dia 14, e não um momento no tempo. Convertê-la com `diaNoFuso` seria
 * errado — ela nasce de `new Date(ano, mes, dia)`, meia-noite **local**, e num
 * dispositivo à frente da agência viraria o dia 13. Por isso a chave sai
 * direto dos números da grade, e é o lado do conteúdo que é convertido.
 */
export const chaveDoDia = (ano: number, mes0: number, dia: number): string =>
  `${ano}-${String(mes0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** `true` quando as duas datas caem no mesmo dia do fuso da agência. */
export const mesmoDiaNoFuso = (a: Date | string, b: Date | string, fuso = fusoAtual): boolean =>
  diaNoFuso(a, fuso) === diaNoFuso(b, fuso);

/**
 * Os fusos oferecidos na tela.
 *
 * Cuiabá está aqui porque a lista anterior não tinha: quem é de Mato Grosso
 * teria de descobrir sozinho que "Manaus" é o mesmo UTC−4. Fuso que a pessoa
 * não encontra pelo nome da própria cidade é fuso que ela configura errado.
 */
export const FUSOS: { valor: string; rotulo: string }[] = [
  { valor: 'America/Sao_Paulo', rotulo: 'Brasília, São Paulo, Rio (GMT−3)' },
  { valor: 'America/Cuiaba', rotulo: 'Cuiabá, Campo Grande (GMT−4)' },
  { valor: 'America/Manaus', rotulo: 'Manaus, Porto Velho (GMT−4)' },
  { valor: 'America/Belem', rotulo: 'Belém, Macapá (GMT−3)' },
  { valor: 'America/Fortaleza', rotulo: 'Fortaleza, Recife, Salvador (GMT−3)' },
  { valor: 'America/Rio_Branco', rotulo: 'Rio Branco (GMT−5)' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha (GMT−2)' },
  { valor: 'Europe/Lisbon', rotulo: 'Lisboa (GMT+0/+1)' },
  { valor: 'UTC', rotulo: 'UTC (GMT+0)' },
];

/** "Cuiabá, Campo Grande (GMT−4)", ou o próprio nome se não estiver na lista. */
export const rotuloDoFuso = (fuso = fusoAtual): string =>
  FUSOS.find((f) => f.valor === fuso)?.rotulo ?? fuso;

/**
 * Só a cidade, para caber ao lado de um campo: "Cuiabá".
 *
 * O campo de agendamento precisa dizer de qual fuso é o horário que a pessoa
 * está digitando. Sem isso, quem está em São Paulo numa agência de Cuiabá
 * digita 10:00 achando que é o horário dele — e só descobre quando o post sai
 * uma hora "errado".
 */
export const cidadeDoFuso = (fuso = fusoAtual): string => {
  const rotulo = FUSOS.find((f) => f.valor === fuso)?.rotulo;
  if (!rotulo) return fuso.split('/').pop()?.replace(/_/g, ' ') ?? fuso;
  return rotulo.split(',')[0].replace(/\s*\(.*/, '');
};

/**
 * O fuso do dispositivo é diferente do da agência?
 *
 * Quando é, a tela diz de qual fuso está falando. Quando não é — o caso
 * comum —, o aviso seria ruído: repetir "horário de Cuiabá" para quem está
 * em Cuiabá treina a pessoa a ignorar avisos.
 */
export const fusoDoDispositivoDivergente = (fuso = fusoAtual): boolean => {
  try {
    const doDispositivo = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!doDispositivo || doDispositivo === fuso) return false;
    // Nomes diferentes com o mesmo deslocamento não confundem ninguém:
    // 'America/Manaus' e 'America/Cuiaba' marcam a mesma hora no relógio.
    const agora = new Date();
    return deslocamentoMs(agora, doDispositivo) !== deslocamentoMs(agora, fuso);
  } catch {
    return false;
  }
};
