import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * As abas vêm de um componente só, e nenhuma expressão vaza para a tela.
 *
 * O produto tinha **cinco barras de abas escritas à mão**, e entre elas três
 * paddings, duas fontes e dois pesos — a mesma história das doze alturas de
 * botão. Agora são `Tabs`/`TabsList`/`TabsTrigger`, com o vocabulário fechado
 * em dois papéis medidos (`pagina` e `painel`) mais o `segmentado`.
 *
 * A segunda guarda daqui nasceu de um bug **desta própria entrega**, e é a
 * mais importante: ver a seção "expressão solta" abaixo.
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

const fontes = listarFontes(join(RAIZ, 'src')).map((caminho) => ({
  caminho: caminho.replace(`${RAIZ}/`, ''),
  texto: semComentarios(readFileSync(caminho, 'utf-8')),
}));

/**
 * **Sem os comentários**, como em `tests/tema-shadcn.test.ts` e
 * `tests/fuso-horario.test.ts`. O cabeçalho de `tabs.tsx` registra as medidas
 * antigas (`py-3.5`, `py-3`) e o `rounded-sm` que o shadcn escreve — é assim
 * que o projeto guarda o custo de ter feito diferente. Lendo o arquivo cru, a
 * guarda acusaria justamente a memória do bug, e a saída seria apagá-la.
 */
const tabs = semComentarios(
  readFileSync(join(RAIZ, 'src', 'components', 'ui', 'tabs.tsx'), 'utf-8')
);

describe('barra de abas nova passa pelo componente', () => {
  it('ninguém volta a pintar aba à mão', () => {
    /**
     * A assinatura da aba escrita à mão: um `<button>` com `border-b-2` e uma
     * comparação de estado na mesma string de classe. É assim que as cinco
     * divergiram — cada uma nasceu certa, e juntas não têm padrão.
     *
     * O seletor de visão do calendário fica de fora, e não é exceção
     * preguiçosa: ele é um **ToggleGroup**, não uma aba. Não troca painel;
     * muda como a mesma tela desenha o mesmo dado, e tem estado "selecionado"
     * em vez de "aberto".
     */
    const achados = fontes
      .filter(({ caminho }) => !caminho.endsWith('CalendarHeader.tsx'))
      .filter(({ texto }) =>
        /**
         * Duas assinaturas, e a segunda foi acrescentada porque a primeira
         * **deixou passar duas barras** na Prévia: a de rede comparava
         * `ativo === canal` (nome próprio, não `activeTab`) e a de
         * enquadramento nem `border-b-2` tinha — é um segmentado, com
         * `bg-slate-100` em volta e `bg-white` no ativo.
         *
         * Guarda que só procura o que você lembrou de escrever não é guarda.
         */
        /<button[\s\S]{0,400}?border-b-2[\s\S]{0,300}?\b(?:activeTab|abaAtiva|isActive|ativo)\s*===/.test(
          texto
        ) ||
        /rounded-xl bg-slate-100[\s\S]{0,600}?<button[\s\S]{0,400}?bg-white[\s\S]{0,120}?shadow-xs/.test(
          texto
        )
      )
      .map(({ caminho }) => caminho);

    expect(
      achados,
      'barra de abas escrita à mão — use <Tabs>/<TabsList>/<TabsTrigger>, ' +
        'ou o padding e a fonte voltam a divergir entre telas'
    ).toEqual([]);
  });

  it('o gatilho fixa altura, nunca padding vertical', () => {
    // A mesma regra do botão, e pelo mesmo motivo: com `py-` a altura depende
    // também da fonte, e foi assim que `py-3.5 text-xs` (46px) e `py-3
    // text-xs` (42px) ficaram a 4px um do outro sem ninguém notar.
    const bloco = tabs.slice(tabs.indexOf('const variantesDoGatilho'));
    const corpo = bloco.slice(0, bloco.indexOf('defaultVariants'));

    expect(corpo, 'o gatilho de painel perdeu a altura fixa').toMatch(/\bh-12\b/);
    expect(corpo, 'o gatilho segmentado perdeu a altura fixa').toMatch(/\bh-8\b/);
    expect(
      corpo,
      'um gatilho voltou a usar py-*, que é a causa raiz das medidas divergentes'
    ).not.toMatch(/\bpy-[\d.]+\b/);
  });

  it('a aparência viaja por contexto, não como prop de cada gatilho', () => {
    /**
     * Repeti-la em cada `TabsTrigger` é o convite para a sexta barra nascer
     * com metade dos gatilhos num estilo e metade noutro — que é literalmente
     * como as cinco divergiram.
     */
    expect(tabs).toMatch(/React\.createContext<Aparencia>/);
    const gatilho = tabs.slice(tabs.indexOf('export const TabsTrigger'));
    expect(
      gatilho.slice(0, 500),
      'o TabsTrigger passou a receber a aparência por prop'
    ).toMatch(/React\.useContext\(ContextoDaAparencia\)/);
  });

  it('o canto do shadcn foi traduzido na entrada', () => {
    // `rounded-md`/`rounded-sm` do shadcn não estão no vocabulário de cinco
    // passos, e a saída fácil — declarar `--radius-*` — é o bug de 649
    // elementos da 2.29.0.
    expect(tabs, 'o raio do shadcn entrou sem tradução').not.toMatch(/rounded-sm/);
    expect(tabs, '--radius-* voltou ao tema pela porta das abas').not.toMatch(/--radius/);
  });
});

