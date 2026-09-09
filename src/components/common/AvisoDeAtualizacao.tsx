import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { temVersaoNova, type IdentidadeDaBuild } from '../../lib/atualizacao';

/**
 * Aviso de que subiu versão nova enquanto esta aba estava aberta.
 *
 * Sem ele o deploy é invisível para quem já está lá dentro: a pessoa segue no
 * bundle antigo até fechar o navegador, e o sintoma aparece como bug — botão
 * que sumiu, tela que mudou de lugar, chamada para uma rota que já não
 * existe.
 *
 * O aviso não recarrega sozinho. Recarregar por conta própria interromperia
 * quem está no meio de escrever uma legenda, e o susto seria pior do que a
 * versão velha. Quem decide a hora é quem está usando.
 */

/**
 * De dois em dois minutos, e sempre que a aba volta ao primeiro plano.
 *
 * Só o intervalo não bastaria: o caso mais comum é a aba passar horas em
 * segundo plano — e é justamente aí que o navegador estrangula os timers.
 * A volta do foco é o momento em que a pessoa vai voltar a clicar.
 */
const INTERVALO = 2 * 60 * 1000;

export const AvisoDeAtualizacao: React.FC = () => {
  const { recarregarComSeguranca } = usePostfy();
  const [novaVersao, setNovaVersao] = useState<IdentidadeDaBuild | null>(null);
  const [dispensado, setDispensado] = useState(false);
  const [recarregando, setRecarregando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const conferir = async () => {
      if (cancelado || document.visibilityState !== 'visible') return;
      const nova = await temVersaoNova();
      if (!cancelado && nova) setNovaVersao(nova);
    };

    const relogio = setInterval(conferir, INTERVALO);
    document.addEventListener('visibilitychange', conferir);
    // A primeira conferência espera um pouco: no carregamento a aba acabou de
    // pegar o bundle mais novo, e disputar rede com o que a tela precisa para
    // aparecer não ajuda ninguém.
    const primeira = setTimeout(conferir, 30 * 1000);

    return () => {
      cancelado = true;
      clearInterval(relogio);
      clearTimeout(primeira);
      document.removeEventListener('visibilitychange', conferir);
    };
  }, []);

  if (!novaVersao || dispensado) return null;

  return (
    <div className="shrink-0 px-4 py-2.5 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-900 flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />

      <p className="text-[11px] text-purple-900 dark:text-purple-200 leading-relaxed flex-1 min-w-0">
        <strong className="font-bold">Chegou a versão {novaVersao.versao}.</strong>{' '}
        Você ainda está usando a anterior nesta aba. Atualize quando quiser — o que já
        está salvo continua salvo.
      </p>

      <button
        onClick={() => {
          setRecarregando(true);
          void recarregarComSeguranca();
        }}
        disabled={recarregando}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${recarregando ? 'animate-spin' : ''}`} />
        {recarregando ? 'Atualizando...' : 'Atualizar agora'}
      </button>

      <button
        onClick={() => setDispensado(true)}
        className="shrink-0 p-1 rounded-lg text-purple-400 hover:text-purple-700 dark:hover:text-purple-200 transition cursor-pointer"
        title="Agora não"
        aria-label="Dispensar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
