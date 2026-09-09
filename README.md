# Exalto website

Marketing lives at `/`. Public tools live at `/traces`, `/registry`, `/verify`,
and `/s/{trace_id}`. The tools use the hosted API directly and do not load the
Capture account application. Capture docs and downloads are linked at
`https://capture.exalto.ai`.

Run `npm ci`, `npm run dev` (localhost:4175), or `npm run dev:sample` for labeled
synthetic data with writes disabled. The normal dev API is localhost:8080.
`VITE_API_ORIGIN`, `VITE_CAPTURE_ORIGIN`, and `VITE_WEBSITE_ORIGIN` configure
origins. Production defaults are api.exalto.ai, capture.exalto.ai, and exalto.ai.
Build with `npm run build`; run browser checks with `npm test` and route checks
with `npm run test:redirects`.

Vercel builds this repository with `npm run build` and publishes `dist`.
`vercel.json` maps public deep links to the tools HTML entry; no API proxy or
retired-domain redirects are needed. Configure the API to allow the website's
exact origin and credentials. Arbitrary Vercel preview origins are not allowed;
use sample mode or a configured staging API.

The generated hosted contract is committed under `src/tools/platform-api/generated`.
After regenerating it in the notary repo, run `npm run sync:api -- <generated-directory>`.
The build needs no sibling checkout. Browser tests retain the original public
trace, password protection, Registry, and verification coverage.
