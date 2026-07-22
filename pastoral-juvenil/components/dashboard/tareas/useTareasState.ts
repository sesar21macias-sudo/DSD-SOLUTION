"use client";

import { useState } from "react";
import { MOCK_TASKS_SEED, type MockTask } from "@/data/mockTasks";

export function useTareasState(ministrySlug: string) {
  const [tasks, setTasks] = useState<MockTask[]>(() => MOCK_TASKS_SEED[ministrySlug] ?? []);

  function addTask(texto: string) {
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), texto, hecha: false }]);
  }

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t)));
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return { tasks, addTask, toggleTask, removeTask };
}
