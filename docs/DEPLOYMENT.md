# GitHub Pages deployment

Live application: <https://wieslawsoltes.github.io/ConduitCAD/>.

The full editable workspace lives on `main`: all thirteen reusable packages,
application sources, tests, examples, documentation, production build and npm
archives. No archive reconstruction or download from this conversation is needed.

## Continuous delivery

`.github/workflows/pages.yml` validates pull requests without deploying them.
Pushes to `main` and manual runs on `main` additionally deploy `dist/` to the
`github-pages` environment. The pipeline links local packages without downloading
npm dependencies, runs unit tests, builds the app, packs all thirteen modules,
then runs browser/touch workflows and independent DXF validation.

After deployment, `scripts/verify-pages.mjs` requests the real project root and
all eight other production resources, including the standalone HTML, worker,
service worker, web manifest and build metadata. Every response must have status
200 and match the SHA-256 of the locally reproduced build. Bounded retries allow
CDN propagation; a mismatch fails the job rather than reporting a false success.
The exact result is saved as the `conduitcad-live-deployment-verification`
workflow artifact. This checks HTTP delivery and byte identity, not GPU hardware
execution. The browser tests report which rendering backend was available.

Build jobs have read-only repository access. Only the deployment job receives
Pages-write and OIDC permissions; normal CI never commits or pushes changes.

## Local reproduction

```sh
node scripts/bootstrap.mjs
npm test
npm run build
npm run pack:packages
npm run dev
```

In another terminal:

```sh
node scripts/verify-pages.mjs http://localhost:4173/
```

To compare this checkout's build with the production site:

```sh
node scripts/verify-pages.mjs https://wieslawsoltes.github.io/ConduitCAD/
```

Serve the contents of `dist/`, not the source repository root. All application
asset references, the manifest scope and the service-worker URL are relative,
so the `/ConduitCAD/` project path does not require root-domain rewriting.
