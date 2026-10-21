import { Component } from 'react';
import { isChunkLoadError } from '@/lib/lazyWithRetry';

/** @extends {Component<{ children?: import('react').ReactNode }, { error: any }>} */
export default class AppErrorBoundary extends Component {
  /** @param {{ children?: import('react').ReactNode }} props */
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  /** @param {any} error */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /** @param {any} error */
  componentDidCatch(error) {
    console.error('Errore di caricamento della pagina:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkError = isChunkLoadError(this.state.error);
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-display text-2xl font-semibold text-white">
            {chunkError ? 'Nuova versione disponibile' : 'Impossibile caricare la pagina'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {chunkError
              ? 'L’app è stata aggiornata oppure la connessione si è interrotta. Ricarica per continuare.'
              : 'Si è verificato un errore imprevisto. Ricarica la pagina per riprovare.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Ricarica
          </button>
        </div>
      </div>
    );
  }
}
