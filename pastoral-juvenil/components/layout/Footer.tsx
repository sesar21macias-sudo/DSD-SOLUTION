import Link from "next/link";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.row}`}>
        <span>Pastoral Juvenil &middot; Ntra. Sra. del Refugio</span>
        <span className={styles.rightGroup}>
          <span>Equipo 2026-2027</span>
          <Link href="/admin" className={styles.adminLink}>
            <LockSimple size={12} style={{ display: "inline", verticalAlign: -1.5, marginRight: 4 }} />
            Admin
          </Link>
        </span>
      </div>
    </footer>
  );
}
