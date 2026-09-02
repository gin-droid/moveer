import { useState } from "react";
import { Mail, Send, Loader2, CheckCircle2 } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const CONTACT_EMAIL = "info@moveer.ai";

export default function Contact() {
  useSEO({
    title: "Contattaci — moVeerAI",
    description:
      "Contatta il team di moVeerAI per domande, collaborazioni o supporto tecnico. Rispondiamo entro 48 ore.",
    path: "/contact",
  });
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    const subject = encodeURIComponent(`Contatto da ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-tight">Contattaci</h1>

      <p className="text-muted-foreground text-[15px] leading-relaxed">
        Hai domande su moVeerAI, vuoi collaborare o segnalare un problema? Scrivici: ti rispondiamo entro 48 ore.
      </p>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground hover:bg-sidebar-accent transition-colors"
      >
        <Mail className="w-4 h-4 text-primary" />
        {CONTACT_EMAIL}
      </a>

      {sent ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-300 font-medium">Messaggio pronto</p>
          <p className="text-xs text-muted-foreground mt-1">
            Abbiamo aperto il tuo client di posta. Se non si è aperto, scrivi direttamente a {CONTACT_EMAIL}.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="Il tuo nome"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="nome@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Messaggio</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              placeholder="Come possiamo aiutarti?"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Invia messaggio
          </button>
        </form>
      )}
    </div>
  );
}