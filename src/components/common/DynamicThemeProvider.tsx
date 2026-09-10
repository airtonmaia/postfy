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
