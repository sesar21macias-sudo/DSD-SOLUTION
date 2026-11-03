import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lee variables del Worker. En `next dev` OpenNext las inyecta desde .dev.vars;
 * en producción vienen de los secrets de Cloudflare.
 */
export async function getEnv(): Promise<CloudflareEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env;
  } catch {
    return process.env as unknown as CloudflareEnv;
  }
}
