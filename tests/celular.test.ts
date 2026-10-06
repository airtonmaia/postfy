import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import { relativoAoRepo } from './util/caminhos';

/**
 * O produto é usado no celular, e nada local acusa quando ele quebra lá.
 *
 * `tsc` compila, o vitest não monta componente e o `vite build` não mede
 * caixa — é a mesma família da armadilha 0. Só aparece abrindo a tela num
 * aparelho, que é como estes dois chegaram a produção:
 *
 * - **A Biblioteca não rolava.** O `<main>` do `App.tsx` é
 *   `flex-1 min-h-0 overflow-hidden`: ele dá a altura e **corta**. Quem rola é
 *   cada tela, e essa era a única sem `overflow-y-auto`. Medido no Chromium
 *   com a classe antiga: `overflow-y: visible`, `scrollTop` preso em 0 — o
 *   acervo passava da dobra e não havia como chegar nele.
 * - **A modal de conteúdo era ilegível em 390px.** Centrada com `p-4`, ela
 *   perdia 32px de largura; o nome do cliente quebrava em três linhas e o
 *   título virava "D..". A barra de abas ficava com 146px de 868px de
 *   conteúdo.
 *
 * As duas guardas abaixo afirmam o **efeito**, não a aparência: "esta tela
 * rola" e "esta modal usa a tela toda no celular". Aparência muda com a
 * redação; estes dois só mudam se o bug voltar.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const app = ler('src', 'App.tsx');

function listarTsx(dir: string, saida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarTsx(caminho, saida);
    else if (/\.tsx$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

describe('toda tela montada no <main> rola sozinha', () => {
  /**
   * **A lista sai do `App.tsx`, não é escrita à mão aqui.**
   *
   * Uma lista literal teria de ser editada junto com o código — e editar a
   * guarda junto com o código é como ela deixa de guardar. Tela nova entra
   * nesta checagem sozinha, que é o ponto.
   */
  const telas = [...app.matchAll(/activeTab === '[\w-]+' && <(\w+)\s*\/>/g)].map((m) => m[1]);

  it('a lista de telas foi derivada do App', () => {
    // Se o `App.tsx` mudar a forma de montar as telas, a extração devolve
    // vazio e a guarda passaria sem olhar nada — o pior desfecho possível.
    expect(telas.length, 'não consegui derivar as telas do App.tsx').toBeGreaterThan(8);
  });

  it('o <main> corta, e é por isso que cada tela precisa rolar', () => {
    /**
     * Esta é a premissa das outras. Se o `<main>` ganhar `overflow-y-auto`, a
     * regra abaixo deixa de ser necessária — e continuar exigindo-a criaria
     * duas barras de rolagem aninhadas.
     */
    const main = app.slice(app.indexOf('<main'), app.indexOf('>', app.indexOf('<main')));
    expect(main, 'o <main> deixou de ser o container de altura').toMatch(/overflow-hidden/);
  });

  /**
   * A **raiz** do componente, não o arquivo inteiro.
   *
   * A primeira versão desta guarda procurava `overflow-*` em qualquer lugar
   * do arquivo, e passou quando eu tirei o `overflow-hidden` da raiz do
   * `CalendarApp`: ele tem containers internos que rolam, e qualquer um deles
   * satisfazia a busca. Uma guarda que aceita o vizinho no lugar do alvo não
   * está guardando — ela só parece que está.
   */
  const raizDe = (fonte: string): string => {
    const decl = Math.max(
      fonte.lastIndexOf('export const '),
      fonte.lastIndexOf('export default function ')
    );
    const corpo = decl >= 0 ? fonte.slice(decl) : fonte;

    // O `return (` do corpo do componente vem com dois espaços de indentação;
    // os de dentro de helpers e de `.map()` vêm com mais.
    const ret = corpo.search(/\n {2}return \(/);
    if (ret < 0) return '';

    const depois = corpo.slice(ret);
    // Fragmento não carrega classe: a raiz que importa é o primeiro elemento
    // de verdade depois dele.
    const abre = depois.search(/<[A-Za-z]/);
    if (abre < 0) return '';

    /**
     * O fim da tag é o primeiro `>` **fora de chaves**.
     *
     * `indexOf('>')` parava dentro de `onValueChange={(v) =>` e devolvia meia
     * tag, sem nenhuma classe — e aí a guarda reprovava telas corretas, que é
     * o defeito que ensina a ignorá-la.
     */
    let prof = 0;
    for (let i = abre; i < depois.length; i++) {
      const c = depois[i];
      if (c === '{') prof++;
      else if (c === '}') prof--;
      else if (c === '>' && prof === 0) return depois.slice(abre, i + 1);
    }
    return '';
  };

  const CAMINHOS: Record<string, string> = {
    DashboardView: 'dashboard/DashboardView',
    CalendarApp: 'calendar/CalendarApp',
    KanbanBoard: 'kanban/KanbanBoard',
    BibliotecaView: 'library/BibliotecaView',
    ClientsView: 'clients/ClientsView',
    CommercialView: 'commercial/CommercialView',
    PublicationsView: 'publications/PublicationsView',
    ReportsView: 'reports/ReportsView',
    AutomationsView: 'automations/AutomationsView',
    SettingsView: 'settings/SettingsView',
  };

  for (const tela of telas) {
    it(`${tela} traz o próprio container de rolagem`, () => {
      const rel = CAMINHOS[tela];
      expect(rel, `${tela} é montada no App e não está no mapa desta guarda`).toBeTruthy();

      const caminho = join(RAIZ, 'src', 'components', `${rel}.tsx`);
      expect(existsSync(caminho), `não achei ${rel}.tsx`).toBe(true);
      const fonte = semComentarios(readFileSync(caminho, 'utf-8'));

      /**
       * `CalendarApp` e `KanbanBoard` são a exceção nomeada, e não é
       * preguiça: os dois são grades que **não rolam por inteiro** — o
       * calendário fixa o cabeçalho dos dias e o quadro rola as colunas na
       * horizontal, cada um com o próprio `overflow` por dentro. Um
       * `overflow-y-auto` na raiz deles criaria duas barras aninhadas.
       *
       * O que a guarda exige deles é que continuem declarando `overflow` —
       * some dali e eles voltam a ser cortados pelo `<main>` sem aviso.
       */
      const grade = tela === 'CalendarApp' || tela === 'KanbanBoard';

      const raiz = raizDe(fonte);
      expect(raiz, `não consegui extrair a raiz de ${tela}`).not.toBe('');

      expect(
        raiz,
        `a raiz de ${tela} não declara rolagem própria. O <main> do App é ` +
          `overflow-hidden: sem isso o conteúdo que passa da dobra fica ` +
          `inalcançável, sem barra, sem erro e sem pista — foi exatamente o ` +
          `que aconteceu com a Biblioteca.\n\nraiz encontrada: ${raiz}`
      ).toMatch(grade ? /overflow-(?:hidden|y-auto|auto)/ : /overflow-y-auto|overflow-auto/);
    });
  }
});

