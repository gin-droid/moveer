import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4 pt-safe pb-safe">
      <div className="max-w-md w-full p-8 bg-card rounded-2xl shadow-lg border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-400/15">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-semibold text-foreground mb-4">Accesso riservato</h1>
          <p className="text-muted-foreground mb-8">
            Non sei registrato per utilizzare questa applicazione. Contatta l'amministratore dell'app per richiedere l'accesso.
          </p>
          <div className="p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground text-left">
            <p>Se ritieni sia un errore, puoi:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verificare di aver effettuato l'accesso con l'account corretto</li>
              <li>Contattare l'amministratore dell'app per l'accesso</li>
              <li>Provare a uscire e rientrare</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;