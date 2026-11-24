import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-md border-l-2 border-emerald-400 pl-6">
        <p className="font-mono text-sm text-emerald-300">ERRORE 404</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Pagina non trovata</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">L’indirizzo richiesto non corrisponde a una pagina disponibile.</p>
        <Link to="/" className="mt-6 inline-flex items-center rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300">
          Torna alla home
        </Link>
      </div>
    </main>
  );
}