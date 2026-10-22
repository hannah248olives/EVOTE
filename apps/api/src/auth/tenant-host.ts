import { resolveTenantBySubdomain, type Database } from "@evote/database";

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Extracts the school's subdomain from a Host header: `stmarys.evote.app:3001` gives `stmarys`
 * when the base domain is `evote.app`. Returns null for anything else, including nested
 * subdomains and the bare base domain.
 */
export function subdomainFromHost(host: string | undefined, baseDomain: string): string | null {
  if (!host) return null;
  const hostname = host.toLowerCase().replace(/:\d{1,5}$/, "");
  const suffix = `.${baseDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  return LABEL.test(label) ? label : null;
}

/** Maps a Host header to the id of an active school, or null when there is none. */
export async function resolveTenantFromHost(
  db: Database,
  host: string | undefined,
  baseDomain: string,
): Promise<string | null> {
  const subdomain = subdomainFromHost(host, baseDomain);
  return subdomain ? resolveTenantBySubdomain(db, subdomain) : null;
}
