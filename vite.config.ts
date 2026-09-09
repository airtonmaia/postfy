import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

const identidadeDaBuild = {
  versao: version as string,
  build: new Date().toISOString(),
  commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
};

/**
 * `version.json` ao lado do bundle.
 *
 * A aba aberta só sabe a versão com que ela mesma foi carregada — está
 * embutida no JS. Para descobrir que subiu outra, precisa perguntar a algo
 * que não seja o próprio bundle. Este arquivo é esse algo: minúsculo, sem
 * hash no nome (senão a aba antiga não saberia o endereço do novo) e sem
 * depender de `/api`, que não sobe no `vite dev`.
 */
const publicarIdentidadeDaBuild = (): Plugin => ({
  name: 'orquesia:version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify(identidadeDaBuild),
    });
  },
});

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
      __APP_VERSION__: JSON.stringify(identidadeDaBuild.versao),
      __BUILD_TIME__: JSON.stringify(identidadeDaBuild.build),
      __COMMIT__: JSON.stringify(identidadeDaBuild.commit),
    },
    plugins: [react(), tailwindcss(), publicarIdentidadeDaBuild()],
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
      // `vercel dev` aplica o rewrite de SPA do vercel.json até nos módulos
      // internos do Vite (/src/main.tsx, /@vite/client) e devolve HTML no
      // lugar do JS — página em branco. Por isso as rotas /api rodam numa
      // instância separada de `vercel dev` (porta 3001, sem browser
      // acessando direto) e o Vite só encaminha a chamada.
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
