import { useEffect, useState } from "react";
import { appApi } from "@/api/appApi";
import { PLANS } from "@/lib/monetizationData";
import {
  Check,
  X,
  CreditCard,
  Users,
  Video,
  Sparkles,
  Loader2,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  configureStorePurchases,
  isNativeStoreAvailable,
  purchaseStorePackage,
  restoreStorePurchases,
  storeManagementUrl,
} from "@/lib/storePurchases";

async function invokePaymentFunction(name, body = {}) {
  const { data, error } = await appApi.functions.invoke(name, body);
  if (error) {
    let message = error.message || "Operazione non riuscita.";
    try {
      const responseBody = await error.context?.json();
      if (responseBody?.error) message = responseBody.error;
    } catch {
      // Keep the Functions error when the response has no JSON body.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Subscription() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switchingTo, setSwitchingTo] = useState(null);
  const [storePackages, setStorePackages] = useState({});
  const [storeError, setStoreError] = useState("");
  const [storeSyncPending, setStoreSyncPending] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [restoring, setRestoring] = useState(false);
  const isNative = isNativeStoreAvailable();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const user = await appApi.auth.me();
        if (cancelled) return;
        setMe(user);
        if (isNative && user?.id) {
          const availablePackages = await configureStorePurchases(user.id);
          if (!cancelled) setStorePackages(availablePackages);
          const result = await invokePaymentFunction("syncStoreEntitlement");
          if (!cancelled) setMe((current) => ({ ...current, plan: result.plan }));
        }
      } catch (error) {
        if (!cancelled) setStoreError(error.message || "Impossibile caricare gli acquisti dello store.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isNative]);

  const currentPlanId = me?.plan || "freemium";
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[0];

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mentorUsed = (me?.mentor_query_month === monthKey ? me?.mentor_query_count : 0) || 0;
  const mentorLimit = currentPlan.limits.mentorQueriesPerMonth;

  const syncStorePlan = async () => {
    const result = await invokePaymentFunction("syncStoreEntitlement");
    setMe((current) => ({ ...current, plan: result.plan }));
    setStoreSyncPending(false);
    return result.plan;
  };

  const handlePurchase = async (planId) => {
    const storePackage = storePackages[planId]?.[billingPeriod];
    if (!storePackage) {
      setStoreError("Questo prodotto non è disponibile nell’offerta attiva dello store.");
      return;
    }
    setSwitchingTo(planId);
    try {
      await purchaseStorePackage(storePackage);
      try {
        const plan = await syncStorePlan();
        toast({
          title: "Abbonamento attivato",
          description: `Il piano ${PLANS.find((item) => item.id === plan)?.name || plan} è attivo.`,
        });
      } catch (error) {
        setStoreSyncPending(true);
        toast({
          title: "Acquisto ricevuto",
          description: "Lo store ha confermato l’acquisto. L’attivazione dell’account è in sincronizzazione.",
        });
      }
    } catch (error) {
      toast({
        title: "Acquisto non completato",
        description: error.message || "Lo store non ha completato l’acquisto.",
        variant: "destructive",
      });
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restoreStorePurchases();
      const plan = await syncStorePlan();
      toast({
        title: plan === "freemium" ? "Nessun acquisto attivo" : "Acquisti ripristinati",
        description: plan === "freemium"
          ? "Non risultano abbonamenti attivi per questo account store."
          : `Il piano ${PLANS.find((item) => item.id === plan)?.name || plan} è stato ripristinato.`,
      });
    } catch (error) {
      toast({
        title: "Ripristino non riuscito",
        description: error.message || "Impossibile ripristinare gli acquisti.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    window.open(storeManagementUrl(), "_blank", "noopener,noreferrer");
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
                <div className="text-2xl font-display font-bold text-white">
                  {storePackages[currentPlanId]?.[billingPeriod]?.product.priceString || (isNative ? "" : `€${billingPeriod === "annual" ? currentPlan.priceYearly : currentPlan.priceMonthly}`)}
                  <span className="text-sm text-muted-foreground">/{billingPeriod === "annual" ? "anno" : "mese"}</span>
                </div>
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
            <div className="text-lg font-display font-bold text-white">{mentorUsed}<span className="text-muted-foreground">/{mentorLimit}</span></div>
            <div className="text-[11px] text-muted-foreground">query Mentore usate</div>
          </div>
        </div>
        {isNative && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRestore}
              disabled={restoring}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Ripristina acquisti
            </button>
            {currentPlanId !== "freemium" && (
              <button
                type="button"
                onClick={handleManageSubscription}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                Gestisci nello store
              </button>
            )}
          </div>
        )}
      </div>

      {/* All plans */}
      <div>
        <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Piani disponibili
        </h2>
        {isNative && (
          <div role="group" aria-label="Periodo di fatturazione" className="mb-4 inline-grid grid-cols-2 rounded-md border border-border p-1">
            {[{ id: "monthly", label: "Mensile" }, { id: "annual", label: "Annuale" }].map((period) => (
              <button
                key={period.id}
                type="button"
                aria-pressed={billingPeriod === period.id}
                onClick={() => setBillingPeriod(period.id)}
                className={`min-h-9 rounded px-4 text-sm font-medium ${billingPeriod === period.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
        {!isNative && <p className="mb-4 text-sm text-muted-foreground">Gli acquisti sono disponibili nell’app nativa per iOS e Android.</p>}
        {storeError && isNative && <p role="alert" className="mb-4 text-sm text-destructive">{storeError}</p>}
        {storeSyncPending && <p role="status" className="mb-4 text-sm text-muted-foreground">Acquisto confermato dallo store; sincronizzazione dell’account in corso. Usa “Ripristina acquisti” se il piano non si aggiorna.</p>}
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              storePackage={storePackages[plan.id]?.[billingPeriod]}
              billingPeriod={billingPeriod}
              isNative={isNative}
              isCurrent={plan.id === currentPlanId}
              hasActiveStoreSubscription={currentPlanId !== "freemium"}
              isSwitching={switchingTo === plan.id}
              onSwitch={() => handlePurchase(plan.id)}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Gli acquisti e i rinnovi sono gestiti da Apple App Store o Google Play. Puoi gestire o annullare l’abbonamento nelle impostazioni dello store.
      </p>
    </div>
  );
}

function PlanCard({ plan, storePackage, billingPeriod, isNative, isCurrent, hasActiveStoreSubscription, isSwitching, onSwitch }) {
  const isPro = plan.id === "pro";
  const price = storePackage?.product.priceString || (isNative
    ? "Prezzo non disponibile"
    : `€${billingPeriod === "annual" ? plan.priceYearly : plan.priceMonthly}`);
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
            <span className="text-3xl font-display font-bold text-white">{price}</span>
            <span className="text-sm text-muted-foreground">/{billingPeriod === "annual" ? "anno" : "mese"}</span>
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
        disabled={isCurrent || isSwitching || !isNative || !storePackage || hasActiveStoreSubscription || plan.id === "freemium"}
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
          !isNative ? "Disponibile nell’app mobile"
            : hasActiveStoreSubscription ? "Gestisci nello store"
              : !storePackage ? "Non disponibile nello store"
                : "Abbonati"
        )}
      </button>
    </div>
  );
}