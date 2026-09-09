export function routeHref(route: string): string {
  const cleanRoute = route.startsWith('#/')
    ? route.slice(2)
    : route.startsWith('/')
      ? route.slice(1)
      : route;
  return `/${cleanRoute.replace(/^\/+/, '')}`;
}

export function currentRoute(): string {
  if (window.location.hash.startsWith('#/')) return window.location.hash.slice(2);
  return `${window.location.pathname.replace(/^\/+/, '')}${window.location.search}`;
}

export function navigateTo(route: string): void {
  window.history.pushState({}, '', routeHref(route));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function migrateLegacyRoute(): void {
  const route = currentRoute();
  const canonical = route
    .replace(/^(?:account|dashboard)(?=\/|\?|$)/, 'app')
    .replace(/^app\/credits(?=\?|$)/, 'app/usage')
    .replace(/^app\/shares(?=\?|$)/, 'app/traces')
    .replace(/^app\/?(?=\?|$)/, 'app/overview');
  if (canonical !== route || window.location.hash.startsWith('#/')) {
    window.history.replaceState({}, '', routeHref(canonical));
  }
}
