/**
 * waterx_prediction_gift / claimable_link bindings.
 *
 * Three responsibilities:
 *
 * 1. **KDF + signed-message format** — turn a 16-byte URL seed into an
 *    Ed25519 keypair (sha256 over a package-prefixed domain) and build
 *    the exact 92-byte payload `claim_share` verifies on chain.
 *    Every byte here must match `claimable_link.move` — one wrong byte
 *    and outstanding URLs break.
 *
 * 2. **URL helpers + offline gift-address derivation** — base64url(no-pad)
 *    encode/decode of the seed (URL fragment), and `deriveGiftAddress`
 *    which mirrors `derived_object::derive_address` locally so a
 *    receiver can compute `gift_id` from the seed without any RPC.
 *
 * 3. **PTB builders + simulate reads** — `createGift` / `claimShare` /
 *    `deleteGift` matching the on-chain entrypoints, plus single-RPC
 *    `simulateTransaction`-based read helpers for the view fns.
 */

import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { deriveObjectID, fromBase64, toBase64 } from "@mysten/sui/utils";
import { sha256 } from "@noble/hashes/sha2.js";

import { mapSelection, SelectionBcs } from "./bcs.ts";
import type { PredictClient } from "./client.ts";
import {
  GIFT_DOMAIN_CLAIM,
  GIFT_KDF_DOMAIN,
  GIFT_PUBKEY_LEN,
  GIFT_SIG_LEN,
  GIFT_URL_SEED_BYTES,
} from "./constants.ts";
import { extractReturnBytes } from "./fetch.ts";
import type { AccountIdentityParams, IdArgument, Selection } from "./types.ts";
import {
  clockArg,
  createAccountRequest,
  idArg,
  resolveAccountRegistry,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolveSettlementCoinType,
  toBigInt,
} from "./utils.ts";

// ---------------------------------------------------------------------
// Base config plumbing
// ---------------------------------------------------------------------

export interface GiftBaseParams {
  /** `waterx_prediction_gift` package id. Defaults to `client.waterxPredictionGiftPackageId()`. */
  giftPackageId?: string;
  /**
   * `waterx_prediction_gift` *original* (first-published) package id, used
   * ONLY for the `GiftKey` type tag in {@link deriveGiftAddress}. Defaults to
   * `client.waterxPredictionGiftTypeOriginId()` (config `original_id`, falling
   * back to `giftPackageId`/`published_at`). Distinct from `giftPackageId`,
   * which selects the *runtime* package for moveCall targets — after a package
   * upgrade the two diverge, and only the original id reproduces the on-chain
   * `gift_id`. Override only for offline derivation against a custom deploy.
   */
  giftTypeOriginId?: string;
  /** `ClaimableLinkConfig` object id. Defaults to `client.claimableLinkConfigId()`. */
  claimableLinkConfig?: string;
  /** Collateral / settlement coin type for the position's `Gift<T>`. Defaults to `client.settlementCoinType()`. */
  settlementCoinType?: string;
}

export interface GiftReferralParams {
  /** `waterx_referral` package id. Defaults to `client.waterxReferralPackageId()`. */
  referralPackageId?: string;
  /** `ReferralTable` object id. Defaults to `client.referralTableId()`. */
  referralTable?: string;
}

function resolveGiftPackageId(client: PredictClient, override?: string): string {
  return override === undefined || override === ""
    ? client.waterxPredictionGiftPackageId()
    : override;
}

/**
 * Resolve the package id for the `GiftKey` type tag in
 * {@link deriveGiftAddress}. Precedence: explicit `giftTypeOriginId`, then
 * the runtime `giftPackageId` override (a self-contained deploy where
 * original == published), then the client's config `original_id` (falling
 * back to `published_at`). This must key on the *original* id so the
 * off-chain derivation matches the on-chain type identity, which never
 * advances across package upgrades.
 */
function resolveGiftTypeOriginId(
  client: PredictClient,
  originOverride?: string,
  pkgOverride?: string,
): string {
  if (originOverride !== undefined && originOverride !== "") return originOverride;
  if (pkgOverride !== undefined && pkgOverride !== "") return pkgOverride;
  return client.waterxPredictionGiftTypeOriginId();
}

