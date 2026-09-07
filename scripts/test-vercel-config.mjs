import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));

assert.equal(config.framework, 'vite');
assert.deepEqual(config.redirects, [
  {
    source: '/docs',
    destination: 'https://seal.exalto.ai/docs',
    permanent: true,
  },
  {
    source: '/docs/(.*)',
    destination: 'https://seal.exalto.ai/docs/$1',
    permanent: true,
  },
]);

const headers = new Map(config.headers.map((entry) => [entry.source, entry.headers]));
assert.deepEqual(headers.get('/assets/:path*'), [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
]);
assert.deepEqual(headers.get('/(favicon.svg|pot-mark-white.svg|pot-mark-blue.svg|pot-tile.svg)'), [
  { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
]);
assert.deepEqual(headers.get('/(art|icons)/:path*'), [
  { key: 'Cache-Control', value: 'public, max-age=86400' },
]);

console.log('Vercel redirects and cache headers are configured.');
