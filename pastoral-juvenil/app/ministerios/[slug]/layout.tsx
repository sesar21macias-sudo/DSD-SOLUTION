import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Footer } from "@/components/layout/Footer";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { getMinistryBySlug } from "@/lib/ministryFolders";
import styles from "./layout.module.css";

export default async function MinistryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ministry = getMinistryBySlug(slug);

  if (!ministry) {
    notFound();
  }

  return (
    <>
      <SiteHeader ministryName={ministry.nombre} />
      <DashboardHeader ministry={ministry} />
      <DashboardTabs slug={ministry.slug} />
      <main className={`container ${styles.content}`}>{children}</main>
      <Footer />
    </>
  );
}
