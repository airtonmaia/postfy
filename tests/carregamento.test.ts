import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A carga não traz a agência inteira — e o que vem depois não vira inserção.
 *
 * `carregarTudo` puxava tudo, sem limite e sem paginação. Com 5.000 jobs o
 * login demora segundos e cada edição passa pelo `diferenciar()`, que faz um
 * `JSON.stringify` por linha. O problema não dependia de a agência crescer:
 * nada era arquivado, então toda agência chegava lá só pelo tempo.
 *
 * Duas coisas precisam continuar verdadeiras, e nenhuma delas quebra tipo,
 * teste de componente ou build:
 *
 * 1. As coleções que só crescem vêm limitadas.
 * 2. O que é buscado sob demanda entra no estado com a bandeira de carga
 *    ligada. Sem ela o `useColecaoSincronizada` vê linhas novas e tenta
 *    **gravar de volta** o que acabou de ler — a chave primária recusaria
 *    uma a uma, em silêncio, na fila de gravação.
 */

const RAIZ = join(__dirname, '..');

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const db = semComentarios(readFileSync(join(RAIZ, 'src', 'lib', 'db.ts'), 'utf-8'));
const contexto = semComentarios(
  readFileSync(join(RAIZ, 'src', 'context', 'PostfyContext.tsx'), 'utf-8')
);

describe('a carga inicial tem janela', () => {
  it('jobs concluídos vêm só da janela, e os abertos sempre', () => {
    // A regra inteira está aqui: sem o `neq('status', 'published')` a
    // consulta dos abertos vira "todos", e a janela deixa de existir.
    expect(db).toContain("neq('status', 'published')");
    expect(db).toContain("eq('status', 'published')");
    expect(db).toMatch(/gte\('created_at', desdeISO\(DIAS_DE_HISTORICO\)\)/);
  });

  it('as coleções que só crescem vêm limitadas', () => {
    // activity_logs, notifications, client_materials e timesheet_logs são as
    // que mais crescem por agência e as que ninguém lê inteiras.
    for (const tabela of [
      'activity_logs',
      'notifications',
      'client_materials',
      'timesheet_logs',
    ]) {
      expect(db, `${tabela} voltou a vir inteira`).toMatch(
        new RegExp(`listarRecentes\\('${tabela}'`)
      );
    }
  });

  it('carregarTudo não usa mais o listar() sem limite nessas coleções', () => {
    const corpo = db.slice(db.indexOf('export const carregarTudo'));
    for (const colecao of [
      'db.jobs.listar()',
      'db.notifications.listar()',
      'db.activityLogs.listar()',
      'db.clientMaterials.listar()',
      'db.timesheetLogs.listar()',
    ]) {
      expect(corpo, `${colecao} voltou para a carga inicial`).not.toContain(colecao);
    }
  });

  it('clientes e comercial continuam vindo inteiros, de propósito', () => {
    // São limitados pelo tamanho do negócio, não pelo tempo. Paginá-los
    // quebraria o seletor de cliente e o funil sem ganho nenhum.
    const corpo = db.slice(db.indexOf('export const carregarTudo'));
    expect(corpo).toContain('db.clients.listar()');
    expect(corpo).toContain('db.leads.listar()');
    expect(corpo).toContain('db.contracts.listar()');
  });
});

describe('a busca sob demanda não vira inserção', () => {
  it('garantirJobsDoPeriodo levanta a bandeira de carga antes de mexer no estado', () => {
    const inicio = contexto.indexOf('const garantirJobsDoPeriodo');
    expect(inicio).toBeGreaterThan(-1);

    const corpo = contexto.slice(inicio, contexto.indexOf('\n  };', inicio));

    const bandeira = corpo.indexOf('aplicandoCargaDoBanco.current = true');
    const mexeNoEstado = corpo.indexOf('setAllJobs');

    expect(bandeira, 'a bandeira sumiu — a carga voltaria a ser gravada').toBeGreaterThan(-1);
    expect(mexeNoEstado).toBeGreaterThan(-1);
    expect(bandeira, 'a bandeira precisa vir antes do setAllJobs').toBeLessThan(mexeNoEstado);
  });

  it('não duplica o que já está em memória', () => {
    const inicio = contexto.indexOf('const garantirJobsDoPeriodo');
    const corpo = contexto.slice(inicio, contexto.indexOf('\n  };', inicio));

    // Dois períodos que se sobrepõem trariam o mesmo job duas vezes, e a
    // tela mostraria o card repetido.
    expect(corpo).toMatch(/conhecidos.*has\(j\.id\)|filter\(\(j\) => !conhecidos/s);
  });

  it('falha de rede não marca o período como visto', () => {
    const inicio = contexto.indexOf('const garantirJobsDoPeriodo');
    const corpo = contexto.slice(inicio, contexto.indexOf('\n  };', inicio));

    // Sem isto, uma oscilação de rede deixaria aquele mês vazio para sempre
    // naquela sessão — e vazio, num calendário, parece "não houve nada".
    expect(corpo).toContain('periodosCarregados.current.delete(chave)');
  });

  it('quem navega o histórico pede o período', () => {
    for (const tela of [
      'src/components/calendar/CalendarApp.tsx',
      'src/components/reports/ReportsView.tsx',
    ]) {
      const fonte = readFileSync(join(RAIZ, tela), 'utf-8');
      expect(fonte, `${tela} não pede os jobs fora da janela`).toContain(
        'garantirJobsDoPeriodo'
      );
    }
  });
});

describe('o agendador tem orçamento de tempo, não lote fixo', () => {
  const publicar = semComentarios(readFileSync(join(RAIZ, 'api', 'publicar.ts'), 'utf-8'));

  it('para quando o tempo acaba, em vez de estourar a função', () => {
    // Estourar o tempo no meio de uma publicação deixa a peça no ar sem a
    // fila saber — o pior desfecho possível nesta rota.
    expect(publicar).toContain('ORCAMENTO_MS');
    expect(publicar).toMatch(/Date\.now\(\) - comecou > ORCAMENTO_MS/);
  });

  it('conta quantos ficaram para a próxima passada', () => {
    // `adiados` diferente de zero de forma seguida é o sinal de que cinco
    // minutos já não bastam. Sem o número, a fila atrasa em silêncio.
    expect(publicar).toContain('adiados');
  });
});
