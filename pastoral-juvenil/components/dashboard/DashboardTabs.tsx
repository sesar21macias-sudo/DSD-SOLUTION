"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChatCircleDots, CalendarBlank, CheckSquare } from "@phosphor-icons/react";
import styles from "./DashboardTabs.module.css";

const TABS = [
  { key: "agente", label: "Agente", icon: ChatCircleDots },
  { key: "calendario", label: "Calendario", icon: CalendarBlank },
  { key: "tareas", label: "Tareas y notas", icon: CheckSquare },
];

export function DashboardTabs({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className={styles.wrap}>
      <div className={`container ${styles.tabsRow}`}>
        <div className={styles.tabs}>
          {TABS.map((tab) => {
            const href = `/ministerios/${slug}/${tab.key}`;
            const isActive = pathname === href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              >
                {isActive ? (
                  <motion.span
                    layoutId="dashboard-tab-pill"
                    className={styles.pill}
                    transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                  />
                ) : null}
                <span className={styles.tabContent}>
                  <Icon size={17} weight={isActive ? "fill" : "regular"} />
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
