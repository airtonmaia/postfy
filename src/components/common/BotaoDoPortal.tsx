import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

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
  /** `discreto` para barra de ações; `destaque` para o topo de uma tela. */
  variante?: 'discreto' | 'destaque';
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

  const classeAbrir = destaque
    ? 'flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-l-xl shadow-xs transition cursor-pointer'
    : 'flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-l-lg transition cursor-pointer';

  const classeCopiar = destaque
    ? 'flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-r-xl shadow-xs transition cursor-pointer border-l border-purple-500'
    : 'flex items-center px-2 py-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-r-lg transition cursor-pointer border-l border-purple-200 dark:border-purple-800';

  return (
    <div className="inline-flex items-center">
      {clientId && (
        <button
          onClick={() => visualizarPortalDoCliente(clientId)}
          className={classeAbrir}
          title="Abrir a prévia numa aba nova, com a marca da agência"
        >
          <ExternalLink className={destaque ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          <span>{rotulo}</span>
        </button>
      )}

      <button
        onClick={copiar}
        disabled={!slug}
        className={`${classeCopiar} ${clientId ? '' : 'rounded-l-lg border-l-0'} disabled:opacity-40 disabled:cursor-not-allowed`}
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
        {destaque && <span className="ml-1.5 text-xs font-bold">{copiado ? 'Copiado!' : 'Copiar link'}</span>}
      </button>
    </div>
  );
};
