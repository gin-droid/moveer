import {
  Activity,
  Cloud,
  Database,
  ExternalLink,
  GitBranch,
  KeyRound,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const groups = [
  {
    title: "moVeerAI",
    icon: Activity,
    links: [
      { label: "Apri l'app", detail: "Dashboard e analisi", url: "https://app.moveer.eu/" },
      { label: "Lista d'attesa", detail: "Sito pubblico", url: "https://www.moveer.eu/" },
    ],
  },
  {
    title: "GitHub",
    icon: GitBranch,
    links: [
      { label: "Repository moveer", detail: "Codice sorgente", url: "https://github.com/gin-droid/moveer" },
      { label: "Deploy Pages", detail: "Workflow e stato pubblicazione", url: "https://github.com/gin-droid/moveer/actions/workflows/deploy.yml" },
      { label: "Impostazioni Pages", detail: "Dominio e sorgente deploy", url: "https://github.com/gin-droid/moveer/settings/pages" },
    ],
  },
  {
    title: "Supabase",
    icon: Database,
    links: [
      { label: "Progetti", detail: "Apri il progetto moVeerAI", url: "https://supabase.com/dashboard/projects" },
      { label: "Provider Google", detail: "Authentication e provider", url: "https://supabase.com/dashboard/projects" },
    ],
  },
  {
    title: "Google Cloud",
    icon: Cloud,
    links: [
      { label: "Credenziali OAuth", detail: "Client ID e URI autorizzati", url: "https://console.cloud.google.com/apis/credentials" },
      { label: "Branding OAuth", detail: "Nome e schermata consenso", url: "https://console.cloud.google.com/auth/branding" },
      { label: "Pubblico e test user", detail: "Audience dell'app OAuth", url: "https://console.cloud.google.com/auth/audience" },
      { label: "Client OAuth", detail: "Configurazione applicazioni web", url: "https://console.cloud.google.com/auth/clients" },
    ],
  },
];

function LinkGroup({ group }) {
  const Icon = group.icon;

  return (
    <section aria-labelledby={`links-${group.title}`}>
      <h2 id={`links-${group.title}`} className="flex items-center gap-2 border-b border-border pb-3 font-display text-base font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {group.title}
      </h2>
      <ul>
        {group.links.map((link) => (
          <li key={link.url + link.label}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 border-b border-border/70 py-3 text-sm transition-colors hover:text-primary"
            >
              <span>
                <span className="block font-medium">{link.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{link.detail}</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ManagementLinks() {
  useSEO({
    title: "Collegamenti di gestione — moVeerAI",
    description: "Accessi rapidi ai servizi di gestione di moVeerAI.",
    path: "/gestione",
  });

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase text-primary">moVeerAI</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-white">Centro di gestione</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Accessi rapidi ai servizi collegati all'app. Ogni servizio richiede l'accesso al relativo account.
        </p>
      </header>

      <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
        {groups.map((group) => <LinkGroup key={group.title} group={group} />)}
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Le credenziali restano sui rispettivi servizi.</span>
      </footer>
    </div>
  );
}