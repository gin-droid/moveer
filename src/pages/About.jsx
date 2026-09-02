import { Link } from "react-router-dom";
import { Video, Activity, Dumbbell, Shield } from "lucide-react";

export default function About() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-tight">Chi siamo</h1>

      <div className="space-y-4 text-muted-foreground leading-relaxed text-[15px]">
        <p>
          <strong className="text-white">moVeerAI</strong> è una piattaforma di analisi del movimento guidata
          dall'intelligenza artificiale, progettata per aiutare atleti, personal trainer e appassionati di fitness
          a migliorare la tecnica di esecuzione degli esercizi e prevenire gli infortuni. Attraverso l'analisi
          biomeccanica del video, l'IA rileva gli errori posturali, calcola lo stress articolare e restituisce
          un report dettagliato con correzioni mirate ed esercizi correttivi personalizzati.
        </p>
        <p>
          Il nostro motore di analisi combina visione artificiale, modelli biomeccanici deterministici e — sui
          dispositivi compatibili — dati di profondità LiDAR/ToF e sensori wearable Bluetooth per una valutazione
          tridimensionale della postura. Ogni report include un diagramma corporeo interattivo che evidenzia
          le giunzioni sotto stress e i segmenti disallineati, oltre a raccomandazioni pratiche per progredire
          nel tempo e confrontare i progressi tra le sessioni.
        </p>
        <p>
          moVeerAI è pensato per chi vuole allenarsi in modo più consapevole: dal principiante che impara i
          fondamentali del movimento, all'atleta avanzato che cerca il perfezionamento tecnico, fino al coach
          che vuole supportare i propri clienti con feedback oggettivo e misurabile. Il catalogo integrato
          copre forza, powerlifting, body building, calisthenics, cardio, mobilità, kettlebell ed esercizi
          posturali, con un mentor virtuale disponibile per guidare ogni fase dell'allenamento.
        </p>
        <p>
          Sviluppiamo moVeerAI con l'obiettivo di rendere l'analisi biomeccanica professionale accessibile a
          tutti, direttamente dal proprio smartphone, senza bisogno di laboratori o strumentazione costosa.
          Crediamo che una tecnica corretta sia la base di ogni risultato duraturo e che la tecnologia possa
          dare a chiunque gli strumenti per allenarsi in modo più sicuro ed efficace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Feature icon={Video} title="Analisi IA" desc="Valutazione automatica di postura e tecnica dal video" />
        <Feature icon={Activity} title="Biomeccanica 3D" desc="Stress articolare e angoli misurati in tempo reale" />
        <Feature icon={Dumbbell} title="Catalogo completo" desc="Oltre 500 esercizi con istruzioni e demo" />
        <Feature icon={Shield} title="Prevenzione infortuni" desc="Correzioni mirate ed esercizi correttivi" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
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

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{desc}</div>
    </div>
  );
}