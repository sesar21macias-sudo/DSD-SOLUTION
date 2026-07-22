"use client";

import { motion } from "motion/react";
import { OBJETIVOS_ESPECIFICOS } from "@/data/asesores";
import styles from "./ObjetivosEspecificos.module.css";

export function ObjetivosEspecificos() {
  return (
    <section className={`container ${styles.section}`}>
      <div className={styles.heading}>
        <h2>Objetivos específicos</h2>
        <span className={styles.count}>{OBJETIVOS_ESPECIFICOS.length} líneas de trabajo</span>
      </div>

      <div className={styles.grid}>
        {OBJETIVOS_ESPECIFICOS.map((texto, index) => (
          <motion.div
            key={texto}
            className={styles.item}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
            <p>{texto}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
