import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Video, Dumbbell, FileText, ArrowRight, AlertTriangle, Activity, ShieldCheck } from "lucide-react";
import GenderOnboarding from "@/components/GenderOnboarding";
import { useAuth } from "@/lib/AuthContext";
import { loadPreferredExercises } from "@/lib/exercisePreferences";
import { cacheReportList, getCachedReportList } from "@/lib/reportCache";
import TermsContent from "@/components/TermsContent";
import PrivacyContent from "@/components/PrivacyContent";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function Home() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, e] = await Promise.all([
          base44.entities.AnalysisReport.list("-created_date", 5),
          loadPreferredExercises(user),
        ]);
        setReports(r);
        setExercises(e);
        cacheReportList(r);
      } catch (err) {
        const cached = getCachedReportList().slice(0, 5);
        if (cached.length > 0) setReports(cached);
        else console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const avgScore = reports.length
    ? Math.round(reports.reduce((s, r) => s + (r.score || 0), 0) / reports.length)
    : null;

  const macros = [...new Set(exercises.map((e) => e.macro_category))].length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/30 bg-card p-4 sm:p-6 md:p-10 shadow-lg shadow-primary/10">
        <div className="absolute -right-16 -top-16 w-48 h-48 sm:w-72 sm:h-72 bg-primary/15 rounded-full blur-2xl z-0 pointer-events-none" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Video className="w-3.5 h-3.5" /> Analisi IA
          </span>
          <h1 className="mt-3 sm:mt-5 font-display text-xl sm:text-3xl md:text-5xl font-semibold tracking-tight text-white max-w-2xl leading-[1.1]">
            Allenati meglio.<br />Correggi la postura, una ripetizione alla volta.
          </h1>
          <p className="mt-3 sm:mt-4 text-muted-foreground max-w-xl text-sm sm:text-[15px] leading-relaxed">
            Carica un video della tua esecuzione: l'intelligenza artificiale analizza tecnica e postura,
            individua gli errori e ti restituisce un report con esercizi correttivi mirati.
          </p>
          <div className="mt-5 sm:mt-7">
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
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <Link to="/report" className="block">
          <StatCard label="Analisi effettuate" value={loading ? "—" : reports.length} icon={FileText} />
        </Link>
        <Link to="/report" className="block">
          <ScoreStat value={loading || avgScore === null ? null : avgScore} />
        </Link>
        <Link to="/esercizi" className="block">
          <StatCard label="Esercizi in catalogo" value={loading ? "—" : exercises.length} icon={Dumbbell} />
        </Link>
        <Link to="/esercizi" className="block">
          <StatCard label="Macro-categorie" value={loading ? "—" : macros} icon={Activity} />
        </Link>
      </section>

      {/* Recent reports */}
      <section>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-white">Analisi recenti</h2>
          <Link to="/report" className="text-sm text-primary hover:text-primary/80 inline-flex items-center gap-1">
            Tutti <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="text-muted-foreground text-sm">Caricamento…</div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 sm:p-10 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nessuna analisi ancora. Avvia la prima per vedere qui i tuoi progressi.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {reports.map((r) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="group rounded-2xl border border-border bg-card p-3.5 sm:p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-secondary">{r.macro_category}</div>
                    <div className="font-display font-semibold text-white mt-1 truncate">{r.exercise_name}</div>
                  </div>
                  <ScoreBadge score={r.score} />
                </div>
                <p className="mt-2.5 sm:mt-3 text-sm text-muted-foreground line-clamp-2">{r.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <GenderOnboarding />

      {/* Legal links */}
      <footer className="pt-2 pb-1 flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => setTermsOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> Termini d'uso
          </button>
          <button
            onClick={() => setPrivacyOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Privacy &amp; Policy
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 text-center">
          © {new Date().getFullYear()} moVeerAI — Analisi biomeccanica guidata dall'IA
        </p>
      </footer>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-white">Termini d'uso</DialogTitle>
          </DialogHeader>
          <TermsContent />
        </DialogContent>
      </Dialog>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-white">Privacy &amp; Policy</DialogTitle>
          </DialogHeader>
          <PrivacyContent />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-3.5 h-full transition-colors hover:border-primary/40 hover:bg-sidebar-accent">
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-primary" />
        <Sparkline />
      </div>
      <div className="mt-2 sm:mt-2.5 text-lg sm:text-xl font-display font-semibold text-white">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function ScoreStat({ value }) {
  const s = value ?? 0;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3 h-full transition-colors hover:border-primary/40 hover:bg-sidebar-accent">
      <div className="relative w-11 h-11 sm:w-12 sm:h-12 shrink-0">
        <svg className="w-11 h-11 sm:w-12 sm:h-12 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-display font-semibold text-white">
          {value === null ? "—" : s}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-lg sm:text-xl font-display font-semibold text-white leading-none">
          {value === null ? "—" : s}
          <span className="text-xs text-muted-foreground font-body font-normal">/100</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">Punteggio medio</div>
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