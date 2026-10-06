import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

export interface PassoDoConteudo {
  chave: string;
  rotulo: string;
  /** Uma linha dizendo o que se decide aqui. */
  descricao: string;
  conteudo: React.ReactNode;
}

/**
 * O conteúdo em passos, **no celular**.
 *
 * ### O problema que ele resolve
 *
 * No computador a tela tem duas colunas: a peça de um lado, a gestão do outro.
 * Abaixo do `lg` as duas viram uma lista só — e a lista tem doze campos, uma
 * área de upload e duas de texto. Rolar isso de ponta a ponta para trocar a
 * data é o que faz alguém preferir abrir o notebook, que é o oposto do que um
 * produto usado no telefone precisa.
 *
 * ### Quatro decisões
 *
 * - **A faixa de passos é tocável, não só um indicador.** Quem veio trocar a
 *   legenda toca "Texto" e pronto; quem está criando a peça segue o
 *   "Avançar". Um assistente que **obriga** a ordem transforma uma edição de
 *   uma palavra em quatro toques.
 * - **Dá para salvar em qualquer passo.** O botão de concluir está sempre na
 *   barra de baixo, e não escondido no último passo. Fechar no meio é um toque
 *   no celular, e perder o que foi digitado por causa disso é o pior desfecho
 *   possível numa tela de produção — a peça incompleta é um estado que o
 *   quadro já tem, e se chama Ideias.
 * - **A barra de baixo não rola com o conteúdo.** Ela é irmã da área que rola,
 *   não filha: um botão de salvar que exige rolar até o fim de um formulário é
 *   um botão que a pessoa não encontra. Mesma regra da barra de salvar do
 *   editor.
 * - **O passo atual aparece na faixa mesmo quando ela rola.** São quatro ou
 *   cinco chips em 390px: sem o `scrollIntoView`, avançar para o último deixa
 *   a faixa mostrando os primeiros, e a pessoa perde a noção de onde está.
 */
export const AssistenteDoConteudo: React.FC<{
  passos: PassoDoConteudo[];
  /** A barra de baixo, à direita do Voltar/Avançar: salvar, publicar, etc. */
  acoes?: React.ReactNode;
}> = ({ passos, acoes }) => {
  const [indice, setIndice] = useState(0);

  /*
    O índice é preso à lista a cada render, e não só ao mudar: a lista encolhe
    quando a peça deixa de pedir arte (trocar o tipo de conteúdo), e um índice
    além do fim desenharia uma tela em branco — sem erro, sem pista.
  */
  const atual = Math.min(indice, passos.length - 1);
  const passo = passos[atual];
  if (!passo) return null;

  const ir = (proximo: number) => {
    const alvo = Math.max(0, Math.min(passos.length - 1, proximo));
    setIndice(alvo);
    // O chip do passo escolhido volta para a vista: a faixa rola, e avançar
    // para o último deixaria a pessoa olhando para os primeiros.
    document
      .getElementById(`passo-${passos[alvo].chave}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  };

  return (
    <Tabs
      value={passo.chave}
      onValueChange={(v) => ir(passos.findIndex((p) => p.chave === v))}
      className="flex flex-col min-h-0"
    >
      {/*
        **A faixa de passos é a barra de abas do projeto, não um chip novo.**

        A primeira versão desenhou os chips à mão, pintando o atual com o roxo
        do botão primário — e as duas guardas de `tests/botoes.test.ts`
        reprovaram, com razão nas duas: item selecionável não é `<button>`
        escrito à mão, e nada à mão se pinta como a ação primária da tela.

        E a peça certa já existia: tocar um passo troca o painel sem navegar,
        que é a definição de aba. Ela ainda traz de graça o que eu teria de
        refazer — rolagem horizontal sem barra à mostra e navegação por teclado.
      */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
        <TabsList aparencia="segmentado">
          {passos.map((p) => (
            <TabsTrigger key={p.chave} value={p.chave} id={`passo-${p.chave}`}>
              {p.rotulo}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* O passo */}
      {/*
        **Quem rola é o pai, não este bloco.** Dentro da modal de edição o
        assistente mora numa área que já rola; um `overflow-y-auto` aqui
        criaria duas barras aninhadas, e a de dentro só apareceria depois de a
        de fora chegar ao fim. A faixa de passos e a barra de baixo ficam
        **grudadas** (`sticky`), que funciona nos dois casos — com altura
        limitada e sem.
      */}
      <div className="flex-1 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{passo.rotulo}</h3>
          {/* A linha de apoio não é enfeite: ela é o que diz que "Agenda" é
              quando a peça sai, e não quando ela foi criada. */}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {passo.descricao}
          </p>
        </div>

        {passo.conteudo}
      </div>

      {/* A barra de baixo */}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
        <div className="flex items-center justify-center gap-1.5">
          {passos.map((p, i) => (
            <span
              key={p.chave}
              aria-hidden
              className={`h-1.5 rounded-full transition-all ${
                i === atual ? 'w-5 bg-purple-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
          <span className="ml-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {atual + 1}/{passos.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => ir(atual - 1)}
            disabled={atual === 0}
            className="flex-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Voltar
          </Button>

          {atual < passos.length - 1 && (
            <Button type="button" onClick={() => ir(atual + 1)} className="flex-1">
              Avançar
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/*
          **As ações da tela ficam sempre à vista, inclusive no primeiro passo**,
          e numa linha própria. Escondê-las no último passo seria a regra da
          referência — e ali fechar no meio perde tudo, que no celular é um
          toque. A peça incompleta é um estado que o quadro já tem, e se chama
          Ideias.
        */}
        {acoes && (
          <div className="flex flex-col gap-2 [&>*]:w-full pt-1 border-t border-slate-100 dark:border-slate-800">
            {acoes}
          </div>
        )}
      </div>
    </Tabs>
  );
};
