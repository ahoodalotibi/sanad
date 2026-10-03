import { useCallback, useEffect, useState } from 'react';

export type Route = 'home' | 'ask';

export function parseRoute(hash: string): Route {
  return hash.replace(/^#\/?/, '').split(/[/?]/)[0] === 'ask' ? 'ask' : 'home';
}

/** Minimal hash routing: #/ = home, #/ask = conversation. Keeps URLs shareable without a router dependency. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => (typeof window === 'undefined' ? 'home' : parseRoute(window.location.hash)));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = next === 'ask' ? '#/ask' : '#/';
    if (window.location.hash !== hash) window.location.hash = hash;
    window.scrollTo({ top: 0 });
    setRoute(next);
  }, []);

  return [route, navigate];
}
