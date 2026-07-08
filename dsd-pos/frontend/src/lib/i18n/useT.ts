import { useLocaleStore } from '@/store/locale'
import { dictionaries, TranslationKey } from './dictionaries'

// t('login.welcome', { name: 'Ana' }) -> reemplaza {name} en la cadena traducida.
export function useT() {
  const locale = useLocaleStore((s) => s.locale)

  function t(key: TranslationKey, vars?: Record<string, string>): string {
    let text: string = dictionaries[locale][key] ?? dictionaries.es[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, v)
      }
    }
    return text
  }

  return { t, locale }
}
