import Link from "next/link";
import { getDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const d = await getDict();
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-sm text-ink-faint">404</p>
        <h1 className="mt-2 font-display text-[2.6rem] leading-none">{d.notFound.title}</h1>
        <p className="mt-3 text-sm text-ink-soft">{d.notFound.body}</p>
        <Link href="/" className="btn btn-light mt-6">
          {d.notFound.back}
        </Link>
      </div>
    </div>
  );
}
