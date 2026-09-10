import React from 'react';

/**
 * Marca do Orquesia.
 *
 * A tela de cadastro trazia isto:
 *
 *     const orquesiaLogo = 'https://i.pinimg.com/736x/dd/6e/b3/dd6eb...jpg';
 *
 * Um link do Pinterest. Além de não ser a marca do produto — quem se
 * cadastrava via uma foto qualquer no lugar dela —, é um endereço de terceiro
 * que some, muda de conteúdo ou vira 404 sem aviso, na primeira tela que um
 * cliente novo vê. E é imagem de outra pessoa.
 *
 * Aqui é SVG local: não depende de rede, escala em qualquer tamanho, e
 * acompanha o tema.
 *
 * O desenho é o mesmo padrão que o resto do app já usa para marca — quadrado
 * arredondado com a inicial — para a tela de entrada não destoar do que a
 * pessoa encontra depois de entrar.
 */

interface Props {
  /** Lado do quadrado, em px. */
  tamanho?: number;
  className?: string;
}

export const MarcaOrquesia: React.FC<Props> = ({ tamanho = 44, className = '' }) => (
  <svg
    width={tamanho}
    height={tamanho}
    viewBox="0 0 48 48"
    fill="none"
    role="img"
    aria-label="Orquesia"
    className={className}
  >
    <rect width="48" height="48" rx="13" fill="url(#marcaOrquesia)" />
    {/* O "O" é um anel, não a letra de uma fonte: fonte varia por sistema, e
        a marca não pode mudar de forma conforme a máquina de quem abre. */}
    <circle cx="24" cy="24" r="10" stroke="#fff" strokeWidth="4.5" fill="none" />
    {/* A falha à direita transforma o anel num "O" com corte — o que separa a
        marca de um círculo genérico. */}
    <rect x="30" y="19.5" width="8" height="9" rx="1" fill="url(#marcaOrquesia)" />
    <circle cx="34" cy="24" r="3.5" fill="#fff" />
    <defs>
      <linearGradient id="marcaOrquesia" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7c3aed" />
        <stop offset="1" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
  </svg>
);
