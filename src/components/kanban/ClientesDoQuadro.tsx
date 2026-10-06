import React from 'react';
import { Users } from 'lucide-react';

import { Avatar } from '../common/Avatar';
import type { Client } from '../../types';

/**
 * Os clientes da agência em faixa, no topo do quadro: clicar na foto filtra.
 *
 * **Ela não é um segundo filtro — é outro jeito de mexer no mesmo.** O estado
 * é o `clientFilter` do contexto, que o seletor "Todos os Clientes" já usava.
 * Dois controles para um estado é uma coisa; dois estados para a mesma
 * pergunta é o que este projeto já pagou caro, e não é o caso aqui: mudar por
 * um lado move o outro na hora.
 *
 * **Por que a foto, se o seletor já existia.** O seletor é uma lista de nomes
 * atrás de um clique — para trocar de cliente é preciso abrir, ler e escolher.
 * Numa tela em que a pergunta "o que está acontecendo com este cliente?"
 * aparece o tempo todo, isso é caro justamente por ser barato cada vez. A foto
 * é reconhecida antes de qualquer texto ser lido, e o `Avatar` garante que
 * mesmo quem não tem foto tenha uma cor estável e as iniciais — a mesma peça
 * que o card do quadro usa, então o cliente lê igual nos dois lugares.
 *
 * **O seletor fica.** Ele é o caminho de quem procura pelo nome, e com vinte
 * clientes percorrer a faixa é pior. Tirá-lo deixaria a tela mais limpa e mais
 * lenta de usar.
 *
 * Três decisões que não são gosto:
 *
 * - **"Todos" é um item da faixa, não a ausência de seleção.** Sem ele, sair
 *   de um cliente exigiria descobrir que clicar de novo desmarca — regra que
 *   ninguém adivinha, e que deixaria a pessoa presa num cliente achando que o
 *   quadro esvaziou.
 * - **Clicar no selecionado volta para "Todos"**, e isso é um atalho, não a
 *   única saída: quem descobrir, economiza; quem não, usa o "Todos".
 * - **A lista é a mesma do seletor**, inclusive cliente inativo. Dois
 *   controles do mesmo estado mostrando conjuntos diferentes fariam um cliente
 *   existir num e não no outro — e quem não o achasse na faixa concluiria que
 *   ele saiu da agência.
 */
export const ClientesDoQuadro: React.FC<{
  clientes: Client[];
  /** `all` ou o id do cliente — o mesmo valor do seletor. */
  selecionado: string;
  aoSelecionar: (valor: string) => void;
}> = ({ clientes, selecionado, aoSelecionar }) => {
  // Agência sem cliente não ganha uma faixa vazia: ela não filtra nada e
  // ocupa a altura de uma linha dizendo isso. Quem não tem cliente precisa
  // cadastrar um, e esse convite já mora na tela de Clientes.
  if (clientes.length === 0) return null;

  const itens = [{ id: 'all', nome: 'Todos', avatar: undefined as string | undefined }].concat(
    clientes.map((c) => ({ id: c.id, nome: c.name, avatar: c.avatar }))
  );

  return (
    <div className="px-4 sm:px-6 pt-2 sm:pt-4">
      {/* Rola na horizontal porque a lista cresce com a agência, e empilhar
          clientes em duas linhas empurraria o quadro para baixo justamente em
          quem tem mais trabalho para ver. */}
      <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-1">
        {itens.map((item) => {
          const ativo = selecionado === item.id;

          return (
            <button
              key={item.id}
              type="button"
              // Clicar no que já está selecionado volta para "Todos": é o
              // atalho de quem filtrou sem querer, e não custa nada a quem
              // não souber dele.
              onClick={() => aoSelecionar(ativo && item.id !== 'all' ? 'all' : item.id)}
              title={item.nome}
              aria-label={item.nome}
              aria-pressed={ativo}
              className="flex flex-col items-center gap-1.5 shrink-0 w-11 sm:w-16 group cursor-pointer"
            >
              {item.id === 'all' ? (
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ${
                    ativo ? 'ring-2 ring-purple-600' : ''
                  }`}
                >
                  <Users className="w-5 h-5" />
                </span>
              ) : (
                /* O anel é o mesmo da seleção da grade do Instagram — o
                   vocabulário de seleção deste produto, não um inventado. */
                <Avatar
                  nome={item.nome}
                  url={item.avatar}
                  tamanho={44}
                  className={ativo ? 'ring-2 ring-purple-600' : ''}
                />
              )}

              {/* O nome inteiro não cabe, e cortar é melhor que quebrar em
                  duas linhas: a faixa teria alturas diferentes por item. O
                  `title` entrega o nome completo.

                  **Abaixo do `sm` ele some, e a faixa encolhe de 85 para 52
                  pixels.** Num telefone esses 33px são um terço de um card, e
                  o quadro só mostrava dois. O que fica é o avatar — que este
                  arquivo já argumenta ser reconhecido antes de qualquer texto,
                  com cor estável e iniciais para quem não tem foto — mais o
                  `title` e o `aria-label`, que é o que o leitor de tela lê. */}
              <span
                aria-hidden
                className={`hidden sm:block text-[11px] leading-tight text-center truncate w-full ${
                  ativo
                    ? 'font-bold text-purple-700 dark:text-purple-300'
                    : 'font-medium text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.nome}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
