const DEFAULT_AUTH_REDIRECT = "/pools";

export function getSafeAuthRedirect(nextPath: string | null): string {
  if (!nextPath) {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return nextPath;
}

export function buildAuthPageHref(
  pathname: string,
  nextPath: string | null,
): string {
  const safeNext = getSafeAuthRedirect(nextPath);

  if (safeNext === DEFAULT_AUTH_REDIRECT) {
    return pathname;
  }

  return `${pathname}?next=${encodeURIComponent(safeNext)}`;
}