describe('as modais usam a tela inteira no celular', () => {
  /**
   * **A regra mora no primitivo, e é por isso que esta guarda olha para ele.**
   *
   * A primeira versão desta checagem media as duas modais **uma a uma** — e
   * reprovou, certíssima, quando as classes saíram delas para o
   * `ui/dialog.tsx`. Repontá-la foi o que a deixou mais forte: antes ela
   * cobria duas modais e agora cobre a peça que serve a todas, incluindo as
   * que ainda vão migrar.
   *
   * É a mesma lição da tabela de formatos: a guarda segue o lugar onde a
   * decisão mora, não o arquivo onde ela estava.
   */
  const dialog = ler('src', 'components', 'ui', 'dialog.tsx');
  const base = dialog.slice(dialog.indexOf('cva('), dialog.indexOf('{\n    variants'));

  it('a modal não perde largura com respiro no celular', () => {
    /**
     * Centrada com respiro em volta, uma modal densa perde 32px de 390 justo
     * onde a largura é escassa. Abaixo do `sm` ela é `inset-0`: a tela toda.
     */
    expect(
      base,
      'o conteúdo do Dialog voltou a ser uma caixa centrada no celular'
    ).toMatch(/inset-0 w-full h-full max-h-full/);
    expect(base, 'a caixa centrada do desktop sumiu').toMatch(/sm:left-1\/2 sm:top-1\/2/);
  });

  it('o canto só se solta em tela cheia', () => {
    /**
     * `rounded-2xl` é o canto de uma superfície **sobre** outra, e em tela
     * cheia não há o "sobre" — sobrariam quatro cantos do fundo aparecendo
     * nas quinas do aparelho. É a única exceção ao vocabulário de canto.
     */
    expect(base, 'a modal perdeu o canto reto do celular').toMatch(/rounded-none border-0/);
    expect(base, 'a modal perdeu o canto do desktop').toMatch(/sm:rounded-2xl/);
    expect(
      base,
      'a modal voltou a limitar a altura no celular, o que reintroduz a caixa ' +
        'centrada que a tela cheia veio substituir'
    ).toMatch(/max-h-full[\s\S]*sm:max-h-\[90vh\]/);
  });

  it('o rodapé empilha no celular, na ordem da decisão', () => {
    // Com `flex-wrap justify-end` os cinco botões do cadastro caíam em três
    // linhas desencontradas e nenhuma dizia qual era a principal.
    expect(dialog, 'o rodapé do Dialog voltou a ser só uma linha').toMatch(
      /flex flex-col sm:flex-row[\s\S]*\[&>\*\]:w-full sm:\[&>\*\]:w-auto/
    );
  });

  it('as modais de conteúdo usam o primitivo, não uma sobreposição à mão', () => {
    /**
     * O que o `Dialog` traz não é acabamento: **2 das 25 sobreposições à mão
     * fechavam com `Esc` e nenhuma travava a rolagem do fundo.** Voltar a
     * escrever `fixed inset-0` aqui é perder trava de foco, `Esc`, bloqueio de
     * rolagem e o `aria-hidden` nos irmãos de uma vez — e nada disso aparece
     * em tela. Medido no Chromium: 40 `Tab` seguidos, nenhum saiu do diálogo.
     */
    for (const nome of ['JobDetailModal', 'CreateJobModal']) {
      const fonte = ler('src', 'components', 'modals', `${nome}.tsx`);
      expect(fonte, `${nome} deixou de usar o Dialog`).toMatch(/<DialogContent/);
      expect(
        fonte.match(/fixed inset-0 z-50/)?.[0] ?? null,
        `${nome} voltou a montar a sobreposição à mão`
      ).toBeNull();
    }
  });

  it('Dialog com estado nulo protege o próprio conteúdo', () => {
    /**
     * **Esta também nasceu de um erro meu, e ele era pior que o anterior.**
     *
     * `{estado && (<div overlay>…)}` vira `<Dialog open={!!estado}>`, e a
     * tentação é achar que o `open` já resolve. Não resolve: **JSX avalia os
     * filhos na criação do elemento, não na renderização.** Com a modal
     * fechada, `estado.titulo` roda do mesmo jeito e derruba a tela inteira —
     * e a tela fechada é o estado normal dela.
     *
     * Deixei 17 dessas em três modais antes de perceber. O `tsc` não acusa
     * porque `strictNullChecks` está desligado no projeto, então a única
     * defesa é esta guarda.
     *
     * A correção é manter o `{estado && (…)}` **dentro** do `Dialog`,
     * envolvendo o `DialogContent`. O `open` decide se abre; a guarda decide
     * se o conteúdo chega a existir.
     */
    const arquivos = listarTsx(join(RAIZ, 'src'));
    for (const caminho of arquivos) {
      const fonte = semComentarios(readFileSync(caminho, 'utf-8'));

      for (const m of fonte.matchAll(/<Dialog open=\{!!(\w+)\}/g)) {
        const estado = m[1];
        const fim = fonte.indexOf('</Dialog>', m.index!);
        const bloco = fonte.slice(m.index!, fim < 0 ? undefined : fim);

        // `estado.algo` dentro do bloco só é seguro atrás de `{estado && (`.
        const desreferencia = new RegExp(`\\b${estado}\\.`).test(bloco);
        if (!desreferencia) continue;

        expect(
          bloco.includes(`{${estado} && (`),
          `${caminho.replace(RAIZ + '/', '')}: o <Dialog open={!!${estado}}> lê ` +
            `\`${estado}.…\` sem a guarda \`{${estado} && (\` por dentro. JSX avalia ` +
            `os filhos na criação do elemento, então isso roda com a modal FECHADA ` +
            `e derruba a tela. O tsc não acusa — strictNullChecks está desligado`
        ).toBe(true);
      }
    }
  });

  it('nenhum DialogTitle mora fora de um Dialog', () => {
    /**
     * **Esta guarda nasceu de um erro meu, e ele passou no `tsc`.**
     *
     * Ao converter os títulos de `CommercialView` em lote, o regex pegou
     * cinco `<h4>` e só três estavam dentro de um `Dialog` — os outros dois
     * eram título de seção e de uma modal ainda não migrada. `DialogTitle`
     * fora do contexto do Radix **estoura em tempo de execução**, e `tsc` não
     * sabe disso: para ele é um componente como outro qualquer.
     *
     * É a armadilha 0 de novo, e a conversão em lote é justamente onde ela
     * acontece — um por um ninguém erra.
     */
    const arquivos = listarTsx(join(RAIZ, 'src'));
    for (const caminho of arquivos) {
      const fonte = semComentarios(readFileSync(caminho, 'utf-8'));
      if (!fonte.includes('<DialogTitle')) continue;

      // Intervalos [abre, fecha] de cada <Dialog> do arquivo, por posição.
      const intervalos: [number, number][] = [];
      const pilha: number[] = [];
      for (const m of fonte.matchAll(/<Dialog(?:\s|>)|<\/Dialog>/g)) {
        if (m[0].startsWith('</')) {
          const abre = pilha.pop();
          if (abre !== undefined) intervalos.push([abre, m.index!]);
        } else {
          pilha.push(m.index!);
        }
      }

      for (const t of fonte.matchAll(/<DialogTitle/g)) {
        const dentro = intervalos.some(([a, b]) => a < t.index! && t.index! < b);
        expect(
          dentro,
          `${caminho.replace(RAIZ + '/', '')}: há um <DialogTitle fora de qualquer ` +
            `<Dialog>. Isso passa no tsc e estoura ao abrir a tela — o Radix exige ` +
            `o contexto. Se o título não é de um diálogo, ele é um <h*> comum`
        ).toBe(true);
      }
    }
  });

  it('toda modal do Dialog tem nome acessível', () => {
    /**
     * Sem `DialogTitle` o Radix sobe o diálogo sem nome e avisa no console.
     * Quando o título é desenhado de outro jeito — a modal de conteúdo mostra
     * avatar, selos e o título editável —, o lugar dele é o `sr-only`, nunca
     * a ausência.
     */
    for (const nome of ['JobDetailModal', 'CreateJobModal']) {
      const fonte = ler('src', 'components', 'modals', `${nome}.tsx`);
      expect(fonte, `${nome} abre um diálogo sem nome acessível`).toMatch(/<DialogTitle/);
    }
  });

  it('a barra de abas da modal de conteúdo pode encolher', () => {
    /**
     * **`min-w-0` é o que faz a faixa rolar**, e a falta dele não parece um
     * bug: o `min-width:auto` padrão de um filho de flex impede que ele
     * encolha abaixo do conteúdo, então em vez de virar faixa rolável a lista
     * empurrava o vizinho e sumia por baixo dele. Medido em 390px: 146px de
     * caixa para 868px de abas; com `min-w-0`, 320px e rolando.
     */
    const modal = ler('src', 'components', 'modals', 'JobDetailModal.tsx');
    const lista = modal.slice(modal.indexOf('<TabsList'), modal.indexOf('>', modal.indexOf('<TabsList')));
    expect(
      lista,
      'a lista de abas perdeu o min-w-0 e volta a ser espremida pelo botão ao lado'
    ).toMatch(/min-w-0/);
  });

  it('botão que esconde o rótulo no celular guarda o nome', () => {
    /**
     * O rótulo some no celular para devolver largura ao vizinho. Sem o
     * `aria-label`, quem usa leitor de tela passa a ouvir um botão sem nome —
     * trocar um problema de layout por um de acesso não é corrigir.
     *
     * **A primeira versão desta guarda media um botão só**, fatiando o
     * arquivo a partir de `setIsWhatsAppOpen(true)`. No dia em que aquele
     * botão virou aba, a guarda parou de medir qualquer coisa: `indexOf`
     * devolveu -1, a fatia virou o arquivo inteiro e a asserção passou a
     * afirmar sobre o texto errado. Guarda ancorada numa string do código
     * morre com a primeira refatoração — esta varre `src` e procura o
     * **padrão**, que é o que a decisão realmente é.
     */
    const arquivos = listarTsx(join(RAIZ, 'src'));
    const semNome: string[] = [];

    for (const caminho of arquivos) {
      const fonte = semComentarios(readFileSync(caminho, 'utf-8'));

      for (const m of fonte.matchAll(/<Button\b[\s\S]{0,900}?<\/Button>/g)) {
        const botao = m[0];
        // Só interessa o botão cujo texto some abaixo do `sm`: é ele que
        // fica sem nome nenhum no telefone.
        if (!/hidden sm:inline/.test(botao)) continue;
        if (/aria-label=/.test(botao)) continue;
        semNome.push(`${relativoAoRepo(caminho, RAIZ)}: ${botao.slice(0, 80)}`);
      }
    }

    expect(
      semNome,
      'o rótulo some no celular e o botão fica sem nome para o leitor de tela'
    ).toEqual([]);
  });
});

