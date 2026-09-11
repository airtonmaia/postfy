import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';
import { iniciarAnalytics } from './lib/analytics';

// Sem VITE_POSTHOG_KEY isto é um no-op: o app funciona igual sem analytics.
iniciarAnalytics();

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

