# `vendor/` — temporary dependency bridges

## `waterx-config/` — `@waterx/config` built from `staging-v2`

`@waterx/config` on the npm registry is still `0.1.1-staging.1`, which predates
the per-credit maps (`objects.credit.registries`, `objects.custody.vaults`,
`objects.withdrawal_queue.{executors,queues}`) the SDK now requires — that
parser STRIPS them, so the SDK cannot resolve any credit stack against it.

Until the config repo publishes the next prerelease, this directory carries a
build of `waterx-config` **`staging-v2` @ `e21549f`** (`packages/ts`, `pnpm build`
output only, no scripts) and `package.json` routes the dependency at it through
a **pnpm override**:

```jsonc
"dependencies": { "@waterx/config": "0.1.1-staging.2" },   // what consumers will install
"pnpm":         { "overrides": { "@waterx/config": "file:vendor/waterx-config" } } // what THIS repo installs
```

The published manifest therefore declares the registry version the SDK
actually needs (publint-clean), while local dev / CI resolve the vendored
build. **Do not run the `Publish package` workflow until that registry version
exists** — a consumer install would fail on the missing version.

### Removing the bridge

1. Publish `@waterx/config` from `waterx-config` `staging-v2` (gated workflow).
2. Delete the `pnpm.overrides` entry, set `dependencies["@waterx/config"]` to the
   published version, `pnpm install`, delete `vendor/waterx-config` and this file.
3. `pnpm check && pnpm build && pnpm check:exports`.

### Refreshing the vendored build

```sh
cd ../waterx-config && git checkout staging-v2 && git pull
cd packages/ts && pnpm install && pnpm build
rsync -a --delete dist/ ../../../waterx-sdk/vendor/waterx-config/dist/
# then bump the `version` label in vendor/waterx-config/package.json to `<next>-<short sha>`
```
