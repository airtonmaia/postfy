import React, { useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';

function hexToRgba(hex: string, alpha: number): string {
  let c = (hex || '').replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) return `rgba(147, 51, 234, ${alpha})`;
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(147, 51, 234, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Branco ou quase-preto, o que ler melhor sobre a cor.
 *
 * A folha de `!important` abaixo não consegue decidir isto: ali a cor de fundo
 * e a do texto são classes diferentes (`bg-purple-600` e `text-white`), então
 * uma agência de marca clara — amarelo, lima, ciano — ficava com texto branco
 * sobre fundo claro, ilegível, e nada no produto avisava.
 *
 * Com `--primary-foreground` a decisão passa a existir num lugar só, e é por
 * isso que a variável vale mais que a folha: ela carrega o par, não a cor
 * solta.
 *
 * O peso de cada canal é o da luminância percebida (o olho lê verde muito mais
 * que azul); o corte em 150 é o usual para esta fórmula.
 */
function textoLegivelSobre(hex: string): string {
  let c = (hex || '').replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) return '#ffffff';
  const num = parseInt(c, 16);
  if (isNaN(num)) return '#ffffff';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
  // slate-900, que é o texto escuro do produto — não preto puro.
  return luminancia > 150 ? '#0f172a' : '#ffffff';
}

function adjustHexBrightness(hex: string, percent: number): string {
  let c = (hex || '').replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) return hex;
  const num = parseInt(c, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  r = Math.min(255, Math.max(0, Math.round(r * (1 + percent / 100))));
  g = Math.min(255, Math.max(0, Math.round(g * (1 + percent / 100))));
  b = Math.min(255, Math.max(0, Math.round(b * (1 + percent / 100))));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const DynamicThemeProvider: React.FC = () => {
  const { currentWorkspace, aparencia } = usePostfy();

  /**
   * A agência sobrepõe o produto, e não o contrário.
   *
   * Dentro de uma agência quem pinta é o whitelabel dela — é para isso que
   * ele existe, e o cliente dela é quem vê aquela tela. A paleta do Orquesia
   * vale onde não há agência aberta: entrada, cadastro, porta do portal e a
   * área de administração. Antes o fallback era um roxo literal aqui, que
   * ninguém conseguia trocar sem deploy.
   */
  const primary = currentWorkspace?.primaryColor || aparencia.corPrimaria;
  const secondary = currentWorkspace?.secondaryColor || aparencia.corSecundaria;

  useEffect(() => {
    const hoverPrimary = adjustHexBrightness(primary, -12);
    const activePrimary = adjustHexBrightness(primary, -22);
    const brightPrimary = adjustHexBrightness(primary, 25);
    const lightPrimary = hexToRgba(primary, 0.12);
    const lightPrimaryDark = hexToRgba(primary, 0.2);
    const borderPrimary = hexToRgba(primary, 0.28);
    const glowPrimary = hexToRgba(primary, 0.35);

    const styleId = 'postfy-whitelabel-custom-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const textoSobrePrimario = textoLegivelSobre(primary);

    /**
     * O bloco abaixo escreve a mesma cor com dois conjuntos de nomes.
     *
     * `--brand-*` alimenta a folha de `!important` que vem depois, e é o que
     * pinta os 984 utilitários roxos escritos à mão em 61 arquivos —
     * `bg-purple-600` e companhia. `--primary`, `--ring` e
     * `--sidebar-primary` são os nomes que o shadcn
     * usa, e é por eles que toda peça gerada por `npx shadcn add` vai
     * perguntar a cor.
     *
     * As duas saem de `currentWorkspace.primaryColor`, então não podem
     * divergir: trocar a cor da agência move as duas juntas. É isso que
     * permite migrar tela por tela em vez de num fôlego só.
     *
     * **Apagar um dos lados antes da hora é o erro caro.** A tela continua
     * pintada — com o roxo do Orquesia no lugar da marca do cliente — e
     * ninguém abre chamado, porque *parece* certo.
     *
     * **A marca não muda de tom entre claro e escuro.** O shadcn clareia o
     * `--primary` no escuro porque o primário dele é um neutro; aqui ele é a
     * cor da agência, e os 99 `bg-purple-600` escritos à mão continuam no tom
     * cheio nos dois modos. Clarear só este lado colocaria dois roxos
     * diferentes na mesma tela — exatamente o que a padronização veio tirar.
     *
     * Por isso há só `:root`, e não um `.dark` junto. O `index.css` declara as
     * duas versões dentro de `@layer base`, e **fora de camada vence dentro de
     * camada independente de especificidade** — então este `:root` sobrepõe
     * também o `.dark` de lá. Medido no Chromium, não deduzido: com `.dark` no
     * `<html>` e a folha injetada trazendo só `:root`, é o valor injetado que
     * `getComputedStyle` devolve.
     */
    const css = `
      :root {
        --brand-primary: ${primary};
        --brand-primary-hover: ${hoverPrimary};
        --brand-primary-active: ${activePrimary};
        --brand-primary-bright: ${brightPrimary};
        --brand-primary-light: ${lightPrimary};
        --brand-primary-light-dark: ${lightPrimaryDark};
        --brand-primary-border: ${borderPrimary};
        --brand-primary-glow: ${glowPrimary};
        --brand-secondary: ${secondary};

        /* As mesmas cores, nos nomes que o shadcn usa. */
        --primary: ${primary};
        --primary-foreground: ${textoSobrePrimario};
        --ring: ${primary};
        --sidebar-primary: ${primary};
        --sidebar-primary-foreground: ${textoSobrePrimario};
        --sidebar-ring: ${primary};
      }

      /* Primary Background Buttons & Chips */
      .bg-purple-600, .bg-purple-500 {
        background-color: var(--brand-primary) !important;
      }
      .hover\\:bg-purple-700:hover, .hover\\:bg-purple-600:hover {
        background-color: var(--brand-primary-hover) !important;
      }
      .active\\:bg-purple-800:active {
        background-color: var(--brand-primary-active) !important;
      }

      /* Text Colors */
      .text-purple-600, .text-purple-700, .text-purple-800 {
        color: var(--brand-primary) !important;
      }
      .dark .text-purple-400, .dark .text-purple-300 {
        color: var(--brand-primary-bright) !important;
      }
      .hover\\:text-purple-600:hover, .hover\\:text-purple-700:hover {
        color: var(--brand-primary) !important;
      }

      /* Light Background Highlights & Active Navigation */
      .bg-purple-50, .bg-purple-100 {
        background-color: var(--brand-primary-light) !important;
      }
      .dark .bg-purple-950\\/40, .dark .bg-purple-950\\/50, .dark .bg-purple-900\\/20, .dark .bg-purple-900\\/30, .dark .bg-purple-900\\/40, .dark .bg-purple-500\\/10, .dark .bg-purple-500\\/20 {
        background-color: var(--brand-primary-light-dark) !important;
      }
      .hover\\:bg-purple-50:hover, .hover\\:bg-purple-100:hover {
        background-color: var(--brand-primary-light) !important;
      }
      .dark .hover\\:bg-purple-900\\/50:hover {
        background-color: var(--brand-primary-border) !important;
      }

      /* Borders */
      .border-purple-600, .border-purple-500 {
        border-color: var(--brand-primary) !important;
      }
      .border-purple-200, .border-purple-100, .border-purple-300 {
        border-color: var(--brand-primary-border) !important;
      }
      .dark .border-purple-800, .dark .border-purple-800\\/50, .dark .border-purple-700, .dark .border-purple-500\\/20, .dark .border-purple-500\\/30 {
        border-color: var(--brand-primary-border) !important;
      }

      /* Focus states and Rings */
      .focus\\:ring-purple-500:focus, .focus\\:ring-purple-600:focus, .focus\\:ring-purple-500\\/20:focus {
        --tw-ring-color: var(--brand-primary-border) !important;
        border-color: var(--brand-primary) !important;
      }
      .focus\\:border-purple-500:focus {
        border-color: var(--brand-primary) !important;
      }

      /* Shadows & Gradients */
      .shadow-purple-600\\/20, .shadow-purple-600\\/30 {
        box-shadow: 0 4px 12px var(--brand-primary-glow) !important;
      }
      .from-purple-500, .from-purple-600 {
        --tw-gradient-from: var(--brand-primary) var(--tw-gradient-from-position, 0%) !important;
      }
      .to-purple-500, .to-purple-600 {
        --tw-gradient-to: var(--brand-primary) var(--tw-gradient-to-position, 100%) !important;
      }
    `;

    styleEl.innerHTML = css;
  }, [primary, secondary]);

  return null;
};
