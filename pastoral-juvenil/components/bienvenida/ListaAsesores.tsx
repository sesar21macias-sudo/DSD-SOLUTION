import { Card } from "@/components/ui/Card";
import { MATRIMONIO_ASESOR, PADRE_ASESOR } from "@/data/asesores";
import styles from "./ListaAsesores.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .filter((w) => w.length > 2 || /[A-ZÁÉÍÓÚÑ]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ListaAsesores() {
  return (
    <section className={`container ${styles.section}`}>
      <h2 className={styles.heading}>Asesores</h2>
      <div className={styles.row}>
        <Card className={styles.card}>
          <span className={`${styles.avatar} ${styles.avatarPadre}`}>{initials(PADRE_ASESOR.nombre)}</span>
          <div>
            <p className={styles.name}>{PADRE_ASESOR.nombre}</p>
            <p className={styles.role}>{PADRE_ASESOR.rol}</p>
          </div>
        </Card>

        <Card className={styles.card}>
          <span className={`${styles.avatar} ${styles.avatarMatrimonio}`}>{initials(MATRIMONIO_ASESOR.nombre)}</span>
          <div>
            <p className={styles.name}>{MATRIMONIO_ASESOR.nombre}</p>
            <p className={styles.role}>{MATRIMONIO_ASESOR.rol}</p>
          </div>
        </Card>
      </div>
    </section>
  );
}
