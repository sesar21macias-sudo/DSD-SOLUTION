"use client";

import { FormEvent, useState } from "react";
import { motion } from "motion/react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import styles from "./ChatInput.module.css";

export function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        placeholder="Escribe tu mensaje para el agente..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
      <motion.button
        type="submit"
        className={styles.send}
        disabled={disabled || !value.trim()}
        whileTap={{ scale: 0.92 }}
        aria-label="Enviar mensaje"
      >
        <PaperPlaneRight size={16} weight="fill" />
      </motion.button>
    </form>
  );
}
