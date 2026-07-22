"use client";

import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "@phosphor-icons/react";
import type { MockTask } from "@/data/mockTasks";
import styles from "./TaskItem.module.css";

type TaskItemProps = {
  task: MockTask;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
};

export function TaskItem({ task, onToggle, onRemove }: TaskItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={styles.item}
    >
      <button
        className={`${styles.checkbox} ${task.hecha ? styles.checkboxChecked : ""}`}
        onClick={() => onToggle(task.id)}
        aria-label={task.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
      >
        <AnimatePresence>
          {task.hecha ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Check size={13} weight="bold" />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>
      <span className={`${styles.texto} ${task.hecha ? styles.textoHecha : ""}`}>{task.texto}</span>
      <button className={styles.remove} onClick={() => onRemove(task.id)} aria-label="Eliminar tarea">
        <X size={15} />
      </button>
    </motion.div>
  );
}
