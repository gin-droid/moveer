import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, MessageSquareWarning } from "lucide-react";

export default function FeedbackDialog({ open, onOpenChange }) {
  const [category, setCategory] = useState("malfunzionamento");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      await base44.functions.invoke("sendUserReport", {
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      toast({ title: "Segnalazione inviata", description: "Grazie! Ti risponderemo al più presto." });
      setSubject("");
      setMessage("");
      setCategory("malfunzionamento");
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Invio fallito",
        description: err.message || "Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-white flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-primary" />
            Invia una segnalazione
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "malfunzionamento", label: "Malfunzionamento" },
                { v: "suggerimento", label: "Suggerimento" },
                { v: "altro", label: "Altro" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setCategory(opt.v)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    category === opt.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Oggetto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Breve descrizione"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Messaggio</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descrivi nel dettaglio…"
              rows={5}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Invia segnalazione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}