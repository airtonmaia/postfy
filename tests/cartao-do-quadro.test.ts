import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import { prazoDoCard } from '../src/lib/prazoDoCard';
import { dataCompacta } from '../src/lib/utils';
import type { Job } from '../src/types';

/**
 * O card do quadro: o que ele põe em primeiro lugar, o que ele esconde atrás
 * da gaveta e o que ele **não** afirma.
 *
 * As três guardas de fonte aqui medem **efeito**, não forma: a ordem em que
 * dois trechos aparecem, a presença da parada de evento acima dos controles, e
 * a ausência de um nome que o produto não mede. Guarda que descreve o
 * mecanismo aprova qualquer mecanismo com aquela forma — é a lição que este
 * repositório já pagou quatro vezes.
 */

const RAIZ = join(__dirname, '..');
const cartao = semComentarios(
  readFileSync(join(RAIZ, 'src', 'components', 'kanban', 'CartaoDoQuadro.tsx'), 'utf-8')
);
const modal = semComentarios(
  readFileSync(join(RAIZ, 'src', 'components', 'modals', 'JobDetailModal.tsx'), 'utf-8')
);

const job = (parcial: Partial<Job> = {}): Job =>
  ({
    id: 'j1',
    workspaceId: 'w1',
    clientId: 'c1',
    title: 'Peça',
    tipo: 'conteudo',
    platform: 'instagram',
    format: 'feed',
    status: 'in_production',
    priority: 'medium',
    caption: '',
    hashtags: [],
    mediaUrls: [],
    currentVersion: 1,
    versions: [],
    createdAt: '2026-10-01T12:00:00.000Z',
    deadlineProduction: '',
    deadlineApproval: '',
    scheduledDate: '2026-10-10T12:00:00.000Z',
    checklist: [],
    comments: [],
    ...parcial,
  }) as Job;

