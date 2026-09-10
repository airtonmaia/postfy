import { lazy } from 'react';
import type { ComponentType } from 'react';
import { comRetentativaDeDeploy } from './atualizacao';

/**
 * Tela carregada sob demanda (code splitting).
 *
 * Cada tela vira um chunk próprio, então abrir o login não baixa relatórios,
 * gráficos e PDF.
 *
 * `comRetentativaDeDeploy` cobre o chunk que some no meio do caminho: quando
 * sai um deploy, os arquivos ganham hash novo e os antigos deixam de existir,
 * mas a aba aberta continua pedindo os de antes. Sem isso a aplicação caía
 * inteira em "Failed to fetch dynamically imported module" na primeira tela
 * que ainda não tinha sido aberta.
 *
 * Mora aqui, e não em `App.tsx`, porque agora existem duas cascas — a da
 * agência e a de `/admin` — e as duas carregam telas do mesmo jeito.
 */
export const tela = <T extends Record<string, unknown>>(
  carregar: () => Promise<T>,
  nome: keyof T
) =>
  lazy(() =>
    comRetentativaDeDeploy(carregar).then((m) => ({
      default: m[nome] as ComponentType<Record<string, never>>,
    }))
  );
