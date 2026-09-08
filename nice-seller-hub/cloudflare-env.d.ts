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
  /**
   * El bucket de R2 donde se guardan las fotos que se suben desde el
   * dispositivo (perfil, portada, piezas).
   *
   * Opcional a proposito, igual que la clave de Anthropic: mientras R2 no este
   * activado en la cuenta y este binding no exista en `wrangler.jsonc`, el
   * boton de "Subir desde tu dispositivo" avisa que no esta disponible y el
   * campo de URL sigue funcionando normal. El dia que se active, esto empieza
   * a funcionar solo, sin tocar el resto del codigo.
   */
  MEDIA?: R2Bucket;
}
