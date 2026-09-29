import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Check, X, Users, Video, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { PLANS, COSTS, TOTAL_BUILDER, TOTAL_PRO, BREAK_EVEN_SCENARIOS } from "@/lib/monetizationData";
import MonetizationPdfExport from "@/components/MonetizationPdfExport";

export default function Monetization() {
  const [authState, setAuthState] = useState({ loading: true, isAdmin: false });

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setAuthState({ loading: false, isAdmin: u?.role === "admin" });
      } catch {
        setAuthState({ loading: false, isAdmin: false });
      }
    })();
  }, []);

  if (authState.loading) {
    return <div className="text-muted-foreground text-sm">Caricamento…</div>;
  }
  if (!authState.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Piano di Monetizzazione</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xl">
            Strategia a 3 livelli per pubblicare moVeerAI su Google Play e App Store,
            coprire i costi della piattaforma e degli store, e rinnovare l'abbonamento anno per anno.
          </p>
        </div>
        <MonetizationPdfExport />
      </div>

      {/* Cost summary */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Costi annuali da coprire
        </h2>
        <div className="space-y-2.5">
          {Object.values(COSTS).map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-4 text-sm">
              <div>
                <span className="text-foreground font-medium">{c.label}</span>
                <span className="text-muted-foreground text-xs block">{c.note}</span>
              </div>
              <span className="text-foreground font-display font-semibold tabular-nums shrink-0">€{c.value}</span>
            </div>
          ))}
          <div className="pt-3 mt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-400 font-medium">Totale minimo (Builder + Store)</span>
              <span className="text-emerald-400 font-display font-bold text-lg tabular-nums">€{TOTAL_BUILDER}<span className="text-xs text-muted-foreground font-body font-normal">/anno</span></span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-400 font-medium">Totale massimo (Pro + Store)</span>
              <span className="text-amber-400 font-display font-bold text-lg tabular-nums">€{TOTAL_PRO}<span className="text-xs text-muted-foreground font-body font-normal">/anno</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section>
        <h2 className="font-display text-lg font-semibold text-white mb-4">Piani di abbonamento</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>

      {/* Break-even */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Analisi di pareggio (break-even)
        </h2>
        <div className="space-y-5">
          {BREAK_EVEN_SCENARIOS.map((s) => (
            <div key={s.target} className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">{s.targetLabel}</span>
                <span className="text-sm font-display font-bold text-primary tabular-nums">€{s.target}<span className="text-xs text-muted-foreground font-body font-normal">/anno</span></span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <div className="text-2xl font-display font-bold text-emerald-400">{s.proOnly}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">abbonati Pro</div>
                  <div className="text-[10px] text-emerald-400/70 mt-0.5">€{s.proOnly * 99}/anno</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <div className="text-2xl font-display font-bold text-amber-400">{s.coachOnly}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">abbonati Coach</div>
                  <div className="text-[10px] text-amber-400/70 mt-0.5">€{s.coachOnly * 199}/anno</div>
                </div>
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <div className="text-2xl font-display font-bold text-primary">{s.mixed.pro}+{s.mixed.coach}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Pro + Coach</div>
                  <div className="text-[10px] text-primary/70 mt-0.5">€{s.mixedRevenue}/anno</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-white mb-3">Note e strategia</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><span className="text-primary">•</span> Il piano <strong className="text-foreground">Freemium</strong> serve come funnel: attira utenti senza costi e li converte verso Pro/Coach.</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Il piano <strong className="text-foreground">Pro</strong> è il punto di equilibrio: prezzo accessibile che copre i costi con pochi abbonati.</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Il piano <strong className="text-foreground">Coach</strong> è il margine: ogni abbonato Coach copre quasi interamente il costo annuale Builder.</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Con soli <strong className="text-foreground">7 abbonati Pro</strong> (oppure 4 Coach) si coprono i costi del piano Builder + store.</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Con <strong className="text-foreground">11 abbonati Pro</strong> (oppure 6 Coach) si passa al piano Pro di Base44 con margine.</li>
          <li className="flex gap-2"><span className="text-primary">•</span> I prezzi possono essere registrati su Google Play Console e App Store Connect come abbonamenti in-app.</li>
        </ul>
      </section>

      {/* Download CTA */}
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-xs text-muted-foreground text-center">
          Scarica il documento completo per consultarlo offline o condividerlo con il tuo team.
        </p>
        <MonetizationPdfExport />
      </div>
    </div>
  );
}

function PlanCard({ plan }) {
  const isPro = plan.id === "pro";
  return (
    <div className={`relative rounded-2xl border p-5 flex flex-col ${
      isPro ? "border-primary/40 bg-primary/5" : "border-border bg-card"
    }`}>
      {plan.badge && (
        <span className={`absolute -top-3 left-5 px-3 py-1 rounded-full text-[11px] font-semibold text-primary-foreground ${plan.accent}`}>
          {plan.badge}
        </span>
      )}
      <div className="mb-4">
        <h3 className="font-display text-xl font-semibold text-white">{plan.name}</h3>
        <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      </div>
      <div className="mb-4">
        {plan.priceMonthly === 0 ? (
          <div className="text-3xl font-display font-bold text-white">Gratis</div>
        ) : (
          <div>
            <span className="text-3xl font-display font-bold text-white">€{plan.priceMonthly}</span>
            <span className="text-sm text-muted-foreground">/mese</span>
            <div className="text-xs text-muted-foreground mt-1">€{plan.priceYearly}/anno</div>
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4 text-primary/70 shrink-0" />
          {plan.limits.users}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Video className="w-4 h-4 text-primary/70 shrink-0" />
          <span><strong className="text-foreground">{plan.limits.analysesPerMonth}</strong> analisi/mese</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary/70 shrink-0" />
          <span><strong className="text-foreground">{plan.limits.mentorQueriesPerMonth}</strong> interrogazioni Mentore/mese</span>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-1.5 mb-4 flex-1">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            {f}
          </div>
        ))}
      </div>

      {/* Limitations */}
      {plan.limitations.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-border">
          {plan.limitations.map((l) => (
            <div key={l} className="flex items-start gap-2 text-xs text-muted-foreground/60">
              <X className="w-3.5 h-3.5 text-rose-400/60 shrink-0 mt-0.5" />
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}