import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Send, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSEO } from "@/hooks/useSEO";

const CONTACT_EMAIL = "gianlusis91@gmail.com";

export default function Contact() {
  useSEO({
    title: "Contattaci — moVeerAI",
    description:
      "Contatta il team di moVeerAI per domande, collaborazioni o supporto tecnico. Rispondiamo entro 48 ore.",
    path: "/contact",
  });
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) return;
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("sendContactForm", {
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setSent(true);
    } catch (err) {
      setError(err.message || "Errore nell'invio. Riprova.");
    } finally {
      setSending(false);
    }
  };

  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Indietro
      </button>
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
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">Messaggio inviato</p>
          <p className="text-xs text-muted-foreground mt-1">
            Grazie per la tua segnalazione. Ti risponderemo al più presto.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <input
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="Il tuo nome"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              required
              maxLength={200}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="nome@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Oggetto</label>
            <input
              type="text"
              required
              maxLength={200}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="Di cosa si tratta?"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Messaggio</label>
            <textarea
              required
              maxLength={5000}
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
              placeholder="Come possiamo aiutarti?"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

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