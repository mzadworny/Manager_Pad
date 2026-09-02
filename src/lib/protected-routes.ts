export const PROTECTED_ROUTES = ["/dashboard", "/employees", "/meetings"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}
