import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

import { Button } from '../ui/button';
import { usePostfy } from '../../context/PostfyContext';
import { urlDoPortalDaAgencia } from '../../lib/rotas';

/**
 * Abrir a prévia do portal, e copiar o link que vai para o cliente.
 *
 * São duas coisas diferentes coladas no mesmo lugar de propósito, porque a
 * confusão entre elas já custou caro:
 *
 *   - **Prévia** é interna. Abre o portal de um cliente específico, e só
 *     funciona para quem já está logado como equipe.
 *   - **Copiar link** é o endereço que se manda ao cliente. Não leva cliente
 *     nenhum: leva a agência, e quem chega prova quem é pelo código no
 *     e-mail. É o código que decide o que ele enxerga.
 *
 * O link com o id do cliente dentro é o erro que estava em produção — o
 * portal espera o token opaco, não o id, e o cliente caía numa tela vazia.
 * Aqui não há como errar: o botão de copiar não tem cliente para colocar.
 */

interface Props {
  /**
   * Cliente da prévia. Sem ele, cai no primeiro da lista — os dois botões
   * aparecem sempre. Escondê-los quando não há cliente escolhido já foi
   * tentado, e some com o botão no caso mais comum: o filtro em "todos".
   */
  clientId?: string;
  /**
   * `discreto` para barra de ações, `destaque` para o topo de uma tela,
   * `lateral` para a coluna estreita da barra lateral — ali o par ocupa a
   * largura toda e divide o espaço, senão os dois rótulos não cabem.
   */
  variante?: 'discreto' | 'destaque' | 'lateral';
  rotulo?: string;
}

export const BotaoDoPortal: React.FC<Props> = ({
  clientId,
  variante = 'discreto',
  rotulo = 'Portal do Cliente',
}) => {
  const { visualizarPortalDoCliente, currentWorkspace, clients } = usePostfy();
  const [copiado, setCopiado] = useState(false);

  const slug = currentWorkspace?.slug;

  /**
   * Qual cliente a prévia abre.
   *
   * Sem `clientId` — a barra lateral com o filtro em "todos", que é o padrão —
   * cai no primeiro da lista. A primeira tentativa de consertar isso escondeu
   * o botão nesse caso, e o resultado foi pior: para a maioria das pessoas, na
   * maior parte do tempo, o botão simplesmente não existia.
   *
   * O problema nunca foi abrir o primeiro: era não dizer qual. O `title`
   * abaixo diz o nome, então deixa de ser surpresa.
   */
  const alvo = clientId
    ? clients.find((c) => c.id === clientId) ?? null
    : clients[0] ?? null;

  const copiar = async () => {
    if (!slug) return;
    const link = urlDoPortalDaAgencia(slug, window.location.origin);

    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // `navigator.clipboard` exige contexto seguro e permissão, e falha
      // calada em alguns navegadores. O campo temporário funciona em todos —
      // sem ele o clique não faria nada e ninguém saberia por quê.
      const campo = document.createElement('textarea');
      campo.value = link;
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(campo);
      }
    }

    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const destaque = variante === 'destaque';
  const lateral = variante === 'lateral';

  /**
   * A variante do `Button` carrega cor, tipografia e foco. O que sobra aqui é
   * só o que é deste par e o primitivo não tem como saber: o canto reto do
   * lado que encosta no vizinho, e a divisão de largura na barra lateral.
   */
  const variantePrimitivo = destaque ? 'primary' : ('soft' as const);
  const tamanho = destaque ? ('md' as const) : ('sm' as const);

  /**
   * Na barra lateral os dois ficam soltos, com respiro entre eles. Nas outras
   * variantes eles são um par colado, com o canto reto do lado que encosta.
   *
   * Colado é melhor quando os dois cabem com rótulo: lê como uma coisa só com
   * duas ações. Na coluna estreita não cabem, o da direita fica só com ícone,
   * e aí colado ele some dentro do vizinho — foi o que fez o copiar passar
   * despercebido antes.
   */
  const juntarEsquerda = lateral ? '' : 'rounded-r-none';
  const juntarDireita = lateral ? '' : 'rounded-l-none border-l';

  return (
    <div
      className={
        lateral ? 'flex items-center gap-1.5 w-full' : 'inline-flex items-stretch'
      }
    >
      <Button
        variant={variantePrimitivo}
        size={tamanho}
        onClick={() => alvo && visualizarPortalDoCliente(alvo.id)}
        disabled={!alvo}
        className={`${juntarEsquerda} ${lateral ? 'flex-1 min-w-0 justify-start p-2.5' : ''}`}
        /* O nome do cliente vai no title porque o botão perdeu o badge
           "Prévia" — na coluna estreita ele não cabia ao lado do copiar — e
           porque com o filtro em "todos" o alvo não é óbvio olhando a tela. */
        title={
          alvo
            ? `Abrir a prévia do portal de ${alvo.name} numa aba nova, com a marca da agência`
            : 'Cadastre um cliente para ver a prévia do portal'
        }
      >
        <ExternalLink className={destaque ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        <span className={lateral ? 'truncate' : undefined}>{rotulo}</span>
      </Button>

      <Button
        variant={variantePrimitivo}
        size={tamanho}
        onClick={copiar}
        disabled={!slug}
        className={`${lateral ? 'p-2.5' : ''} ${
          !lateral
            ? `${juntarDireita} ${destaque ? 'border-purple-500' : 'border-purple-200 dark:border-purple-800'}`
            : ''
        }`}
        /* O title diz o que o link É, não o que o botão faz: o risco aqui é
           alguém achar que copiou o endereço da prévia que está vendo. */
        title={
          slug
            ? 'Copiar o link do portal para mandar ao cliente. Ele entra com o código que recebe por e-mail.'
            : 'Disponível quando a agência tiver um endereço definido'
        }
        aria-label="Copiar link do portal"
      >
        {copiado ? (
          <Check className={destaque ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        ) : (
          <Copy className={destaque ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        )}
        {/* Na barra lateral fica só o ícone: "Copiar link" ao lado de "Portal
            do Cliente" não cabe nos 232px úteis da coluna. O `title` e o
            `aria-label` seguram o significado. */}
        {!lateral && <span>{copiado ? 'Copiado!' : 'Copiar link'}</span>}
      </Button>
    </div>
  );
};
