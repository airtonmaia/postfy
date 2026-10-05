import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import {
  duracaoLegivel,
  linhaDoTempo,
  type EventoDeEtapa,
  type OrigemDaMudanca,
} from '../src/lib/historicoDeEtapas';
import { ETAPAS_DO_CONTEUDO } from '../src/lib/etapasDoConteudo';

/**
 * Quem mexeu na peça, quando, e quanto ela ficou parada.
 *
 * O número que sai daqui é levado para a reunião com o cliente — "ficou quatro
 * dias parado esperando sua aprovação" — e o **nome** também: "quem mandou
 * isso para aprovação sem a arte?". Os dois caem na mesma regra de
 * `post_metrics`: **nulo é "não medi", e "não medi" se diz**.
 *
 * As guardas estão em duas famílias:
 *
 * - as de **comportamento**, que rodam a função de verdade, porque ela é pura;
 * - as da **migração**, que conferem que ninguém pode forjar o histórico e que
 *   o gatilho não vira ruído a cada edição de legenda.
 */

const RAIZ = join(__dirname, '..');

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const AGORA = new Date('2026-10-05T18:00:00.000Z');
const antes = (ms: number) => new Date(AGORA.getTime() - ms).toISOString();

const evento = (
  status: string,
  ms: number,
  porNome?: string,
  origem: OrigemDaMudanca = 'equipe'
): EventoDeEtapa =>
  ({ id: `e-${status}-${ms}`, status, entrouEm: antes(ms), porNome, origem }) as EventoDeEtapa;

const frases = (linha: ReturnType<typeof linhaDoTempo>) =>
  linha.acontecimentos.map((a) => a.frase);

describe('a lista é de acontecimentos, com autor e horário', () => {
  it('cada passo diz o que foi feito e por quem', () => {
    /*
      "Aprovação — Airton Maia" deixa em aberto se ele mandou para aprovação ou
      se ele aprovou, que são coisas opostas. O histórico conta o **ato**.
    */
    const linha = linhaDoTempo(
      [
        evento('ideas', 5 * DIA, 'Mariany'),
        evento('in_production', 4 * DIA, 'Mariany'),
        evento('for_approval', 2 * DIA, 'Airton Maia'),
      ],
      'for_approval',
      AGORA
    );

    expect(frases(linha)).toEqual([
      'Criado por Mariany',
      'Enviado para produção por Mariany',
      'Enviado para aprovação por Airton Maia',
    ]);
  });

  it('a primeira linha é a criação, nunca "voltou para ideias"', () => {
    /*
      O gatilho dispara no insert, então o primeiro evento é sempre o
      nascimento da peça — e dizer "voltou" sobre algo que acabou de nascer faz
      procurar um histórico anterior que não existe.

      Quando ela não nasce na primeira etapa, a etapa vai junto: criar direto
      em "Produção" é comum, e omitir isso deixaria um buraco entre a criação e
      o primeiro movimento registrado.
    */
    expect(frases(linhaDoTempo([evento('ideas', DIA, 'Mariany')], 'ideas', AGORA))[0]).toBe(
      'Criado por Mariany'
    );
    expect(
      frases(linhaDoTempo([evento('in_production', DIA, 'Mariany')], 'in_production', AGORA))[0]
    ).toBe('Criado em Produção por Mariany');

    // E "voltou para ideias" continua existindo — quando é mesmo uma volta.
    const volta = linhaDoTempo(
      [evento('in_production', 2 * DIA, 'Ana'), evento('ideas', DIA, 'Ana')],
      'ideas',
      AGORA
    );
    expect(frases(volta)[1]).toBe('Voltou para ideias por Ana');
  });

  it('cliente e agendador não viram "Sistema"', () => {
    /*
      Os dois chegam ao banco com `auth.uid()` nulo, e a diferença entre eles é
      a coisa mais útil da linha: "Aprovado" sem dizer que foi **o cliente** não
      responde nada. Inventar um autor seria pior ainda.
    */
    const linha = linhaDoTempo(
      [
        evento('for_approval', 3 * DIA, 'Airton Maia'),
        evento('approved', 2 * DIA, undefined, 'portal'),
        evento('published', DIA, undefined, 'sistema'),
      ],
      'published',
      AGORA
    );

    expect(frases(linha)[1]).toBe('Aprovado pelo cliente, no portal');
    expect(frases(linha)[2]).toBe('Publicado pelo agendador');
  });

  it('sem nome e sem origem conhecida, a frase não inventa autor', () => {
    const linha = linhaDoTempo([evento('for_approval', DIA, undefined, 'equipe')], 'for_approval', AGORA);
    expect(frases(linha)[0]).toBe('Criado em Aprovação');
  });

  it('o vaivém aparece uma linha por vez, não somado', () => {
    /*
      A primeira versão disto somava as visitas: uma linha por etapa, com o
      tempo total. Lê bem e **apaga o que importa** — "voltou para ajuste três
      vezes" vira "ficou 6h em ajuste", e o vaivém, que é a história da peça,
      desaparece.
    */
    const linha = linhaDoTempo(
      [
        evento('for_approval', 10 * HORA, 'Ana'),
        evento('in_adjustment', 8 * HORA, 'Ana'),
        evento('for_approval', 6 * HORA, 'Ana'),
        evento('in_adjustment', 4 * HORA, 'Ana'),
      ],
      'in_adjustment',
      AGORA
    );

    expect(linha.acontecimentos).toHaveLength(4);
    expect(frases(linha).filter((f) => f.startsWith('Devolvido para ajuste'))).toHaveLength(2);
  });
});