describe('o dedo rola a tela — e o que arrasta não impede isso', () => {
  /**
   * **`touch-action: none` num card que ocupa a coluna inteira = quadro que
   * não rola no celular.**
   *
   * O dnd-kit recomenda `touch-action: none` para arrasto que começa no
   * toque: ali o navegador não pode competir com o gesto. Mas a ativação aqui
   * é por **tempo** — e com ela a recomendação é `manipulation`: o navegador
   * rola enquanto o `delay` não vence, e a `tolerance` cancela o arrasto
   * justamente quando o dedo deslizou.
   *
   * Com `none`, nada disso acontecia: os cards cobrem quase toda a área da
   * coluna, então o dedo encostava sempre num deles e o quadro não rolava nem
   * na vertical nem na horizontal. Sem erro, sem barra, sem pista — e o
   * comentário dos sensores afirmava, havia meses, que "deslizar rola".
   */
  const kanban = readdirSync(join(RAIZ, 'src', 'components', 'kanban'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ nome: f, fonte: ler('src', 'components', 'kanban', f) }));

  it('a ativação do toque é por tempo', () => {
    // A premissa da regra abaixo. Se o sensor voltar a ativar por distância,
    // `touch-none` passa a ser o certo — e esta guarda tem de cair junto.
    const quadro = kanban.find((a) => a.nome === 'KanbanBoard.tsx')!.fonte;
    expect(quadro, 'o toque deixou de ativar por tempo').toMatch(
      /TouchSensor, \{ activationConstraint: \{ delay: \d+, tolerance: \d+ \} \}/
    );
  });

  it('nenhum card do quadro desliga a rolagem do navegador', () => {
    const culpados = kanban
      .filter((a) => /touch-none/.test(a.fonte))
      .map((a) => a.nome);

    expect(
      culpados,
      'voltou o `touch-none` no quadro: com ele o dedo não rola a coluna nem o ' +
        'quadro, porque os cards cobrem toda a área de toque'
    ).toEqual([]);

    const cartao = kanban.find((a) => a.nome === 'CartaoDoQuadro.tsx')!.fonte;
    expect(cartao, 'o card arrastável perdeu o `touch-manipulation`').toMatch(
      /touch-manipulation/
    );
  });
});

