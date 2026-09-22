/**
 * @waterx/config — the official typed reader for waterx-config.
 *
 * The CDN serves ONE format: the consolidated shape (schema_version 2).
 *
 *   import { loadWaterxConfig } from "@waterx/config";
 *   const cfg = await loadWaterxConfig("mainnet");
 *   cfg.objects.oracle.aggregators["BTCUSD"]; // fully typed
 *
 * The validator is GENERATED from schema/waterx-config.schema.json; CI fails
 * if it drifts. Do not edit schema.ts by hand.
 *
 * Unknown fields are ACCEPTED but NOT PRESERVED: parsing validates live CDN
 * data that can gain fields before this package version does, and returns
 * the typed view — zod strips keys this version doesn't know (open maps like
 * `packages` keep every entry; unknown FIELDS on known objects are dropped).
 * Therefore NEVER re-serialize a parse result back into a config file — a
 * read-modify-write tool must patch the ORIGINAL document and use
 * parseWaterxConfig only to validate it. ID patterns, required fields and
 * the schema_version pin still bite; the strict reject-unknowns check is the
 * config repo's own ajv CI gate, where schema and data move together.
 */
import waterxConfigSchema from "./schema.ts";
import type { z } from "zod";
export { waterxConfigSchema };
/** The full network document. */
export type WaterxConfig = z.infer<typeof waterxConfigSchema>;
export type WaterxPackages = WaterxConfig["packages"];
export type SymbolsRegistry = WaterxConfig["symbols"];
export type OracleRules = WaterxConfig["oracle_rules"];
export type PerpMarket = WaterxConfig["objects"]["perp"]["markets"][string];
export type Network = "mainnet" | "testnet";
/**
 * The ONLY sanctioned base URL. raw.githubusercontent.com is rate-limited
 * (429) and forbidden by the repo README — this loader exists so no consumer
 * ever hardcodes it again.
 */
export declare const CONFIG_CDN_BASE = "https://config.waterx.app";
export declare class WaterxConfigError extends Error {
    /** HTTP status of the failed response, when the failure was an HTTP error. */
    readonly status?: number;
    constructor(message: string, opts?: {
        cause?: unknown;
        status?: number;
    });
}
export interface LoadOptions {
    /** Override the CDN base (tests, staging CDN). Never raw.githubusercontent.com. */
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    /** Per-attempt timeout in ms (default 10_000). */
    timeoutMs?: number;
    /** Total attempts (default 3, exponential backoff). Minimum 1. */
    attempts?: number;
    /** Base backoff delay in ms (default 500; attempt i waits base * 2^i). */
    backoffBaseMs?: number;
}
/** Fetch + parse one network's config. Throws WaterxConfigError on any failure. */
export declare function loadWaterxConfig(network: Network, opts?: LoadOptions): Promise<WaterxConfig>;
/** Parse an already-fetched document (pinned file, test fixture). */
export declare function parseWaterxConfig(doc: unknown, expectNetwork?: Network): WaterxConfig;
