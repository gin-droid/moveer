import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  Loader2,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { appApi } from "@/api/appApi";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoDialog from "@/components/InfoDialog";
import { PLANS } from "@/lib/monetizationData";

async function invokeAdmin(action, values = {}) {
  const { data, error } = await appApi.functions.invoke("adminManageUsers", { action, ...values });
  if (error) {
    let message = error.message || "Operazione non riuscita.";
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // Keep the Functions error message when no JSON response is available.
    }
    throw new Error(message);
  }
  return data;
}

function accountStatus(user) {
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return "suspended";
  if (user.entitlement?.blocked) return "blocked";
  return "active";
}

export default function SubscriptionManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("pro");
  const [busyId, setBusyId] = useState("");
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmUser, setConfirmUser] = useState(null);
  const [infoState, setInfoState] = useState({ open: false, title: "", description: "" });

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const currentUser = await appApi.auth.me();
      if (currentUser?.role !== "admin") {
        setError("Accesso riservato agli amministratori.");
        return;
      }
      const result = await invokeAdmin("list");
      setUsers(result.users || []);
    } catch (err) {
      setError(err.message || "Errore nel caricamento degli utenti.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users
      .filter((user) => !normalizedQuery || user.email.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [users, query]);

  const assignPlan = async (targetEmail, nextPlan) => {
    setBusyId(targetEmail);
    setError("");
    setNotice("");
    try {
      const updated = await invokeAdmin("set-plan", { email: targetEmail, plan: nextPlan });
      setUsers((current) => current.map((user) => user.id === updated.id
        ? { ...user, plan: nextPlan, entitlement: { ...user.entitlement, plan: nextPlan } }
        : user));
      setNotice(`Piano ${PLANS.find((item) => item.id === nextPlan)?.name || nextPlan} assegnato a ${targetEmail}.`);
      return true;
    } catch (err) {
      setInfoState({ open: true, title: "Assegnazione non riuscita", description: err.message });
      return false;
    } finally {
      setBusyId("");
    }
  };

  const handleGrantPlan = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    setGranting(true);
    setError("");
    setNotice("");
    try {
      if (await assignPlan(normalizedEmail, plan)) setEmail("");
    } finally {
      setGranting(false);
    }
  };

  const setUserStatus = async (user, status) => {
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await invokeAdmin("set-status", { userId: user.id, status });
      setUsers((current) => current.map((item) => item.id === user.id
        ? { ...item, banned_until: status === "suspended" ? new Date(Date.now() + 876000 * 60 * 60 * 1000).toISOString() : null, entitlement: { ...item.entitlement, blocked: status !== "active" } }
        : item));
      setNotice(status === "active" ? `Accesso riattivato per ${user.email}.` : `Account ${status === "blocked" ? "bloccato" : "sospeso"}: ${user.email}.`);
    } catch (err) {
      setInfoState({ open: true, title: "Modifica non riuscita", description: err.message });
    } finally {
      setBusyId("");
    }
  };

  const deleteUser = async () => {
    if (!confirmUser) return;
    const target = confirmUser;
    setBusyId(target.id);
    try {
      await invokeAdmin("delete", { userId: target.id });
      setUsers((current) => current.filter((user) => user.id !== target.id));
      setNotice(`Account ${target.email} eliminato.`);
    } catch (err) {
      setInfoState({ open: true, title: "Eliminazione non riuscita", description: err.message });
    } finally {
      setBusyId("");
      setConfirmUser(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>;
  }

  if (error && users.length === 0) {
    return <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>;
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Abbonamenti e utenti</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Assegna un piano e controlla l’accesso agli account registrati.</p>
      </header>

      <section className="border-y border-zinc-800 py-5">
        <h2 className="mb-1 text-base font-semibold text-white">Assegna un piano via email</h2>
        <p className="mb-4 text-xs text-zinc-500">L’indirizzo deve appartenere a un account registrato. L’assegnazione manuale non modifica pagamenti o rinnovi Stripe.</p>
        <form onSubmit={handleGrantPlan} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@esempio.it"
            aria-label="Email dell’utente"
            className="h-11 min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-primary"
          />
          <select value={plan} onChange={(event) => setPlan(event.target.value)} aria-label="Piano da assegnare" className="h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white">
            {PLANS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button disabled={granting} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Assegna piano
          </button>
        </form>
      </section>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Account registrati</h2>
            <p className="mt-1 text-xs text-zinc-500">{filteredUsers.length} di {users.length} utenti</p>
          </div>
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca per email" aria-label="Cerca utenti per email" className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-white outline-none focus:border-primary" />
          </label>
        </div>

        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
          {filteredUsers.map((user) => {
            const status = accountStatus(user);
            const isAdmin = user.role === "admin";
            const busy = busyId === user.id || busyId === user.email;
            return (
              <article key={user.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isAdmin ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                  {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{user.email || "Email non disponibile"}</p>
                  <p className="mt-1 text-xs text-zinc-500">Registrato il {new Date(user.created_at).toLocaleDateString("it-IT")}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${status === "active" ? "bg-emerald-400/10 text-emerald-300" : status === "suspended" ? "bg-amber-400/10 text-amber-300" : "bg-rose-400/10 text-rose-300"}`}>
                  {status === "active" ? "Attivo" : status === "suspended" ? "Sospeso" : "Bloccato"}
                </span>
                <select
                  value={user.entitlement?.plan || user.plan || "freemium"}
                  onChange={(event) => assignPlan(user.email, event.target.value)}
                  disabled={busy || isAdmin}
                  aria-label={`Piano per ${user.email}`}
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-white disabled:opacity-50 sm:w-36"
                >
                  {PLANS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setUserStatus(user, status === "blocked" ? "active" : "blocked")}
                    disabled={busy || isAdmin}
                    title={status === "blocked" ? "Sblocca account" : "Blocca account"}
                    aria-label={status === "blocked" ? `Sblocca ${user.email}` : `Blocca ${user.email}`}
                    className={`rounded-md p-2 transition-colors disabled:opacity-40 ${status === "blocked" ? "text-amber-300 hover:bg-amber-400/10" : "text-zinc-500 hover:bg-amber-400/10 hover:text-amber-300"}`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserStatus(user, status === "suspended" ? "active" : "suspended")}
                    disabled={busy || isAdmin}
                    title={status === "suspended" ? "Riattiva account" : "Sospendi account"}
                    aria-label={status === "suspended" ? `Riattiva ${user.email}` : `Sospendi ${user.email}`}
                    className={`rounded-md p-2 transition-colors disabled:opacity-40 ${status === "suspended" ? "text-emerald-300 hover:bg-emerald-400/10" : "text-zinc-500 hover:bg-amber-400/10 hover:text-amber-300"}`}
                  >
                    {status === "suspended" ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmUser(user)}
                    disabled={busy || isAdmin}
                    title="Elimina account"
                    aria-label={`Elimina ${user.email}`}
                    className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
          {filteredUsers.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">Nessun account corrispondente.</p>}
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmUser}
        onOpenChange={(open) => { if (!open) setConfirmUser(null); }}
        onConfirm={deleteUser}
        opts={{
          title: "Elimina account",
          description: `Eliminare definitivamente ${confirmUser?.email || "questo account"}? L’operazione è irreversibile.`,
          confirmLabel: "Elimina account",
          loading: !!confirmUser && busyId === confirmUser.id,
        }}
      />
      <InfoDialog
        open={infoState.open}
        onOpenChange={(open) => setInfoState((current) => ({ ...current, open }))}
        opts={{ title: infoState.title, description: infoState.description }}
      />
    </div>
  );
}