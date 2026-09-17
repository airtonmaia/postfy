import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * O caminho do conteúdo, do cadastro ao aviso ao cliente.
 *
 * Três decisões desta entrega não quebram nada visível quando violadas — que
 * é exatamente o motivo das guardas:
 *
 * 1. O status saiu do cadastro. Ele era um `select` que pedia a decisão
 *    **antes** de o conteúdo existir, e desencontrava do botão apertado no
 *    fim: dava para escolher "Já Aprovado" e clicar em "Enviar para
 *    aprovação".
 * 2. "Agendar" põe na fila de verdade. Um botão escrito "Agendar" que só
 *    muda o status é a armadilha que já custou caro aqui — o card ficava em
 *    "Agendado", a data passava e nada publicava.
 * 3. No modo de lote, o disparo por arte **não pode sair**. Se sair, o
 *    cliente recebe os dois avisos, e a preferência vira enfeite.
 */

const RAIZ = join(__dirname, '..');


const modal = semComentarios(
  readFileSync(join(RAIZ, 'src', 'components', 'modals', 'CreateJobModal.tsx'), 'utf-8')
);
/**
 * **O quadro inteiro, e não um arquivo dele.**
 *
 * A guarda lia só `KanbanBoard.tsx`, e reprovou no dia em que o card saiu de
 * lá para um arquivo próprio — o `DragOverlay` precisa desenhar o mesmo card
 * fora da coluna, e a alternativa era copiar o JSX. Ela seguiu o arquivo, e o
 * que ela protege é a decisão: o quadro diz "sem data" em vez de esconder a
 * peça aprovada que ninguém agendou.
 */
const kanban = readdirSync(join(RAIZ, 'src', 'components', 'kanban'))
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => semComentarios(readFileSync(join(RAIZ, 'src', 'components', 'kanban', f), 'utf-8')))
  .join('\n');
const automacoes = semComentarios(
  readFileSync(join(RAIZ, 'src', 'lib', 'automacoes.ts'), 'utf-8')
);

