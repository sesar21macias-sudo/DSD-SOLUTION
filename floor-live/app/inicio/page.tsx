import { redirect } from "next/navigation";
import { SetupForm } from "@/components/AccountForms";
import { AuthShell } from "@/components/AuthShell";
import { first } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).auth.setupTitle };
}

export default async function SetupPage() {
  const users = await first<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if ((users?.n ?? 0) > 0) redirect("/entrar");
  const d = await getDict();

  return (
    <AuthShell title={d.auth.setupTitle} subtitle={d.auth.setupSubtitle}>
      <SetupForm />
    </AuthShell>
  );
}
