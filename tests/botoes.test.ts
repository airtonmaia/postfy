import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Botão tem uma escala só, e ela mora no componente.
 *
 * O produto tinha **339 `<button>` escritos à mão em 60 arquivos**. Cada um
 * nasceu certo no lugar dele, e juntos produziram doze alturas diferentes: só
 * entre as combinações de padding mais comuns havia `px-4 py-2`, `px-5 py-2`,
 * `px-4 py-2.5`, `px-4 py-1.5`, `px-3.5 py-2`, `px-6 py-2.5`…
 *
 * O que torna isso invisível para quem escreve e óbvio para quem usa é que
 * **com padding vertical a altura depende também da fonte**. "Novo Post"
 * (`py-1.5 text-xs`) e "Novo Conteúdo" (`py-2.5 text-sm`) estavam a 10px de
 * distância, e nenhum dos dois parecia errado sozinho.
 *
 * As guardas abaixo protegem as duas metades da correção: a escala existe
 * (altura fixa, no componente) e ninguém volta a escrever uma por fora.
 */

const RAIZ = join(__dirname, '..');

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function listarFontes(dir: string, saida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarFontes(caminho, saida);
    else if (/\.tsx$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

/** O `>` que fecha a tag de abertura, contando `{}`. */
function fimDaTag(txt: string, inicio: number): number {
  let prof = 0;
  for (let i = inicio; i < txt.length; i++) {
    const c = txt[i];
    if (c === '{') prof++;
    else if (c === '}') prof--;
    else if (c === '>' && prof === 0) return i;
  }
  return -1;
}

const botao = readFileSync(
  join(RAIZ, 'src', 'components', 'ui', 'button.tsx'),
  'utf-8'
);

describe('a escala do botão', () => {
  it('cada tamanho define altura fixa, nunca padding vertical', () => {
    // `h-*`/`size-*` é o que faz dois botões com fontes diferentes fecharem.
    // Com `py-*` a altura volta a depender da fonte, que é a causa raiz das
    // doze alturas — o sintoma reapareceria sem quebrar nada mais.
    const bloco = botao.slice(botao.indexOf('size: {'));
    const corpo = bloco.slice(0, bloco.indexOf('\n      },'));

    for (const [, nome, classes] of corpo.matchAll(
      /^\s*'?([a-z-]+)'?:\s*'([^']*)'/gm
    )) {
      expect(
        classes,
        `o tamanho "${nome}" não fixa altura — sem h-*/size-* ela volta a depender da fonte`
      ).toMatch(/\b(?:h-\d+|size-\d+)\b/);

      expect(
        classes,
        `o tamanho "${nome}" usa py-*, que é exatamente o que produziu doze alturas diferentes`
      ).not.toMatch(/\bpy-[\d.]+\b/);
    }
  });

  it('o canto do botão fica na base, igual para todos os tamanhos', () => {
    // Botão pequeno com canto menor que o grande é a inconsistência que esta
    // entrega veio tirar. Se o `rounded-` migrar para dentro de um `size`,
    // ele volta a poder divergir entre tamanhos.
    const base = botao.slice(botao.indexOf('cva('), botao.indexOf('{\n    variants'));
    expect(base, 'o canto saiu da base do botão').toMatch(/\brounded-lg\b/);

    const bloco = botao.slice(botao.indexOf('size: {'));
    const corpo = bloco.slice(0, bloco.indexOf('\n      },'));
    expect(corpo, 'algum tamanho voltou a declarar canto próprio').not.toMatch(
      /\brounded-/
    );
  });
});

/**
 * Onde ainda há `<button>` estilizado à mão — e por quê.
 *
 * Nem todo `<button>` é um botão no sentido do design system, e ignorar isso
 * foi o erro mais caro desta entrega. São três papéis:
 *
 *   - **Item selecionável** — item de menu, aba, dia do calendário. Tem estado
 *     "selecionado" e ocupa a largura do container: é `SidebarMenuButton` ou
 *     `ToggleGroup`, e sai quando a casca for trocada.
 *   - **Card clicável** — resultado de busca, card do kanban, entrada do
 *     changelog, item da lista suspensa, job no portal. Tem conteúdo em bloco
 *     (imagem, título, badges) e altura própria. Altura fixa **corta o
 *     conteúdo**: nove destes foram migrados por engano e voltaram.
 *   - **Afordância minúscula** — o "+" que aparece no hover de uma célula de
 *     16px na semana do calendário. Qualquer tamanho da escala é maior que a
 *     célula.
 *
 * A lista é fechada de propósito. Arquivo novo aparecendo aqui quer dizer que
 * alguém escreveu um botão por fora do componente — e é assim que as doze
 * alturas voltam, uma de cada vez.
 */
