// Generado/mantenido a mano; `npm run cf-typegen` lo regenera desde wrangler.jsonc.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  /**
   * Secret de Cloudflare, para la lectura de tickets con visión.
   * `wrangler secret put ANTHROPIC_API_KEY`
   *
   * Es opcional a proposito: sin ella todo lo demas de la aplicacion funciona
   * y la recepcion cae al modo de captura manual.
   */
  ANTHROPIC_API_KEY?: string;
}
