"use client";

import { MotionConfig } from "motion/react";

/** Respeta prefers-reduced-motion en todas las animaciones de motion/react. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
