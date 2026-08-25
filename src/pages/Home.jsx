import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Video, Dumbbell, FileText, ArrowRight, AlertTriangle, Activity } from "lucide-react";
import GenderOnboarding from "@/components/GenderOnboarding";

export default function Home() {
  const [reports, setReports] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, e] = await Promise.all([
          base44.entities.AnalysisReport.list("-created_date", 5),
          base44.entities.Exercise.list("-created_date", 500),
        ]);
        setReports(r);
        setExercises(e);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const avgScore = reports.length
    ? Math.round(reports.reduce((s, r) => s + (r.score || 0), 0) / reports.length)
    : null;

  const macros = [...new Set(exercises.map((e) => e.macro_category))].length;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-6 sm:p-8 md:p-12 shadow-[0_0_70px_-20px_hsl(var(--primary))]">
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Video className="w-3.5 h-3.5" /> Analisi IA
          </span>
          <h1 className="mt-5 font-display text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight text-white max-w-2xl leading-[1.05]">
            Allena meglio.<br />Correggi la postura, una ripetizione alla volta.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl text-[15px] leading-relaxed">
            Carica un video della tua esecuzione: l'intelligenza artificiale analizza tecnica e postura,
            individua gli errori e ti restituisce un report con esercizi correttivi mirati.
          </p>
          <div className="mt-7">
            <Link
              to="/analizza"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-5 py-3 rounded-xl transition-colors shadow-lg shadow-primary/20"
            >
              <Video className="w-4 h-4" /> Avvia analisi
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Analisi effettuate" value={loading ? "—" : reports.length} icon={FileText} />
        <ScoreStat value={loading || avgScore === null ? null : avgScore} />
        <StatCard label="Esercizi in catalogo" value={loading ? "—" : exercises.length} icon={Dumbbell} />
        <StatCard label="Macro-categorie" value={loading ? "—" : macros} icon={Activity} />
      </section>

      {/* Catalog CTA */}
      <Link
        to="/esercizi"
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Dumbbell className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-white">Esplora il catalogo</div>
          <div className="text-sm text-muted-foreground">{loading ? "…" : `${exercises.length} esercizi in ${macros} macro-categorie`}</div>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </Link>

      {/* Recent reports */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold tracking-tight text-white">Analisi recenti</h2>
          <Link to="/report" className="text-sm text-primary hover:text-primary/80 inline-flex items-center gap-1">
            Tutti <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="text-muted-foreground text-sm">Caricamento…</div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nessuna analisi ancora. Avvia la prima per vedere qui i tuoi progressi.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((r) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-secondary">{r.macro_category}</div>
                    <div className="font-display font-semibold text-white mt-1 truncate">{r.exercise_name}</div>
                  </div>
                  <ScoreBadge score={r.score} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{r.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <GenderOnboarding />
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5 text-primary" />
        <Sparkline />
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-display font-semibold text-white">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function ScoreStat({ value }) {
  const s = value ?? 0;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-display font-semibold text-white">
          {value === null ? "—" : s}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-2xl sm:text-3xl font-display font-semibold text-white leading-none">
          {value === null ? "—" : s}
          <span className="text-sm text-muted-foreground font-body font-normal">/100</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">Punteggio medio</div>
      </div>
    </div>
  );
}

function Sparkline() {
  return (
    <svg width="44" height="22" viewBox="0 0 44 22" className="overflow-visible">
      <polyline
        points="0,18 9,12 18,15 27,7 35,10 44,4"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 75 ? "text-primary bg-primary/10" : score >= 50 ? "text-secondary bg-secondary/10" : "text-rose-400 bg-rose-400/10";
  return <span className={`text-sm font-display font-semibold px-2.5 py-1 rounded-lg ${color}`}>{score}</span>;
}