describe('o cadastro decide pelo botão, não por um campo', () => {
  it('não há mais seletor de status inicial', () => {
    expect(modal).not.toMatch(/Status Inicial/);
    // E o `select` dele também não pode voltar por outro nome.
    expect(modal).not.toMatch(/setStatus\(e\.target\.value as JobStatus\)/);
  });

  it('os quatro caminhos existem, cada um com o seu status', () => {
    expect(modal).toMatch(/salvar\(e, 'ideas'\)/);
    expect(modal).toMatch(/salvar\(e, 'for_approval'\)/);
    expect(modal).toContain('Criar ideia');
    expect(modal).toContain('Enviar para aprovação');
    expect(modal).toContain('Agendar');
    expect(modal).toContain('Publicar agora');
  });

  it('agendar põe na fila, não só muda o status', () => {
    // O card em "Agendado" com a data passando e nada publicando foi um bug
    // real. Um botão escrito "Agendar" que não agenda é pior que não existir.
    const corpo = modal.slice(modal.indexOf('const agendar ='), modal.indexOf('const publicarImediatamente'));
    expect(corpo).toMatch(/agendarPublicacao\(/);
  });

  it('sem conta conectada, agendar diz que a postagem é sua', () => {
    /**
     * Em vez de agendar em silêncio algo que nunca vai sair sozinho.
     *
     * **A frase saiu do corpo da modal e foi para `textoDoAgendamento`**, que
     * é quem monta a mensagem para as três telas — ela era copiada em cada
     * uma, e é assim que as três acabaram com o mesmo `find` errado ao lado.
     * A guarda seguiu a decisão: o aviso tem de existir onde o texto é
     * montado, e o canal sem conta tem de chegar lá para disparar o aviso.
     */
    const redes = semComentarios(
      readFileSync(join(RAIZ, 'src', 'lib', 'redes.ts'), 'utf-8')
    );
    const corpo = redes.slice(redes.indexOf('export const textoDoAgendamento'));
    expect(corpo, 'o aviso de cliente sem conta conectada desapareceu').toMatch(
      /não tem conta conectada/
    );

    // E `semConta` é preenchido de verdade: sem isso o aviso existiria e
    // nunca sairia — função que não é chamada é enfeite.
    const agenda = redes.slice(
      redes.indexOf('export const agendarPublicacao'),
      redes.indexOf('export const textoDoAgendamento')
    );
    expect(agenda, 'o canal sem conta conectada deixou de ser registrado').toMatch(
      /semConta\.push\(canal\)/
    );
  });

  it('agendar cobre todos os canais marcados, não só o primeiro', () => {
    /**
     * **A guarda do bug que publicava menos do que a tela prometia.**
     *
     * As três telas faziam `listarContas().find(...)` e mandavam **um**
     * `connectionId`: com Instagram e Facebook marcados, só a conta mais
     * antiga entrava na fila, a segunda rede ficava muda, e a mensagem dizia
     * "Na fila para @conta" nomeando só uma.
     */
    const redes = semComentarios(
      readFileSync(join(RAIZ, 'src', 'lib', 'redes.ts'), 'utf-8')
    );
    const agenda = redes.slice(
      redes.indexOf('export const agendarPublicacao'),
      redes.indexOf('export const textoDoAgendamento')
    );
    expect(agenda, 'o agendamento voltou a tratar um canal só').toMatch(
      /for \(const canal of canaisDoJob\(job\)\)/
    );

    // E nenhuma tela volta a escolher a conta por conta própria: era a cópia
    // desse `find` nas três que mantinha o bug em pé.
    for (const rel of [
      'modals/CreateJobModal',
      'modals/JobDetailModal',
      'publications/PublicationsView',
    ]) {
      const fonte = semComentarios(
        readFileSync(join(RAIZ, 'src', 'components', `${rel}.tsx`), 'utf-8')
      );
      expect(
        fonte.match(/listarContas\(\)\)?\.find\(/),
        `${rel} voltou a escolher a conta do agendamento sozinho`
      ).toBeNull();
    }
  });
});

describe('o quadro junta aprovado e agendado', () => {
  it('uma coluna só, alimentada pelos dois status', () => {
    expect(kanban).toMatch(/statuses: \['approved', 'scheduled'\]/);
    expect(kanban).toContain('Aprovado / Agendado');
  });

  it('a coluna filtra pela lista de status, não pelo id', () => {
    // `j.status === col.id` deixaria a coluna juntada sempre vazia — o id
    // dela não é um status.
    expect(kanban).toMatch(/col\.statuses\.includes\(j\.status\)/);
    expect(kanban).not.toMatch(/j\.status === col\.id/);
  });

  it('aprovado sem data aparece como "sem data", em vez de sumir', () => {
    expect(kanban).toContain("'sem data'");
  });
});

describe('o aviso ao cliente segue a preferência da agência', () => {
  it('no modo lote, o disparo por arte não sai', () => {
    // A checagem mora no motor, e não nas telas: o evento é disparado de
    // vários lugares, e filtrar em cada um garantiria esquecer um.
    const corpo = automacoes.slice(automacoes.indexOf('const enfileirarEmail'));
    expect(corpo).toMatch(/notificacao_aprovacao/);
    expect(corpo).toMatch(/=== 'lote'/);
  });

  it('o aviso de lote não tem job, tem cliente e contagem', () => {
    const corpo = automacoes.slice(automacoes.indexOf('enviarAprovacaoEmLote'));
    expect(corpo).toMatch(/evento: 'lote_aguardando_aprovacao'/);
    expect(corpo).toMatch(/client_id: clientId/);
    expect(corpo).toMatch(/quantidade: aguardando\.length/);
    expect(corpo).not.toMatch(/job_id:/);
  });

  it('o botão exige um cliente escolhido', () => {
    // Com o filtro em "todos", o lote misturaria clientes e o aviso iria para
    // quem não deveria ver o conteúdo dos outros.
    const corpo = kanban.slice(kanban.indexOf('const dispararLote'));
    expect(corpo).toMatch(/clientFilter === 'all'/);
  });

  it('a tela diz "na fila", nunca "enviado"', () => {
    // Quem envia é o cron, daqui a alguns minutos (armadilha 9.1). Um
    // endereço inválido só se revela lá.
    const corpo = kanban.slice(kanban.indexOf('const dispararLote'), kanban.indexOf('const filteredJobs'));
    expect(corpo).toMatch(/na fila/);
    expect(corpo).not.toMatch(/enviado com sucesso|E-mail enviado/);
  });

  it('o botão só aparece para quem escolheu agrupar', () => {
    expect(kanban).toMatch(/agrupaAvisos/);
    expect(kanban).toMatch(/notificacaoAprovacao === 'lote'/);
  });
});

describe('a migração do lote', () => {
  const migracao = readFileSync(
    join(
      RAIZ,
      'supabase',
      'migrations',
      readdirSync(join(RAIZ, 'supabase', 'migrations')).find((f) =>
        f.includes('aprovacao_em_lote')
      )!
    ),
    'utf-8'
  );

  it('o padrão é o comportamento que já existia', () => {
    // Agência que não mexer em nada não pode perceber diferença nenhuma.
    expect(migracao).toMatch(/default 'cada'/);
  });

  it('a fila aceita linha sem job, mas nunca sem alvo', () => {
    expect(migracao).toMatch(/alter column job_id drop not null/);
    expect(migracao).toMatch(/check \(job_id is not null or client_id is not null\)/);
  });

  it('o modelo de e-mail não sobrescreve o que o dono editou', () => {
    // O texto é editável em Admin → E-mails; reaplicar a migração não pode
    // devolver o padrão por cima.
    expect(migracao).toMatch(/on conflict \(evento\) do nothing/);
  });
});
