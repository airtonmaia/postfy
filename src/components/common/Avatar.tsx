import React, { useEffect, useState } from 'react';

/**
 * Foto de alguém — ou as iniciais, quando não há foto.
 *
 * Existia um `<img src={cliente.avatar}>` solto em quinze telas. Sem foto, o
 * `src` fica vazio e o navegador desenha o ícone de imagem quebrada: o
 * calendário, o kanban e o portal do cliente mostravam esse ícone ao lado do
 * nome de quem ainda não tinha subido nada.
 *
 * A saída anterior era pior: um retrato do Unsplash como padrão. Isso põe a
 * foto de um desconhecido no lugar de um cliente da agência, e depende de um
 * servidor de terceiro para desenhar a tela.
 *
 * Iniciais num fundo derivado do nome resolvem os dois: não dependem de rede,
 * dizem de quem é, e a mesma pessoa recebe sempre a mesma cor — o olho passa
 * a reconhecer o cliente pela cor antes de ler o nome.
 */

/**
 * Paleta fechada, e nenhuma cor inventada: são os mesmos tons que o app já
 * usa em badge e gráfico. Escolhida pelo nome, não sorteada — sorteio mudaria
 * a cor a cada render.
 */
const FUNDOS = [
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
];

const corDoNome = (nome: string): string => {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i)) % 997;
  return FUNDOS[soma % FUNDOS.length];
};

/**
 * Duas letras: a inicial do primeiro nome e a do último.
 *
 * "Ana Paula Souza" vira AS, e não AP — o sobrenome distingue mais numa
 * lista de clientes que o segundo nome.
 */
export const iniciaisDe = (nome: string): string => {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

interface Props {
  nome: string;
  url?: string | null;
  /** Lado do quadrado, em px. */
  tamanho?: number;
  /** `circulo` para pessoa, `quadrado` para marca de cliente. */
  formato?: 'circulo' | 'quadrado';
  className?: string;
}

export const Avatar: React.FC<Props> = ({
  nome,
  url,
  tamanho = 32,
  formato = 'circulo',
  className = '',
}) => {
  const canto = formato === 'circulo' ? 'rounded-full' : 'rounded-lg';
  const estilo = { width: tamanho, height: tamanho };

  /**
   * Endereço que deixou de existir cai nas iniciais.
   *
   * Em estado, e não mexendo no DOM pelo `onError`: o React remonta o
   * elemento a cada render e desfaria o `style.display` escrito na mão, então
   * o ícone quebrado voltaria no próximo render da lista.
   */
  const [falhou, setFalhou] = useState(false);

  // Trocar de pessoa na mesma posição da lista tem que voltar a tentar a
  // foto — senão o cliente seguinte herda a falha do anterior.
  useEffect(() => setFalhou(false), [url]);

  if (url && !falhou) {
    return (
      <img
        src={url}
        alt=""
        style={estilo}
        className={`${canto} object-cover shrink-0 bg-slate-100 dark:bg-slate-800 ${className}`}
        onError={() => setFalhou(true)}
      />
    );
  }

  return (
    <span
      style={estilo}
      className={`${canto} ${corDoNome(nome)} shrink-0 inline-flex items-center justify-center font-bold select-none ${className}`}
      // A fonte acompanha o tamanho: iniciais fixas em 12px somem num avatar
      // de 64 e vazam de um de 16.
      title={nome || undefined}
    >
      <span style={{ fontSize: Math.max(9, Math.round(tamanho * 0.38)) }}>
        {iniciaisDe(nome)}
      </span>
    </span>
  );
};
