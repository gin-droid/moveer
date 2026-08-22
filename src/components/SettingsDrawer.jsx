import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  User as UserIcon, Mail, ShieldCheck, Trash2, Loader2, AlertTriangle,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function SettingsDrawer({ open, onOpenChange }) {
  const [me, setMe] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emailConfirm, setEmailConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      (async () => {
        try {
          setMe(await base44.auth.me());
        } catch (e) {
          /* ignore */
        }
      })();
    }
  }, [open]);

  const emailMatches =
    me && emailConfirm.trim().toLowerCase() === (me.email || "").toLowerCase();

  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleting(true);
    setError("");
    try {
      await base44.functions.invoke("deleteOwnAccount", {});
      setConfirmOpen(false);
      await base44.auth.logout("/register");
    } catch (err) {
      setError(err.message || "Errore durante l'eliminazione dell'account.");
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-sm p-0 bg-sidebar border-sidebar-border text-foreground flex flex-col"
        >
          <SheetHeader className="px-5 pt-safe pt-6 pb-4 border-b border-sidebar-border">
            <SheetTitle className="font-display text-white">Impostazioni</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Gestisci il tuo account e le preferenze.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* User card */}
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-white truncate">
                  {me?.full_name || me?.email || "—"}
                </div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {me?.email || ""}
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-white">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Ruolo:{" "}
                <span className="text-muted-foreground">
                  {me?.role === "admin" ? "Amministratore" : "Utente"}
                </span>
              </div>
            </div>

            {/* Logout (mobile-friendly, since top bar no longer has it) */}
            <LogoutButton className="w-full justify-center rounded-xl border border-border bg-card text-foreground hover:text-white py-3" />

            {/* Danger zone */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" /> Zona pericolosa
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                L'eliminazione dell'account è permanente e rimuove tutti i tuoi
                report e dati associati. L'azione non può essere annullata.
              </p>
              <button
                onClick={() => {
                  setConfirmOpen(true);
                  setEmailConfirm("");
                  setError("");
                }}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm font-medium px-4 py-2.5 rounded-xl border border-rose-500/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Elimina account
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border text-foreground max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-display">
              Elimina definitivamente l'account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Questa azione è irreversibile. Tutti i tuoi report e dati verranno
              rimossi. Per confermare, digita il tuo indirizzo email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="email"
            value={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.value)}
            placeholder={me?.email || "la tua email"}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          {error && <div className="text-xs text-rose-300">{error}</div>}
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-muted-foreground hover:text-white">
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!emailMatches || deleting}
              className="bg-rose-500 hover:bg-rose-600 text-white border-rose-500 disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}