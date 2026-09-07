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
The production Caddy server permanently redirects `/docs`
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

## Deploy (Fly)

The `Deploy website` workflow builds the image on Fly, pins it to a `sha256`
digest, deploys it, verifies the site serves, and restores the previous digest
if anything fails. It is manual-only until `FLY_LANDING_DEPLOY_TOKEN` is added
to this repository's `production` environment. The copy audit runs inside the
image build, so a banned term fails the build before production changes; the
same audit runs on pull requests through the `Website` CI job.

The landing site is deliberately not part of the gated three-service promotion
in `deploy.yml`; see the landing rollout section of `deploy/fly/README.md`.

To deploy from a workstation instead:

```bash
fly deploy . \
  --config fly.toml \
  --app exalto-prod-landing
```

Cutover checklist (founder-owned, in order):

1. Create the Fly app, allocate a dedicated IPv4 and an IPv6, store the
   `FLY_LANDING_DEPLOY_TOKEN` repository secret, then add the DNS records and
   issue certs. `deploy/fly/README.md` has the exact commands. The first
   rollout happens on the next push to `main`; `exalto.ai` is an apex name, so
   it takes `A`/`AAAA` records rather than a CNAME.
2. Add `seal.exalto.ai` as a cert/hostname on the existing web app and switch
   its `NOTARY_PUBLIC_ORIGIN`/`VITE_PUBLIC_ORIGIN` build arg when ready.
3. 301 `notary.exalto.ai` to `seal.exalto.ai` on the old hostname.
4. Update OAuth redirect URIs (Google, GitHub), the Stripe webhook URL, and the
   product site's hardcoded install command.
5. Later, move the notary endpoint hostname (`alice.notary.exalto.ai`) with a
   Registry generation bump; it keeps working unchanged until then.
