import { defineConfig } from 'vite';

// The hosted product site. The landing links to it for docs, downloads,
// verification, traces, the Registry, and legal pages.
const productOrigin = process.env.VITE_PRODUCT_ORIGIN ?? 'https://seal.exalto.ai';
const productOriginUrl = new URL(productOrigin);
if (
  !['http:', 'https:'].includes(productOriginUrl.protocol) ||
  productOrigin !== productOriginUrl.origin ||
  productOriginUrl.pathname !== '/' ||
  productOriginUrl.search ||
  productOriginUrl.hash
) {
  throw new Error(
    'VITE_PRODUCT_ORIGIN must be a canonical HTTP(S) origin without a trailing slash, path, query, or fragment',
  );
}

export default defineConfig({
  plugins: [
    {
      name: 'product-origin',
      transformIndexHtml(html) {
        return html.replaceAll('%PRODUCT_ORIGIN%', productOriginUrl.origin);
      },
    },
  ],
  server: { port: 4174 },
  preview: { port: 4174 },
});
