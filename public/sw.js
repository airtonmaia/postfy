/*
  Service Worker do Orquesia.

  Ele existe por **um** motivo: receber push com o app fechado. Não há
  estratégia de cache aqui, e isso é decisão, não preguiça.

  Um SW que guarda o app em cache muda o jogo do deploy: a pessoa passa a
  rodar a versão que ficou guardada, e o `AvisoDeAtualizacao` — que compara a
  build do servidor com a da aba — passaria a comparar contra um arquivo que
  o próprio SW serve. O sintoma seria o pior conhecido aqui: botão que sumiu,
  tela que mudou de lugar, chamada para rota que já não existe, tudo com
  aparência de bug e sem ninguém entender por quê.

  Enquanto o produto depende do servidor em toda tela (o navegador fala
  direto com o Supabase), cache offline não compra quase nada e custa isso.
*/

self.addEventListener('install', () => {
  // Assume o lugar do SW anterior sem esperar a aba fechar. Sem isto, uma
  // correção aqui só valeria no próximo dia em que a pessoa fechasse o
  // Orquesia — e há quem não feche.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/*
  Este handler existe para o app **poder ser instalado**, e não para cachear
  coisa nenhuma.

  O Chrome só oferece a instalação quando há um service worker com handler de
  `fetch` registrado. Sem ele, o manifest está certo, o ícone está certo, e o
  convite simplesmente nunca aparece — sem erro, sem aviso no console, sem
  nada que explique.

  Ele não chama `respondWith`, então toda requisição segue para a rede como
  se o SW não existisse. É de propósito: ver o comentário no topo sobre por
  que não há cache aqui.
*/
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  /*
    O corpo pode não vir. Alguns serviços de push entregam evento vazio (é o
    caso de um "wake up" sem payload), e `event.data.json()` estoura ali —
    dentro de um SW, onde ninguém vê o erro. Com o `try`, o pior caso é uma
    notificação genérica em vez de nenhuma.
  */
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }

  const titulo = dados.title || 'Orquesia';

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      // O ícone vem no corpo, escolhido pelo dono do produto em
      // Admin → Design. O arquivo do repositório é a reserva — e ele precisa
      // existir, porque notificação sem ícone ganha um quadrado cinza do
      // sistema operacional.
      icon: dados.icon || '/icon-192.png',
      // O badge é o ícone monocromático da barra de status do Android. Sem
      // ele o sistema desenha um quadrado cinza no lugar.
      badge: dados.icon || '/icon-192.png',
      // Junta os avisos da mesma agência numa pilha só em vez de empilhar
      // dez cartões separados na tela de bloqueio.
      tag: 'orquesia',
      renotify: true,
      data: { url: dados.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destino = (event.notification.data && event.notification.data.url) || '/';

  /*
    Foca a aba que já existe em vez de abrir outra.

    Abrir sempre uma janela nova é o comportamento que faz a pessoa terminar
    a manhã com seis abas do Orquesia — e, pior aqui, seis abas cada uma com
    sua própria sondagem do sino e sua própria carga inicial.
  */
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ('focus' in aba) return aba.focus();
      }
      return self.clients.openWindow(destino);
    })
  );
});
