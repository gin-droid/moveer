import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appApi";
import { useAuth } from "@/lib/AuthContext";
import { PLANS } from "@/lib/monetizationData";
import { Send, Sparkles, MessageCircle, Plus, Lock } from "lucide-react";
import MessageBubble from "@/components/mentor/MessageBubble";

const AGENT_NAME = "exercise_mentor";

const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Mentor() {
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [queryCount, setQueryCount] = useState(0);
  const scrollRef = useRef(null);

  const planId = user?.plan || "freemium";
  const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
  const queryLimit = plan.limits.mentorQueriesPerMonth;
  const limitReached = queryCount >= queryLimit;

  // Sincronizza il contatore mensile dal profilo utente (display cache sincronizzata dal backend)
  useEffect(() => {
    const month = monthKey();
    const storedMonth = user?.mentor_query_month;
    const storedCount = user?.mentor_query_count || 0;
    if (storedMonth !== month) {
      setQueryCount(0);
    } else {
      setQueryCount(storedCount);
    }
  }, [user]);

  const loadConversation = useCallback(async (conv) => {
    setConversation(conv);
    setMessages(conv.messages || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await appApi.agents.listConversations({ agent_name: AGENT_NAME });
        setConversations(list || []);
        if (list && list.length > 0) {
          const full = await appApi.agents.getConversation(list[0].id);
          await loadConversation(full);
        } else {
          const conv = await appApi.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: "Mentore", description: "Guida agli esercizi" },
          });
          setConversations([conv]);
          await loadConversation(conv);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    })();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = appApi.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsub();
  }, [conversation?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // L'agente sta elaborando se l'ultimo messaggio è dell'utente (in attesa di risposta)
  // o se c'è un tool call in corso.
  const isWaiting = messages.length > 0 && (
    messages[messages.length - 1].role === "user" ||
    (messages[messages.length - 1].tool_calls || []).some(
      (tc) => ["pending", "running", "in_progress"].includes(tc.status)
    )
  );

  const send = async () => {
    const text = input.trim();
    if (!text || !conversation || sending || limitReached) return;
    setInput("");
    setSending(true);
    try {
      // Server-side quota check + message submission in one atomic call.
      // The backend function verifies the quota AND adds the message, so the
      // client cannot bypass the quota by calling addMessage directly.
      const res = await appApi.functions.invoke("sendMentorMessage", {
        conversationId: conversation.id,
        text,
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.allowed) {
        setQueryCount(res.data?.used ?? queryLimit);
        return;
      }
      setQueryCount(res.data.used);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const newChat = async () => {
    setLoading(true);
    try {
      const conv = await appApi.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: "Mentore", description: "Guida agli esercizi" },
      });
      setConversations([conv, ...conversations]);
      await loadConversation(conv);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-9rem)] md:h-[calc(100dvh-7rem)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-white leading-tight">Mentore</h1>
            <p className="text-[11px] text-zinc-500">
              Ti guida attraverso ogni esercizio
              <span className={`ml-1.5 font-medium ${limitReached ? "text-rose-400" : "text-emerald-400"}`}>
                {queryCount}/{queryLimit} query
              </span>
            </p>
          </div>
        </div>
        <button onClick={newChat} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nuova
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-3 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <MessageCircle className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-400 font-medium">Chiedi al mentore come eseguire un esercizio</p>
            <p className="text-xs text-zinc-600 mt-1">Es. "Come imposto correttamente lo squat?" o "Quali errori evitare nel panca?"</p>
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {isWaiting && (
          <div className="flex justify-start">
            <div className="bg-zinc-800/80 rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="pt-2">
        {limitReached ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 text-center">
            <Lock className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
            <p className="text-sm text-amber-200 font-medium mb-1">Limite mensile raggiunto</p>
            <p className="text-xs text-muted-foreground mb-2.5">
              Hai usato tutte le {queryLimit} query del piano {plan.name} per questo mese.
            </p>
            <Link to="/abbonamento" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80">
              Passa a un piano superiore →
            </Link>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="Scrivi al mentore…"
              className="flex-1 resize-none bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors max-h-32"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-11 h-11 shrink-0 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}