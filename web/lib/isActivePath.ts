/**
 * Whether a nav link is "active" for the current pathname — an exact match, or
 * a prefix match for nested routes. The home link ("/") only matches exactly.
 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}
