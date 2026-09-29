import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Loader2, ShieldCheck, User as UserIcon, Ban } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoDialog from "@/components/InfoDialog";
import PullToRefresh from "@/components/PullToRefresh";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [blockingId, setBlockingId] = useState(null);
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState({ open: false, user: null });
  const [infoState, setInfoState] = useState({ open: false, title: "", description: "" });

  const loadUsers = async () => {
    try {
      const me = await base44.auth.me();
      if (me?.role !== "admin") {
        setError("Accesso riservato agli amministratori.");
        setLoading(false);
        return;
      }
      const data = await base44.entities.User.list("-created_date", 200);
      // Fetch entitlement records to get the authoritative blocked status
      const entitlements = await base44.entities.UserEntitlement.list("-created_date", 500);
      const entMap = {};
      for (const e of entitlements) { entMap[e.user_id] = e; }
      setUsers(data.map((u) => ({ ...u, _entitlement: entMap[u.id] || null })));
    } catch (err) {
      setError(err.message || "Errore nel caricamento degli utenti.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const requestDelete = (u) => {
    if (u.role === "admin") {
      setInfoState({
        open: true,
        title: "Operazione non consentita",
        description: "Non puoi eliminare un account amministratore.",
      });
      return;
    }
    setConfirmState({ open: true, user: u });
  };

  const handleDelete = async () => {
    const u = confirmState.user;
    if (!u) return;
    setDeletingId(u.id);
    try {
      await base44.entities.User.delete(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setInfoState({
        open: true,
        title: "Eliminazione fallita",
        description: err.message || "Errore durante l'eliminazione dell'utente.",
      });
    } finally {
      setDeletingId(null);
      setConfirmState({ open: false, user: null });
    }
  };

  const handleToggleBlock = async (u) => {
    if (u.role === "admin") return;
    setBlockingId(u.id);
    try {
      // Write blocked to the trusted UserEntitlement entity (admin-only writes).
      // The user.blocked field on User is client-writable via updateMe and cannot be trusted.
      let ent = u._entitlement;
      if (!ent) {
        ent = await base44.entities.UserEntitlement.create({
          user_id: u.id,
          plan: "freemium",
          blocked: false,
          mentor_query_count: 0,
          mentor_query_month: "",
          analysis_count: 0,
          analysis_month: "",
        });
      }
      await base44.entities.UserEntitlement.update(ent.id, { blocked: !ent.blocked });
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, _entitlement: { ...ent, blocked: !ent.blocked } } : x
        )
      );
    } catch (err) {
      setInfoState({
        open: true,
        title: "Operazione fallita",
        description: err.message || "Errore durante il blocco dell'utente.",
      });
    } finally {
      setBlockingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
    <PullToRefresh onRefresh={loadUsers}>
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Gestione utenti</h1>
        <p className="text-zinc-400 mt-2 text-sm">Elenco degli account registrati. Puoi bloccare o eliminare gli utenti non amministratori.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="divide-y divide-zinc-800/60">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${u.role === "admin" ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                {u.role === "admin" ? <ShieldCheck className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{u.full_name || u.email}</div>
                <div className="text-xs text-zinc-500 truncate">{u.email}</div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${u.role === "admin" ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                {u.role === "admin" ? "Admin" : "Utente"}
              </span>
              {u._entitlement?.blocked && (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-amber-500/15 text-amber-300">
                  Bloccato
                </span>
              )}
              <button
                onClick={() => handleToggleBlock(u)}
                disabled={blockingId === u.id || deletingId === u.id || u.role === "admin"}
                title={u.role === "admin" ? "Gli amministratori non possono essere bloccati" : u._entitlement?.blocked ? "Sblocca utente" : "Blocca utente"}
                className={`p-2 rounded-lg transition-colors shrink-0 disabled:opacity-40 disabled:hover:bg-transparent ${
                  u._entitlement?.blocked
                    ? "text-amber-400 hover:bg-amber-500/10"
                    : "text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10"
                } disabled:hover:text-zinc-600`}
              >
                {blockingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              </button>
              <button
                onClick={() => requestDelete(u)}
                disabled={deletingId === u.id || u.role === "admin"}
                title={u.role === "admin" ? "Gli amministratori non possono essere eliminati" : "Elimina utente"}
                className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:text-zinc-600 disabled:hover:bg-transparent transition-colors shrink-0"
              >
                {deletingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
    </PullToRefresh>
    <ConfirmDialog
      open={confirmState.open}
      onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
      onConfirm={handleDelete}
      opts={{
        title: "Elimina utente",
        description: `Eliminare definitivamente l'utente "${confirmState.user?.email ?? ""}"? L'operazione è irreversibile.`,
        confirmLabel: "Elimina",
        loading: deletingId !== null,
      }}
    />
    <InfoDialog
      open={infoState.open}
      onOpenChange={(open) => setInfoState((s) => ({ ...s, open }))}
      opts={{
        title: infoState.title,
        description: infoState.description,
      }}
    />
    </>
  );
}