import type { Message } from "@/lib/db";

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isHuman = message.role === "human";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
          isUser
            ? "border border-neutral-700 bg-neutral-900 text-neutral-100"
            : isHuman
              ? "bg-amber-700 text-amber-50"
              : "bg-emerald-700 text-emerald-50"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="mt-1 text-right text-[10px] opacity-70">{formatTime(message.created_at)}</p>
      </div>
    </div>
  );
}
