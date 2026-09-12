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
 * Nem todo `<button>` é um botão no sentido do design system. Item de menu,
 * célula de dia do calendário e aba têm estado "selecionado" e ocupam a
 * largura do container: são outros componentes do shadcn (`SidebarMenuButton`,
 * `ToggleGroup`), não `Button`. Ficam de fora até a casca ser trocada.
 *
 * A lista é fechada de propósito. Arquivo novo aparecendo aqui quer dizer que
 * alguém escreveu um botão por fora do componente — e é assim que as doze
 * alturas voltam, uma de cada vez.
 */
const COM_BOTAO_A_MAO = new Set([
  'src/App.tsx',                                        // item do menu lateral
  'src/components/admin/AdminLayout.tsx',               // idem, casca do /admin
  'src/components/admin/AdminAgenciasView.tsx',         // aba
  'src/components/admin/AdminSeoView.tsx',              // aba
  'src/components/auth/LoginView.tsx',                  // alternador de modo
  'src/components/calendar/CalendarHeader.tsx',         // seletor de visão
  'src/components/calendar/CalendarSidebar.tsx',        // dia do mini calendário
  'src/components/clients/ClientDetail.tsx',            // aba
  'src/components/clients/ClientUsersTab.tsx',          // aba
  'src/components/common/AtalhosDoConteudo.tsx',        // atalho com badge
  'src/components/common/PreviaDaRede.tsx',             // navegação do carrossel
  'src/components/layout/ClientSwitcher.tsx',           // item de lista suspensa
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
