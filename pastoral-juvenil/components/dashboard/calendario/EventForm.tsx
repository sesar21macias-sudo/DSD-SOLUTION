"use client";

import { FormEvent, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import type { CalendarEvent } from "@/lib/calendario";
import styles from "./EventForm.module.css";

type EventDraft = Omit<CalendarEvent, "id" | "ministrySlug" | "htmlLink">;

export function EventForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: EventDraft) => void;
  onCancel: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");

  const valid = titulo.trim() && fecha && hora && lugar.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({ titulo: titulo.trim(), fecha, hora, lugar: lugar.trim() });
    onCancel();
  }

  return (
    <motion.form
      className={styles.form}
      onSubmit={handleSubmit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Título</span>
          <input
            className={styles.input}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Junta de coordinadores"
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Lugar</span>
          <input
            className={styles.input}
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Ej. Salón parroquial"
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Fecha</span>
          <input
            className={styles.input}
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Hora</span>
          <input
            className={styles.input}
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
        </label>
      </div>

      <div className={styles.actions}>
        <Button type="submit" size="sm" disabled={!valid}>
          Guardar evento
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  );
}