describe('o calendário cabe na tela do celular', () => {
  /**
   * A barra lateral é `w-64` — 256px de uma tela de 390. E o `<main>` do App é
   * `overflow-hidden`: o que sobrava da grade do mês não ficava apertado,
   * ficava **cortado e inalcançável**, sete colunas espremidas em 134px, sem
   * barra de rolagem e sem nada indicando que havia mês ali.
   */
  const calendario = ler('src', 'components', 'calendar', 'CalendarApp.tsx');
  const cabecalho = ler('src', 'components', 'calendar', 'CalendarHeader.tsx');

  it('a barra lateral fixa não existe abaixo do lg', () => {
    const montagens = [...calendario.matchAll(/<CalendarSidebar[\s\S]{0,400}?\/>/g)].map(
      (m) => m[0]
    );
    expect(montagens.length, 'a barra lateral do calendário sumiu do CalendarApp').toBe(2);

    const fixa = montagens.find((m) => /w-64/.test(m));
    expect(fixa, 'a barra fixa do calendário sumiu').toBeTruthy();
    expect(
      fixa,
      'a barra de 256px voltou a aparecer no celular, cortando a grade do mês'
    ).toMatch(/hidden lg:flex/);
  });

  it('e o que ela guarda continua alcançável por lá', () => {
    /**
     * Esconder e pronto custaria o filtro de **status**, que só existe dentro
     * dela — e filtro que some sem aviso é a tela escondendo conteúdo. Por
     * isso a gaveta monta a mesma barra, não uma cópia reduzida.
     */
    expect(
      calendario,
      'a gaveta de filtros do celular sumiu: o filtro de status ficou inalcançável'
    ).toMatch(/<DialogContent className="lg:hidden[\s\S]{0,400}<CalendarSidebar/);
    const abridor = cabecalho.slice(
      Math.max(0, cabecalho.indexOf('aoAbrirFiltros}') - 300),
      cabecalho.indexOf('aoAbrirFiltros}') + 200
    );
    expect(abridor, 'o botão que abre a gaveta sumiu').toContain('Filtros');
    expect(
      abridor,
      'o botão de filtros passou a aparecer também onde a barra já está à ' +
        'vista — dois caminhos para a mesma coisa'
    ).toMatch(/lg:hidden/);
  });

  it('o cabeçalho do calendário quebra linha', () => {
    /**
     * Título do mês, navegação e quatro filtros não cabem em 390px. Sem
     * `flex-wrap`, a barra de filtros era empurrada para fora — e, de novo,
     * o `<main>` corta: ela ficava inalcançável em vez de apertada.
     */
    const barra = cabecalho.indexOf('<BarraDeFiltrosDoConteudo');
    expect(barra, 'a barra de filtros saiu do cabeçalho do calendário').toBeGreaterThan(-1);

    /*
      A âncora é a **própria barra**, não um comentário: `semComentarios` os
      apaga, e guarda ancorada em texto que some não guarda nada — foi o que
      acabou de acontecer na primeira versão desta asserção.
    */
    const acima = cabecalho.slice(0, barra);
    const container = acima.lastIndexOf('flex flex-wrap items-center');
    expect(
      container,
      'o bloco que leva o mês, a navegação e os filtros voltou a ser uma linha só'
    ).toBeGreaterThan(-1);
    expect(
      acima.slice(container, container + 80),
      'o container dos filtros perdeu o min-w-0 e volta a empurrar a barra ' +
        'para fora da tela'
    ).toMatch(/min-w-0/);
  });
});

describe('nenhuma faixa de abas empurra a página', () => {
  /**
   * **A tela rola para o lado inteira, e não é a faixa que rola.**
   *
   * A raiz de cada tela é `overflow-y-auto`, e o CSS promove o eixo
   * horizontal a `auto` quando o vertical deixa de ser `visible`. Então uma
   * faixa de abas mais larga que o telefone não ganha barra própria: ela
   * estica a tela, e o título, os campos e os botões saem da vista. Medido em
   * três telas por print — "Clientes da Agência" lido como "entes da Agência",
   * "Nome Fantasia" como "ome Fantasia".
   *
   * `inline-flex` e `w-fit` são justamente as duas formas de dizer "não
   * encolha". Quem as usa precisa dizer também até onde pode crescer.
   */
  const tabs = ler('src', 'components', 'ui', 'tabs.tsx');
  const bloco = tabs.slice(tabs.indexOf('const variantesDaLista'), tabs.indexOf('export interface TabsListProps'));

  const VARIANTES = ['default', 'segmentado', 'pagina', 'painel'];

  it('a lista de variantes foi derivada do primitivo', () => {
    // Se o bloco mudar de forma, a extração devolve vazio e a guarda passaria
    // sem olhar nada — o pior desfecho possível.
    expect(bloco.length, 'não achei as variantes da barra de abas').toBeGreaterThan(200);
    for (const v of VARIANTES) {
      expect(bloco, `a variante ${v} sumiu do primitivo`).toContain(`${v}:`);
    }
  });

  for (const variante of VARIANTES) {
    it(`a variante ${variante} rola em vez de esticar a tela`, () => {
      const inicio = bloco.indexOf(`${variante}:`);
      const fim = VARIANTES.map((v) => bloco.indexOf(`${v}:`))
        .filter((i) => i > inicio)
        .sort((a, b) => a - b)[0];
      const corpo = bloco.slice(inicio, fim > 0 ? fim : undefined);

      expect(
        corpo,
        `a barra de abas "${variante}" voltou a poder empurrar a página no celular`
      ).toMatch(/overflow-x-auto/);

      // `inline-flex` e `w-fit` não encolhem: sem um teto, o `overflow-x-auto`
      // nunca chega a valer, porque a caixa cresce com o conteúdo.
      if (/inline-flex|w-fit/.test(corpo)) {
        expect(
          corpo,
          `a barra "${variante}" não encolhe e não tem teto de largura`
        ).toMatch(/max-w-full/);
      }
    });
  }

  it('`no-scrollbar` existe de verdade', () => {
    /**
     * Ela era usada em quatro lugares e **não existia em lugar nenhum** — nem
     * no Tailwind, nem no `index.css`. Classe que não existe não vira
     * propriedade: as faixas rolavam com a barra cinza do sistema à mostra,
     * num produto que é whitelabel. Mesma família do `animate-in` sem o
     * `tw-animate-css`.
     */
    const css = readFileSync(join(RAIZ, 'src', 'index.css'), 'utf-8');
    const usada = listarTsx(join(RAIZ, 'src')).some((f) =>
      /no-scrollbar/.test(readFileSync(f, 'utf-8'))
    );

    if (usada) {
      expect(css, 'a classe `no-scrollbar` é usada e não existe em lugar nenhum').toMatch(
        /@utility no-scrollbar|\.no-scrollbar/
      );
    }
  });
});

describe('o quadro mostra mais de dois cards no telefone', () => {
  /**
   * **O gargalo era o cabeçalho, não o card.**
   *
   * Medido no print que chegou (390px de largura, 705px de área útil do app):
   * o que vinha **antes** do primeiro card somava 411px — título, selo de
   * fixados, duas linhas de filtros, troca de visão, faixa de clientes e o
   * respiro das colunas. Sobravam 294px para cards de 219px: um e meio.
   *
   * As três guardas abaixo prendem as três decisões que devolveram altura, e
   * nenhuma delas é aparência: cada uma vale uma fração de card por tela.
   */
  const quadro = ler('src', 'components', 'kanban', 'KanbanBoard.tsx');
  const cartao = ler('src', 'components', 'kanban', 'CartaoDoQuadro.tsx');
  const faixa = ler('src', 'components', 'kanban', 'ClientesDoQuadro.tsx');

  it('os filtros viram gaveta no celular, em vez de duas linhas', () => {
    // Duas linhas de 42px saíam direto do espaço dos cards.
    expect(quadro, 'a barra de filtros voltou a ficar inline no celular').toMatch(
      /hidden sm:flex[\s\S]{0,120}<BarraDeFiltrosDoConteudo/
    );
    expect(quadro, 'sumiu o botão que abre os filtros no celular').toMatch(
      /sm:hidden[\s\S]{0,200}Filtros/
    );
    /*
      A gaveta monta a **mesma** peça, empilhada. Uma versão reduzida para o
      telefone divergiria na primeira pressa — e divergir num filtro esconde
      conteúdo sem dizer que escondeu.
    */
    expect(quadro, 'a gaveta deixou de montar a barra de filtros de verdade').toMatch(
      /<BarraDeFiltrosDoConteudo empilhada/
    );
  });

  it('o rodapé do card é uma linha, não duas', () => {
    /*
      Eram duas linhas de 32px: as ações numa e a gaveta noutra. Num telefone
      que mostrava dois cards, a segunda valia um terço de um terceiro.
    */
    const rodape = cartao.slice(cartao.indexOf("abrir('revisoes')"));
    const ateAGaveta = rodape.slice(0, rodape.indexOf("{aberto ? 'Recolher' : 'Detalhes'}"));

    expect(
      ateAGaveta,
      'o botão Detalhes saiu da linha das ações e voltou a ocupar uma linha própria'
    ).not.toMatch(/<\/div>\s*<\/div>/);

    expect(
      cartao,
      'o botão Detalhes voltou a ser de largura cheia, o que o tira da linha das ações'
    ).not.toMatch(/className="w-full text-\[11px\]"[\s\S]{0,400}Detalhes/);
  });

  it('a faixa de clientes esconde o nome no celular, não o avatar', () => {
    /**
     * O nome vale 33px de faixa — um terço de card. O que fica é o avatar, que
     * `ClientesDoQuadro` já argumenta ser reconhecido antes de qualquer texto,
     * com cor estável e iniciais para quem não tem foto.
     *
     * **E o nome não some para quem usa leitor de tela**: ele sai do fluxo
     * visual com `aria-hidden` e volta como `aria-label` do botão. Esconder os
     * dois seria trocar altura por acesso.
     */
    expect(faixa, 'o nome do cliente voltou a ocupar altura no celular').toMatch(
      /hidden sm:block[\s\S]{0,400}\{item\.nome\}/
    );
    expect(faixa, 'o botão da faixa ficou sem nome para o leitor de tela').toMatch(
      /aria-label=\{item\.nome\}/
    );
  });
});

describe('o mês no celular mostra todos os posts do dia', () => {
  /**
   * **Sete colunas em 390px dão 55px por dia.** O cartão do conteúdo era
   * desenhado em tamanho de computador — selo de rede, horário, miniatura,
   * título, formato e status — dentro dessa largura. Com um post por dia ele
   * já saía cortado; com dois, o segundo ficava numa área de rolagem de poucos
   * pixels, **invisível e sem como tocar**.
   *
   * E o "+N mais" do computador **abria o cadastro**: o comentário ao lado
   * dizia "show all jobs for that date in detail" e a chamada era
   * `openCreateJobModal`. Rótulo que descreve o que não acontece é a família
   * do `trial_ends_at`, agora na interface — quem clicava concluía que as
   * peças tinham sumido.
   */
  const mes = ler('src', 'components', 'calendar', 'MonthView.tsx');
  const lista = ler('src', 'components', 'calendar', 'ConteudosDoDia.tsx');
  const cabecalho = ler('src', 'components', 'calendar', 'CalendarHeader.tsx');
  const app = ler('src', 'components', 'calendar', 'CalendarApp.tsx');

  it('o cartão de computador não é desenhado no celular', () => {
    expect(
      mes,
      'o cartão do conteúdo voltou a ser montado dentro de uma casinha de 55px'
    ).toMatch(/hidden sm:block[\s\S]{0,80}space-y-1\.5 overflow-y-auto/);
  });

  it('a casinha do celular é tocável inteira', () => {
    // Num alvo de 55px, exigir mira no pontinho é exigir o que o dedo não faz.
    expect(mes, 'o alvo de toque da casinha sumiu ou encolheu').toMatch(
      /sm:hidden absolute inset-0/
    );
    expect(mes, 'tocar na casinha deixou de abrir a lista do dia').toMatch(
      /setDiaAberto\(cell\.date\)/
    );
  });

  it('"+N mais" abre a lista do dia, não o cadastro', () => {
    /*
      Conferido pelo **efeito**: dentro do bloco do "+N mais" não pode haver
      `openCreateJobModal`. Era exatamente ele que estava lá.
    */
    const inicio = mes.indexOf('cell.jobs.length > 3');
    expect(inicio, 'o botão de excedente sumiu do mês').toBeGreaterThan(-1);

    const bloco = mes.slice(inicio, inicio + 600);
    expect(bloco, 'o "+N mais" voltou a abrir o cadastro em vez da lista').not.toMatch(
      /openCreateJobModal/
    );
    expect(bloco, 'o "+N mais" deixou de abrir a lista do dia').toMatch(/setDiaAberto/);
  });

  it('a lista do dia é uma peça só para os dois caminhos', () => {
    // Duas — uma de celular, outra de computador — divergiriam na primeira
    // pressa, e divergir aqui é mostrar conjuntos diferentes para a mesma data.
    expect(mes, 'o mês deixou de montar a lista do dia').toContain('<ConteudosDoDia');

    /*
      Tocar na casinha passou a abrir a lista, e antes tocava-se no vazio dela
      para criar. Sem o botão de criar aqui dentro, a mudança teria **tirado**
      o caminho de criar num dia específico do telefone inteiro.
    */
    expect(lista, 'a lista do dia ficou sem o caminho de criar peça naquela data').toMatch(
      /openCreateJobModal\(dia\.toISOString\(\)\)/
    );

    /*
      JSX avalia os filhos na criação do elemento: `dia.toISOString()` rodaria
      com a lista fechada — o estado normal dela — e derrubaria a tela.
    */
    expect(lista, 'a guarda de estado nulo saiu de dentro do Dialog').toMatch(
      /\{dia && \(/
    );
  });

  it('os filtros do calendário não aparecem duas vezes no celular', () => {
    // Quatro chips no cabeçalho e um botão "Filtros" logo ao lado eram dois
    // caminhos para a mesma pergunta — e os chips comiam duas linhas da altura
    // que a grade do mês precisa.
    expect(cabecalho, 'a barra de filtros voltou a ficar inline no celular').toMatch(
      /hidden lg:flex[\s\S]{0,120}<BarraDeFiltrosDoConteudo/
    );
    expect(app, 'a gaveta do calendário ficou sem a barra de filtros').toMatch(
      /<BarraDeFiltrosDoConteudo empilhada/
    );
  });
});

/**
 * O conteúdo em passos, no celular.
 *
 * Empilhado, o formulário é uma lista de doze campos com uma área de upload e
 * duas de texto no meio — e rolar isso de ponta a ponta no telefone é o que faz
 * alguém preferir abrir o notebook, que é o oposto do que um produto usado no
 * celular precisa.
 */
describe('o assistente do celular', () => {
  const assistente = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'jobs', 'AssistenteDoConteudo.tsx'), 'utf-8')
  );
  const telas = ['CreateJobModal', 'JobDetailModal'].map((n) =>
    semComentarios(readFileSync(join(RAIZ, 'src', 'components', 'modals', `${n}.tsx`), 'utf-8'))
  );

  it('a escolha é em JavaScript, nunca com lg:hidden', () => {
    /*
      **Esta é a guarda que protege o produto, não o layout.** Esconder por CSS
      montaria as duas versões — o assistente e as duas colunas — e deixaria uma
      invisível: o formulário seria montado o dobro de vezes, com o efeito que
      revalida o formato rodando numa instância que ninguém vê, e o aparelho
      carregando duas árvores onde a memória é o que falta.

      Nada local acusa isso: `tsc` compila, o vitest não monta componente e o
      `vite build` não mede caixa. É a armadilha 0 na camada do layout.
    */
    for (const [i, tela] of telas.entries()) {
      const nome = ['CreateJobModal', 'JobDetailModal'][i];
      expect(tela, `${nome} deixou de escolher o assistente em JavaScript`).toMatch(
        /\{estreita \?/
      );
      expect(
        tela,
        `${nome} voltou a esconder o assistente por CSS, montando as duas versões`
      ).not.toMatch(/AssistenteDoConteudo[\s\S]{0,200}lg:hidden/);
    }
  });

  it('dá para salvar em qualquer passo', () => {
    /*
      A referência que originou o pedido só mostra "Criar" no último passo.
      Fechar no meio é **um toque** no celular, e perder o que foi digitado por
      causa disso é o pior desfecho possível numa tela de produção. A peça
      incompleta é um estado que o quadro já tem, e se chama Ideias.
    */
    /*
      A âncora é o **uso**, não o nome: `/\{acoes/` casava com a
      desestruturação das props (`({ passos, acoes })`), e a guarda passava com
      a barra vazia. É a guarda medindo o vizinho, pela enésima vez neste
      repositório.
    */
    expect(assistente, 'as ações sumiram da barra do assistente').toMatch(/\{acoes && \(/);

    const barra = assistente.slice(assistente.indexOf('{acoes && ('));
    expect(
      barra,
      'as ações do assistente voltaram a depender do último passo'
    ).not.toMatch(/passos\.length - 1/);
  });

  it('a faixa de passos é a barra de abas do projeto', () => {
    /*
      Tocar um passo troca o painel sem navegar, que é a definição de aba — e a
      peça já existe, com rolagem horizontal sem barra à mostra e navegação por
      teclado. A primeira versão desenhou chips à mão pintando o atual com o
      roxo do primário, e as duas guardas de `botoes.test.ts` reprovaram.
    */
    expect(assistente, 'a faixa de passos virou chip escrito à mão').toMatch(/<TabsTrigger/);
    expect(assistente, 'a faixa de passos deixou de usar o primitivo').toMatch(/<TabsList/);
  });
});
