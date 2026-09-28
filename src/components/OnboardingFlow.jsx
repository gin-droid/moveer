import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Palette, Layers, Dumbbell, ArrowRight, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { ACCENT_COLORS, DEFAULT_ACCENT, applyAccentColor, setStoredAccentColor } from "@/lib/accentColor";
import { MACRO_CATEGORIES, EQUIPMENT_CATEGORIES } from "@/lib/onboardingConstants";
import { safeReturnTo } from "@/lib/authReturnTo";

const STEPS = [
  { icon: Palette, title: "Scegli il colore tema", subtitle: "Personalizza l'aspetto dell'app. Lo vedi in tempo reale." },
  { icon: Layers, title: "Quali categorie ti interessano?", subtitle: "Seleziona le macro-categorie su cui vuoi lavorare." },
  { icon: Dumbbell, title: "Con quali attrezzature?", subtitle: "Scegli le attrezzature a tua disposizione. Puoi saltare." },
];

export default function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [selectedMacros, setSelectedMacros] = useState([]);
  const [selectedEquip, setSelectedEquip] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (list, setter, value) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const handleFinish = async () => {
    setSaving(true);
    setStoredAccentColor(accentColor);
    try {
      await base44.auth.updateMe({
        accent_color: accentColor,
        preferred_macro_categories: selectedMacros,
        preferred_equipment: selectedEquip,
      });
    } catch (e) { /* non-blocking */ }
    window.location.href = safeReturnTo();
  };

  const isLastStep = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;
  const canContinue = step !== 1 || selectedMacros.length > 0;

  return (
    <AuthLayout icon={Icon} title={current.title} subtitle={current.subtitle}>
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-muted"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setAccentColor(c.hsl); applyAccentColor(c.hsl); }}
              className={`w-11 h-11 rounded-full border-2 transition-transform ${accentColor === c.hsl ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
              style={{ backgroundColor: `hsl(${c.hsl})` }}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-2 gap-2 mb-6">
          {MACRO_CATEGORIES.map((m) => {
            const active = selectedMacros.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(selectedMacros, setSelectedMacros, m)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium border transition-colors ${active ? "bg-primary/15 text-primary border-primary/40" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}
              >
                <span className="truncate">{m}</span>
                {active && <Check className="w-4 h-4 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-2 gap-2 mb-6">
          {EQUIPMENT_CATEGORIES.map((eq) => {
            const active = selectedEquip.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                onClick={() => toggle(selectedEquip, setSelectedEquip, eq)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium border transition-colors ${active ? "bg-primary/15 text-primary border-primary/40" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}
              >
                <span className="truncate">{eq}</span>
                {active && <Check className="w-4 h-4 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="outline" className="h-12 font-medium" onClick={() => setStep(step - 1)} disabled={saving}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
          </Button>
        )}
        {isLastStep ? (
          <Button className="flex-1 h-12 font-medium" onClick={handleFinish} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...
              </>
            ) : (
              "Salva e inizia"
            )}
          </Button>
        ) : (
          <Button className="flex-1 h-12 font-medium" onClick={() => setStep(step + 1)} disabled={!canContinue}>
            Continua <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {step === 2 && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={saving}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-3 transition-colors"
        >
          Salta questo passaggio
        </button>
      )}

      {step === 1 && selectedMacros.length === 0 && (
        <p className="w-full text-center text-xs text-muted-foreground mt-3">
          Seleziona almeno una categoria per continuare
        </p>
      )}
    </AuthLayout>
  );
}