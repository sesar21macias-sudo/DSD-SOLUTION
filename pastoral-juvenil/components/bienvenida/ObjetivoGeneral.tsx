"use client";

import { motion } from "motion/react";
import { OBJETIVO_GENERAL } from "@/data/asesores";
import styles from "./ObjetivoGeneral.module.css";

export function ObjetivoGeneral() {
  return (
    <section className={`container ${styles.section}`}>
      <motion.div
        className={styles.panel}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={styles.label}>Objetivo general</span>
        <p className={styles.text}>{OBJETIVO_GENERAL}</p>
      </motion.div>
    </section>
  );
}
