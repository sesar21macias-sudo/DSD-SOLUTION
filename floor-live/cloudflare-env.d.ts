// Bindings del Worker (ver wrangler.jsonc).
interface CloudflareEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  /** Clave para crear la primera cuenta de administrador en /inicio. */
  SETUP_CODE?: string;
  /** Opcional: con ella, Claude escribe los resúmenes y ayuda con los anuncios. */
  ANTHROPIC_API_KEY?: string;
}
