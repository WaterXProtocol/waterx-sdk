/**
 * WaterX prediction deployment config loader.
 *
 * Mirrors the canonical `waterx-config` JSON for the packages used by this SDK
 * and fetches it from GitHub raw by default.
 */

import type { Network } from "./constants.ts";

export interface WaterxConfigPackageBase {
  published_at: string;
  original_id?: string;
  version?: number;
  upgrade_capability?: string;
}

export interface WaterxAccountPackage extends WaterxConfigPackageBase {
  admin_cap?: string;
  account_registry: string;
}

export interface WaterxPredictionPackage extends WaterxConfigPackageBase {
  admin_cap?: string;
  global_config: string;
  market_registries: Record<string, string>;
  settlement_coin_types?: Record<string, string>;
}

export interface WaterxPredictionConfigPackages {
  bucket_framework: WaterxConfigPackageBase;
  waterx_account: WaterxAccountPackage;
  waterx_prediction: WaterxPredictionPackage;
  [name: string]: unknown;
}

export interface WaterxPredictionConfig {
  network?: string;
  chain_id?: string | number | null;
  grpcUrl?: string;
  packages: WaterxPredictionConfigPackages;
}

export interface LoadConfigOptions {
  /** Override the default waterx-config raw JSON URL. */
  configUrl?: string;
  /** Reuse a previously fetched config in memory. Default: false. */
  cache?: boolean;
  /** Optional fetch implementation for tests or runtimes without global fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. Default: 10_000. */
  timeoutMs?: number;
}

const DEFAULT_CONFIG_URL_BASE =
  "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main";

export function defaultConfigUrl(network: Network): string {
  return `${DEFAULT_CONFIG_URL_BASE}/${network.toLowerCase()}.json`;
}

const configCache = new Map<string, WaterxPredictionConfig>();

export function clearConfigCache(): void {
  configCache.clear();
}

export async function loadConfig(
  network: Network,
  opts: LoadConfigOptions = {},
): Promise<WaterxPredictionConfig> {
  const url = opts.configUrl ?? defaultConfigUrl(network);
  if (opts.cache && configCache.has(url)) {
    return configCache.get(url)!;
  }

  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!fetchImpl) {
    throw new Error("loadConfig: no global fetch available; pass opts.fetchImpl");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`loadConfig: HTTP ${response.status} fetching ${url}`);
  }

  const raw = (await response.json()) as WaterxPredictionConfig;
  validateConfig(raw, network, url);

  if (opts.cache) {
    configCache.set(url, raw);
  }
  return raw;
}

function validateConfig(cfg: WaterxPredictionConfig, expected: Network, url: string): void {
  if (cfg.network !== undefined && cfg.network.toUpperCase() !== expected) {
    throw new Error(
      `loadConfig: config at ${url} declares network=${cfg.network} but caller asked for ${expected}`,
    );
  }
  if (!isRecord(cfg.packages)) {
    throw new Error(`loadConfig: config at ${url} has no packages object`);
  }

  const packages = cfg.packages;
  requirePublishedPackage(packages.bucket_framework, "bucket_framework", url);
  const account = requirePublishedPackage(packages.waterx_account, "waterx_account", url);
  const prediction = requirePublishedPackage(packages.waterx_prediction, "waterx_prediction", url);

  if (!isNonEmptyString((account as WaterxAccountPackage).account_registry)) {
    throw new Error(
      `loadConfig: config at ${url} missing packages.waterx_account.account_registry`,
    );
  }
  if (!isNonEmptyString((prediction as WaterxPredictionPackage).global_config)) {
    throw new Error(
      `loadConfig: config at ${url} missing packages.waterx_prediction.global_config`,
    );
  }
  if (!isRecord((prediction as WaterxPredictionPackage).market_registries)) {
    throw new Error(
      `loadConfig: config at ${url} missing packages.waterx_prediction.market_registries`,
    );
  }
}

function requirePublishedPackage(
  value: unknown,
  name: string,
  url: string,
): WaterxConfigPackageBase {
  if (!isRecord(value) || !isNonEmptyString(value.published_at)) {
    throw new Error(`loadConfig: config at ${url} missing packages.${name}.published_at`);
  }
  return value as unknown as WaterxConfigPackageBase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
