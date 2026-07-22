import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Config mínima para el esqueleto (fase 1, sin ISR real todavía).
// Cuando se conecten Supabase/Google/Anthropic (fases futuras) y haya
// contenido que se beneficie de cache incremental, aquí se puede añadir
// un R2 incremental cache: ver https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
