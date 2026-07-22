"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./TaskForm.module.css";

export function TaskForm({ onAdd }: { onAdd: (texto: string) => void }) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        placeholder="Nueva tarea o nota..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={!value.trim()}>
        Agregar
      </Button>
    </form>
  );
}
