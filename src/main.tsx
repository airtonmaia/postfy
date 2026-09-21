import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';
import { iniciarAnalytics } from './lib/analytics';

// Sem VITE_POSTHOG_KEY isto é um no-op: o app funciona igual sem analytics.
iniciarAnalytics();

/**
 * Registra o service worker no carregamento.
 *
 * Não é só pelo push — `ativarNotificacoes` registra por conta própria
 * quando a pessoa liga. É pela **instalação**: o navegador só oferece
 * "instalar o app" quando já existe um SW registrado, e sem isto o convite
 * só apareceria depois de alguém abrir Preferências e ligar notificação.
 * Quem quer o ícone na tela de início não passa por lá.
 *
 * Falhar aqui não pode atrapalhar nada: sem SW o produto é o site de sempre.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* O atraso é compartilhado por todos os tooltips: percorrer uma fileira
          de ícones abre o segundo na hora, em vez de esperar de novo. */}
      <TooltipProvider delayDuration={300} skipDelayDuration={500}>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
);

