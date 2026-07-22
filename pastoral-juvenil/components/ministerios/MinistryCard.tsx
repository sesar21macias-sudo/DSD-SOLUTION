"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { Ministry } from "@/lib/ministryFolders";
import styles from "./MinistryCard.module.css";

export function MinistryCard({ ministry, index }: { ministry: Ministry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      style={{ height: "100%" }}
    >
      <Link
        href={`/ministerios/${ministry.slug}/agente`}
        className={styles.card}
        style={{ ["--accent" as string]: `var(${ministry.accentVar})` }}
      >
        <span className={styles.accentBar} />
        <ArrowUpRight size={18} weight="bold" className={styles.arrow} />
        <h3 className={styles.name}>{ministry.nombre}</h3>
        <p className={styles.descripcion}>{ministry.descripcion}</p>
        <div className={styles.roster}>
          <div className={styles.rosterLine}>
            <span className={styles.rosterLabel}>Coordinador/a</span>
            <span className={styles.rosterValue}>{ministry.coordinador}</span>
          </div>
          <div className={styles.rosterLine}>
            <span className={styles.rosterLabel}>Subcoordinador/a</span>
            <span className={styles.rosterValue}>{ministry.subcoordinador}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
