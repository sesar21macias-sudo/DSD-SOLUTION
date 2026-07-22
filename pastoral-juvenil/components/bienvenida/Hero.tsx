"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { Button } from "@/components/ui/Button";
import { FlameIcon } from "@/components/ui/FlameIcon";
import styles from "./Hero.module.css";

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <motion.div
        className={`container ${styles.inner}`}
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item} className={styles.crest}>
          <Image src="/logo.png" alt="Escudo de la Pastoral Juvenil NSR" width={108} height={108} priority />
        </motion.div>

        <motion.span variants={item} className={styles.eyebrow}>
          <FlameIcon size={14} />
          Equipo 2026-2027
        </motion.span>

        <motion.h1 variants={item} className={styles.title}>
          Pastoral Juvenil <em>Ntra. Sra. del Refugio</em>
        </motion.h1>

        <motion.p variants={item} className={styles.subtitle}>
          El espacio de trabajo de los nueve ministerios: planeación, calendario y
          acompañamiento en un mismo lugar, para seguir llevando la luz de la fe a más
          jóvenes de la parroquia.
        </motion.p>

        <motion.div variants={item} className={styles.actions}>
          <Link href="/ministerios">
            <Button>Entrar</Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
