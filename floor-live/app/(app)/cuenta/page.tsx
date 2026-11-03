import { LogoutButton, PasswordForm } from "@/components/AccountForms";
import { PageHead } from "@/components/admin/Kpi";
import { LanguageSwitch } from "@/components/I18n";
import { getDict } from "@/lib/i18n/server";
import { pageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).account.title };
}

export default async function AccountPage() {
  const user = await pageUser();
  const d = await getDict();
  return (
    <>
      <PageHead title={d.account.title} subtitle={`${user.name} · ${user.username}`} />
      <div className="flex max-w-2xl flex-col gap-6">
        <section className="panel flex items-center justify-between gap-4 p-5">
          <h2 className="font-medium">{d.account.language}</h2>
          <LanguageSwitch />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-medium">{d.account.password}</h2>
          <PasswordForm />
        </section>
        <div>
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
