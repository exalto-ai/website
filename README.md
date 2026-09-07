# Exalto website (exalto.ai)

The marketing landing page for the Exalto Notary Protocol, built from the
`design_handoff_exalto_7a` handoff ("Record + Protocol" in Ledger Phosphor).
Static-first Vite with no framework: semantic HTML, one tokenized stylesheet,
and a small vanilla script for the contribution-history popover and the hero
ledger loop. Fully responsive; all motion is CSS and disabled under
`prefers-reduced-motion`.

This site is separate from the hosted product site at `seal.exalto.ai`. Product
links point at that origin by default and can be changed at build time with
`VITE_PRODUCT_ORIGIN`.

The public user guides live only at [Exalto Seal docs](https://seal.exalto.ai/docs).
Vercel permanently redirects `/docs`
and `/docs/*` to the product origin, preserving paths and queries. The image's
`EXALTO_PRODUCT_ORIGIN` build argument supplies both the links and redirects;
it must be an origin without a trailing slash.
Vite dev/preview serves only the landing page; use the redirect test below to
exercise Caddy. Runtime reference docs remain in `runtime/docs`.

## Develop

```bash
npm ci
npm run dev        # http://127.0.0.1:4174
npm run build      # runs the copy audit, then builds dist/
npm run preview
npm run test:redirects # requires Docker and a completed build
```

`npm run check:copy` enforces the handoff QA checklist: banned vocabulary
absent (notarize, finaliz*, checkpoint, fingerprint claims, any API), required
doctrine strings present verbatim, tile order, and no em- or en-dashes in
rendered copy.

## Placeholders

- The three Proof of Thought CTAs point at the `#pot` band and the band's join
  button reads "early access · opens soon" until `POT_EARLY_ACCESS_URL` exists;
  swap the `#pot` hrefs and the button when it does.
- `favicon.svg` is a placeholder; no commissioned logo exists yet.
- No `og:image` yet (open item; suggestion: a rendered receipt card).
- The applications grid ships with the pointillist Ledger Grain art from
  `public/art/`; product marks used on the page live in `public/icons/`.

## Deploy (Vercel)

The Vercel project is connected to this GitHub repository. Pull requests get
preview deployments and pushes to `main` deploy to production. Vercel detects
Vite and publishes `dist/`; redirects and cache headers live in `vercel.json`.

The custom domain is configured separately in Vercel when exalto.ai is ready
to move from its current host.
