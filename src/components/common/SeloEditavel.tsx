import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';

/**
 * Um selo que troca de valor ao ser clicado.
 *
 * O cabeçalho do conteúdo já mostrava rede, formato, versão e prioridade em
 * selo — e nenhum deles dava para mudar ali. Quem quisesse corrigir o formato
 * de uma peça precisava abrir outra tela, o mesmo caminho longo que o
 * `CampoEditavel` resolveu para os textos.
 *
 * **Não é um `CampoEditavel` com `tipo="selecao"`, e isso é decisão.** O
 * `<select>` nativo não tem a cara do selo: ele é uma caixa cinza do sistema
 * operacional, com a seta e a fonte que o aparelho escolher — no meio de uma
 * linha de selos coloridos, ele lê como um erro de renderização. O
 * `DropdownMenu` do shadcn já está no projeto, já fecha com `Esc`, já anda
 * com as setas e já devolve o foco ao gatilho.
 *
 * O gatilho é o **próprio selo**, recebido em `children`: assim o desenho
 * continua morando em `Badges.tsx` e este componente não conhece cor nenhuma
 * — o que também impede que ele vire o oitavo desenho de selo.
 */
export interface OpcaoDoSelo<T extends string> {
  valor: T;
  rotulo: string;
  /**
   * A opção desenhada como ela vai aparecer em tela — o próprio selo.
   *
   * É um nó pronto, e não um componente que recebe o valor: quem monta a lista
   * já sabe qual é o valor de cada linha, e a função com parâmetro obrigava a
   * carregar o genérico até dentro dela sem ganhar nada.
   */
  amostra?: React.ReactNode;
}

interface Props<T extends string> {
  valor: T;
  opcoes: OpcaoDoSelo<T>[];
  aoTrocar: (novo: T) => void;
  rotulo: string;
  children: React.ReactNode;
  desabilitado?: boolean;
}

export function SeloEditavel<T extends string>({
  valor,
  opcoes,
  aoTrocar,
  rotulo,
  children,
  desabilitado = false,
}: Props<T>) {
  if (desabilitado) return <>{children}</>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          O gatilho é um `<button>` à mão, não um `<Button>`: ele embrulha um
          selo de 20px e tem a altura dele, enquanto a escala do `Button`
          começa em 32px — é o papel "card clicável" que `tests/botoes.test.ts`
          nomeia, e a altura fixa cortaria o selo.
        */}
        <button
          type="button"
          aria-label={`Trocar ${rotulo.toLowerCase()}`}
          title={`Trocar ${rotulo.toLowerCase()}`}
          className="group inline-flex items-center gap-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
        >
          {children}
          {/* A seta só aparece no hover, como o lápis do `CampoEditavel`:
              sempre visível ela vira ruído numa linha com quatro selos. */}
          <ChevronDown className="w-3 h-3 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:text-purple-500 transition" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuLabel>{rotulo}</DropdownMenuLabel>

        {opcoes.map((o) => (
          <DropdownMenuItem key={o.valor} onSelect={() => aoTrocar(o.valor)}>
            {o.amostra ?? <span>{o.rotulo}</span>}
            {/* O escolhido é marcado, e o espaço dele fica reservado nos
                outros: sem isso a lista dança a cada abertura. */}
            <Check
              className={`w-3.5 h-3.5 ml-auto shrink-0 ${
                o.valor === valor ? 'text-purple-600' : 'opacity-0'
              }`}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
