import { Clock, MapPin, TrashSimple } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/Card";
import type { CalendarEvent } from "@/lib/calendario";
import styles from "./EventCard.module.css";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function EventCard({ event, onDelete }: { event: CalendarEvent; onDelete?: () => void }) {
  const date = new Date(`${event.fecha}T00:00:00`);

  return (
    <Card className={styles.card}>
      <div className={styles.dateBlock}>
        <span className={styles.day}>{date.getDate()}</span>
        <span className={styles.month}>{MESES[date.getMonth()]}</span>
      </div>
      <div className={styles.info}>
        <p className={styles.title}>{event.titulo}</p>
        <div className={styles.meta}>
          <span>
            <Clock size={13} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
            {event.hora} h
          </span>
          <span>
            <MapPin size={13} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
            {event.lugar}
          </span>
        </div>
      </div>
      {onDelete ? (
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={onDelete}
          aria-label={`Borrar evento: ${event.titulo}`}
        >
          <TrashSimple size={16} />
        </button>
      ) : null}
    </Card>
  );
}
