import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

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
    ApprovalsView: 'approvals/ApprovalsView',
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
   * Centrada com respiro em volta, uma modal densa perde largura justo onde
   * ela é escassa. E o canto acompanha: `rounded-2xl` é o canto de uma
   * superfície **sobre** outra, e em tela cheia não há o "sobre" — sobrariam
   * quatro cantos do fundo aparecendo nas quinas do aparelho.
   *
   * As duas modais aqui são as que o editor usa todo dia. As outras 23
   * seguem no formato antigo, e isso está registrado como pendência: uma
   * guarda que varresse todas passaria a reprovar código que ninguém
   * prometeu ter arrumado.
   */
  const MODAIS = ['JobDetailModal', 'CreateJobModal'];

  for (const nome of MODAIS) {
    const fonte = ler('src', 'components', 'modals', `${nome}.tsx`);

    it(`${nome} não perde largura com respiro no celular`, () => {
      expect(
        fonte,
        `${nome} voltou a reservar respiro em volta no celular — são 32px de ` +
          `390, tirados de onde a largura já é escassa`
      ).toMatch(/p-0 sm:p-4/);
    });

    it(`${nome} solta o canto só em tela cheia`, () => {
      expect(fonte, `${nome} perdeu o canto do desktop`).toMatch(/rounded-none sm:rounded-2xl/);
      expect(
        fonte,
        `${nome} voltou a limitar a altura no celular, o que reintroduz a ` +
          `caixa centrada que a tela cheia veio substituir`
      ).toMatch(/max-h-full sm:max-h-\[9[02]vh\]/);
    });
  }

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

  it('o botão ao lado das abas guarda o nome quando esconde o rótulo', () => {
    /**
     * O rótulo some no celular para devolver 180px às abas. Sem o
     * `aria-label`, quem usa leitor de tela passa a ouvir um botão sem nome —
     * trocar um problema de layout por um de acesso não é corrigir.
     */
    const modal = ler('src', 'components', 'modals', 'JobDetailModal.tsx');
    const bloco = modal.slice(modal.indexOf('setIsWhatsAppOpen(true)'));
    const botao = bloco.slice(0, bloco.indexOf('</Button>'));
    expect(botao, 'o rótulo some no celular sem aria-label no lugar').toMatch(/aria-label=/);
  });
});
