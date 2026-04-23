export function isAuthRoute(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/register");
}

