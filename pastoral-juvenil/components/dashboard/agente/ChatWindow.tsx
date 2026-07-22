"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChatMessage, type ChatRole } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { getInitialGreeting } from "./mockAgentResponder";
import styles from "./ChatWindow.module.css";

type Message = {
  id: string;
  role: ChatRole;
  text: string;
};

export function ChatWindow({
  ministryName,
  ministrySlug,
}: {
  ministryName: string;
  ministrySlug: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "agente", text: getInitialGreeting(ministryName) },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(text: string) {
    const userMessage: Message = { id: crypto.randomUUID(), role: "usuario", text };
    const history = [...messages, userMessage];
    setMessages(history);
    setIsTyping(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ministrySlug,
          // El saludo inicial no aporta contexto; se envía la conversación real
          messages: history
            .filter((m) => m.id !== "greeting")
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data: { ok: boolean; reply?: string; error?: string } = await res.json();
      const reply = data.ok && data.reply ? data.reply : (data.error ?? "Tuve un problema, intenta de nuevo.");
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agente", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agente",
          text: "No me pude conectar al servidor. Revisa tu conexión e intenta de nuevo.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.log} ref={logRef}>
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} text={m.text} />
        ))}
        {isTyping ? (
          <motion.div
            className={styles.typing}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            aria-label="El agente está escribiendo"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className={styles.dot}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        ) : null}
      </div>
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
}
