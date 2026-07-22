import { ReactNode } from "react";
import styles from "./Tooltip.module.css";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className={styles.wrapper}>
      {children}
      <span role="tooltip" className={styles.bubble}>
        {label}
      </span>
    </span>
  );
}
