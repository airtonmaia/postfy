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
  /** Cliente da prévia. Sem ele, só o copiar aparece. */
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
  const { visualizarPortalDoCliente, currentWorkspace } = usePostfy();
  const [copiado, setCopiado] = useState(false);

  const slug = currentWorkspace?.slug;

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

  const juntarEsquerda = destaque ? 'rounded-r-none' : 'rounded-r-none';
  const juntarDireita = 'rounded-l-none border-l';

  return (
    <div
      className={
        lateral
          ? 'flex items-stretch w-full rounded-xl overflow-hidden'
          : 'inline-flex items-stretch'
      }
    >
      {clientId && (
        <Button
          variant={variantePrimitivo}
          size={tamanho}
          onClick={() => visualizarPortalDoCliente(clientId)}
          className={`${juntarEsquerda} ${lateral ? 'flex-1 min-w-0 justify-start py-2' : ''}`}
          title="Abrir a prévia numa aba nova, com a marca da agência"
        >
          <ExternalLink className={destaque ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          <span className={lateral ? 'truncate' : undefined}>{rotulo}</span>
        </Button>
      )}

      <Button
        variant={variantePrimitivo}
        size={tamanho}
        onClick={copiar}
        disabled={!slug}
        className={`${lateral ? 'py-2' : ''} ${
          clientId
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
        {/* Na barra lateral o rótulo encurta: "Copiar link" ao lado de
            "Portal do Cliente" não cabe nos 232px úteis da coluna. */}
        <span>{copiado ? 'Copiado!' : lateral ? 'Copiar' : 'Copiar link'}</span>
      </Button>
    </div>
  );
};
