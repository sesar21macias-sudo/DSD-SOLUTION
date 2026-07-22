import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import type { Ministry } from "@/lib/ministryFolders";
import styles from "./DashboardHeader.module.css";

export function DashboardHeader({ ministry }: { ministry: Ministry }) {
  return (
    <div className={`container ${styles.header}`}>
      <Link href="/ministerios" className={styles.back}>
        <ArrowLeft size={14} weight="bold" />
        Volver
      </Link>
      <div className={styles.row}>
        <div className={styles.titleBlock}>
          <Image src="/logo.png" alt="Logo" width={40} height={40} className={styles.logo} />
          <h1 className={styles.title}>{ministry.nombre}</h1>
        </div>
        <div className={styles.roster}>
          <span>
            Coordinador/a <span className={styles.rosterValue}>{ministry.coordinador}</span>
          </span>
          <span>
            Subcoordinador/a <span className={styles.rosterValue}>{ministry.subcoordinador}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
