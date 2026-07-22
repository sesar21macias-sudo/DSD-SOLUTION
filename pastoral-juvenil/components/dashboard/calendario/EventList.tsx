"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, Plus, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAdminSession } from "@/components/admin/useAdminSession";
import { CALENDAR_SUBSCRIBE_URL } from "@/lib/calendario";
import { EventCard } from "./EventCard";
import { EventForm } from "./EventForm";
import { AddEventButton } from "./AddEventButton";
import { useEventosState } from "./useEventosState";
import styles from "./EventList.module.css";

export function EventList({ ministrySlug }: { ministrySlug: string }) {
  const { admin } = useAdminSession();
  const { events, loading, error, addEvent, removeEvent } = useEventosState(ministrySlug);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAdd(draft: { titulo: string; fecha: string; hora: string; lugar: string }) {
    setActionError(await addEvent(draft));
  }

  async function handleRemove(id: string) {
    setActionError(await removeEvent(id));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {admin ? (
          <span className={`${styles.hint} ${styles.adminHint}`}>
            <SealCheck size={14} weight="fill" style={{ display: "inline", verticalAlign: -2, marginRight: 5 }} />
            Sesión de administrador activa.
          </span>
        ) : (
          <span className={styles.hint}>Calendario oficial del equipo, en vivo desde Google Calendar.</span>
        )}

        <div className={styles.headerActions}>
          <a href={CALENDAR_SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary">
              <CalendarPlus size={15} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
              Vincular a mi calendario
            </Button>
          </a>

          {admin ? (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus size={15} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
              {showForm ? "Cerrar" : "Agregar evento"}
            </Button>
          ) : (
            <AddEventButton />
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {admin && showForm ? (
          <EventForm key="form" onAdd={handleAdd} onCancel={() => setShowForm(false)} />
        ) : null}
      </AnimatePresence>

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      {loading ? (
        <Card className={styles.empty}>Cargando el calendario…</Card>
      ) : error ? (
        <Card className={styles.empty}>{error}</Card>
      ) : events.length === 0 ? (
        <Card className={styles.empty}>Todavía no hay eventos próximos para este ministerio.</Card>
      ) : (
        <div className={styles.list}>
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <EventCard
                  event={event}
                  onDelete={admin ? () => handleRemove(event.id) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
