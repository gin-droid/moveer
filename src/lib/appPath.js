const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');

export function appPath(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!appBase || appBase === '/') return normalizedPath;

  if (normalizedPath.startsWith(`${appBase}/#/`)) return normalizedPath;
  if (normalizedPath === appBase || normalizedPath === `${appBase}/`) {
    return `${appBase}/#/`;
  }
  if (normalizedPath.startsWith(`${appBase}/`)) {
    return `${appBase}/#${normalizedPath.slice(appBase.length)}`;
  }

  return `${appBase}/#${normalizedPath}`;
}