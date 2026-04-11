const LOCAL_APP_ORIGIN = 'http://localhost:3000';

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getConfiguredAppOrigin(): string | null {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configuredOrigin) {
    return null;
  }

  return normalizeOrigin(configuredOrigin);
}

export function getPublicAppOrigin(): string {
  const configuredOrigin = getConfiguredAppOrigin();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return normalizeOrigin(window.location.origin);
  }

  return LOCAL_APP_ORIGIN;
}

export function buildPublicAppUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getPublicAppOrigin()}${normalizedPath}`;
}
