import { useEffect, useState } from "react";
import { appApi } from "@/api/appApi";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, UserRound } from "lucide-react";

export default function GenderOnboarding() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && !user.gender) setOpen(true);
  }, [user]);

  const choose = async (g) => {
    setSaving(true);
    try {
      await appApi.auth.updateMe({ gender: g });
      setOpen(false);
    } catch (e) {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <UserRound className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-white">Seleziona il tuo genere</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Usiamo il genere per mostrare la sagoma corporea corretta (maschile o femminile) nella mappa posturale dei report.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "maschio", l: "Maschio" },
            { v: "femmina", l: "Femmina" },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => choose(opt.v)}
              disabled={saving}
              className="px-4 py-5 rounded-xl border border-border bg-background hover:border-primary text-foreground hover:text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              {opt.l}
            </button>
          ))}
        </div>
        {saving && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvataggio…
          </div>
        )}
      </div>
    </div>
  );
}