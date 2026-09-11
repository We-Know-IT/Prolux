const ROOT_DOMAIN = 'proluxshine.com'

// Share the auth cookie across www.proluxshine.com, crm.proluxshine.com
// etc. so a login on one subdomain carries over to another. Returns
// undefined for localhost/preview hosts, where the default (host-only)
// cookie is what you want.
export function cookieDomainForHost(host: string): string | undefined {
  return host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`) ? `.${ROOT_DOMAIN}` : undefined
}
