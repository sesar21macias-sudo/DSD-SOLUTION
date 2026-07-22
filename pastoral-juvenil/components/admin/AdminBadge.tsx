"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { SealCheck, SignOut } from "@phosphor-icons/react/dist/ssr";
import { useAdminSession } from "./useAdminSession";
import styles from "./AdminBadge.module.css";

export function AdminBadge() {
  const router = useRouter();
  const { admin, logout } = useAdminSession();

  async function handleLogout() {
    await logout();
    router.refresh();
  }

  return (
    <AnimatePresence>
      {admin ? (
        <motion.span
          className={styles.badge}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <SealCheck size={14} weight="fill" className={styles.icon} />
          Admin
          <button type="button" className={styles.logout} onClick={handleLogout} aria-label="Cerrar sesión">
            <SignOut size={14} />
            Salir
          </button>
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
