import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Loader2, ShieldCheck, User as UserIcon, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me?.role !== "admin") {
          setError("Accesso riservato agli amministratori.");
          setLoading(false);
          return;
        }
        const data = await base44.entities.User.list("-created_date", 200);
        setUsers(data);
      } catch (err) {
        setError(err.message || "Errore nel caricamento degli utenti.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (u) => {
    if (u.role === "admin") {
      alert("Non puoi eliminare un account amministratore.");
      return;
    }
    if (!window.confirm(`Eliminare definitivamente l'utente "${u.email}"?`)) return;
    setDeletingId(u.id);
    try {
      await base44.entities.User.delete(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      alert(err.message || "Errore durante l'eliminazione dell'utente.");
    } finally {
      setDeletingId(null);
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
      <div className="max-w-2xl">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Torna alla dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Gestione utenti</h1>
        <p className="text-zinc-400 mt-2 text-sm">Elenco degli account registrati. Puoi eliminare gli utenti non amministratori.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="divide-y divide-zinc-800/60">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4">
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
              <button
                onClick={() => handleDelete(u)}
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
  );
}