function resolveClaimableLinkConfig(client: PredictClient, override?: string): string {
  return override === undefined || override === "" ? client.claimableLinkConfigId() : override;
}

function resolveReferralTable(client: PredictClient, override?: string): string {
  return override === undefined || override === "" ? client.referralTableId() : override;
}

// ---------------------------------------------------------------------
// URL / base64url(no-pad) helpers
//
// Standard base64 maps to base64url by replacing +/= → -_ and dropping
// padding. Tiny enough to avoid pulling @scure/base.
// ---------------------------------------------------------------------

export function base64UrlNoPadEncode(bytes: Uint8Array): string {
  return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlNoPadDecode(value: string): Uint8Array {
  let b64 = value.replaceAll("-", "+").replaceAll("_", "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return fromBase64(b64);
}

/** CSPRNG-generated 16-byte URL seed. Uses `globalThis.crypto.getRandomValues`. */
export function generateGiftSeed(): Uint8Array {
  const seed = new Uint8Array(GIFT_URL_SEED_BYTES);
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error(
      "generateGiftSeed: globalThis.crypto.getRandomValues is unavailable; use Node >= 19 or a polyfill",
    );
  }
  globalThis.crypto.getRandomValues(seed);
  return seed;
}

export interface GiftUrlParts {
  /** Optional URL base (`https://waterx.io`). Empty → fragment-only path `/g/#<seed>`. */
  host?: string;
  /** Path prefix before `#<seed>`. Defaults to `/g/`. */
  path?: string;
}

/** Build the share URL: `<host><path>#<base64urlnopad(seed)>`. */
export function encodeGiftUrl(seed: Uint8Array, parts: GiftUrlParts = {}): string {
  assertSeedLength(seed);
  const host = parts.host ?? "";
  const path = parts.path ?? "/g/";
  return `${host}${path}#${base64UrlNoPadEncode(seed)}`;
}

/** Parse a share URL or fragment-only string back into the raw seed bytes. */
export function parseGiftUrl(url: string): { seed: Uint8Array } {
  const hashIdx = url.indexOf("#");
  if (hashIdx === -1) {
    throw new Error("parseGiftUrl: no '#' fragment in URL");
  }
  const fragment = url.slice(hashIdx + 1);
  if (fragment === "") throw new Error("parseGiftUrl: empty fragment");
  const seed = base64UrlNoPadDecode(fragment);
  assertSeedLength(seed);
  return { seed };
}

function assertSeedLength(seed: Uint8Array): void {
  if (seed.length !== GIFT_URL_SEED_BYTES) {
    throw new Error(`Gift URL seed must be ${GIFT_URL_SEED_BYTES} bytes, got ${seed.length}`);
  }
}

// ---------------------------------------------------------------------
// KDF + signed-message
// ---------------------------------------------------------------------

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Off-chain KDF: `sha256(KDF_DOMAIN || seed)` → 32-byte Ed25519 secret.
 * Bytes MUST match across SDK versions and downstream integrations or
 * every outstanding URL breaks.
 */
export function deriveGiftKeypair(seed: Uint8Array): Ed25519Keypair {
  assertSeedLength(seed);
  const secret = sha256(concatBytes(GIFT_KDF_DOMAIN, seed));
  return Ed25519Keypair.fromSecretKey(secret);
}

/**
 * Reproduce the bytes `claim_share` verifies:
 * `DOMAIN_CLAIM || bcs(gift_id) || bcs(sender)` = 28 + 32 + 32 = 92 bytes.
 */
export function buildGiftClaimMessage(giftId: string, sender: string): Uint8Array {
  return concatBytes(
    GIFT_DOMAIN_CLAIM,
    bcs.Address.serialize(giftId).toBytes(),
    bcs.Address.serialize(sender).toBytes(),
  );
}

/**
 * Raw Ed25519 over the claim payload — NOT Sui-intent-prefixed.
 * `claim_share` calls `ed25519::ed25519_verify` directly, so any
 * intent prefix would break verification.
 */
export async function signGiftClaim(
  giftKeypair: Ed25519Keypair,
  giftId: string,
  sender: string,
): Promise<Uint8Array> {
  const sig = await giftKeypair.sign(buildGiftClaimMessage(giftId, sender));
  if (sig.length !== GIFT_SIG_LEN) {
    throw new Error(`Gift signature must be ${GIFT_SIG_LEN} bytes, got ${sig.length}`);
  }
  return sig;
}

// ---------------------------------------------------------------------
// Offline gift-address derivation
//
// Mirrors `derived_object::derive_address(parent_id, GiftKey { pubkey })`.
// `deriveObjectID` from @mysten/sui/utils wraps the key in
// `DerivedObjectKey<K>` and hashes parent_id || type_tag || bcs(key)
// with blake2b-256, which matches the on-chain formula.
// ---------------------------------------------------------------------

const GiftKeyBcs = bcs.struct("GiftKey", {
  pubkey: bcs.vector(bcs.u8()),
});

/**
 * Compute the `gift_id` that `create_gift` will produce for the given
 * pubkey, offline. No RPC. Mirrors `claimable_link::derive_gift_address`.
 *
 * The `GiftKey` type tag is keyed on the gift package's *original* id
 * (via {@link resolveGiftTypeOriginId}), NOT `published_at`. On Sui a
 * struct's type identity stays pinned to its defining package's original
 * id and never advances across upgrades, so `derive_gift_address`
 * hashes `GiftKey` under that original id. Using `published_at` here would
 * silently diverge from the chain after the first package upgrade, yielding
 * the wrong `gift_id` for every gift. The moveCall targets elsewhere in
 * this module correctly stay on `published_at` (latest code).
 */
export function deriveGiftAddress(
  client: PredictClient,
  pubkey: Uint8Array,
  params: GiftBaseParams = {},
): string {
  if (pubkey.length !== GIFT_PUBKEY_LEN) {
    throw new Error(`Gift pubkey must be ${GIFT_PUBKEY_LEN} bytes, got ${pubkey.length}`);
  }
  const giftPkg = resolveGiftTypeOriginId(client, params.giftTypeOriginId, params.giftPackageId);
  const configId = resolveClaimableLinkConfig(client, params.claimableLinkConfig);
  const keyBytes = GiftKeyBcs.serialize({ pubkey: Array.from(pubkey) }).toBytes();
  return deriveObjectID(configId, `${giftPkg}::claimable_link::GiftKey`, keyBytes);
}

// ---------------------------------------------------------------------
// PTB builders — create / claim / delete
// ---------------------------------------------------------------------

export interface CreateGiftParams
  extends GiftBaseParams, GiftReferralParams, AccountIdentityParams {
  /** wxa account id (`0x2::object::ID`) that owns the source position. */
  sourceAccountId: IdArgument;
  /** Numeric `position_id` of the position to lock. */
  sourcePositionId: bigint | number | string;
  /** 32-byte gift pubkey (from `deriveGiftKeypair(seed).getPublicKey().toRawBytes()`). */
  pubkey: Uint8Array;
  /** Number of slices, 1..=MAX_SHARES_PER_GIFT. */
  shareCount: bigint | number | string;
  /** Absolute expiry in milliseconds. Must be strictly in the future. */
  expiresAtMs: bigint | number | string;
  /** Optional referral code applied to every claimer (idempotent). */
  referralCode?: string | null;
  /** Override `MarketRegistry<T>` id. Defaults to `client.marketRegistry()`. */
  marketRegistry?: string;
  /** Override `AccountRegistry` id. Defaults to `client.accountRegistry()`. */
  accountRegistry?: string;
}

/**
 * Lock one position behind `pubkey` and share it as a gift. Adds a
 * single `claimable_link::create_gift<T>` call to `tx` using the
 * caller's `bucket_framework::account::request` as the source-owner
 * authority. The transaction sender (`ctx.sender()`) must be the owner
 * of `sourceAccountId`.
 */
export function createGift(
  client: PredictClient,
  tx: Transaction,
  params: CreateGiftParams,
): Transaction {
  if (params.pubkey.length !== GIFT_PUBKEY_LEN) {
    throw new Error(
      `createGift: pubkey must be ${GIFT_PUBKEY_LEN} bytes, got ${params.pubkey.length}`,
    );
  }
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  const sourceOwnerRequest = createAccountRequest(client, tx, params);

  tx.moveCall({
    target: `${giftPkg}::claimable_link::create_gift`,
    typeArguments: [coinType],
    arguments: [
      tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.object(resolveReferralTable(client, params.referralTable)),
      sourceOwnerRequest,
      idArg(tx, params.sourceAccountId),
      tx.pure.u64(toBigInt(params.sourcePositionId)),
      tx.pure.vector("u8", Array.from(params.pubkey)),
      tx.pure.u64(toBigInt(params.shareCount)),
      tx.pure.u64(toBigInt(params.expiresAtMs)),
      tx.pure.option("string", params.referralCode ?? null),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface ClaimShareParams extends GiftBaseParams, GiftReferralParams {
  /** Shared `Gift<T>` object id. Derive locally via `deriveGiftAddress`. */
  giftId: string;
  /** Raw 64-byte Ed25519 signature over `buildGiftClaimMessage(giftId, sender)`. */
  sig: Uint8Array;
  /**
   * Recipient wxa account id, or `null`/`undefined` to land in the
   * claimer's main wxa (auto-created with alias `"main"` if the
   * claimer has none yet).
   */
  recipientAccountId?: IdArgument | null;
  /** prediction `GlobalConfig` id. Defaults to `client.globalConfigId()`. */
  globalConfig?: string;
  /** prediction `MarketRegistry<T>` id. Defaults to `client.marketRegistry()`. */
  marketRegistry?: string;
  /** `waterx_account::AccountRegistry` id. Defaults to `client.accountRegistry()`. */
  accountRegistry?: string;
}

/**
 * Claim one slice of a gift. The signature must be raw Ed25519 (NOT
 * Sui-intent-prefixed) over `DOMAIN_CLAIM || gift_id || sender`.
 * Pre-flight: fetch the gift and check `claimed_count < share_count`,
 * `now < expires_at_ms`, and `!claimed_addresses.contains(sender)` to
 * surface "already claimed" client-side instead of paying gas to abort.
 */
export function claimShare(
  client: PredictClient,
  tx: Transaction,
  params: ClaimShareParams,
): Transaction {
  if (params.sig.length !== GIFT_SIG_LEN) {
    throw new Error(`claimShare: sig must be ${GIFT_SIG_LEN} bytes, got ${params.sig.length}`);
  }
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  // recipient_account_id is `Option<ID>` — tx.pure.option only accepts a
  // string literal id, so a TransactionArgument here would need a
  // different code path (build the Option via Move calls). Bail loudly.
  if (
    params.recipientAccountId !== undefined &&
    params.recipientAccountId !== null &&
    typeof params.recipientAccountId !== "string"
  ) {
    throw new Error("claimShare: recipientAccountId must be a string id or null/undefined");
  }

  tx.moveCall({
    target: `${giftPkg}::claimable_link::claim_share`,
    typeArguments: [coinType],
    arguments: [
      tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig)),
      tx.object(params.giftId),
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.object(resolveReferralTable(client, params.referralTable)),
      tx.pure.option("id", (params.recipientAccountId as string | null | undefined) ?? null),
      tx.pure.vector("u8", Array.from(params.sig)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface DeleteGiftParams extends GiftBaseParams, AccountIdentityParams {
  /** Shared `Gift<T>` object id to consume. */
  giftId: string;
}

/**
 * Creator-driven hard delete. Consumes the `Gift<T>` by value and
 * removes it from `config.creator_gifts[creator]`. The source position
 * stays on the creator's wxa; nothing to refund. Skips the paused gate
 * — cancel must work even when the package is paused.
 */
export function deleteGift(
  client: PredictClient,
  tx: Transaction,
  params: DeleteGiftParams,
): Transaction {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  const creatorRequest = createAccountRequest(client, tx, params);

  tx.moveCall({
    target: `${giftPkg}::claimable_link::delete_gift`,
    typeArguments: [coinType],
    arguments: [
      tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig)),
      tx.object(params.giftId),
      creatorRequest,
      clockArg(tx),
    ],
  });
  return tx;
}

// ---------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------

export interface GiftView {
  giftId: string;
  creator: string;
  creatorAccountId: string;
  sourcePositionId: bigint;
  marketId: Uint8Array;
  marketIdHex: string;
  selection: Selection;
  totalSpend: bigint;
  spendPerShare: bigint;
  lockedOddsCents: bigint;
  pubkey: Uint8Array;
  shareCount: bigint;
  claimedCount: bigint;
  claimedAddresses: string[];
  baseShareAmount: bigint;
  extraShareLinks: bigint;
  totalShares: bigint;
  remainingShares: bigint;
  referralCode: string | null;
  createdAtMs: bigint;
  expiresAtMs: bigint;
}

/**
 * Fetch a single gift's full view in one RPC by batching every getter
 * into one simulated PTB. Decodes each `commandResults[i].returnValues[0]`
 * into the corresponding TypeScript field.
 */
export async function getGift(
  client: PredictClient,
  params: GiftBaseParams & { giftId: string },
): Promise<GiftView> {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  const tx = new Transaction();
  const giftArg = tx.object(params.giftId);

  // Ordering is load-bearing: result decoders below index by command position.
  const callGetter = (name: string): void => {
    tx.moveCall({
      target: `${giftPkg}::claimable_link::${name}`,
      typeArguments: [coinType],
      arguments: [giftArg],
    });
  };
  const getterOrder = [
    "gift_id",
    "creator",
    "creator_account_id",
    "source_position_id",
    "market_id",
    "selection",
    "total_spend",
    "spend_per_share",
    "locked_odds_cents",
    "pubkey",
    "share_count",
    "claimed_count",
    "claimed_addresses",
    "base_share_amount",
    "extra_share_links",
    "total_shares",
    "remaining_shares",
    "referral_code",
    "created_at_ms",
    "expires_at_ms",
  ] as const;
  for (const g of getterOrder) callGetter(g);

  const result = await client.simulate(tx);
  let i = 0;
  const id = () => bcs.Address.parse(extractReturnBytes(result, i++));
  const u64 = () => BigInt(bcs.u64().parse(extractReturnBytes(result, i++)));
  const bytes = () => new Uint8Array(bcs.vector(bcs.u8()).parse(extractReturnBytes(result, i++)));
  const sel = (): Selection => mapSelection(SelectionBcs.parse(extractReturnBytes(result, i++)));
  const addrs = () => bcs.vector(bcs.Address).parse(extractReturnBytes(result, i++));
  const optString = () => bcs.option(bcs.string()).parse(extractReturnBytes(result, i++));

  const giftId = id();
  const creator = id();
  const creatorAccountId = id();
  const sourcePositionId = u64();
  const marketIdBytes = bytes();
  const selection = sel();
  const totalSpend = u64();
  const spendPerShare = u64();
  const lockedOddsCents = u64();
  const pubkey = bytes();
  const shareCount = u64();
  const claimedCount = u64();
  const claimedAddresses = addrs();
  const baseShareAmount = u64();
  const extraShareLinks = u64();
  const totalShares = u64();
  const remainingShares = u64();
  const referralCode = optString();
  const createdAtMs = u64();
  const expiresAtMs = u64();

  return {
    giftId,
    creator,
    creatorAccountId,
    sourcePositionId,
    marketId: marketIdBytes,
    marketIdHex: bytesToHexLocal(marketIdBytes),
    selection,
    totalSpend,
    spendPerShare,
    lockedOddsCents,
    pubkey,
    shareCount,
    claimedCount,
    claimedAddresses,
    baseShareAmount,
    extraShareLinks,
    totalShares,
    remainingShares,
    referralCode: referralCode ?? null,
    createdAtMs,
    expiresAtMs,
  };
}

// Local copy of the hex helper to avoid a circular import via utils.ts.
function bytesToHexLocal(bytes: Uint8Array): string {
  let out = "0x";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Live gift IDs for a creator. Order isn't preserved — sort by `createdAtMs`. */
export async function getCreatorGiftIds(
  client: PredictClient,
  params: GiftBaseParams & { creator: string },
): Promise<string[]> {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${giftPkg}::claimable_link::creator_gift_ids`,
    arguments: [
      tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig)),
      tx.pure.address(params.creator),
    ],
  });
  const result = await client.simulate(tx);
  return bcs.vector(bcs.Address).parse(extractReturnBytes(result));
}

export async function getCreatorGiftCount(
  client: PredictClient,
  params: GiftBaseParams & { creator: string },
): Promise<bigint> {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${giftPkg}::claimable_link::creator_gift_count`,
    arguments: [
      tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig)),
      tx.pure.address(params.creator),
    ],
  });
  const result = await client.simulate(tx);
  return BigInt(bcs.u64().parse(extractReturnBytes(result)));
}

/**
 * Global controller delegate address. Same value for every creator,
 * stable for the package's lifetime. Surface on FE so creators can
 * verify the right delegate is registered on their wxa.
 */
export async function getGiftControllerAddress(
  client: PredictClient,
  params: GiftBaseParams = {},
): Promise<string> {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${giftPkg}::claimable_link::controller_address`,
    arguments: [tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig))],
  });
  const result = await client.simulate(tx);
  return bcs.Address.parse(extractReturnBytes(result));
}

export async function getGiftConfigPaused(
  client: PredictClient,
  params: GiftBaseParams = {},
): Promise<boolean> {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${giftPkg}::claimable_link::is_paused`,
    arguments: [tx.object(resolveClaimableLinkConfig(client, params.claimableLinkConfig))],
  });
  const result = await client.simulate(tx);
  return bcs.bool().parse(extractReturnBytes(result));
}

export async function getGiftHasClaimed(
  client: PredictClient,
  params: GiftBaseParams & { giftId: string; addr: string },
): Promise<boolean> {
  const giftPkg = resolveGiftPackageId(client, params.giftPackageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  const tx = new Transaction();
  tx.moveCall({
    target: `${giftPkg}::claimable_link::has_claimed`,
    typeArguments: [coinType],
    arguments: [tx.object(params.giftId), tx.pure.address(params.addr)],
  });
  const result = await client.simulate(tx);
  return bcs.bool().parse(extractReturnBytes(result));
}

// ---------------------------------------------------------------------
// Convenience: full create / claim flow (KDF + PTB in one call)
// ---------------------------------------------------------------------

export interface BuildCreateGiftFlowResult {
  tx: Transaction;
  /** Raw 16-byte seed. Encode into the share URL with `encodeGiftUrl`. */
  seed: Uint8Array;
  /** Predicted gift ID (computed locally from `(config, pubkey)`). */
  giftId: string;
  /** 32-byte gift pubkey, in case the caller wants to log/store it. */
  pubkey: Uint8Array;
}

/**
 * One-shot: generate a fresh seed, derive the gift keypair + pubkey,
 * compute the predicted `gift_id`, and add the `create_gift` call to
 * `tx`. The caller signs + executes `tx` and then renders the URL via
 * `encodeGiftUrl(seed, …)`.
 */
export function buildCreateGiftFlow(
  client: PredictClient,
  tx: Transaction,
  params: Omit<CreateGiftParams, "pubkey">,
): BuildCreateGiftFlowResult {
  const seed = generateGiftSeed();
  const giftKeypair = deriveGiftKeypair(seed);
  const pubkey = giftKeypair.getPublicKey().toRawBytes();
  const giftId = deriveGiftAddress(client, pubkey, params);
  createGift(client, tx, { ...params, pubkey });
  return { tx, seed, giftId, pubkey };
}

export interface BuildClaimShareFlowParams extends Omit<ClaimShareParams, "sig" | "giftId"> {
  /** The 16-byte seed parsed from the share URL fragment. */
  seed: Uint8Array;
  /** The transaction sender (becomes `ctx.sender()`). Bound into the sig. */
  sender: string;
  /** Optional override — defaults to `deriveGiftAddress(client, pubkey)`. */
  giftId?: string;
}

export interface BuildClaimShareFlowResult {
  tx: Transaction;
  giftId: string;
  sig: Uint8Array;
}

/**
 * One-shot: derive the gift keypair from `seed`, compute `gift_id`,
 * sign the claim payload bound to `sender`, and add the `claim_share`
 * call to `tx`. Caller signs + executes `tx` with `sender`'s keypair.
 */
export async function buildClaimShareFlow(
  client: PredictClient,
  tx: Transaction,
  params: BuildClaimShareFlowParams,
): Promise<BuildClaimShareFlowResult> {
  const giftKeypair = deriveGiftKeypair(params.seed);
  const pubkey = giftKeypair.getPublicKey().toRawBytes();
  const giftId = params.giftId ?? deriveGiftAddress(client, pubkey, params);
  const sig = await signGiftClaim(giftKeypair, giftId, params.sender);
  claimShare(client, tx, { ...params, giftId, sig });
  return { tx, giftId, sig };
}
