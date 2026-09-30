/**
 * Import-specifier rewrites `sync-from-sdk.mjs` applies to every vendored file:
 * the standalone package reaches the SDK through the `@waterx/sdk` export map,
 * never through relative paths into `src/`. Its own module, free of side
 * effects, so the vendored-copy test can apply the SAME rewrite.
 */
export function rewriteSdkImports(content) {
  return (
    content
      .replace(/from "~predict\/([^"]+)\.ts"/g, 'from "@waterx/sdk/prediction/$1"')
      .replace(/from '\~predict\/([^']+)\.ts'/g, "from '@waterx/sdk/prediction/$1'")
      // Codegen lives at `src/generated/`, exported as `@waterx/sdk/generated/*`.
      // There is no `prediction/generated` subpath — the prediction line imports
      // from the single shared root.
      .replace(/from "(?:\.\.\/)+src\/generated\/([^"]+)\.ts"/g, 'from "@waterx/sdk/generated/$1"')
      .replace(/from '(?:\.\.\/)+src\/generated\/([^']+)\.ts'/g, "from '@waterx/sdk/generated/$1'")
      // `DEFAULT_GRPC_URLS` lives on `src/base-client.ts` upstream and is
      // re-exported on the prediction export map for exactly this reason.
      .replace(/from "(?:\.\.\/)+src\/base-client\.ts"/g, 'from "@waterx/sdk/prediction"')
      .replace(/from '(?:\.\.\/)+src\/base-client\.ts'/g, "from '@waterx/sdk/prediction'")
      // The env-boundary URL rule is vendored next to the helpers (OTHER_FILES).
      // ...and it composes through the SDK's public `waterxConfigUrlFromRoot`.
      .replace(/from "(?:\.\.\/)+src\/config-url\.ts"/g, 'from "@waterx/sdk/config"')
      .replace(/from '(?:\.\.\/)+src\/config-url\.ts'/g, "from '@waterx/sdk/config'")
      .replace(/from "(?:\.\.\/)+scripts\/waterx-config-url\.ts"/g, 'from "./waterx-config-url.ts"')
      .replace(/from '(?:\.\.\/)+scripts\/waterx-config-url\.ts'/g, "from './waterx-config-url.ts'")
  );
}