/** Meio-dia em São Paulo, para o dia no fuso da agência não depender da borda. */
const AGORA = new Date('2026-10-05T15:00:00.000Z');
const emDias = (dias: number) =>
  new Date(AGORA.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();

describe('o prazo que o card mostra', () => {
  it('o prazo da etapa é o que vale', () => {
    /*
      Peça esperando o cliente é medida pelo prazo de aprovação; peça em
      produção, pelo de produção. Ler sempre o mesmo campo faria o card avisar
      sobre um prazo que já não é o que está correndo — alarme sobre trabalho
      que foi feito, que é como a pessoa aprende a ignorar o selo.
    */
    expect(
      prazoDoCard(
        job({ status: 'for_approval', deadlineApproval: emDias(0), deadlineProduction: emDias(30) }),
        AGORA
      )?.texto
    ).toBe('Vence hoje');

    expect(
      prazoDoCard(
        job({
          status: 'in_production',
          deadlineApproval: emDias(0),
          deadlineProduction: emDias(30),
        }),
        AGORA
      )
    ).toBeNull();
  });

  it('peça concluída não tem prazo correndo', () => {
    for (const status of ['approved', 'scheduled', 'published'] as const) {
      expect(
        prazoDoCard(job({ status, deadlineProduction: emDias(-9) }), AGORA),
        `${status} voltou a mostrar prazo vencido`
      ).toBeNull();
    }
  });

  it('só fala de hoje, de amanhã e do que já passou', () => {
    const texto = (dias: number) =>
      prazoDoCard(job({ deadlineProduction: emDias(dias) }), AGORA)?.texto ?? null;

    expect(texto(0)).toBe('Vence hoje');
    expect(texto(1)).toBe('Vence amanhã');
    expect(texto(-1)).toBe('Venceu ontem');
    expect(texto(-4)).toBe('Venceu há 4 dias');

    /*
      Um selo em todo card não distingue nada, e a pessoa para de ler os selos
      todos. O corte é o que transforma o selo em aviso.
    */
    expect(texto(2)).toBeNull();
    expect(texto(30)).toBeNull();
  });

  it('sem prazo cadastrado não inventa nenhum', () => {
    expect(prazoDoCard(job({ deadlineProduction: '' }), AGORA)).toBeNull();
    expect(prazoDoCard(job({ deadlineProduction: 'qualquer coisa' }), AGORA)).toBeNull();
  });

  it('vencido e vencendo são tons diferentes', () => {
    expect(prazoDoCard(job({ deadlineProduction: emDias(-2) }), AGORA)?.tom).toBe('vencido');
    expect(prazoDoCard(job({ deadlineProduction: emDias(0) }), AGORA)?.tom).toBe('hoje');
  });
});

describe('a data do card é "05 out", não "05 de out."', () => {
  it('sai sem a preposição e sem o ponto da abreviação', () => {
    /*
      O `Intl` em pt-BR escreve `{ day, month: 'short' }` como "05 de out.", e
      com o ano "05 de out. de 2026". Numa linha de card, ao lado de selos e de
      um relógio, essas letras a mais são ruído.

      **O fuso não é o do runner**, e isto é o que faz a asserção valer alguma
      coisa: `dataCompacta` usa o fuso da agência, que sem agência carregada é
      `America/Sao_Paulo`. O teste de `descreverBuild` já caiu na armadilha
      oposta uma vez — criava a data no fuso da máquina e conferia no mesmo
      fuso, então os dois lados se cancelavam e ele passava em qualquer lugar
      sem afirmar nada.
    */
    const meioDia = '2026-10-05T15:00:00.000Z';

    expect(dataCompacta(meioDia)).toBe('05 out');
    expect(dataCompacta(meioDia, { comAno: true })).toBe('05 out 2026');
  });

  it('data ausente ou inválida não vira uma data qualquer', () => {
    expect(dataCompacta(undefined)).toBe('Sem data');
    expect(dataCompacta('')).toBe('Sem data');
    expect(dataCompacta('não é data')).toBe('Sem data');
  });
});

describe('o que o card põe em primeiro lugar', () => {
  it('o título vem antes do nome do cliente', () => {
    /*
      Era o contrário, e o custo aparecia no estado mais comum do quadro: com
      o filtro num cliente, a primeira linha de doze cards era a mesma palavra.
      A tela repetia a resposta que a pessoa já sabia e punha em segundo plano
      a única que ela procurava.
    */
    const titulo = cartao.indexOf('{job.title}');
    const cliente = cartao.indexOf('{client?.name}');

    expect(titulo, 'o título saiu do card').toBeGreaterThan(-1);
    expect(cliente, 'o cliente saiu do card').toBeGreaterThan(-1);
    expect(titulo, 'o nome do cliente voltou a ser a primeira linha do card').toBeLessThan(
      cliente
    );
  });

  it('o aviso de prazo fica fora da gaveta', () => {
    /*
      Alerta que exige um clique para aparecer não é alerta: quem não desconfia
      que a peça está vencendo é justamente quem não vai abrir os detalhes.
    */
    const aviso = cartao.indexOf('prazo.texto');
    const gaveta = cartao.indexOf('{aberto && (');

    expect(aviso, 'o selo de prazo sumiu do card').toBeGreaterThan(-1);
    expect(gaveta, 'a gaveta de detalhes sumiu do card').toBeGreaterThan(-1);
    expect(aviso, 'o aviso de prazo foi parar dentro da gaveta').toBeLessThan(gaveta);
  });
});

describe('controle dentro de card arrastável para os dois eventos', () => {
  it('a barra de ações não abre a peça nem inicia o arrasto', () => {
    /*
      Sem parar o **clique**, usar qualquer botão daqui abre a modal por cima;
      sem parar o **pointerdown**, encostar nele começa a arrastar o card em
      vez de acioná-lo. Os dois, num container só: em cada botão, o próximo
      botão nasce sem a proteção — que foi exatamente como o seletor de etapa
      nasceu errado uma vez.
    */
    const inicio = cartao.indexOf('Ver histórico');
    expect(inicio, 'a barra de ações do card sumiu').toBeGreaterThan(-1);

    const acima = cartao.slice(Math.max(0, inicio - 900), inicio);
    expect(acima, 'a barra de ações do card voltou a abrir a peça ao ser usada').toMatch(
      /onClick=\{\(e\) => e\.stopPropagation\(\)\}/
    );
    expect(acima, 'a barra de ações do card voltou a disparar o arrasto').toMatch(
      /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/
    );
  });

  it('o rodapé do card não carrega ação destrutiva', () => {
    /*
      Excluir ficava a um toque num card que a pessoa percorre com o dedo, e
      colada no "Detalhes". Ela saiu daqui — e a guarda mede as **duas**
      metades da decisão, porque tirar sem repor seria deixar o produto sem
      como apagar uma peça:

      1. o card não chama `deleteJob`;
      2. a modal do conteúdo continua chamando, com a confirmação que diz o
         que some junto. A `descricao` é obrigatória no componente justamente
         para o diálogo não virar um "tem certeza?".
    */
    expect(cartao, 'o excluir voltou para o rodapé do card').not.toMatch(/deleteJob/);

    const inicio = modal.indexOf('const excluir');
    expect(inicio, 'a modal do conteúdo deixou de excluir — não sobrou caminho').toBeGreaterThan(
      -1
    );

    const corpo = modal.slice(inicio, modal.indexOf('};', inicio));
    expect(corpo, 'o excluir da modal perdeu a confirmação').toMatch(/pedir\(\{/);
    expect(corpo, 'a confirmação não diz mais o que some junto').toMatch(/descricao:/);
    expect(corpo).toMatch(/deleteJob\(selectedJob\.id\)/);
  });

  it('o rodapé do card cabe na coluna', () => {
    /*
      No computador o "Detalhes" saía **cortado na borda do card**: a linha
      tinha cinco controles e `whitespace-nowrap` é a base do `Button`, então
      ela não quebra — transborda. Duas asserções de efeito:

      - o link do portal (que é do cliente, não da peça) não voltou;
      - quem cede numa coluna estreita é o rótulo da esquerda, nunca a gaveta.
    */
    expect(cartao, 'o link do portal voltou para o card').not.toMatch(/urlDoPortalDaAgencia/);

    const inicio = cartao.indexOf('Ver histórico');
    const gaveta = cartao.indexOf("'Detalhes'");
    expect(gaveta, 'a gaveta sumiu do rodapé').toBeGreaterThan(inicio);

    /*
      O `shrink-0` tem de estar no **grupo** que contém a gaveta, não num
      ícone qualquer do caminho: o ícone do "Ver histórico" também o usa, e
      uma busca solta aprovaria o grupo sem ele.
    */
    const linha = cartao.slice(inicio, gaveta);
    expect(linha, 'a gaveta voltou a poder encolher até ser cortada').toMatch(
      /<div className="flex items-center[^"]*shrink-0"/
    );
  });
});

describe('o card não afirma o que o produto não mede', () => {
  it('não há responsável inventado', () => {
    /*
      `designerId`, `copywriterId` e `socialMediaId` estão no schema desde a
      primeira migração e **nada escreve neles** — a família do
      `trial_ends_at`. A saída fácil é rotular `currentUser.name` como
      "Responsável", que é o que a modal de detalhe faz hoje: ela mostra quem
      está olhando a tela, não quem fez a peça.

      O que o card mostra é `versions[].submittedBy`, que é carimbado de
      verdade — e não mostra linha nenhuma quando ninguém entregou ainda.
    */
    expect(cartao, 'o card voltou a rotular quem está olhando como responsável').not.toMatch(
      /currentUser/
    );
    for (const campo of ['designerId', 'copywriterId', 'socialMediaId']) {
      expect(cartao, `${campo} não é escrito por ninguém; lê-lo mostra sempre vazio`).not.toContain(
        campo
      );
    }
    expect(cartao, 'o card deixou de mostrar quem entregou a versão').toContain('submittedBy');
  });
});

describe('"Ver histórico" abre em Revisões', () => {
  it('a aba de abertura vem de quem mandou abrir, e volta ao padrão', () => {
    /*
      Sem isto os dois caminhos do card para a mesma peça caem no formulário, e
      quem clicou em histórico tem de achar a aba Revisões por conta própria.
      E sem a reposição, o próximo conteúdo aberto de qualquer outro lugar
      herdaria a escolha do anterior.
    */
    const abrir = cartao.slice(cartao.indexOf('const abrir'));
    expect(abrir.slice(0, 200), 'abrir o conteúdo deixou de dizer em que aba').toMatch(
      /setAbaDoConteudo\(aba\)[\s\S]{0,80}setSelectedJob\(job\)/
    );
    expect(cartao, '"Ver histórico" voltou a abrir no formulário').toMatch(/abrir\('revisoes'\)/);
    expect(modal, 'a modal voltou a ignorar a aba pedida').toMatch(/setAba\(abaDoConteudo\)/);
    expect(modal, 'a aba pedida ficou pendurada para o próximo conteúdo').toMatch(
      /setAbaDoConteudo\('conteudo'\)/
    );
  });
});
