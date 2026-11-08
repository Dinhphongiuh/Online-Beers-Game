/**
 * Minimal client-side router (History API) — the app only has a couple of routes:
 *   /login  → Cổng Quán (sign in / sign up / guest)
 *   /       → home menu + match (requires a session)
 */
import { useEffect, useState } from 'react';

export const ROUTES = {
  login: '/login',
  home: '/',
} as const;

const NAV_EVENT = 'tram-nhau:navigate';

const currentLocation = () => ({
  path: window.location.pathname || '/',
  search: window.location.search,
});

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** Re-renders on navigate() and on browser back/forward. */
export function useLocation() {
  const [loc, setLoc] = useState(currentLocation);
  useEffect(() => {
    const sync = () => setLoc(currentLocation());
    window.addEventListener('popstate', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);
  return loc;
}

/** `/login?next=/somewhere` → only same-site paths are honoured (no open redirects). */
export function safeNextPath(search: string): string {
  const next = new URLSearchParams(search).get('next') || ROUTES.home;
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith(ROUTES.login) ? next : ROUTES.home;
}

export function loginPathFor(path: string, search: string) {
  const next = path + search;
  return next === ROUTES.home ? ROUTES.login : `${ROUTES.login}?next=${encodeURIComponent(next)}`;
}
