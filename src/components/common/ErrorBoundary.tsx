import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Ops! Ocorreu um erro inesperado</h2>
              <p className="text-sm text-slate-400">
                A aplicação encontrou uma falha no processamento, mas seus dados estão protegidos.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="bg-slate-900/80 p-3 rounded-lg text-xs font-mono text-rose-300 text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <Button size="lg"
              onClick={this.handleReset}
              className="w-full hover:bg-purple-500 shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicação
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
