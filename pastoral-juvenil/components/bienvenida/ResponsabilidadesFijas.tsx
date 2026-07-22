"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/Card";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { RESPONSABILIDADES_FIJAS } from "@/data/asesores";
import styles from "./ResponsabilidadesFijas.module.css";

export function ResponsabilidadesFijas() {
  const resto = RESPONSABILIDADES_FIJAS.slice(0, -1);
  const featured = RESPONSABILIDADES_FIJAS[RESPONSABILIDADES_FIJAS.length - 1];

  return (
    <section className={`container ${styles.section}`}>
      <h2 className={styles.heading}>Responsabilidades fijas</h2>

      <div className={styles.bento}>
        {resto.map((r, index) => (
          <motion.div
            key={r.titulo}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className={styles.tile}>
              <span className={styles.tileTitle}>{r.titulo}</span>
              <span className={styles.tileDetalle}>{r.detalle}</span>
            </Card>
          </motion.div>
        ))}

        <motion.div
          className={`${styles.tile} ${styles.featured}`}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.tileTitle}>{featured.titulo}</span>
          <span className={styles.tileDetalle}>{featured.detalle}</span>
          <motion.span
            className={styles.flameWrap}
            animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <FlameIcon size={44} />
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