describe('expressão solta não vira texto na tela', () => {
  /**
   * **Esta guarda nasceu de um bug desta entrega, e ele foi ao ar na tela.**
   *
   * A conversão das abas trocou `{activeTab === 'x' && ( CORPO )}` por
   * `<TabsContent value="x">CORPO</TabsContent>`. Quando o CORPO era JSX, deu
   * certo. Quando era uma **expressão** — um ternário
   * `pendingApprovalJobs.length === 0 ? (…) : (…)` —, ela perdeu as chaves que
   * a faziam ser código e virou **filho de texto**: a tela de Aprovações
   * passou a exibir, em letras pretas, `pendingApprovalJobs.length === 0 ? (`.
   *
   * E `tsc`, vitest e `vite build` ficaram os três verdes — texto dentro de
   * JSX é JSX válido. Só apareceu no Chromium, e é a mesma família da
   * armadilha 0.
   */
  it('nenhum filho de JSX parece código', () => {
    const suspeito = /(?:===|!==|\?\s*\(|&&\s*\(|\.length\b|\.map\()/;
    const achados: string[] = [];

    for (const { caminho, texto } of fontes) {
      /**
       * Filho de texto: entre o `>` que fecha uma tag e o `<` seguinte, sem
       * chave nenhuma no meio.
       *
       * O `[A-Za-z_$]` no começo não é enfeite — é o conserto da primeira
       * versão desta guarda, que reprovou **doze trechos corretos**. Todos
       * eram continuação de ternário dentro de chaves (`) : isSvg ? (`), que
       * começa com `)`. Guarda que reprova código correto é pior que guarda
       * nenhuma: ensina a ignorá-la, e na próxima vez que ela acusar — com
       * razão — alguém some com o teste em vez do bug.
       */
      for (const m of texto.matchAll(/>\s*\n\s*([A-Za-z_$][^<>{}\n]*)\n\s*</g)) {
        const conteudo = m[1].trim();
        if (!suspeito.test(conteudo)) continue;
        achados.push(
          `${caminho}:${texto.slice(0, m.index!).split('\n').length} — ${conteudo.slice(0, 60)}`
        );
      }
    }

    expect(
      achados,
      'expressão JavaScript como filho de texto: ela perdeu as chaves e vai ' +
        'aparecer escrita na tela. Nada local acusa — JSX aceita texto'
    ).toEqual([]);
  });
});

describe('o rascunho nunca é publicado', () => {
  /**
   * A regra central do campo novo, e a única que custa caro se cair.
   *
   * "Legenda" vai para a rede; "Rascunho" é o texto de trabalho — versão
   * descartada, gancho, o que o cliente falou na reunião. Eles são colunas
   * diferentes justamente para que o segundo não possa sair por engano: o que
   * vai ao ar no perfil do cliente não volta.
   */
  it('nenhuma rota de publicação lê draft', () => {
    const api = listarDiretorio(join(RAIZ, 'api'));
    for (const caminho of api) {
      const texto = semComentarios(readFileSync(caminho, 'utf-8'));
      expect(
        texto,
        `${caminho.replace(`${RAIZ}/`, '')} passou a ler o rascunho — ele é o texto ` +
          `que a agência descartou, e ia para o perfil do cliente`
      ).not.toMatch(/\bdraft\b/);
    }
  });

  it('a prévia mostra a legenda, não o rascunho', () => {
    // A prévia é o que a pessoa confere antes de mandar para aprovação. Com o
    // rascunho ali, ela aprovaria uma coisa e publicaria outra.
    const previa = fontes.find((f) => f.caminho.endsWith('PreviaDaRede.tsx'));
    expect(previa, 'PreviaDaRede sumiu').toBeTruthy();
    expect(previa!.texto, 'a prévia passou a desenhar o rascunho').not.toMatch(/\bdraft\b/);
  });

  it('a tela diz que o rascunho não é publicado', () => {
    const modal = fontes.find((f) => f.caminho.endsWith('CreateJobModal.tsx'))!;
    // Campo que parece que publica e não publica engana mais que campo
    // ausente — a mesma lição de `trial_ends_at`.
    expect(modal.texto, 'o aviso de que o rascunho não vai ao ar saiu da tela').toMatch(
      /não (?:vai publicado|entra na publicação)/
    );
  });
});

function listarDiretorio(dir: string, saida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarDiretorio(caminho, saida);
    else if (/\.ts$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}
