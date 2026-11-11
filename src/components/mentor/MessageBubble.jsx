import ReactMarkdown from "react-markdown";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? "bg-emerald-400 text-zinc-950" : "bg-zinc-800/80 text-zinc-100"}`}>
        {message.content && (isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm prose-invert max-w-none leading-relaxed [&>p]:my-1.5 [&>ul]:my-1.5 [&>li]:my-0.5">
            <ReactMarkdown
              disallowedElements={["img"]}
              unwrapDisallowed
              components={{
                a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
}