"use client";

import { motion } from "motion/react";
import styles from "./ChatMessage.module.css";

export type ChatRole = "agente" | "usuario";

export function ChatMessage({ role, text }: { role: ChatRole; text: string }) {
  const isUser = role === "usuario";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`${styles.row} ${isUser ? styles.rowUser : ""}`}
    >
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAgent}`}>{text}</div>
    </motion.div>
  );
}