const COM_BOTAO_A_MAO = new Set([
  'src/App.tsx',                                        // item do menu + seletor de agência
  'src/components/admin/AdminLayout.tsx',               // idem, casca do /admin
  'src/components/admin/AdminAgenciasView.tsx',         // aba
  'src/components/admin/AdminSeoView.tsx',              // aba
  'src/components/auth/LoginView.tsx',                  // alternador de modo
  'src/components/calendar/CalendarHeader.tsx',         // seletor de visão
  'src/components/calendar/CalendarSidebar.tsx',        // dia do mini calendário
  'src/components/calendar/WeekView.tsx',               // "+" na célula de 16px
  'src/components/clients/ClientDetail.tsx',            // aba
  'src/components/clients/ClientUsersTab.tsx',          // aba
  'src/components/common/AtalhosDoConteudo.tsx',        // atalho com badge
  'src/components/common/PreviaDaRede.tsx',             // navegação do carrossel
  'src/components/kanban/KanbanBoard.tsx',              // card do quadro
  'src/components/layout/ClientSwitcher.tsx',           // item de lista suspensa
  'src/components/layout/WorkspaceSwitcher.tsx',        // idem
  'src/components/modals/ChangelogModal.tsx',           // entrada expansível
  'src/components/modals/SearchModal.tsx',              // resultado de busca
  'src/components/portal/ClientPortalView.tsx',         // card de job no portal
  'src/components/reports/ReportsView.tsx',             // aba
  'src/components/settings/tabs/SettingsPreferences.tsx', // opção selecionável
  'src/components/settings/tabs/SettingsUsers.tsx',     // aba
]);

