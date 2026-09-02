import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Loader2, AlertCircle, ChevronDown, Wrench } from "lucide-react";

function statusMeta(status) {
  switch (status) {
    case "pending":
    case "running":
    case "in_progress":
      return { icon: Loader2, spin: true, cls: "text-zinc-400", label: "In corso…" };
    case "success":
    case "completed":
      return { icon: Check, spin: false, cls: "text-emerald-400", label: "Completato" };
    case "failed":
    case "error":
      return { icon: AlertCircle, spin: false, cls: "text-rose-400", label: "Errore" };
    default:
      return { icon: Wrench, spin: false, cls: "text-zinc-500", label: status };
  }
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? "bg-emerald-400 text-zinc-950" : "bg-zinc-800/80 text-zinc-100"}`}>
        {message.content && (isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none leading-relaxed [&>p]:my-1.5 [&>ul]:my-1.5 [&>li]:my-0.5">{message.content}</ReactMarkdown>
        ))}
        {message.tool_calls?.map((tc, i) => <ToolCall key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}

function ToolCall({ toolCall }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(toolCall.status);
  const Icon = meta.icon;
  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { /* keep raw */ }
  let parsedResults = toolCall.results;
  if (typeof parsedResults === "string") {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;
  const label = toolCall.status === "failed" || toolCall.status === "error"
    ? (proj.error_label || meta.label)
    : ["pending", "running", "in_progress"].includes(toolCall.status)
      ? (proj.active_label || meta.label)
      : (proj.label || meta.label);

  return (
    <div className="mt-2 text-xs border-t border-white/10 pt-1.5">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200">
        <Icon className={`w-3.5 h-3.5 ${meta.spin ? "animate-spin" : ""} ${meta.cls}`} />
        <span>{label}</span>
        {!hideDetails && <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {!hideDetails && open && (
        <div className="mt-1.5 space-y-1 pl-5 text-zinc-500">
          {parsedArgs && typeof parsedArgs === "object" && (
            <div><span className="text-zinc-600">Parametri:</span> <pre className="whitespace-pre-wrap break-words">{JSON.stringify(parsedArgs, null, 2)}</pre></div>
          )}
          {parsedResults != null && (
            <div><span className="text-zinc-600">Risultato:</span> <pre className="whitespace-pre-wrap break-words">{typeof parsedResults === "object" ? JSON.stringify(parsedResults, null, 2) : String(parsedResults)}</pre></div>
          )}
        </div>
      )}
    </div>
  );
}