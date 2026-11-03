"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext } from "react";
import { LANGS, LANG_COOKIE, dicts, type Dict, type Lang } from "@/lib/i18n/dict";
import { cx } from "./ui";

const Ctx = createContext<Lang>("es");

/** El servidor decide el idioma; el cliente solo recibe cuál es (las funciones del diccionario no se serializan). */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang(): Lang {
  return useContext(Ctx);
}

export function useDict(): Dict {
  return dicts[useContext(Ctx)];
}

/** Idioma actual fuera de React (por ejemplo en `send`). */
export function docLang(): Lang {
  return typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "es";
}

export function LanguageSwitch({ className }: { className?: string }) {
  const lang = useLang();
  const router = useRouter();
  const d = useDict();
  return (
    <div role="radiogroup" aria-label={d.account.language} className={cx("inline-flex rounded-full bg-surface-2 p-1", className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === lang}
          onClick={() => {
            if (l === lang) return;
            document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            document.documentElement.lang = l;
            router.refresh();
          }}
          className={cx(
            "h-8 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors duration-200",
            l === lang ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"
          )}
        >
          {dicts[l].langName}
        </button>
      ))}
    </div>
  );
}
