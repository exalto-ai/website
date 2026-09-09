import { useEffect, useState } from 'react';
import { getListedTraces } from '../platform-api/client';
import './siteStyles';
import { initialThemePreference, resolvedTheme } from '../theme';
import { RegistryPage } from './RegistryPage';
import { currentRoute } from './navigation';
import { captureHref } from './origins';
import { PublicTracePage, PublicTraces, VerificationPage } from './PublicTracePages';


export function PublicTools({
  loadShares = getListedTraces,
}: {
  loadShares?: typeof getListedTraces;
} = {}) {
  const [route, setRoute] = useState(currentRoute);
  const section = route.split(/[/?]/)[0];
  const traceMatch = route.split('?')[0].match(/^s\/([^/]+)\/?$/);
  const traceId = traceMatch ? decodeURIComponent(traceMatch[1]) : null;
  useEffect(() => {
    const update = () => {
      const next = currentRoute();
      setRoute(next);
    };
    update();
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = resolvedTheme(initialThemePreference(), media.matches);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  useEffect(() => {
    const title = traceId
      ? 'Shared trace'
      : section === 'verify'
        ? 'Verify'
        : section === 'registry'
          ? 'Registry'
          : 'Published Traces';
    document.title = `${title} · Exalto`;
  }, [section, traceId]);
  return (
    <>
      <header className="app-nav seal-nav">
        <a className="app-brand" href="/" aria-label="Exalto home">
          <span>Exalto</span>
        </a>
        <nav className="app-nav-links" aria-label="Product">
          <a href="/traces" aria-current={!section || section === 'traces' ? 'page' : undefined}>
            Traces
          </a>
          <a href="/verify" aria-current={section === 'verify' ? 'page' : undefined}>
            Verify
          </a>
          <a href="/registry" aria-current={section === 'registry' ? 'page' : undefined}>
            Registry
          </a>
        </nav>
        <div className="app-nav-actions">
          <a className="app-sign-in-link" href={captureHref('/app/')}>
            Capture ↗
          </a>
        </div>
      </header>
      {traceId ? (
        <PublicTracePage traceId={traceId} />
      ) : section === 'verify' ? (
        <VerificationPage />
      ) : section === 'registry' ? (
        <RegistryPage />
      ) : !section || section === 'traces' ? (
        <PublicTraces loadShares={loadShares} />
      ) : (
        <main className="legal-shell">
          <h1>Page not found</h1>
          <a href="/">Browse published Traces</a>
        </main>
      )}
<footer className="app-footer"><a href="/">Exalto</a><nav aria-label="Footer"><a href={captureHref("/privacy")}>Privacy</a><a href={captureHref("/terms")}>Terms</a></nav></footer>
    </>
  );
}
