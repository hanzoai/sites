# @hanzo/sites

**One app. Four hosts.** `erp` · `crm` · `cms` · `help` — on every brand.

```
erp.hanzo.ai  ─┐
crm.hanzo.ai  ─┤
cms.hanzo.ai  ─┼──▶  this app  ──▶  /v1/framework/*  (the DocType engine)
help.hanzo.ai ─┘
erp.lux.network, help.zoo.ngo, … same code, same build
```

Not four applications with a shared component library. **One** application whose
`module` is a value read off the hostname.

## Why this is possible

`hanzoai/cloud clients/framework` is a metadata-driven DocType engine: an app lane
is a `module` tag over a registry of DocTypes, and a record is a document validated
against one. An ERP Sales Order, a CRM Deal, a CMS Page and a Helpdesk Ticket are
the same kind of thing with different metadata.

So the renderer can be generic too. `@hanzo/ui/framework` (8.0.39+) is that
renderer — one list, one detail, one form, driven by DocType metadata alone, with
a mobile layout that is a decision rather than a media query (cards on a phone,
table on a desktop). This repo is what is left over once the engine and the
renderer both exist:

| file | what it decides |
|---|---|
| `src/sites.ts` | the first DNS label → which module. **The whole difference between the four.** |
| `src/config.ts` | the registered domain → which brand, API origin and IAM issuer |
| `src/session.tsx` | the IAM PKCE session (the console's path, not a second one) |
| `src/framework.ts` | the bearer transport — the one thing `@hanzo/ui/framework` leaves to the host |
| `src/Shell.tsx` | `AppHeader`, the brand lockup, and the brand / product / collection breadcrumb |
| `src/Site.tsx` | `[] \| [doctype] \| [doctype,name]` → list \| detail \| form |
| `app/[[...path]]/page.tsx` | the one route |

There is no per-module branch anywhere, and adding a fifth product is one entry in
`SITES` plus a DNS record.

## Two independent resolutions

The **first label** picks the SITE. The **registered domain** picks the BRAND.
Keeping them apart is why `erp.zoo.ngo` is an ordinary sentence rather than a
special case: site `erp`, brand `zoo`, API `api.zoo.ngo`, issuer `zoolabs.id`, and
Zoo's own mark in the header. `@hanzo/brand` owns the host→brand table; this repo
must never grow a second copy of it.

> `@hanzo/brand`'s `getBrand()` takes a **host**, not a brand id — `getBrand('lux')`
> matches no suffix and silently returns the DEFAULT (Hanzo) brand. Key `BRANDS`
> directly. This cost a real white-label bug here; see the note in `src/config.ts`.

## Auth

`@hanzo/iam`'s browser SDK, PKCE, against the brand's IAM — the same client and the
same flow the console uses. The access token is the only credential this app holds
and the only thing it presents to the API; cloud derives the org from the token's
own membership claim, so this app never sees, sends, or chooses an org.

## Run it locally

`dev/README.md` has the full recipe. Short version:

```bash
node dev/iam-stub.mjs                   # a local IAM issuer, port 9299
/tmp/cloudbin -listen 127.0.0.1:8299 \
  -data-dir ./.data -enable framework \
  -kms-master-key-ref "$(printf 'hanzo-local-test-key-32-bytes!!!' | base64 -w0)"
node dev/seed.mjs                       # install cms/erp/help, define crm, add records
npm run dev                             # http://localhost:3100
```

Then visit **http://erp.localhost:3100**, `crm.`, `cms.`, `help.` — `*.localhost`
is loopback in every browser, so local development exercises the real host→site
rule rather than a query parameter.

```bash
npm run typecheck     # tsgo — TypeScript 7 native, ~2s where tsc takes ~14s
npm test              # vitest — the host→site and host→brand rules
npm run e2e           # e2e/ — tokens.spec needs only `next start`; shots.spec
                      #   needs the local stack above and writes shots/
npm run audit         # audit/ — the adversarial visual probes (overflow, contrast,
                      #   tap targets); output lands in audit-shots/
```

`next build` still runs its own `tsc` pass — that step is Next's, and it is the
only one that sees the route types it generates mid-build, so it stays. `tsgo`
owns the standalone typecheck, which is the one developers run in a loop.

## Styling

No Tailwind, no shadcn, no Radix — not removed here, never present. Styling is
`@hanzo/gui` props plus two plain stylesheets, and the split between them is
strict:

- **`@hanzo/ui/theme.css`** — the fleet tokens (`--background`, `--border`,
  `--radius`, the Geist family variables, the elevation ladder). Imported first in
  `app/layout.tsx`. `@hanzo/ui`'s components name these; a host that skips it gets
  transparent borders and surfaces while every request still returns 200.
- **`app/globals.css`** — only what the token sheet does *not* say: fetching the
  Geist face, the document reset, and `.mono`. Nothing here may name a font
  family or a colour literal.

`<html>` carries both `dark` (what the token sheet keys on) and `t_dark` (what
gui's runtime reads), server-side, so the first paint is already dark.
`e2e/tokens.spec.ts` asserts the tokens actually resolve in a real browser.

## How it would be deployed

Nothing here is deployed by this repo. The shape it takes:

1. **Build** — `hanzo.yml` at the root, `.hanzo/workflows/cicd.yml` importing
   `hanzoai/ci`, image to `oci.hanzo.ai/hanzo/sites:vX.Y.Z`. No local builds.
2. **Run** — one operator `Service` CR, one Deployment. **One workload for all four
   hosts**, because the host is read at runtime; four ingress hosts point at it.
   Scaling four products is scaling one thing.
3. **Ingress** — `hanzoai/ingress` routes `{erp,crm,cms,help}.<brand>` to that
   Service. The API stays on `api.<brand>`; CORS is answered by exactly ONE layer
   (today the shared Traefik `cors-allow-all` on `api.hanzo.ai`), never two — a
   duplicate `Access-Control-Allow-Origin` breaks every browser preflight.
4. **IAM** — add the four callback URLs to the brand's existing public app
   (`hanzo-app` / `lux-app` / …). One application, four redirect URIs; a client per
   host would be four registrations of one thing.
5. **Cutover** — `cms.hanzo.ai` and `help.hanzo.ai` are serving today (Payload and
   Frappe). This does not touch them. Point a host here only after its module's
   content has been migrated onto the engine; `erp.hanzo.ai` (502) and
   `crm.hanzo.ai` (404) have nothing to displace and can go first.
