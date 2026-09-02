import { useEffect, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Sparkles, MessageCircle, Plus } from "lucide-react";
import MessageBubble from "@/components/mentor/MessageBubble";

const AGENT_NAME = "exercise_mentor";

export default function Mentor() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const scrollRef = useRef(null);

  const loadConversation = useCallback(async (conv) => {
    setConversation(conv);
    setMessages(conv.messages || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        setConversations(list || []);
        if (list && list.length > 0) {
          const full = await base44.agents.getConversation(list[0].id);
          await loadConversation(full);
        } else {
          const conv = await base44.agents.createConversation({
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
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsub();
  }, [conversation?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !conversation || sending) return;
    setInput("");
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: "user", content: text });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const newChat = async () => {
    setLoading(true);
    try {
      const conv = await base44.agents.createConversation({
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
            <p className="text-[11px] text-zinc-500">Ti guida attraverso ogni esercizio</p>
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
      </div>

      <div className="pt-2">
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
      </div>
    </div>
  );
}