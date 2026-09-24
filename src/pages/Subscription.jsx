import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PLANS } from "@/lib/monetizationData";
import { Check, X, CreditCard, Users, Video, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Subscription() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switchingTo, setSwitchingTo] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setMe(u);
      } catch (e) {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentPlanId = me?.plan || "freemium";
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[0];

  const handleSwitch = async (planId) => {
    if (planId === currentPlanId) return;
    setSwitchingTo(planId);
    try {
      const updated = await base44.auth.updateMe({ plan: planId });
      setMe(updated || { ...me, plan: planId });
      const plan = PLANS.find((p) => p.id === planId);
      toast({
        title: "Piano aggiornato",
        description: `Ora sei sul piano ${plan.name}.`,
      });
    } catch (err) {
      toast({
        title: "Errore",
        description: err.message || "Impossibile cambiare piano. Riprova.",
        variant: "destructive",
      });
    } finally {
      setSwitchingTo(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Abbonamento</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Visualizza il tuo piano attuale e scegli quello più adatto a te.
        </p>
      </div>

      {/* Current plan banner */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-2 text-sm text-primary mb-2">
          <ShieldCheck className="w-4 h-4" />
          Piano attuale
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display text-2xl font-bold text-white">{currentPlan.name}</div>
            <div className="text-xs text-muted-foreground">{currentPlan.tagline}</div>
          </div>
          <div className="text-right">
            {currentPlan.priceMonthly === 0 ? (
              <div className="text-2xl font-display font-bold text-white">Gratis</div>
            ) : (
              <>
                <div className="text-2xl font-display font-bold text-white">€{currentPlan.priceMonthly}<span className="text-sm text-muted-foreground">/mese</span></div>
                <div className="text-xs text-muted-foreground">€{currentPlan.priceYearly}/anno</div>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-background/50 border border-border p-3 text-center">
            <Video className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-lg font-display font-bold text-white">{currentPlan.limits.analysesPerMonth}</div>
            <div className="text-[11px] text-muted-foreground">analisi/mese</div>
          </div>
          <div className="rounded-xl bg-background/50 border border-border p-3 text-center">
            <Sparkles className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-lg font-display font-bold text-white">{currentPlan.limits.mentorQueriesPerMonth}</div>
            <div className="text-[11px] text-muted-foreground">query Mentore/mese</div>
          </div>
        </div>
      </div>

      {/* All plans */}
      <div>
        <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Piani disponibili
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlanId}
              isSwitching={switchingTo === plan.id}
              onSwitch={() => handleSwitch(plan.id)}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Il cambio piano è immediato. Gli abbonamenti a pagamento verranno gestiti
        tramite Google Play e App Store al momento della pubblicazione.
      </p>
    </div>
  );
}

function PlanCard({ plan, isCurrent, isSwitching, onSwitch }) {
  const isPro = plan.id === "pro";
  return (
    <div className={`relative rounded-2xl border p-5 flex flex-col ${
      isCurrent ? "border-primary bg-primary/5" : isPro ? "border-primary/40 bg-primary/5" : "border-border bg-card"
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
          <span><strong className="text-foreground">{plan.limits.mentorQueriesPerMonth}</strong> query Mentore/mese</span>
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
        <div className="space-y-1.5 mb-4 pt-3 border-t border-border">
          {plan.limitations.map((l) => (
            <div key={l} className="flex items-start gap-2 text-xs text-muted-foreground/60">
              <X className="w-3.5 h-3.5 text-rose-400/60 shrink-0 mt-0.5" />
              {l}
            </div>
          ))}
        </div>
      )}

      {/* Action */}
      <button
        onClick={onSwitch}
        disabled={isCurrent || isSwitching}
        className={`w-full inline-flex items-center justify-center gap-2 font-semibold text-sm px-4 py-3 rounded-xl transition-colors ${
          isCurrent
            ? "bg-muted text-muted-foreground cursor-default"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {isSwitching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCurrent ? (
          <>
            <Check className="w-4 h-4" /> Piano attuale
          </>
        ) : (
          "Passa a questo piano"
        )}
      </button>
    </div>
  );
}