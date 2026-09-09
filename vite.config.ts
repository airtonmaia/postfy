import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(() => {
  return {
    /**
     * Identidade da build, resolvida na hora de compilar.
     *
     * O rodapé mostra isso para responder à pergunta que aparece toda vez que
     * algo é corrigido: "já subiu?". Sem isso, a única forma de saber é
     * comparar comportamento, que é justamente o que falha quando o deploy
     * não saiu.
     *
     * O commit vem da Vercel; em desenvolvimento não existe e vira 'local'.
     */
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT__: JSON.stringify(
        (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)
      ),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
