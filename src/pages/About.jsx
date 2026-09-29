import { Link } from "react-router-dom";
import { Video, Activity, Dumbbell, Shield, Sparkles, Target, Users } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

export default function About() {
  useSEO({
    title: "Chi siamo — moVeerAI | Analisi biomeccanica IA",
    description:
      "moVeerAI è la piattaforma IA di analisi biomeccanica del movimento: rileva errori posturali, calcola lo stress articolare e restituisce correzioni mirate ed esercizi correttivi per atleti, trainer e appassionati di fitness.",
    path: "/about",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "moVeerAI",
      url: "https://moveer.base44.app",
      description:
        "Analisi biomeccanica del movimento guidata dall'IA per postura e tecnica di allenamento.",
      applicationCategory: "HealthApplication",
      operatingSystem: "iOS, Android, Web",
      inLanguage: "it-IT",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
  });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-tight">Chi siamo</h1>
        <p className="mt-2 text-primary text-sm font-medium uppercase tracking-[0.15em]">moVeerAI</p>
      </div>

      {/* Cos'è */}
      <Section icon={Sparkles} title="Cos'è">
        <p>
          <strong className="text-white">moVeerAI</strong> è una piattaforma di analisi del movimento guidata
          dall'intelligenza artificiale. Attraverso l'analisi biomeccanica del video, l'IA rileva gli errori
          posturali, calcola lo stress articolare e restituisce un report dettagliato con correzioni mirate ed
          esercizi correttivi personalizzati.
        </p>
        <p>
          Il motore di analisi combina visione artificiale, modelli biomeccanici deterministici e — sui
          dispositivi compatibili — dati di profondità LiDAR/ToF e sensori wearable Bluetooth per una
          valutazione tridimensionale della postura.
        </p>
      </Section>

      {/* Cosa fa */}
      <Section icon={Activity} title="Cosa fa">
        <p>
          moVeerAI analizza un video della tua esecuzione e produce un report completo che include:
        </p>
        <ul className="space-y-2 mt-3">
          <li className="flex items-start gap-2.5">
            <Video className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Valutazione automatica di postura e tecnica con punteggio di esecuzione da 0 a 100.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Diagramma corporeo interattivo che evidenzia le giunzioni sotto stress e i segmenti disallineati.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Correzioni mirate ed esercizi correttivi selezionati dal catalogo in base ai difetti rilevati.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Raccomandazioni pratiche per progredire nel tempo e confrontare i progressi tra le sessioni.</span>
          </li>
        </ul>
        <p className="mt-3">
          Il catalogo integrato copre forza, powerlifting, body building, calisthenics, cardio, mobilità,
          kettlebell ed esercizi posturali, con un mentor virtuale disponibile per guidare ogni fase
          dell'allenamento.
        </p>
      </Section>

      {/* Per chi è */}
      <Section icon={Users} title="Per chi è">
        <p>moVeerAI è pensato per chi vuole allenarsi in modo più consapevole:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <AudienceCard
            icon={Dumbbell}
            title="Principianti"
            desc="Imparano i fondamentali del movimento in modo sicuro fin dal primo allenamento."
          />
          <AudienceCard
            icon={Activity}
            title="Atleti avanzati"
            desc="Cercano il perfezionamento tecnico e il monitoraggio oggettivo dei progressi."
          />
          <AudienceCard
            icon={Users}
            title="Coach e trainer"
            desc="Supportano i propri clienti con feedback oggettivo, misurabile e documentato."
          />
        </div>
      </Section>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-muted-foreground leading-relaxed text-[15px]">
          Sviluppiamo moVeerAI con l'obiettivo di rendere l'analisi biomeccanica professionale accessibile a
          tutti, direttamente dal proprio smartphone, senza bisogno di laboratori o strumentazione costosa.
          Crediamo che una tecnica corretta sia la base di ogni risultato duraturo e che la tecnologia possa
          dare a chiunque gli strumenti per allenarsi in modo più sicuro ed efficace.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
        >
          Inizia ad analizzare
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center gap-2 border border-border bg-card hover:bg-sidebar-accent text-foreground font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
        >
          Contattaci
        </Link>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-display text-xl font-semibold text-white tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3 text-muted-foreground leading-relaxed text-[15px] pl-0.5">
        {children}
      </div>
    </section>
  );
}

function AudienceCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{desc}</div>
    </div>
  );
}