describe('botão novo passa pelo componente', () => {
  it('só os papéis já nomeados estilizam <button> à mão', () => {
    const achados = new Set<string>();

    for (const arquivo of listarFontes(join(RAIZ, 'src'))) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      for (const m of fonte.matchAll(/<button\b/g)) {
        const fim = fimDaTag(fonte, m.index! + 7);
        if (fim === -1) continue;
        const tag = fonte.slice(m.index!, fim + 1);
        // assinatura de botão pintado à mão: padding + canto próprios
        if (/\bp[xy]?-[\d.]/.test(tag) && /\brounded/.test(tag)) {
          achados.add(arquivo.replace(`${RAIZ}/`, ''));
        }
      }
    }

    const novos = [...achados].filter((a) => !COM_BOTAO_A_MAO.has(a));
    expect(
      novos,
      'botão estilizado à mão em arquivo novo — use <Button variant size>, ' +
        'ou acrescente aqui com o papel que justifica ficar de fora'
    ).toEqual([]);
  });

  it('nenhum <Button> embrulha conteúdo em bloco', () => {
    /**
     * Esta é a guarda que teria pego nove regressões de uma vez.
     *
     * A migração tratou todo `<button>` como botão, e **card clicável também
     * é `<button>`**: resultado de busca, card do kanban, entrada do
     * changelog, seletor de agência, job no portal. Com `h-9` no lugar do
     * padding que eles tinham, o conteúdo — imagem, título, badges em duas
     * linhas — passa a ser cortado por uma caixa de 36px.
     *
     * `<div>`, `<p>`, `<h*>` e `<img>` no corpo são a assinatura disso.
     * `<span>` não entra: rótulo em `<span>` é uso normal de botão.
     *
     * Nada local acusava — `tsc` compila, o vitest não monta componente e o
     * `vite build` não mede caixa. Só aparece abrindo a tela, que é a família
     * de armadilha que este projeto mais paga.
     */
    for (const arquivo of listarFontes(join(RAIZ, 'src'))) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      for (const m of fonte.matchAll(/<Button\b/g)) {
        const fim = fimDaTag(fonte, m.index! + 7);
        if (fim === -1) continue;

        // o `</Button>` deste botão, contando os aninhados
        let nivel = 1;
        const re = /<Button\b|<\/Button>/g;
        re.lastIndex = fim + 1;
        let fecha = -1;
        let n: RegExpExecArray | null;
        while ((n = re.exec(fonte))) {
          nivel += n[0].startsWith('</') ? -1 : 1;
          if (nivel === 0) {
            fecha = n.index;
            break;
          }
        }
        if (fecha === -1) continue;

        const corpo = fonte.slice(fim + 1, fecha);
        expect(
          corpo.match(/<(?:div|p|h[1-6]|img)\b/)?.[0] ?? null,
          `${arquivo.replace(`${RAIZ}/`, '')}:${
            fonte.slice(0, m.index!).split('\n').length
          } — <Button> com conteúdo em bloco tem a altura fixa cortando o ` +
            `conteúdo. Card clicável não é Button: use <button> com as classes dele`
        ).toBeNull();
      }
    }
  });

  it('nenhum size="icon" carrega rótulo', () => {
    /**
     * `icon` é um quadrado de 36px, e a base do botão tem `whitespace-nowrap`:
     * um rótulo ali não quebra linha nem cabe — ele **escapa para fora da área
     * clicável**, e o que a pessoa lê não é o que ela pode clicar.
     *
     * A migração errou isto três vezes, sempre pelo mesmo motivo: a detecção
     * procurava texto solto começando com letra, e "+ Agendar Post para Hoje"
     * começa com `+`. Por isso a guarda não confia em heurística de prefixo —
     * ela pergunta se sobrou **qualquer** palavra depois de tirar as tags.
     */
    for (const arquivo of listarFontes(join(RAIZ, 'src'))) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      for (const m of fonte.matchAll(/<Button\b/g)) {
        const fim = fimDaTag(fonte, m.index! + 7);
        if (fim === -1) continue;
        const tag = fonte.slice(m.index!, fim + 1);
        if (!/size="icon/.test(tag)) continue;

        let nivel = 1;
        const re = /<Button\b|<\/Button>/g;
        re.lastIndex = fim + 1;
        let fecha = -1;
        let n: RegExpExecArray | null;
        while ((n = re.exec(fonte))) {
          nivel += n[0].startsWith('</') ? -1 : 1;
          if (nivel === 0) {
            fecha = n.index;
            break;
          }
        }
        if (fecha === -1) continue;

        // Fora as tags (os ícones), o que resta tem que ser só pontuação e
        // expressões que rendem ícone — nunca palavra.
        const semTags = fonte.slice(fim + 1, fecha).replace(/<[^>]*>/g, ' ');
        const temLiteral = /['"`][^'"`]*[A-Za-zÀ-ÿ]{3,}/.test(semTags);
        const temTextoSolto = /[A-Za-zÀ-ÿ]{3,}/.test(semTags.replace(/\{[^}]*\}/g, ' '));

        expect(
          temLiteral || temTextoSolto,
          `${arquivo.replace(`${RAIZ}/`, '')}:${
            fonte.slice(0, m.index!).split('\n').length
          } — size="icon" com rótulo: o texto escapa do quadrado de 36px. ` +
            `Use um tamanho com texto (sm, md, lg)`
        ).toBe(false);
      }
    }
  });

  it('nenhum <Button> no primário carrega pintura neutra', () => {
    /**
     * O botão sem `variant` cai no `primary`, que é a **cor da agência**. Um
     * desses carregando só fundo neutro no `className` quer dizer que a
     * variante se perdeu no caminho — e o sintoma é uma barra de navegação
     * inteira pintada com a marca.
     *
     * Foi o que aconteceu com o `< Hoje >` do calendário. O corretor de
     * "fundo sólido" da migração leu o `dark:bg-slate-900` do hover como
     * preenchimento e tirou o `variant="ghost"` de dez botões. A regra certa:
     * **`dark:bg-*` e `hover:bg-*` sozinhos não são preenchimento** — sem um
     * fundo de modo claro fora do hover, o botão não tem fundo próprio, que é
     * a definição de ghost.
     *
     * A cor importa na distinção: `hover:bg-purple-500` sozinho é override do
     * hover de um botão que **é** primário (o "Recarregar" do
     * `ErrorBoundary`), e esse fica. Neutro sozinho, não.
     */
    for (const arquivo of listarFontes(join(RAIZ, 'src'))) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      for (const m of fonte.matchAll(/<Button\b/g)) {
        const fim = fimDaTag(fonte, m.index! + 7);
        if (fim === -1) continue;
        const tag = fonte.slice(m.index!, fim + 1);
        if (/variant=/.test(tag)) continue;

        const cls = tag.match(/className="([^"]*)"/)?.[1];
        if (!cls) continue;

        const fundos = cls.split(/\s+/).filter((c) => /(?:^|:)bg-/.test(c));
        if (fundos.length === 0) continue;

        const semFundoProprio = fundos.every(
          (c) => /^dark:/.test(c) || /(?:^|:)hover:/.test(c)
        );
        const todosNeutros = fundos.every((c) =>
          /bg-(?:white|black|slate|gray|zinc|neutral|stone)/.test(c)
        );

        expect(
          semFundoProprio && todosNeutros,
          `${arquivo.replace(`${RAIZ}/`, '')}:${
            fonte.slice(0, m.index!).split('\n').length
          } — <Button> sem variant (= primary, a cor da agência) com pintura ` +
            `neutra "${cls}". Provável ghost que perdeu a variante`
        ).toBe(false);
      }
    }
  });

  it('nenhum <button> à mão se pinta como ação primária', () => {
    // Fundo roxo cheio é "a ação principal desta tela", e isso é sempre
    // `<Button>`. Onde ele aparece num `<button>` cru significa outra coisa —
    // "selecionado" —, e aí a cor vem da variante pela prop, não de uma
    // string condicional.
    for (const arquivo of listarFontes(join(RAIZ, 'src'))) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      for (const m of fonte.matchAll(/<button\b/g)) {
        const fim = fimDaTag(fonte, m.index! + 7);
        if (fim === -1) continue;
        const tag = fonte.slice(m.index!, fim + 1);
        // O dia selecionado do mini calendário é o único caso legítimo: ele é
        // um círculo de 28px, não um botão.
        if (arquivo.endsWith('CalendarSidebar.tsx')) continue;

        // O `(?!\/)` separa preenchimento de tinta: `bg-purple-500/10` é o
        // fundo de 10% do item de menu ativo, não a ação primária. Sem ele a
        // guarda acusava o próprio menu lateral.
        expect(
          tag.match(/\bbg-purple-(?:500|600)\b(?!\/)/)?.[0] ?? null,
          `${arquivo.replace(`${RAIZ}/`, '')}: <button> à mão com o roxo de ação primária`
        ).toBeNull();
      }
    }
  });
});
