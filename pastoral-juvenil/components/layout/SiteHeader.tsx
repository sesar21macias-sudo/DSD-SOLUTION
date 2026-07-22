import Image from "next/image";
import Link from "next/link";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { AdminBadge } from "@/components/admin/AdminBadge";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ ministryName }: { ministryName?: string }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.row}`}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo.png" alt="Escudo de la Pastoral Juvenil NSR" width={40} height={40} className={styles.logo} />
          <span className={styles.brandText}>
            <span className={styles.brandTitle}>Pastoral Juvenil</span>
            <span className={styles.brandSubtitle}>Ntra. Sra. del Refugio &middot; 2026-2027</span>
          </span>
        </Link>

        <div className={styles.right}>
          {ministryName ? (
            <span className={styles.ministryTag}>
              <FlameIcon size={16} />
              <span className={styles.ministryTagStrong}>{ministryName}</span>
            </span>
          ) : null}
          <AdminBadge />
        </div>
      </div>
    </header>
  );
}
