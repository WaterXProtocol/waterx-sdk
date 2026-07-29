/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Nautilus-backed oracle rule for Binance, Bybit, and Gate.io prices. */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as vec_map from './deps/sui/vec_map.ts';
const $moduleName = '@waterx/rule::waterx_rule';
export const WATERX_RULE = new MoveStruct({ name: `${$moduleName}::WATERX_RULE`, fields: {
        dummy_field: bcs.bool()
    } });
export const WaterxRule = new MoveStruct({ name: `${$moduleName}::WaterxRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const PricePayload = new MoveStruct({ name: `${$moduleName}::PricePayload`, fields: {
        ticker: bcs.string(),
        sources: bcs.vector(bcs.u64()),
        method: bcs.string(),
        price_timestamp_ms: bcs.u64(),
        price_n: bcs.u64(),
        price_scale: bcs.u64(),
        confidence_n: bcs.u64(),
        confidence_scale: bcs.u64(),
        max_source_deviation_bps: bcs.u64(),
        num_sources: bcs.u8()
    } });
export const BatchPriceItem = new MoveStruct({ name: `${$moduleName}::BatchPriceItem`, fields: {
        symbol: bcs.string(),
        ticker: bcs.string(),
        sources: bcs.vector(bcs.u64()),
        method: bcs.string(),
        price_timestamp_ms: bcs.u64(),
        price_n: bcs.u64(),
        price_scale: bcs.u64(),
        confidence_n: bcs.u64(),
        confidence_scale: bcs.u64(),
        max_source_deviation_bps: bcs.u64(),
        num_sources: bcs.u8()
    } });
export const BatchPricePayload = new MoveStruct({ name: `${$moduleName}::BatchPricePayload`, fields: {
        items: bcs.vector(BatchPriceItem)
    } });
export const MerkleRoot = new MoveStruct({ name: `${$moduleName}::MerkleRoot`, fields: {
        root: bcs.vector(bcs.u8())
    } });
export const FeedConfig = new MoveStruct({ name: `${$moduleName}::FeedConfig`, fields: {
        ticker: bcs.string(),
        sources: bcs.vector(bcs.u64()),
        method: bcs.string(),
        max_age_ms: bcs.u64(),
        max_confidence_bps: bcs.u64(),
        max_source_deviation_bps: bcs.u64(),
        min_sources: bcs.u8()
    } });
export const VerifiedPrice = new MoveStruct({ name: `${$moduleName}::VerifiedPrice`, fields: {
        symbol: bcs.string(),
        ticker: bcs.string(),
        sources: bcs.vector(bcs.u64()),
        method: bcs.string(),
        price_timestamp_ms: bcs.u64(),
        price: float.Float,
        price_n: bcs.u64(),
        price_scale: bcs.u64(),
        confidence_n: bcs.u64(),
        confidence_scale: bcs.u64(),
        max_source_deviation_bps: bcs.u64(),
        num_sources: bcs.u8(),
        signed_timestamp_ms: bcs.u64()
    } });
export const Config = new MoveStruct({ name: `${$moduleName}::Config`, fields: {
        id: bcs.Address,
        feed_map: vec_map.VecMap(bcs.string(), FeedConfig)
    } });
export const SignedTsHwmKey = new MoveStruct({ name: `${$moduleName}::SignedTsHwmKey`, fields: {
        symbol: bcs.string()
    } });
export const HistoricalPriceVerified = new MoveStruct({ name: `${$moduleName}::HistoricalPriceVerified`, fields: {
        symbol: bcs.string(),
        ticker: bcs.string(),
        sources: bcs.vector(bcs.u64()),
        method: bcs.string(),
        price_timestamp_ms: bcs.u64(),
        price: bcs.u128(),
        confidence: bcs.u128(),
        max_source_deviation_bps: bcs.u64(),
        num_sources: bcs.u8(),
        signed_timestamp_ms: bcs.u64()
    } });
export const BatchLatestUpdated = new MoveStruct({ name: `${$moduleName}::BatchLatestUpdated`, fields: {
        count: bcs.u64(),
        timestamp_ms: bcs.u64()
    } });
export interface FeedBatchLatestArguments {
    oracleObj: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
    enclaveConfig: RawTransactionArgument<string>;
    enclave: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
    payload: TransactionArgument;
    sig: RawTransactionArgument<Array<number>>;
}
export interface FeedBatchLatestOptions {
    package?: string;
    arguments: FeedBatchLatestArguments | [
        oracleObj: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>,
        enclaveConfig: RawTransactionArgument<string>,
        enclave: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>,
        payload: TransactionArgument,
        sig: RawTransactionArgument<Array<number>>
    ];
}
/**
 * Public Funs Verifies one Nautilus batch signature and updates one or more latest
 * oracle prices. This function is only for current/latest data, never historical
 * data. A single symbol is just a batch of one.
 */
export function feedBatchLatest(options: FeedBatchLatestOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        null,
        null,
        'u64',
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["oracleObj", "config", "enclaveConfig", "enclave", "timestampMs", "payload", "sig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'feed_batch_latest',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CollectBatchLatestArguments {
    collector: TransactionArgument;
    config: RawTransactionArgument<string>;
    enclaveConfig: RawTransactionArgument<string>;
    enclave: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
    payload: TransactionArgument;
    sig: RawTransactionArgument<Array<number>>;
}
export interface CollectBatchLatestOptions {
    package?: string;
    arguments: CollectBatchLatestArguments | [
        collector: TransactionArgument,
        config: RawTransactionArgument<string>,
        enclaveConfig: RawTransactionArgument<string>,
        enclave: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>,
        payload: TransactionArgument,
        sig: RawTransactionArgument<Array<number>>
    ];
}
/**
 * Collect-only sibling of `feed_batch_latest` for the **dual-rule** latest path:
 * verifies one Nautilus batch signature and feeds the single item whose symbol
 * matches `collector.symbol()` into a caller-owned `PriceCollector`, WITHOUT
 * calling `oracle::aggregate`. This lets one aggregator carry both a `WaterxRule`
 * and (e.g.) a `PythRule` weight — the caller composes one collector across every
 * weighted rule in the PTB (compose-then-aggregate, like `pyth_rule::feed`) and
 * aggregates once.
 *
 * Abort vs abstain (WL-1963): unlike `feed_batch_latest`, which has no fallback
 * and so aborts on any stale item, this path runs alongside Pyth/Supra. To let
 * those cover a lagging TEE — the blast-radius bound in the GCP ADR — a
 * _freshness_ miss ABSTAINS (records `none`, which `aggregator::remove_outliers`
 * drops before the `weight_threshold` fail-closed check), and so does a _replayed_
 * signed timestamp (the chain already accepted that snapshot — the on-chain price
 * is at least as fresh, and two concurrent keeper PTBs sharing one envelope must
 * not kill each other). A _config/integrity_ mismatch (source / ticker / method /
 * confidence / deviation) still ABORTS: an enclave whose signed payload disagrees
 * with the on-chain feed config is a red flag, not a liveness blip. Bad signature,
 * malformed batch, and a future timestamp always abort.
 *
 * Every gate is identical to `feed_batch_item_latest`; only the abort-vs-abstain
 * disposition of the freshness + replay gates differs, and the sink is the
 * caller's collector rather than a fresh single-rule one.
 */
export function collectBatchLatest(options: CollectBatchLatestOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        null,
        null,
        'u64',
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "config", "enclaveConfig", "enclave", "timestampMs", "payload", "sig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'collect_batch_latest',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FeedSingleWithProofArguments {
    oracleObj: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
    enclaveConfig: RawTransactionArgument<string>;
    enclave: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
    item: TransactionArgument;
    proof: RawTransactionArgument<Array<Array<number>>>;
    sig: RawTransactionArgument<Array<number>>;
}
export interface FeedSingleWithProofOptions {
    package?: string;
    arguments: FeedSingleWithProofArguments | [
        oracleObj: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>,
        enclaveConfig: RawTransactionArgument<string>,
        enclave: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>,
        item: TransactionArgument,
        proof: RawTransactionArgument<Array<Array<number>>>,
        sig: RawTransactionArgument<Array<number>>
    ];
}
/**
 * Streaming per-symbol sibling of `feed_batch_latest`. Verifies ONE enclave
 * signature over a Merkle `root`, checks `item` is a leaf of that root via
 * `proof`, then runs the identical per-item gates + `oracle::aggregate`. Use for a
 * WaterxRule-only aggregator; for a Pyth-coexisting aggregator use
 * `collect_single_with_proof`.
 */
export function feedSingleWithProof(options: FeedSingleWithProofOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        null,
        null,
        'u64',
        null,
        'vector<vector<u8>>',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["oracleObj", "config", "enclaveConfig", "enclave", "timestampMs", "item", "proof", "sig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'feed_single_with_proof',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CollectSingleWithProofArguments {
    collector: TransactionArgument;
    config: RawTransactionArgument<string>;
    enclaveConfig: RawTransactionArgument<string>;
    enclave: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
    item: TransactionArgument;
    proof: RawTransactionArgument<Array<Array<number>>>;
    sig: RawTransactionArgument<Array<number>>;
}
export interface CollectSingleWithProofOptions {
    package?: string;
    arguments: CollectSingleWithProofArguments | [
        collector: TransactionArgument,
        config: RawTransactionArgument<string>,
        enclaveConfig: RawTransactionArgument<string>,
        enclave: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>,
        item: TransactionArgument,
        proof: RawTransactionArgument<Array<Array<number>>>,
        sig: RawTransactionArgument<Array<number>>
    ];
}
/**
 * Collect-only sibling of `feed_single_with_proof` for the dual-rule latest path
 * (WaterX alongside Pyth on one aggregator), mirroring `collect_batch_latest`:
 * verifies root + proof, feeds the leaf into the caller's `PriceCollector` WITHOUT
 * calling `oracle::aggregate`. Abort vs abstain matches `collect_batch_latest`
 * exactly — a config/integrity mismatch aborts, a freshness miss abstains so Pyth
 * can cover a lagging TEE.
 */
export function collectSingleWithProof(options: CollectSingleWithProofOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        null,
        null,
        'u64',
        null,
        'vector<vector<u8>>',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "config", "enclaveConfig", "enclave", "timestampMs", "item", "proof", "sig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'collect_single_with_proof',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface QuoteForTimestampArguments {
    config: RawTransactionArgument<string>;
    enclaveConfig: RawTransactionArgument<string>;
    enclave: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    signedTimestampMs: RawTransactionArgument<number | bigint>;
    requestedPriceTimestampMs: RawTransactionArgument<number | bigint>;
    payload: TransactionArgument;
    sig: RawTransactionArgument<Array<number>>;
}
export interface QuoteForTimestampOptions {
    package?: string;
    arguments: QuoteForTimestampArguments | [
        config: RawTransactionArgument<string>,
        enclaveConfig: RawTransactionArgument<string>,
        enclave: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        signedTimestampMs: RawTransactionArgument<number | bigint>,
        requestedPriceTimestampMs: RawTransactionArgument<number | bigint>,
        payload: TransactionArgument,
        sig: RawTransactionArgument<Array<number>>
    ];
}
/**
 * Verifies a historical quote without touching `waterx_oracle`.
 *
 * `signed_timestamp_ms` is the fresh timestamp signed by Nautilus.
 * `requested_price_timestamp_ms` is the historical price timestamp the caller
 * requested from Nautilus. Consumers should still assert the returned proof's
 * symbol and timestamp inside their own contract before using the price.
 */
export function quoteForTimestamp(options: QuoteForTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock',
        null,
        null,
        '0x1::string::String',
        'u64',
        'u64',
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "enclaveConfig", "enclave", "symbol", "signedTimestampMs", "requestedPriceTimestampMs", "payload", "sig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'quote_for_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DestroyVerifiedPriceArguments {
    price: TransactionArgument;
}
export interface DestroyVerifiedPriceOptions {
    package?: string;
    arguments: DestroyVerifiedPriceArguments | [
        price: TransactionArgument
    ];
}
/**
 * Consumes a verified historical price proof when no downstream consumer needs to
 * keep using it in the PTB.
 */
export function destroyVerifiedPrice(options: DestroyVerifiedPriceOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'destroy_verified_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CollectVerifiedPriceArguments {
    collector: TransactionArgument;
    price: TransactionArgument;
}
export interface CollectVerifiedPriceOptions {
    package?: string;
    arguments: CollectVerifiedPriceArguments | [
        collector: TransactionArgument,
        price: TransactionArgument
    ];
}
/**
 * Consumes a verified historical price and feeds it into a collector.
 *
 * Use this after `quote_for_timestamp` and before
 * `waterx_oracle::oracle::register_price_at_timestamp`.
 */
export function collectVerifiedPrice(options: CollectVerifiedPriceOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'collect_verified_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetFeedArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    sources: RawTransactionArgument<Array<number | bigint>>;
    method: RawTransactionArgument<string>;
    maxAgeMs: RawTransactionArgument<number | bigint>;
}
export interface SetFeedOptions {
    package?: string;
    arguments: SetFeedArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        sources: RawTransactionArgument<Array<number | bigint>>,
        method: RawTransactionArgument<string>,
        maxAgeMs: RawTransactionArgument<number | bigint>
    ];
}
/** Admin Funs */
export function setFeed(options: SetFeedOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x1::string::String',
        'vector<u64>',
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "ticker", "sources", "method", "maxAgeMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'set_feed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPerpFeedArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    sources: RawTransactionArgument<Array<number | bigint>>;
    method: RawTransactionArgument<string>;
    maxAgeMs: RawTransactionArgument<number | bigint>;
    maxConfidenceBps: RawTransactionArgument<number | bigint>;
    maxSourceDeviationBps: RawTransactionArgument<number | bigint>;
    minSources: RawTransactionArgument<number>;
}
export interface SetPerpFeedOptions {
    package?: string;
    arguments: SetPerpFeedArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        sources: RawTransactionArgument<Array<number | bigint>>,
        method: RawTransactionArgument<string>,
        maxAgeMs: RawTransactionArgument<number | bigint>,
        maxConfidenceBps: RawTransactionArgument<number | bigint>,
        maxSourceDeviationBps: RawTransactionArgument<number | bigint>,
        minSources: RawTransactionArgument<number>
    ];
}
export function setPerpFeed(options: SetPerpFeedOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x1::string::String',
        'vector<u64>',
        '0x1::string::String',
        'u64',
        'u64',
        'u64',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "ticker", "sources", "method", "maxAgeMs", "maxConfidenceBps", "maxSourceDeviationBps", "minSources"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'set_perp_feed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveFeedArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface RemoveFeedOptions {
    package?: string;
    arguments: RemoveFeedArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
export function removeFeed(options: RemoveFeedOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'remove_feed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewBatchPayloadOptions {
    package?: string;
    arguments?: [
    ];
}
/** Getter Funs */
export function newBatchPayload(options: NewBatchPayloadOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'new_batch_payload',
    });
}
export interface NewBatchItemArguments {
    symbol: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    sources: RawTransactionArgument<Array<number | bigint>>;
    method: RawTransactionArgument<string>;
    priceTimestampMs: RawTransactionArgument<number | bigint>;
    priceN: RawTransactionArgument<number | bigint>;
    priceScale: RawTransactionArgument<number | bigint>;
    confidenceN: RawTransactionArgument<number | bigint>;
    confidenceScale: RawTransactionArgument<number | bigint>;
    maxSourceDeviationBps: RawTransactionArgument<number | bigint>;
    numSources: RawTransactionArgument<number>;
}
export interface NewBatchItemOptions {
    package?: string;
    arguments: NewBatchItemArguments | [
        symbol: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        sources: RawTransactionArgument<Array<number | bigint>>,
        method: RawTransactionArgument<string>,
        priceTimestampMs: RawTransactionArgument<number | bigint>,
        priceN: RawTransactionArgument<number | bigint>,
        priceScale: RawTransactionArgument<number | bigint>,
        confidenceN: RawTransactionArgument<number | bigint>,
        confidenceScale: RawTransactionArgument<number | bigint>,
        maxSourceDeviationBps: RawTransactionArgument<number | bigint>,
        numSources: RawTransactionArgument<number>
    ];
}
export function newBatchItem(options: NewBatchItemOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        '0x1::string::String',
        '0x1::string::String',
        'vector<u64>',
        '0x1::string::String',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["symbol", "ticker", "sources", "method", "priceTimestampMs", "priceN", "priceScale", "confidenceN", "confidenceScale", "maxSourceDeviationBps", "numSources"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'new_batch_item',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PushBatchItemArguments {
    payload: TransactionArgument;
    item: TransactionArgument;
}
export interface PushBatchItemOptions {
    package?: string;
    arguments: PushBatchItemArguments | [
        payload: TransactionArgument,
        item: TransactionArgument
    ];
}
export function pushBatchItem(options: PushBatchItemOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["payload", "item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'push_batch_item',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FeedConfigArguments {
    config: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface FeedConfigOptions {
    package?: string;
    arguments: FeedConfigArguments | [
        config: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
export function feedConfig(options: FeedConfigOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'feed_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchPriceIntentOptions {
    package?: string;
    arguments?: [
    ];
}
export function batchPriceIntent(options: BatchPriceIntentOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_price_intent',
    });
}
export interface MerkleRootIntentOptions {
    package?: string;
    arguments?: [
    ];
}
export function merkleRootIntent(options: MerkleRootIntentOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'merkle_root_intent',
    });
}
export interface LeafHashOfArguments {
    item: TransactionArgument;
}
export interface LeafHashOfOptions {
    package?: string;
    arguments: LeafHashOfArguments | [
        item: TransactionArgument
    ];
}
/**
 * The keccak256 leaf hash for `item` — `keccak256(0x00 || BCS(item))`. Exposed so
 * the off-chain builder / SDK can be pinned against the on-chain encoding in a
 * cross-implementation golden test.
 */
export function leafHashOf(options: LeafHashOfOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'leaf_hash_of',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxBatchSizeOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxBatchSize(options: MaxBatchSizeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'max_batch_size',
    });
}
export interface BatchItemsArguments {
    payload: TransactionArgument;
}
export interface BatchItemsOptions {
    package?: string;
    arguments: BatchItemsArguments | [
        payload: TransactionArgument
    ];
}
export function batchItems(options: BatchItemsOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["payload"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_items',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemSymbolArguments {
    item: TransactionArgument;
}
export interface BatchItemSymbolOptions {
    package?: string;
    arguments: BatchItemSymbolArguments | [
        item: TransactionArgument
    ];
}
export function batchItemSymbol(options: BatchItemSymbolOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_symbol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemTickerArguments {
    item: TransactionArgument;
}
export interface BatchItemTickerOptions {
    package?: string;
    arguments: BatchItemTickerArguments | [
        item: TransactionArgument
    ];
}
export function batchItemTicker(options: BatchItemTickerOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_ticker',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemSourcesArguments {
    item: TransactionArgument;
}
export interface BatchItemSourcesOptions {
    package?: string;
    arguments: BatchItemSourcesArguments | [
        item: TransactionArgument
    ];
}
export function batchItemSources(options: BatchItemSourcesOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_sources',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemMethodArguments {
    item: TransactionArgument;
}
export interface BatchItemMethodOptions {
    package?: string;
    arguments: BatchItemMethodArguments | [
        item: TransactionArgument
    ];
}
export function batchItemMethod(options: BatchItemMethodOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_method',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemPriceTimestampMsArguments {
    item: TransactionArgument;
}
export interface BatchItemPriceTimestampMsOptions {
    package?: string;
    arguments: BatchItemPriceTimestampMsArguments | [
        item: TransactionArgument
    ];
}
export function batchItemPriceTimestampMs(options: BatchItemPriceTimestampMsOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_price_timestamp_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemPriceNArguments {
    item: TransactionArgument;
}
export interface BatchItemPriceNOptions {
    package?: string;
    arguments: BatchItemPriceNArguments | [
        item: TransactionArgument
    ];
}
export function batchItemPriceN(options: BatchItemPriceNOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_price_n',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemPriceScaleArguments {
    item: TransactionArgument;
}
export interface BatchItemPriceScaleOptions {
    package?: string;
    arguments: BatchItemPriceScaleArguments | [
        item: TransactionArgument
    ];
}
export function batchItemPriceScale(options: BatchItemPriceScaleOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_price_scale',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemConfidenceNArguments {
    item: TransactionArgument;
}
export interface BatchItemConfidenceNOptions {
    package?: string;
    arguments: BatchItemConfidenceNArguments | [
        item: TransactionArgument
    ];
}
export function batchItemConfidenceN(options: BatchItemConfidenceNOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_confidence_n',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemConfidenceScaleArguments {
    item: TransactionArgument;
}
export interface BatchItemConfidenceScaleOptions {
    package?: string;
    arguments: BatchItemConfidenceScaleArguments | [
        item: TransactionArgument
    ];
}
export function batchItemConfidenceScale(options: BatchItemConfidenceScaleOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_confidence_scale',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemMaxSourceDeviationBpsArguments {
    item: TransactionArgument;
}
export interface BatchItemMaxSourceDeviationBpsOptions {
    package?: string;
    arguments: BatchItemMaxSourceDeviationBpsArguments | [
        item: TransactionArgument
    ];
}
export function batchItemMaxSourceDeviationBps(options: BatchItemMaxSourceDeviationBpsOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_max_source_deviation_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BatchItemNumSourcesArguments {
    item: TransactionArgument;
}
export interface BatchItemNumSourcesOptions {
    package?: string;
    arguments: BatchItemNumSourcesArguments | [
        item: TransactionArgument
    ];
}
export function batchItemNumSources(options: BatchItemNumSourcesOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["item"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'batch_item_num_sources',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedSymbolArguments {
    price: TransactionArgument;
}
export interface VerifiedSymbolOptions {
    package?: string;
    arguments: VerifiedSymbolArguments | [
        price: TransactionArgument
    ];
}
export function verifiedSymbol(options: VerifiedSymbolOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_symbol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedTickerArguments {
    price: TransactionArgument;
}
export interface VerifiedTickerOptions {
    package?: string;
    arguments: VerifiedTickerArguments | [
        price: TransactionArgument
    ];
}
export function verifiedTicker(options: VerifiedTickerOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_ticker',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedSourcesArguments {
    price: TransactionArgument;
}
export interface VerifiedSourcesOptions {
    package?: string;
    arguments: VerifiedSourcesArguments | [
        price: TransactionArgument
    ];
}
export function verifiedSources(options: VerifiedSourcesOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_sources',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedMethodArguments {
    price: TransactionArgument;
}
export interface VerifiedMethodOptions {
    package?: string;
    arguments: VerifiedMethodArguments | [
        price: TransactionArgument
    ];
}
export function verifiedMethod(options: VerifiedMethodOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_method',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedPriceTimestampMsArguments {
    price: TransactionArgument;
}
export interface VerifiedPriceTimestampMsOptions {
    package?: string;
    arguments: VerifiedPriceTimestampMsArguments | [
        price: TransactionArgument
    ];
}
export function verifiedPriceTimestampMs(options: VerifiedPriceTimestampMsOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_price_timestamp_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedPriceArguments {
    price: TransactionArgument;
}
export interface VerifiedPriceOptions {
    package?: string;
    arguments: VerifiedPriceArguments | [
        price: TransactionArgument
    ];
}
export function verifiedPrice(options: VerifiedPriceOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedPriceScaledArguments {
    price: TransactionArgument;
}
export interface VerifiedPriceScaledOptions {
    package?: string;
    arguments: VerifiedPriceScaledArguments | [
        price: TransactionArgument
    ];
}
export function verifiedPriceScaled(options: VerifiedPriceScaledOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_price_scaled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedPriceNArguments {
    price: TransactionArgument;
}
export interface VerifiedPriceNOptions {
    package?: string;
    arguments: VerifiedPriceNArguments | [
        price: TransactionArgument
    ];
}
export function verifiedPriceN(options: VerifiedPriceNOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_price_n',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedPriceScaleArguments {
    price: TransactionArgument;
}
export interface VerifiedPriceScaleOptions {
    package?: string;
    arguments: VerifiedPriceScaleArguments | [
        price: TransactionArgument
    ];
}
export function verifiedPriceScale(options: VerifiedPriceScaleOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_price_scale',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedConfidenceNArguments {
    price: TransactionArgument;
}
export interface VerifiedConfidenceNOptions {
    package?: string;
    arguments: VerifiedConfidenceNArguments | [
        price: TransactionArgument
    ];
}
export function verifiedConfidenceN(options: VerifiedConfidenceNOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_confidence_n',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedConfidenceScaleArguments {
    price: TransactionArgument;
}
export interface VerifiedConfidenceScaleOptions {
    package?: string;
    arguments: VerifiedConfidenceScaleArguments | [
        price: TransactionArgument
    ];
}
export function verifiedConfidenceScale(options: VerifiedConfidenceScaleOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_confidence_scale',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedMaxSourceDeviationBpsArguments {
    price: TransactionArgument;
}
export interface VerifiedMaxSourceDeviationBpsOptions {
    package?: string;
    arguments: VerifiedMaxSourceDeviationBpsArguments | [
        price: TransactionArgument
    ];
}
export function verifiedMaxSourceDeviationBps(options: VerifiedMaxSourceDeviationBpsOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_max_source_deviation_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedNumSourcesArguments {
    price: TransactionArgument;
}
export interface VerifiedNumSourcesOptions {
    package?: string;
    arguments: VerifiedNumSourcesArguments | [
        price: TransactionArgument
    ];
}
export function verifiedNumSources(options: VerifiedNumSourcesOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_num_sources',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifiedSignedTimestampMsArguments {
    price: TransactionArgument;
}
export interface VerifiedSignedTimestampMsOptions {
    package?: string;
    arguments: VerifiedSignedTimestampMsArguments | [
        price: TransactionArgument
    ];
}
export function verifiedSignedTimestampMs(options: VerifiedSignedTimestampMsOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'verified_signed_timestamp_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SourceBinanceSpotOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceBinanceSpot(options: SourceBinanceSpotOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_binance_spot',
    });
}
export interface SourceBinanceUsdmPerpWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceBinanceUsdmPerpWs(options: SourceBinanceUsdmPerpWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_binance_usdm_perp_ws',
    });
}
export interface SourceBybitLinearPerpWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceBybitLinearPerpWs(options: SourceBybitLinearPerpWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_bybit_linear_perp_ws',
    });
}
export interface SourceGateioUsdtPerpWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceGateioUsdtPerpWs(options: SourceGateioUsdtPerpWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_gateio_usdt_perp_ws',
    });
}
export interface SourceGataUsdtPerpWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceGataUsdtPerpWs(options: SourceGataUsdtPerpWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_gata_usdt_perp_ws',
    });
}
export interface SourceBybitSpotWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceBybitSpotWs(options: SourceBybitSpotWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_bybit_spot_ws',
    });
}
export interface SourceXstockEquityRestOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceXstockEquityRest(options: SourceXstockEquityRestOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_xstock_equity_rest',
    });
}
export interface SourceOkxSpotWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceOkxSpotWs(options: SourceOkxSpotWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_okx_spot_ws',
    });
}
export interface SourceHyperliquidPerpWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceHyperliquidPerpWs(options: SourceHyperliquidPerpWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_hyperliquid_perp_ws',
    });
}
export interface SourceGateioSpotWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceGateioSpotWs(options: SourceGateioSpotWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_gateio_spot_ws',
    });
}
export interface SourceKrakenSpotWsOptions {
    package?: string;
    arguments?: [
    ];
}
export function sourceKrakenSpotWs(options: SourceKrakenSpotWsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_kraken_spot_ws',
    });
}
export interface MethodDirectOptions {
    package?: string;
    arguments?: [
    ];
}
export function methodDirect(options: MethodDirectOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'method_direct',
    });
}
export interface MethodMedianOptions {
    package?: string;
    arguments?: [
    ];
}
export function methodMedian(options: MethodMedianOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'method_median',
    });
}
export interface MethodConfidenceOptions {
    package?: string;
    arguments?: [
    ];
}
export function methodConfidence(options: MethodConfidenceOptions = {}) {
    const packageAddress = options.package ?? '@waterx/rule';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'method_confidence',
    });
}
export interface IsSupportedSourceArguments {
    source: RawTransactionArgument<number | bigint>;
}
export interface IsSupportedSourceOptions {
    package?: string;
    arguments: IsSupportedSourceArguments | [
        source: RawTransactionArgument<number | bigint>
    ];
}
export function isSupportedSource(options: IsSupportedSourceOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["source"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'is_supported_source',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsPerpSourceArguments {
    source: RawTransactionArgument<number | bigint>;
}
export interface IsPerpSourceOptions {
    package?: string;
    arguments: IsPerpSourceArguments | [
        source: RawTransactionArgument<number | bigint>
    ];
}
export function isPerpSource(options: IsPerpSourceOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["source"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'is_perp_source',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsSupportedMethodArguments {
    method: RawTransactionArgument<string>;
}
export interface IsSupportedMethodOptions {
    package?: string;
    arguments: IsSupportedMethodArguments | [
        method: RawTransactionArgument<string>
    ];
}
export function isSupportedMethod(options: IsSupportedMethodOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["method"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'is_supported_method',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsPerpMethodArguments {
    method: RawTransactionArgument<string>;
}
export interface IsPerpMethodOptions {
    package?: string;
    arguments: IsPerpMethodArguments | [
        method: RawTransactionArgument<string>
    ];
}
export function isPerpMethod(options: IsPerpMethodOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["method"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'is_perp_method',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SourceFromNameArguments {
    name: RawTransactionArgument<string>;
}
export interface SourceFromNameOptions {
    package?: string;
    arguments: SourceFromNameArguments | [
        name: RawTransactionArgument<string>
    ];
}
export function sourceFromName(options: SourceFromNameOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["name"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'source_from_name',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MethodFromNameArguments {
    name: RawTransactionArgument<string>;
}
export interface MethodFromNameOptions {
    package?: string;
    arguments: MethodFromNameArguments | [
        name: RawTransactionArgument<string>
    ];
}
export function methodFromName(options: MethodFromNameOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["name"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'method_from_name',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SignedTsHwmArguments {
    config: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface SignedTsHwmOptions {
    package?: string;
    arguments: SignedTsHwmArguments | [
        config: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
/**
 * Last accepted signed timestamp for `symbol` (0 if none yet). View helper for
 * keepers/SDK so they can pick a `timestamp_ms` strictly greater than this.
 */
export function signedTsHwm(options: SignedTsHwmOptions) {
    const packageAddress = options.package ?? '@waterx/rule';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_rule',
        function: 'signed_ts_hwm',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}