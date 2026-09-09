import React from 'react';

/**
 * Versão e horário da build, no rodapé.
 *
 * Existe para responder sem ambiguidade à pergunta que aparece toda vez que
 * algo é corrigido: "já subiu?". Durante a caçada ao crash das rotas /api,
 * uma das dúvidas foi exatamente essa — o primeiro teste aconteceu dois
 * minutos depois do merge, e não havia como saber se o deploy tinha saído.
 *
 * Os três valores são injetados pelo Vite na hora de compilar, então o que
 * aparece aqui é o que está servindo, não o que deveria estar.
 */

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
declare const __COMMIT__: string;

/**
 * "atualizado às 9h13" quando é de hoje, "em 09/09 às 9h13" quando não é.
 *
 * A hora sozinha engana: numa build de ontem, "9h13" parece recente.
 */
export const descreverBuild = (iso: string, agora = new Date()): string => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return 'horário indisponível';

  const hora = data
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h');

  const mesmoDia =
    data.getDate() === agora.getDate() &&
    data.getMonth() === agora.getMonth() &&
    data.getFullYear() === agora.getFullYear();

  if (mesmoDia) return `atualizado às ${hora}`;

  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `atualizado em ${dia} às ${hora}`;
};

/**
 * Fixo no canto inferior direito, acima de qualquer tela.
 *
 * `pointer-events-none` no contêiner para não roubar clique de nada que
 * esteja embaixo; só o texto volta a receber ponteiro, para o title do
 * commit funcionar no hover.
 */
export const VersaoDoApp: React.FC = () => (
  <div className="fixed bottom-2 right-3 z-40 pointer-events-none select-none">
    <p
      className="pointer-events-auto text-[10px] font-mono text-slate-400/70 dark:text-slate-600
                 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm rounded-md px-2 py-0.5
                 border border-slate-200/60 dark:border-slate-800/60"
      // O commit fica no title: útil para depurar, e ruído na tela do dia a dia.
      title={`commit ${__COMMIT__}`}
    >
      v{__APP_VERSION__} · {descreverBuild(__BUILD_TIME__)}
    </p>
  </div>
);
