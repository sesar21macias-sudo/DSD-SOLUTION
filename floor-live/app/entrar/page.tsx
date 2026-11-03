import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/AccountForms";
import { AuthShell } from "@/components/AuthShell";
import { first } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).auth.login };
}

export default async function LoginPage() {
  const d = await getDict();
  const users = await first<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  const empty = (users?.n ?? 0) === 0;

  return (
    <AuthShell title={d.auth.loginTitle} subtitle={d.auth.loginSubtitle}>
      <Suspense>
        <LoginForm />
      </Suspense>
      {empty && (
        <p className="mt-6 text-sm text-ink-faint">
          {d.auth.firstTime}{" "}
          <Link href="/inicio" className="text-ink underline decoration-ink-faint underline-offset-4 hover:decoration-ink">
            {d.auth.createAdmin}
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
