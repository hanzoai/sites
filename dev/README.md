# Running the four sites locally

Nothing here is part of the app. It stands up the two things the app talks to —
a **real cloud binary** serving `/v1/framework/*`, and an **IAM issuer** — so the
shell can be driven end to end without touching production.

## 1. A local cloud

`hanzoai/cloud` builds in ~25s and can run one subsystem:

```bash
cd ~/work/hanzo/cloud
export PATH="$HOME/.cargo/bin:$PATH" TMPDIR=$HOME/.cache/tmp
(cd native/flags && cargo build --release)
go build -o /tmp/cloudbin ./cmd/cloud

CLOUD_IAM_ISSUER=http://127.0.0.1:9099 \
/tmp/cloudbin -listen 127.0.0.1:8099 -data-dir ./.data \
              -enable framework \
              -kms-master-key-ref "$(printf 'hanzo-local-test-key-32-bytes!!!' | base64 -w0)"
```

`-enable framework` mounts the DocType engine and the app lanes that register
their fixtures with it (cms, erp, help, kb, content) and nothing else.

## 2. A local IAM

```bash
node dev/iam-stub.mjs        # http://127.0.0.1:9099
```

It serves the four endpoints the `@hanzo/iam` browser SDK calls, so the app runs
its **real** PKCE flow — there is no dev-only auth branch in the app itself. The
JWT it signs carries the `orgs` claim cloud reads to decide tenancy, and cloud
validates its signature against the JWKS this serves.

## 3. The app

```bash
cp .env.example .env.local   # points at the two above
npm run dev                  # http://localhost:3100
```

Then open the four hosts. `*.localhost` resolves to loopback in every browser, so
local development exercises the **real** host→site rule rather than a query
parameter:

- http://erp.localhost:3100
- http://crm.localhost:3100
- http://cms.localhost:3100
- http://help.localhost:3100