describe('a duração é derivada, nunca gravada', () => {
  it('cada passo dura até o seguinte, e o último corre até agora', () => {
    /*
      Gravar a duração junto exigiria fechar a linha anterior a cada mudança —
      duas escritas onde cabe uma, e a segunda podendo falhar sozinha. O
      resultado seria uma etapa "aberta para sempre", com a tela somando um
      tempo que não passou.
    */
    const linha = linhaDoTempo(
      [evento('ideas', 3 * DIA), evento('in_production', 2 * DIA), evento('for_approval', 2 * HORA)],
      'for_approval',
      AGORA
    );

    expect(linha.acontecimentos[0].duracaoMs).toBe(DIA);
    expect(linha.acontecimentos[1].duracaoMs).toBe(2 * DIA - 2 * HORA);
    expect(linha.acontecimentos[2].duracaoMs).toBe(2 * HORA);
    expect(linha.acontecimentos[2].emAndamento).toBe(true);
    expect(linha.totalMs).toBe(3 * DIA);
  });

  it('a ordem sai da data, não da ordem em que as linhas chegaram', () => {
    /*
      O `select` pode mudar de ordenação, e uma linha fora de lugar daria
      duração negativa — que apareceria na tela como "—" sem ninguém entender
      por quê.
    */
    const linha = linhaDoTempo(
      [evento('for_approval', 1 * HORA), evento('ideas', 5 * HORA)],
      'for_approval',
      AGORA
    );

    expect(linha.acontecimentos.map((a) => a.status)).toEqual(['ideas', 'for_approval']);
    expect(linha.acontecimentos[0].duracaoMs).toBe(4 * HORA);
  });

  it('relógio do dispositivo atrasado não produz duração negativa', () => {
    // O `entrou_em` vem do banco e o "agora" vem do navegador. Sem o piso em
    // zero, o total ficaria menor que a soma das partes.
    const linha = linhaDoTempo([evento('for_approval', -5 * MINUTO)], 'for_approval', AGORA);

    expect(linha.acontecimentos[0].duracaoMs).toBe(0);
    expect(linha.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('a etapa que a peça já deixou para de contar tempo', () => {
    /*
      A última linha do histórico e o `job.status` divergem numa peça que mudou
      de etapa antes de o registro existir. Sem conferir as duas pontas, a
      etapa abandonada continuaria "em andamento", com o total subindo sozinho
      na tela.
    */
    const linha = linhaDoTempo([evento('ideas', 2 * DIA, 'Ana')], 'approved', AGORA);
    expect(linha.acontecimentos[0].emAndamento).toBe(false);
  });
});

describe('o que não foi medido não é inventado', () => {
  it('sem evento nenhum, a linha do tempo se declara não medida', () => {
    const linha = linhaDoTempo([], 'in_production', AGORA);

    expect(linha.medido, 'linha do tempo vazia passou a afirmar que mediu').toBe(false);
    expect(linha.acontecimentos).toHaveLength(0);
    expect(linha.totalMs).toBe(0);
  });

  it('as etapas pendentes são as que a peça ainda não alcançou', () => {
    /*
      Sem elas, uma peça em produção e uma peça publicada desenham listas do
      mesmo tamanho, e some de vista o quanto falta.
    */
    const linha = linhaDoTempo(
      [evento('ideas', 2 * DIA, 'Ana'), evento('in_production', DIA, 'Ana')],
      'in_production',
      AGORA
    );
    const pendentes = linha.pendentes.map((p) => p.status);

    expect(pendentes).toContain('published');
    expect(pendentes, 'etapa já percorrida voltou para a lista do que falta').not.toContain(
      'ideas'
    );
    expect(pendentes, 'a etapa atual apareceu como "ainda não iniciada"').not.toContain(
      'in_production'
    );
  });
});

describe('o tempo é escrito para ser lido', () => {
  it('no máximo duas unidades, e nada de "0m"', () => {
    expect(duracaoLegivel(30 * 1000)).toBe('menos de 1m');
    expect(duracaoLegivel(7 * MINUTO)).toBe('7m');
    expect(duracaoLegivel(2 * HORA)).toBe('2h');
    expect(duracaoLegivel(2 * HORA + 15 * MINUTO)).toBe('2h 15m');
    expect(duracaoLegivel(3 * DIA + 4 * HORA)).toBe('3d 4h');
    expect(duracaoLegivel(3 * DIA)).toBe('3d');
  });
});

describe('a lista de etapas é uma só, e cobre o fluxo inteiro', () => {
  it('todo JobStatus tem uma etapa na linha do tempo', () => {
    /*
      **Derivada do tipo, não escrita à mão.** Um status novo em `JobStatus`
      sem entrada aqui não quebra nada: ele some da linha do tempo e o tempo
      gasto nele desaparece do total, com a tela dizendo um número menor com
      cara de certo.
    */
    const tipos = readFileSync(join(RAIZ, 'src', 'types', 'index.ts'), 'utf-8');
    const uniao = tipos.slice(tipos.indexOf('export type JobStatus'));
    const declarados = (uniao.slice(0, uniao.indexOf(';')).match(/'([a-z_]+)'/g) ?? []).map((s) =>
      s.replace(/'/g, '')
    );

    expect(declarados.length, 'não achei a união JobStatus').toBeGreaterThan(3);

    const naLista = ETAPAS_DO_CONTEUDO.map((e) => e.valor);
    for (const status of declarados) {
      expect(naLista, `o status "${status}" não tem etapa na linha do tempo`).toContain(status);
    }
  });

  it('o card do quadro usa a lista compartilhada, sem cópia própria', () => {
    const cartao = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'kanban', 'CartaoDoQuadro.tsx'), 'utf-8')
    );

    expect(cartao, 'o seletor de etapa voltou a ter a própria lista').toContain(
      'ETAPAS_DO_CONTEUDO'
    );
    expect(cartao, 'nasceu uma segunda lista de etapas no card').not.toMatch(
      /const ETAPAS(_DO_QUADRO)?\s*[:=]/
    );
  });
});

describe('o histórico não pode ser forjado nem virar ruído', () => {
  const migracao = (() => {
    const arquivo = readdirSync(join(RAIZ, 'supabase', 'migrations'))
      .filter((f) => f.includes('historico_de_etapas'))
      .sort()
      .pop();
    expect(arquivo, 'a migração do histórico de etapas sumiu').toBeTruthy();
    return readFileSync(join(RAIZ, 'supabase', 'migrations', arquivo!), 'utf-8');
  })();

  /** Sem os comentários: o porquê de cada decisão está escrito neles. */
  const sql = semComentarios(migracao).toLowerCase();

  it('a tabela não tem escrita por sessão autenticada', () => {
    /*
      Quem grava é o gatilho. Uma política de insert aqui deixaria o navegador
      afirmar que a peça ficou dois dias em produção quando ficou duas horas —
      e esse número existe justamente para ser mostrado ao cliente. Mesma razão
      de `post_metrics` e `subscriptions`.
    */
    const politicas: string[] = sql.match(/create policy[\s\S]*?;/g) ?? [];
    const doHistorico = politicas.filter((p) => p.includes('historico_de_etapas'));

    expect(doHistorico.length, 'o histórico ficou sem política de leitura').toBeGreaterThan(0);
    for (const p of doHistorico) {
      expect(p, 'apareceu política de escrita no histórico de etapas').toMatch(/for select/);
    }
    expect(sql).toMatch(/alter table public\.historico_de_etapas enable row level security/);
  });

  it('o gatilho só grava quando a etapa muda', () => {
    /*
      Sem a saída antecipada, cada edição de legenda vira uma linha — e a
      duração de todo passo passa a ser zero. O sintoma não é erro: é uma linha
      do tempo cheia de "menos de 1m".
    */
    const corpo = sql.slice(sql.indexOf('function private.registrar_etapa'));
    expect(corpo, 'o gatilho perdeu a saída antecipada e grava a cada edição').toMatch(
      /new\.status is not distinct from old\.status[\s\S]{0,80}return new;/
    );
    expect(corpo, 'o gatilho deixou de ser security definer e a RLS vai barrá-lo').toMatch(
      /security definer/
    );
    expect(sql, 'o gatilho passou a disparar em qualquer update, não só no de status').toMatch(
      /after insert or update of status on public\.jobs/
    );
  });

  it('o gatilho separa equipe, portal e agendador', () => {
    /*
      Os três chegam com `auth.uid()` nulo nos dois últimos casos. Sem a
      distinção, a tela teria de escolher entre calar sobre quem fez e inventar
      um autor — e "Aprovado" sem dizer que foi o cliente é justamente a
      informação que faz a agência abrir o histórico.
    */
    const corpo = sql.slice(sql.indexOf('function private.registrar_etapa'));
    expect(corpo, 'o gatilho deixou de distinguir de onde veio a mudança').toMatch(
      /auth\.role\(\)[\s\S]{0,40}service_role/
    );
    expect(corpo).toMatch(/'portal'/);
  });

  it('não há backfill inventando quando a peça entrou na etapa de hoje', () => {
    /*
      Uma linha por conteúdo existente com `created_at` e o status atual seria
      mentira duas vezes: a peça não entrou na etapa de hoje no dia em que foi
      criada, e a tela afirmaria uma duração que ninguém mediu.
    */
    expect(
      sql,
      'apareceu um backfill: o acervo antigo passaria a afirmar duração que ninguém mediu'
    ).not.toMatch(/insert into public\.historico_de_etapas[\s\S]{0,400}from public\.jobs/);
  });

  it('a migração é repetível', () => {
    // O banco é compartilhado e é produção: a outra máquina pode aplicá-la de
    // novo sem saber que já foi.
    expect(sql).toMatch(/create table if not exists public\.historico_de_etapas/);
    expect(sql).toMatch(/add column if not exists origem/);
    expect(sql).toMatch(/drop policy if exists/);
    expect(sql).toMatch(/create or replace function private\.registrar_etapa/);
    expect(sql).toMatch(/drop trigger if exists jobs_registrar_etapa/);
  });
});

describe('os eventos ficam fora da carga inicial e do diff', () => {
  it('nada de histórico de etapas em carregarTudo nem na sincronização', () => {
    /*
      A tabela não tem política de escrita, então o diff tentaria gravar de
      volta o que acabou de ler e levaria `42501` **em silêncio**, dentro da
      fila. E o volume não cabe: uma agência com 5.000 conteúdos tem dezenas de
      milhares de linhas aqui, todas para desenhar a linha do tempo de uma peça
      que talvez ninguém abra.
    */
    const contexto = semComentarios(
      readFileSync(join(RAIZ, 'src', 'context', 'PostfyContext.tsx'), 'utf-8')
    );
    expect(contexto, 'o histórico de etapas entrou na persistência por diff').not.toMatch(
      /useColecaoSincronizada\(\s*'(historicoDeEtapas|etapas)'/
    );

    const db = semComentarios(readFileSync(join(RAIZ, 'src', 'lib', 'db.ts'), 'utf-8'));
    const carregar = db.slice(db.indexOf('export const carregarTudo'));
    expect(carregar, 'o histórico de etapas entrou na carga inicial').not.toContain(
      'historico_de_etapas'
    );
    expect(db, 'a leitura sob demanda do histórico sumiu').toContain('buscarEtapasDoJob');
  });
});
