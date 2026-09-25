import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lee una variable de entorno tanto en el worker de Cloudflare
 * (bindings/vars/secrets) como en `next dev` (process.env).
 */
export async function getEnvVar(name: string): Promise<string | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const v = (env as unknown as Record<string, unknown>)[name];
    if (typeof v === "string" && v) return v;
  } catch {
    // Sin contexto de Cloudflare (next dev): cae a process.env.
  }
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}
