import { useEffect, useState } from 'react';

/**
 * A tela é estreita o bastante para o conteúdo virar passos?
 *
 * **Isto é decidido em JavaScript, e não com `lg:hidden`**, e a diferença não
 * é de estilo. Esconder por CSS significa montar as duas versões — o
 * assistente e as duas colunas — e deixar uma invisível. O formulário seria
 * montado o dobro de vezes, com o efeito que revalida o formato rodando em
 * instâncias que ninguém vê, e o navegador carregaria as duas árvores num
 * aparelho onde a memória é o que falta.
 *
 * O corte é o mesmo `lg` do Tailwind (1024px), e ele está escrito aqui porque
 * é a única cópia: um número diferente aqui e lá faria existir uma faixa de
 * largura com o assistente e as duas colunas ao mesmo tempo, ou com nenhum dos
 * dois.
 *
 * **Fora do navegador devolve `false`.** `matchMedia` não existe no vitest nem
 * numa renderização de servidor; a resposta segura é a tela larga, que é a que
 * mostra tudo — errar para o lado do assistente esconderia campos sem nada
 * dizer.
 */
const CORTE = '(max-width: 1023px)';

export const useTelaEstreita = (): boolean => {
  const [estreita, setEstreita] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(CORTE).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const consulta = window.matchMedia(CORTE);

    const aoMudar = (e: MediaQueryListEvent) => setEstreita(e.matches);
    /*
      O valor é relido aqui também, e não só no `useState`: entre a primeira
      renderização e o efeito a janela pode ter mudado de tamanho — girar o
      aparelho durante o carregamento é o caso real —, e sem esta linha a tela
      ficaria no estado de antes do giro até o próximo evento.
    */
    setEstreita(consulta.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return estreita;
};
