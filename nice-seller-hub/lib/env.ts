import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lee los bindings del Worker. En `next dev` OpenNext los inyecta desde
 * wrangler.jsonc y .dev.vars; en produccion vienen de Cloudflare.
 */
export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}
