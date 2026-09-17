import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
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
        semNome.push(`${caminho.replace(`${RAIZ}/`, '')}: ${botao.slice(0, 80)}`);
      }
    }

    expect(
      semNome,
      'o rótulo some no celular e o botão fica sem nome para o leitor de tela'
    ).toEqual([]);
  });
});
