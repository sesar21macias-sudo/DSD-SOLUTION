"use client";

import { AnimatePresence } from "motion/react";
import { useTareasState } from "./useTareasState";
import { TaskForm } from "./TaskForm";
import { TaskItem } from "./TaskItem";
import styles from "./TaskList.module.css";

export function TaskList({ ministrySlug }: { ministrySlug: string }) {
  const { tasks, addTask, toggleTask, removeTask } = useTareasState(ministrySlug);
  const hechas = tasks.filter((t) => t.hecha).length;

  return (
    <div className={styles.wrap}>
      <TaskForm onAdd={addTask} />

      {tasks.length > 0 ? (
        <p className={styles.progress}>
          {hechas} de {tasks.length} tareas completadas
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <div className={styles.empty}>Todavía no hay tareas para este ministerio.</div>
      ) : (
        <div className={styles.listPanel}>
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={toggleTask} onRemove={removeTask} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
