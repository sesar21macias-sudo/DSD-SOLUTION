import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Footer } from "@/components/layout/Footer";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminSession } from "@/lib/auth";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Acceso admin · Pastoral Juvenil NSR",
};

export default async function AdminPage() {
  const admin = await isAdminSession();

  return (
    <>
      <SiteHeader />
      <main className={`container ${styles.main}`}>
        <div className={styles.glow} aria-hidden="true" />
        <LoginForm initialAdmin={admin} />
      </main>
      <Footer />
    </>
  );
}
