import { useEffect } from 'react';
import { usePostfy } from '../../context/PostfyContext';

/**
 * Título da aba, descrição e canônica, em tempo de execução.
 *
 * O `index.html` que sai do build é um só — trocar o título do produto não
 * pode exigir deploy. Aqui as tags são escritas no `head` a partir do que
 * está no banco.
 *
 * Isto alcança o navegador e os buscadores que executam JavaScript (o Google
 * executa). **Não alcança os robôs de prévia de link** — WhatsApp, Facebook,
 * LinkedIn, Slack — que baixam o HTML cru e vão embora antes de qualquer
 * script rodar. Para eles existe `api/seo.ts`, que a Vercel serve pelo
 * user-agent. Os dois caminhos leem a mesma linha do banco de propósito: uma
 * prévia que diz uma coisa e uma aba que diz outra seria pior que nenhuma.
 */

const definirMeta = (chave: 'name' | 'property', valor: string, conteudo: string | null) => {
  const seletor = `meta[${chave}="${valor}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(seletor);

  if (!conteudo) {
    // Campo esvaziado na tela de SEO tem que sumir daqui também, senão o
    // valor antigo ficaria de pé até o próximo recarregamento completo.
    tag?.remove();
    return;
  }

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(chave, valor);
    document.head.appendChild(tag);
  }
  tag.content = conteudo;
};

const definirLink = (rel: string, href: string | null) => {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    if (rel === 'canonical') tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
};

export const SeoDoSaas: React.FC = () => {
  const { aparencia } = usePostfy();

  useEffect(() => {
    const nome = aparencia.nome || 'Orquesia';
    const titulo = aparencia.seoTitulo || `${nome} — gestão de agências de conteúdo`;
    const descricao = aparencia.seoDescricao;
    const canonica =
      aparencia.seoUrlCanonica ||
      (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : null);

    document.title = titulo;

    definirMeta('name', 'description', descricao);
    definirMeta('name', 'keywords', aparencia.seoPalavras);
    definirMeta('name', 'robots', aparencia.seoIndexar ? 'index, follow' : 'noindex, nofollow');

    definirMeta('property', 'og:type', 'website');
    definirMeta('property', 'og:site_name', nome);
    definirMeta('property', 'og:title', titulo);
    definirMeta('property', 'og:description', descricao);
    definirMeta('property', 'og:url', canonica);
    definirMeta('property', 'og:image', aparencia.seoImagemUrl);

    definirMeta('name', 'twitter:card', aparencia.seoImagemUrl ? 'summary_large_image' : 'summary');
    definirMeta('name', 'twitter:title', titulo);
    definirMeta('name', 'twitter:description', descricao);
    definirMeta('name', 'twitter:image', aparencia.seoImagemUrl);

    definirLink('canonical', canonica);

    // O favicon da agência sobrepõe este quando há agência aberta (ver o
    // efeito em App.tsx): dentro da agência o produto é whitelabel, e a aba
    // do navegador faz parte disso.
    definirLink('icon', aparencia.faviconUrl);
  }, [aparencia]);

  return null;
};
