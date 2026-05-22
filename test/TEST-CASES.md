# WaterX SDK 測試用例清單

> 自動產生：pnpm exec tsx scripts/generate-test-cases-doc.ts
> 產生時間：2026-05-22
> 統計：**Unit 250** · **E2E (simulate) 77** · **Integration 12** · 合計 **339**

## 編號規則

| 前綴 | 專案 | 執行指令 | 說明 |
| --- | --- | --- | --- |
| **U-xxx** | unit | pnpm test:unit | 離線 mock，無鏈上簽名 |
| **E-xxx** | e2e | pnpm test:e2e | testnet simulateTransaction |
| **I-xxx** | integration | pnpm test:integration | testnet 真實簽名執行 |

## 欄位說明

- **前置條件**：環境、config、私鑰、鏈上狀態、外部 Hermes 等。
- **操作步驟**：測試實際呼叫的 SDK API 或交易流程（摘要）。
- **預期結果**：Vitest 斷言目標；含 ctx.skip / describe.skipIf 時表示允許跳過。

## 共通跳過條件（E2E / Integration）

- 無 integration 私鑰 → 整檔 describe.skipIf
- 無 wxa 餘額/持倉/待贖回列 → ctx.skip
- Hermes 404 / 5xx / 521 → skipHermesIfFeedUnavailable（E2E）
- SUI gas 不足 → integration skipIfInsufficientSui

> **注意**：`describe.each` / `it.each` 在原始碼中可能只佔一列，執行時會依參數展開（例如 lifecycle 每個 ticker 各跑一遍）。

---
## 一、Unit 測試（test/unit/）

| 編號 | 模組/檔案 | 測試套件 | 用例名稱 | 前置條件 | 操作步驟 | 預期結果 |
| --- | --- | --- | --- | --- | --- | --- |
| U-001 | test/unit/account-request.test.ts | account-request | calls account::request when bucketAccount is undefined | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-002 | test/unit/account-request.test.ts | account-request | calls account::request_with_account when bucketAccount is an object id | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-003 | test/unit/account-request.test.ts | account-request | calls account::request_with_account when bucketAccount is a TransactionArgument | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-004 | test/unit/account-request.test.ts | account-request | string and TransactionArgument paths both differ from plain request | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-005 | test/unit/canonical-testnet-account.test.ts | canonical-testnet-account | includes built-in account on testnet when env is unset | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-006 | test/unit/canonical-testnet-account.test.ts | canonical-testnet-account | prefers env account over canonical | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-007 | test/unit/canonical-testnet-account.test.ts | canonical-testnet-account | returns empty on mainnet | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-008 | test/unit/client.test.ts | client | exposes testnet config and pyth defaults | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-009 | test/unit/client.test.ts | client | getMarket returns market entry for BTCUSD | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-010 | test/unit/client.test.ts | client | getMarket throws for unknown ticker | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-011 | test/unit/client.test.ts | client | getPythFeed / getAggregator / getPoolTokenType / wlpType | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-012 | test/unit/client.test.ts | client | throws for unknown aggregator, pyth feed, pool token, and missing wlp | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-013 | test/unit/client.test.ts | client | grpc convenience methods delegate to grpcClient | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-014 | test/unit/client.test.ts | client | packageIds() lists published_at for each package | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-015 | test/unit/client.test.ts | client | getCredit / creditType / getBridge / wormholeStateId | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-016 | test/unit/client.test.ts | client | wormholeStateId falls back to network defaults when bridge omits wormhole_state | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-017 | test/unit/client.test.ts | client | getNativeAssets / getNativeAsset | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-018 | test/unit/client.test.ts | client | throws when credit / bridge / custody packages are absent | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-019 | test/unit/client.test.ts | client | returns async client with loaded config | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-020 | test/unit/client.test.ts | client | mainnet() and testnet() delegate to create() | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-021 | test/unit/config-load.test.ts | config-load | defaultConfigUrl points at waterx-config raw JSON | Mock `fetch` 回傳 JSON；或記憶體 cache | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-022 | test/unit/config-load.test.ts | config-load | throws when fetch is unavailable | Mock `fetch` 回傳 JSON；或記憶體 cache | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-023 | test/unit/config-load.test.ts | config-load | throws on HTTP error | Mock `fetch` 回傳 JSON；或記憶體 cache | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-024 | test/unit/config-load.test.ts | config-load | throws when network mismatches | Mock `fetch` 回傳 JSON；或記憶體 cache | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-025 | test/unit/config-load.test.ts | config-load | accepts credit-only config shape (no waterx_perp) | Mock `fetch` 回傳 JSON；或記憶體 cache | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-026 | test/unit/config-load.test.ts | config-load | throws when config has no packages object | Mock `fetch` 回傳 JSON；或記憶體 cache | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-027 | test/unit/config-load.test.ts | config-load | accepts account-only minimal config (no perp, no credit) | Mock `fetch` 回傳 JSON；或記憶體 cache | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-028 | test/unit/config-load.test.ts | config-load | throws when required package missing published_at | Mock `fetch` 回傳 JSON；或記憶體 cache | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-029 | test/unit/config-load.test.ts | config-load | fetches and parses canonical-shaped testnet JSON | Mock `fetch` 回傳 JSON；或記憶體 cache | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-030 | test/unit/config-load.test.ts | config-load | uses in-memory cache when opts.cache is true | Mock `fetch` 回傳 JSON；或記憶體 cache | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-031 | test/unit/config-utils.test.ts | config-utils | getMarketTickers returns waterx_perp market tickers | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-032 | test/unit/config-utils.test.ts | config-utils | getCollateralAssets returns wlp pool token tickers | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-033 | test/unit/config-utils.test.ts | config-utils | returns empty arrays when maps are empty | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-034 | test/unit/constants.test.ts | constants | PERM_ALL_TRADING is bits 0–7 (255) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-035 | test/unit/constants.test.ts | constants | PERM_ALL is 65535 (16 bits) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-036 | test/unit/constants.test.ts | constants | matches Move convention 0–3 and wildcard 255 | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-037 | test/unit/constants.test.ts | constants | scales USD to 1e9 fixed-point | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-038 | test/unit/constants.test.ts | constants | throws on non-finite USD input | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-039 | test/unit/e2e-preflight.test.ts | e2e-preflight | is off by default (pnpm test:e2e does not auto-run preflight) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-040 | test/unit/e2e-preflight.test.ts | e2e-preflight | flag is true when WATERX_E2E_PREFLIGHT=1 and integration key is configured | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-041 | test/unit/expected-open-trading-fee.test.ts | expected-open-trading-fee | matches Move test: 1e9 size, $50k BTC, $100k pool TVL, 5 bps base → $50 fee (10 bps total) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-042 | test/unit/expected-open-trading-fee.test.ts | expected-open-trading-fee | closing leg after long OI: short 1e9 has only base 5 bps (no worsening LP exposure) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-043 | test/unit/fetch-simulate.test.ts | fetch-simulate | getGlobalConfigData parses BCS from simulate | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | Mock simulate / fetch，呼叫 SDK API | Vitest `expect` 斷言通過 |
| U-044 | test/unit/fetch-simulate.test.ts | fetch-simulate | surfaces FailedTransaction from simulate | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | Mock simulate / fetch，呼叫 SDK API | Vitest `expect` 斷言通過 |
| U-045 | test/unit/fetch-simulate.test.ts | fetch-simulate | uses default message when FailedTransaction has no error detail | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-046 | test/unit/fetch-simulate.test.ts | fetch-simulate | decodes base64 string and JSON-RPC numeric-indexed BCS blobs | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-047 | test/unit/fetch-simulate.test.ts | fetch-simulate | reads nested value.bcs when top-level bcs is absent | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-048 | test/unit/fetch-simulate.test.ts | fetch-simulate | throws when simulate returns no BCS at the requested index | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-049 | test/unit/fetch-view-data.test.ts | fetch-view-data | getAccountData returns parsed account | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-050 | test/unit/fetch-view-data.test.ts | fetch-view-data | getAccountData returns undefined when option is none | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-051 | test/unit/fetch-view-data.test.ts | fetch-view-data | getMarketData / getPoolData / getTokenPoolData | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-052 | test/unit/fetch-view-data.test.ts | fetch-view-data | positionExists + getPosition + getOrder | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-053 | test/unit/fetch-view-data.test.ts | fetch-view-data | getMarketOrders with pagination cursor | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-054 | test/unit/fetch-view-data.test.ts | fetch-view-data | getMarketOrders reads nested value.bcs and returns empty without order bytes | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-055 | test/unit/fetch-view-data.test.ts | fetch-view-data | getMarketOrders returns empty when simulate has no return values | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | Mock simulate / fetch，呼叫 SDK API | 回傳空集合，不拋錯 |
| U-056 | test/unit/fetch-view-data.test.ts | fetch-view-data | getMarketOrders returns empty when commandResults lack returnValues | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-057 | test/unit/fetch-view-data.test.ts | fetch-view-data | getMarketPositions with positions and cursor | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-058 | test/unit/fetch-view-data.test.ts | fetch-view-data | getAccountPositions + getAccountOrders | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-059 | test/unit/fetch-view-data.test.ts | fetch-view-data | getRedeemRequests paginated | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-060 | test/unit/fetch-view-data.test.ts | fetch-view-data | getRedeemRequests returns empty when primary BCS is missing | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-061 | test/unit/fetch-view-data.test.ts | fetch-view-data | getRedeemRequests returns empty when simulate has no returnValues array | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | Mock simulate / fetch，呼叫 SDK API | 回傳空集合，不拋錯 |
| U-062 | test/unit/fetch-view-data.test.ts | fetch-view-data | getRedeemRequests reads nested cursor bytes | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-063 | test/unit/fetch-view-data.test.ts | fetch-view-data | referral simulate helpers | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | Mock simulate / fetch，呼叫 SDK API | Vitest `expect` 斷言通過 |
| U-064 | test/unit/fetch-view-data.test.ts | fetch-view-data | throws when referral package missing | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-065 | test/unit/fetch-view-data.test.ts | fetch-view-data | getAccountsByOwner decodes address vector | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-066 | test/unit/fetch-view-data.test.ts | fetch-view-data | getAccountBalance defaults to creditType and accepts explicit coinType | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-067 | test/unit/fetch-view-data.test.ts | fetch-view-data | getAccountBalance throws when credit_type missing and coinType omitted | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-068 | test/unit/fetch-view-data.test.ts | fetch-view-data | getCustodyVaultData reads creditSupply | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-069 | test/unit/fetch-view-data.test.ts | fetch-view-data | getCustodyAssetData returns registered:false when the asset is absent | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-070 | test/unit/fetch-view-data.test.ts | fetch-view-data | getCustodyAssetData reads fee rates when the asset is registered | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-071 | test/unit/fetch-view-data.test.ts | fetch-view-data | throws when native_custody is not configured | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-072 | test/unit/fetch-view-data.test.ts | fetch-view-data | isValidReferralCode throws on FailedTransaction | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-073 | test/unit/fetch-view-data.test.ts | fetch-view-data | referralCodeExists throws when simulate returns no BCS | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-074 | test/unit/integration-gas.test.ts | integration-gas | integrationGasBudget uses low defaults and global env override | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-075 | test/unit/integration-gas.test.ts | integration-gas | integrationMinSuiMist is disabled by default | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-076 | test/unit/integration-gas.test.ts | integration-gas | isInsufficientSuiGasError matches gas selection failures | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-077 | test/unit/integration-market-snapshot.test.ts | integration-market-snapshot | returns size unchanged (no-op) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-078 | test/unit/integration-market-snapshot.test.ts | integration-market-snapshot | throws when market is inactive | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-079 | test/unit/math.test.ts | math | scales USD to 1e9 fixed-point | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-080 | test/unit/math.test.ts | math | throws on non-finite USD input | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-081 | test/unit/math.test.ts | math | calcNotional and calcFee | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-082 | test/unit/math.test.ts | math | calcUnrealizedPnl long vs short | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-083 | test/unit/math.test.ts | math | calcLeverage handles zero collateral | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-084 | test/unit/math.test.ts | math | returns 0 when size is zero or already liquidatable | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-085 | test/unit/math.test.ts | math | estimates long liquidation price below entry when collateral is healthy | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-086 | test/unit/math.test.ts | math | estimates short liquidation price above entry | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-087 | test/unit/math.test.ts | math | returns 0 for long when ratio would be >= 1 | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-088 | test/unit/math.test.ts | math | returns 0 when entry notional is zero (avgPrice zero) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-089 | test/unit/math.test.ts | math | accounts for totalFeesUsd eroding margin | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-090 | test/unit/math.test.ts | math | calcTotalTradingFeeRate sums base and impact | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-091 | test/unit/math.test.ts | math | calcImpactFeeRate returns 0 when execution price zeroes order notional | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-092 | test/unit/math.test.ts | math | calcImpactFeeRate returns 0 for zero order or max fee | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-093 | test/unit/math.test.ts | math | calcImpactFeeRate is positive when order increases LP skew | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-094 | test/unit/math.test.ts | math | calcImpactFeeRate uses orderSize - lpOriginalSize when same-side order is larger | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-095 | test/unit/math.test.ts | math | calcImpactFeeRate returns 0 when same-side order shrinks LP skew | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-096 | test/unit/math.test.ts | math | calcImpactFeeRate returns 0 when pool TVL or LP exposure cap is zero | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-097 | test/unit/math.test.ts | math | calcImpactFeeRate handles long-heavy OI (lpOriginalSide false) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-098 | test/unit/math.test.ts | math | calcImpactFeeRate handles balanced OI with zero initial skew | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-099 | test/unit/math.test.ts | math | calcImpactFeeRate respects curvature and scale on the impact curve | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-100 | test/unit/math.test.ts | math | calcFundingRate long-heavy vs short-heavy | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-101 | test/unit/math.test.ts | math | calcFundingFeeUsd respects payer side | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-102 | test/unit/math.test.ts | math | decodeFundingIndexDelta converts Double-scale delta | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-103 | test/unit/math.test.ts | math | annualizeFundingRate scales per-interval rate to a year | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-104 | test/unit/math.test.ts | math | annualizedApyFromRatio compounds NAV ratio over elapsed days | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-105 | test/unit/math.test.ts | math | annualizedApyFromRatio returns 0 when compounding overflows | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-106 | test/unit/math.test.ts | math | calcWlpIncentiveApy converts continuous APR to APY | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-107 | test/unit/math.test.ts | math | calcBorrowRate follows three slopes | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-108 | test/unit/math.test.ts | math | calcBorrowRate interpolates between threshold0 and threshold1 | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-109 | test/unit/math.test.ts | math | calcBorrowRate returns rate2 when utilization exceeds threshold1 at 100% cap | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-110 | test/unit/math.test.ts | math | calcBorrowRateAccrual and calcPositionBorrowFee | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-111 | test/unit/math.test.ts | math | calcTokenUtilizationBps | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-112 | test/unit/math.test.ts | math | calcWlpPrice and bootstrap mint | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-113 | test/unit/math.test.ts | math | calcWlpMintOut pro-rata when pool has supply | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-114 | test/unit/math.test.ts | math | calcWlpMintOut bootstraps when TVL is zero but supply exists | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-115 | test/unit/math.test.ts | math | calcWlpRedeemOut | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-116 | test/unit/math.test.ts | math | calcDynamicFeeBps returns base when weight improves | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-117 | test/unit/math.test.ts | math | calcDynamicFeeBps adds fee when deposit worsens target weight | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-118 | test/unit/math.test.ts | math | calcDynamicFeeBps early exits | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-119 | test/unit/math.test.ts | math | calcDynamicFeeBps returns base when redeem drains pool TVL | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-120 | test/unit/math.test.ts | math | calcDynamicFeeBps redeem path clamps token value at zero | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-121 | test/unit/math.test.ts | math | calcDynamicFeeBps returns base when average target value is zero | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-122 | test/unit/pyth-branches.test.ts | pyth-branches | fetchPriceFeedsUpdateData throws when Hermes returns empty binary | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-123 | test/unit/pyth-branches.test.ts | pyth-branches | buildPythPriceUpdateCalls rejects multiple accumulator messages | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-124 | test/unit/pyth-branches.test.ts | pyth-branches | buildPythPriceUpdateCalls uses sponsor fund split instead of gas | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-125 | test/unit/pyth-branches.test.ts | pyth-branches | buildPythPriceUpdateCalls throws when feed is not registered on-chain | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-126 | test/unit/pyth-branches.test.ts | pyth-branches | pkgFromUpgradeCap reads top-level and nested upgrade_cap package paths | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-127 | test/unit/pyth-branches.test.ts | pyth-branches | getPythStateInfo reads base_update_fee from json root | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-128 | test/unit/pyth-branches.test.ts | pyth-branches | matches dynamic field rows whose objectType contains price_info | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-129 | test/unit/pyth-branches.test.ts | pyth-branches | normalizes feed ids without 0x prefix | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-130 | test/unit/pyth-branches.test.ts | pyth-branches | resolves price table via valueType and childId fields | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-131 | test/unit/pyth-branches.test.ts | pyth-branches | resolves price table via objectType when valueType is empty | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-132 | test/unit/pyth-branches.test.ts | pyth-branches | resolves price table via objectType and childId fields | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-133 | test/unit/pyth-branches.test.ts | pyth-branches | reuses priceFeedObjectId cache keyed by pyth state | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-134 | test/unit/pyth-branches.test.ts | pyth-branches | reuses priceFeedObjectId cache with feed-only key when pyth state id is empty | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-135 | test/unit/pyth-branches.test.ts | pyth-branches | matches price table rows via objectType when valueType is absent | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-136 | test/unit/pyth-branches.test.ts | pyth-branches | reuses grpc caches for pyth state, wormhole package, and price table | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-137 | test/unit/pyth-branches.test.ts | pyth-branches | getPythStateInfo throws when state json or base_update_fee is missing | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-138 | test/unit/pyth-branches.test.ts | pyth-branches | getWormholePackageId throws when wormhole state json is missing | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-139 | test/unit/pyth-branches.test.ts | pyth-branches | getPriceTableInfo throws on missing table, childId, or package type | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-140 | test/unit/pyth-branches.test.ts | pyth-branches | pkgFromUpgradeCap throws when package id cannot be resolved | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-141 | test/unit/pyth-branches.test.ts | pyth-branches | refreshOraclePrices is a no-op for an empty ticker list | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-142 | test/unit/pyth-branches.test.ts | pyth-branches | reimbursePythSponsor throws when sponsor config is incomplete | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-143 | test/unit/pyth.test.ts | pyth | returns empty array when priceIds is empty | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-144 | test/unit/pyth.test.ts | pyth | parses Hermes binary hex data into Uint8Array | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-145 | test/unit/pyth.test.ts | pyth | throws on non-ok HTTP response | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-146 | test/unit/pyth.test.ts | pyth | stores and reuses entries | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-147 | test/unit/pyth.test.ts | pyth | aggregateTickerWithPyth appends collector → feed → aggregate | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-148 | test/unit/pyth.test.ts | pyth | buildPythPriceUpdateCalls appends wormhole + pyth update block | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-149 | test/unit/pyth.test.ts | pyth | updatePythPrices fetches Hermes then builds on-chain calls | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-150 | test/unit/pyth.test.ts | pyth | refreshOraclePrices runs update + per-ticker aggregate | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-151 | test/unit/pyth.test.ts | pyth | buildPythPriceUpdateCalls throws on empty updates | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-152 | test/unit/pyth.test.ts | pyth | openPythSponsorFund throws when sponsor config missing | Mock `WaterXClient` / `fetch` / gRPC；無真實鏈 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-153 | test/unit/referral.test.ts | referral | setReferralCode wires waterx_referral table | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-154 | test/unit/referral.test.ts | referral | useReferralCode wires waterx_referral table | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-155 | test/unit/referral.test.ts | referral | throws when referral package missing from config | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-156 | test/unit/sdk-imports.test.ts | sdk-imports | exports WaterXClient async factories | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-157 | test/unit/sdk-imports.test.ts | sdk-imports | exports trading request + execute + high-level builders | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-158 | test/unit/sdk-imports.test.ts | sdk-imports | exports fetch + WLP + staking | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-159 | test/unit/sdk-imports.test.ts | sdk-imports | exports native-custody builders + generated calls | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-160 | test/unit/sdk-imports.test.ts | sdk-imports | exports credit-bridge builders and wormhole helpers | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-161 | test/unit/tx-builders.test.ts | tx-builders | buildPlaceOrderTx composes request + execute | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-162 | test/unit/tx-builders.test.ts | tx-builders | buildPlaceOrderTx defaults useSponsor to true when omitted | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-163 | test/unit/tx-builders.test.ts | tx-builders | buildClosePositionTx / increase / decrease / collateral adjust | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-164 | test/unit/tx-builders.test.ts | tx-builders | buildCancelOrderTx / buildUpdateOrderTx / pre-order builders | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-165 | test/unit/tx-builders.test.ts | tx-builders | buildMintWlpTx without oracle refresh | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-166 | test/unit/tx-builders.test.ts | tx-builders | buildPlaceOrderTx with oracle refresh and sponsor reimburse | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-167 | test/unit/tx-builders.test.ts | tx-builders | buildMintWlpTx with oracle refresh | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-168 | test/unit/tx-builders.test.ts | tx-builders | openPythSponsorFund + reimbursePythSponsor | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-169 | test/unit/tx-builders.test.ts | tx-builders | reuses passed Transaction via tx opt | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-170 | test/unit/tx-builders.test.ts | tx-builders | buildRedeemVaaTx chains redeem_vaa + consume_deposit_direct | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-171 | test/unit/tx-builders.test.ts | tx-builders | buildRequestCreditWithdrawTx — wormhole and native routes | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-172 | test/unit/tx-builders.test.ts | tx-builders | buildExecuteWithdrawalTx — wormhole (default zero fee) and native | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-173 | test/unit/tx-builders.test.ts | tx-builders | buildRequestCreditWithdrawTx rejects invalid wormhole chain id | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-174 | test/unit/tx-builders.test.ts | tx-builders | buildRequestCreditWithdrawTx throws when withdrawal_queue is not configured | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-175 | test/unit/user-account.test.ts | user-account | createAccount | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-176 | test/unit/user-account.test.ts | user-account | setAlias | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-177 | test/unit/user-account.test.ts | user-account | addDelegate + removeDelegate | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-178 | test/unit/user-account.test.ts | user-account | setDelegateProtocolPermission | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-179 | test/unit/user-account.test.ts | user-account | requestDeposit + requestWithdraw + transferToAccount | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-180 | test/unit/user-credit.test.ts | user-credit | redeemVaa accepts bare hex strings without 0x prefix | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-181 | test/unit/user-credit.test.ts | user-credit | redeemVaa accepts number[] VAA bytes | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-182 | test/unit/user-credit.test.ts | user-credit | redeemVaa rejects odd-length hex VAA | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-183 | test/unit/user-credit.test.ts | user-credit | routeWormhole rejects non-integer evmDestinationChain | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-184 | test/unit/user-credit.test.ts | user-credit | routeWormhole rejects negative and out-of-range chain ids | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-185 | test/unit/user-credit.test.ts | user-credit | routeWormhole rejects EVM addresses that are not 20 bytes | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-186 | test/unit/user-credit.test.ts | user-credit | redeemVaa emits one moveCall and accepts hex / base64 VAA bytes | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-187 | test/unit/user-credit.test.ts | user-credit | consumeCreditDeposit chains after redeemVaa | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-188 | test/unit/user-credit.test.ts | user-credit | routeWormhole and routeNative each emit one moveCall | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-189 | test/unit/user-credit.test.ts | user-credit | requestCreditWithdraw + enqueueWithdrawal compose wormhole withdraw path | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-190 | test/unit/user-credit.test.ts | user-credit | executeWithdrawalWormhole and executeWithdrawalNative (keeper) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-191 | test/unit/user-credit.test.ts | user-credit | custodyMint omits extraData when not provided | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-192 | test/unit/user-credit.test.ts | user-credit | custodyMint + consumeCreditDeposit and custodyBurn | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-193 | test/unit/user-credit.test.ts | user-credit | redeemVaa requires initialized bridge | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-194 | test/unit/user-credit.test.ts | user-credit | routeWormhole requires withdrawal_queue package | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-195 | test/unit/user-credit.test.ts | user-credit | enqueueWithdrawal requires queue object id | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-196 | test/unit/user-credit.test.ts | user-credit | custodyMint requires native_custody vault | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-197 | test/unit/user-credit.test.ts | user-credit | executeWithdrawalNative requires custody vault id | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-198 | test/unit/user-credit.test.ts | user-credit | redeemVaa requires waterx_credit.credit_registry | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-199 | test/unit/user-custody.test.ts | user-custody | mintCredit emits one moveCall and returns the deposit request | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-200 | test/unit/user-custody.test.ts | user-custody | mintCredit defaults the CREDIT type to client.creditType() | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-201 | test/unit/user-custody.test.ts | user-custody | mintCreditFromRequest emits one moveCall and returns the credit request | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-202 | test/unit/user-custody.test.ts | user-custody | mintCreditFromRequest defaults creditType to client.creditType() | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-203 | test/unit/user-custody.test.ts | user-custody | mintCreditToAccount chains mint + consume_deposit_direct | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-204 | test/unit/user-custody.test.ts | user-custody | burnCredit emits one moveCall and returns the redeemed coin | 離線 fixture / mock config；無網路、無私鑰 | 建立 PTB，檢查 `moveCall` 目標與參數 | Vitest `expect` 斷言通過 |
| U-205 | test/unit/user-custody.test.ts | user-custody | throws a clear error when the credit pipeline is not configured | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-206 | test/unit/user-custody.test.ts | user-custody | throws when native_custody vault is missing but credit is present | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-207 | test/unit/user-custody.test.ts | user-custody | mintCreditToAccount throws when waterx_credit is missing | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-208 | test/unit/user-custody.test.ts | user-custody | mintCreditToAccount throws when native_custody vault is missing | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-209 | test/unit/user-order-ptb.test.ts | user-order-ptb | buildPlaceOrderArgument + placeOrderRequest (market form) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-210 | test/unit/user-order-ptb.test.ts | user-order-ptb | placeOrderRequest with limit trigger + pre-order legs | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-211 | test/unit/user-order-ptb.test.ts | user-order-ptb | cancelOrderRequest wildcard | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-212 | test/unit/user-order-ptb.test.ts | user-order-ptb | cancelOrderRequest omits optional triggerPrice and orderTypeTag | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-213 | test/unit/user-order-ptb.test.ts | user-order-ptb | cancelPreOrderRequest + addPreOrderRequest | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-214 | test/unit/user-order-ptb.test.ts | user-order-ptb | updateOrderRequest | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-215 | test/unit/user-staking-ptb.test.ts | user-staking-ptb | stake with rewarder settlement | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-216 | test/unit/user-staking-ptb.test.ts | user-staking-ptb | unstake with rewarder settlement | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-217 | test/unit/user-staking-ptb.test.ts | user-staking-ptb | claimReward | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-218 | test/unit/user-staking-ptb.test.ts | user-staking-ptb | stake and unstake without rewarderTypes skip settlement loops | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-219 | test/unit/user-staking-ptb.test.ts | user-staking-ptb | throws when staking pool alias missing | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-220 | test/unit/user-staking-ptb.test.ts | user-staking-ptb | throws when waterx_staking package is not configured | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-221 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | updateFundingRate | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-222 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | matchOrders | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-223 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | liquidate + batchLiquidate | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-224 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | openPositionByKeeper | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-225 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | closePositionByKeeper | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-226 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | request + executeTrading wiring | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-227 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | decrease / deposit / withdraw collateral requests | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-228 | test/unit/user-trading-ptb.test.ts | user-trading-ptb | closePositionRequest returns hot potato | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-229 | test/unit/user-wlp.test.ts | user-wlp | mintWlp | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-230 | test/unit/user-wlp.test.ts | user-wlp | requestRedeemWlp + cancelRedeemWlp | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-231 | test/unit/user-wlp.test.ts | user-wlp | settleRedeemWlp | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-232 | test/unit/user-wlp.test.ts | user-wlp | mintWlp throws when wlp_aum missing | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-233 | test/unit/user-wlp.test.ts | user-wlp | updateTokenValue | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-234 | test/unit/wormhole.test.ts | wormhole | toWormholescanEmitter left-pads EVM addresses to 32 bytes | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-235 | test/unit/wormhole.test.ts | wormhole | round-trips base64 ↔ bytes ↔ hex | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-236 | test/unit/wormhole.test.ts | wormhole | fetchVaa returns null on HTTP 404 (unsigned VAA) | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-237 | test/unit/wormhole.test.ts | wormhole | fetchVaa throws on non-404 HTTP errors | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-238 | test/unit/wormhole.test.ts | wormhole | fetchVaa returns null when response has no vaa field | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-239 | test/unit/wormhole.test.ts | wormhole | fetchVaa parses a signed VAA payload | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-240 | test/unit/wormhole.test.ts | wormhole | listVaasByEmitter returns items or empty array | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | 回傳空集合，不拋錯 |
| U-241 | test/unit/wormhole.test.ts | wormhole | listVaasByEmitter throws on HTTP error | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-242 | test/unit/wormhole.test.ts | wormhole | doFetch throws when no global fetch and no fetchImpl | 離線 fixture / mock config；無網路、無私鑰 | 呼叫被測函式（非法輸入或缺 config） | 同步拋錯或 `rejects.toThrow` |
| U-243 | test/unit/wormhole.test.ts | wormhole | fetchDepositVaa delegates to client wormholescan endpoint | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-244 | test/unit/wormhole.test.ts | wormhole | listBridgeWithdrawalVaas requires emitter_cap in config | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-245 | test/unit/wormhole.test.ts | wormhole | listBridgeWithdrawalVaas lists via configured emitter cap | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-246 | test/unit/wormhole.test.ts | wormhole | returns when fetchVaa succeeds on first tick | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-247 | test/unit/wormhole.test.ts | wormhole | times out when VAA never appears | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-248 | test/unit/wormhole.test.ts | wormhole | aborts when signal is already aborted | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-249 | test/unit/wormhole.test.ts | wormhole | aborts at sleep entry when signal was aborted after a 404 fetch | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |
| U-250 | test/unit/wormhole.test.ts | wormhole | aborts while sleeping between poll attempts | 離線 fixture / mock config；無網路、無私鑰 | 執行單元斷言（純函式、解析、匯出） | Vitest `expect` 斷言通過 |

---

## 二、E2E Simulate 測試（test/simulate/）

| 編號 | 模組/檔案 | 測試套件 | 用例名稱 | 前置條件 | 操作步驟 | 預期結果 |
| --- | --- | --- | --- | --- | --- | --- |
| E-001 | test/simulate/account-wxa.test.ts | account-wxa | simulates createAccount PTB shape | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-002 | test/simulate/builders-compose.test.ts | builders-compose | createAccount + simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 執行 e2e 場景（simulate） | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-003 | test/simulate/builders-compose.test.ts | builders-compose | increasePositionRequest + executeTrading in one PTB when discovery hits | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB 並檢查指令或 simulate | 斷言通過；或前置不足 / Hermes 不可用時 `ctx.skip` |
| E-004 | test/simulate/config-views.test.ts | config-views | client loaded canonical markets | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-005 | test/simulate/config-views.test.ts | config-views | getGlobalConfigData | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-006 | test/simulate/config-views.test.ts | config-views | getMarketData (BTCUSD) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-007 | test/simulate/config-views.test.ts | config-views | getPoolData | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-008 | test/simulate/config-views.test.ts | config-views | positionExists for unlikely id | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-009 | test/simulate/credit.test.ts | credit | buildRedeemVaaTx composes redeem + consume (invalid VAA may abort on simulate) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-010 | test/simulate/credit.test.ts | credit | buildRequestCreditWithdrawTx wormhole route PTB shape | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | 斷言通過（型別/值/PTB 結構） |
| E-011 | test/simulate/credit.test.ts | credit | buildRequestCreditWithdrawTx native route PTB shape | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | 斷言通過（型別/值/PTB 結構） |
| E-012 | test/simulate/credit.test.ts | credit | buildExecuteWithdrawalTx wormhole and native keeper paths | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | 斷言通過（型別/值/PTB 結構） |
| E-013 | test/simulate/credit.test.ts | credit | listBridgeWithdrawalVaas uses mocked Wormholescan | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-014 | test/simulate/credit.test.ts | credit | getAccountsByOwner returns an array for dummy sender | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-015 | test/simulate/credit.test.ts | credit | native withdraw zero amount fails simulate without wxa env | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-016 | test/simulate/credit.test.ts | credit | simulates native withdraw enqueue when wxa has CREDIT balance | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-017 | test/simulate/credit.test.ts | credit | simulates buildRedeemVaaTx with minimal VAA bytes | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-018 | test/simulate/credit.test.ts | credit | native withdraw enqueue over wxa CREDIT balance fails simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-019 | test/simulate/credit.test.ts | credit | native withdraw with zero amount fails simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-020 | test/simulate/credit.test.ts | credit | native withdraw with unregistered assetType fails simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-021 | test/simulate/custody.test.ts | custody | getCustodyVaultData reads creditSupply | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-022 | test/simulate/custody.test.ts | custody | getCustodyAssetData for each configured backing asset | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-023 | test/simulate/custody.test.ts | custody | mintCredit composes one moveCall against live config package ids | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB 並檢查指令或 simulate | 斷言通過（型別/值/PTB 結構） |
| E-024 | test/simulate/custody.test.ts | custody | mintCreditFromRequest composes one moveCall | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB 並檢查指令或 simulate | 斷言通過（型別/值/PTB 結構） |
| E-025 | test/simulate/custody.test.ts | custody | mintCreditToAccount chains mint + consume_deposit_direct (two moveCalls) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-026 | test/simulate/custody.test.ts | custody | burnCredit composes one moveCall | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB 並檢查指令或 simulate | 斷言通過（型別/值/PTB 結構） |
| E-027 | test/simulate/custody.test.ts | custody | simulates mintCreditToAccount when wxa env + wallet backing coin exist | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-028 | test/simulate/custody.test.ts | custody | mintCreditToAccount with zero backing amount fails simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-029 | test/simulate/custody.test.ts | custody | mintCreditToAccount with unregistered assetType fails simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-030 | test/simulate/custody.test.ts | custody | burnCredit for more than wallet Coin<CREDIT> balance fails simulate | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-031 | test/simulate/custody.test.ts | custody | simulates burnCredit when wallet holds Coin<CREDIT> | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-032 | test/simulate/custody.test.ts | custody | buildRedeemVaaTx is exported alongside custody mint path | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | 斷言通過（型別/值/PTB 結構） |
| E-033 | test/simulate/fetch-errors.test.ts | fetch-errors | getPosition for very unlikely position id rejects | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-034 | test/simulate/keeper.test.ts | keeper | liquidate PTB simulates | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-035 | test/simulate/keeper.test.ts | keeper | matchOrders PTB simulates | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-036 | test/simulate/keeper.test.ts | keeper | updateFundingRate PTB simulates | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-037 | test/simulate/oracle-pyth.test.ts | oracle-pyth | refreshes BTC + USDC pool tickers in one simulate PTB | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB 並檢查指令或 simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-038 | test/simulate/read-account.test.ts | read-account | getAccountData accepts simulate for discovered wxa account id | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | `simulate` 或 view 查詢鏈上狀態 | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-039 | test/simulate/read-account.test.ts | read-account | getAccountPositions when funded probe resolves | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | `simulate` 或 view 查詢鏈上狀態 | 斷言通過；或前置不足 / Hermes 不可用時 `ctx.skip` |
| E-040 | test/simulate/read-account.test.ts | read-account | getAccountOrders when funded probe resolves | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | `simulate` 或 view 查詢鏈上狀態 | 斷言通過；或前置不足 / Hermes 不可用時 `ctx.skip` |
| E-041 | test/simulate/read-pagination.test.ts | read-pagination | lists market orders with cursor + pageSize | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-042 | test/simulate/read-pagination.test.ts | read-pagination | lists market positions with cursor + pageSize | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-043 | test/simulate/read-position-order.test.ts | read-position-order | positionExists false for huge id | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-044 | test/simulate/read-position-order.test.ts | read-position-order | getPosition rejects for missing position id | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-045 | test/simulate/read-position-order.test.ts | read-position-order | getOrder simulates for unlikely order id (may abort — still exercises builder) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-046 | test/simulate/read-referral.test.ts | read-referral | getRefererFor returns undefined for zero referee | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-047 | test/simulate/read-referral.test.ts | read-referral | isValidReferralCode rejects INVALID shape | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | simulate/執行 abort 或明確錯誤；非法輸入必失敗 |
| E-048 | test/simulate/read-referral.test.ts | read-referral | referralCodeExists returns boolean for random code | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-049 | test/simulate/read-views.test.ts | read-views | loads BTCUSD market entry from config | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-050 | test/simulate/read-views.test.ts | read-views | getGlobalConfigData | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-051 | test/simulate/read-views.test.ts | read-views | getMarketData (BTCUSD) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-052 | test/simulate/read-views.test.ts | read-views | getPoolData | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-053 | test/simulate/read-views.test.ts | read-views | getTokenPoolData (first pool token) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-054 | test/simulate/read-views.test.ts | read-views | client.getAggregator / getPythFeed / wlpType / getPoolTokenType | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 執行 e2e 場景（simulate） | 斷言通過（型別/值/PTB 結構） |
| E-055 | test/simulate/read-wlp-queue.test.ts | read-wlp-queue | getRedeemRequests returns vector page + optional cursor | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | `simulate` 或 view 查詢鏈上狀態 | 斷言通過（型別/值/PTB 結構） |
| E-056 | test/simulate/referral.test.ts | referral | composes setReferralCode PTB (simulate-only) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa | 組 PTB 並檢查指令或 simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-057 | test/simulate/staking.test.ts | staking | stake() builds deposit + checker destroy plumbing (discovered wxa WLP) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | 斷言通過（型別/值/PTB 結構） |
| E-058 | test/simulate/trade-ghost-sizing.test.ts | trade-ghost-sizing | buildClosePositionTx simulates (ghost position) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-059 | test/simulate/trade-ghost-sizing.test.ts | trade-ghost-sizing | buildIncreasePositionTx simulates (ghost position) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-060 | test/simulate/trade-ghost-sizing.test.ts | trade-ghost-sizing | buildDecreasePositionTx simulates (ghost position) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-061 | test/simulate/trade-ghost-sizing.test.ts | trade-ghost-sizing | buildDepositCollateralTx simulates (ghost position) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-062 | test/simulate/trade-ghost-sizing.test.ts | trade-ghost-sizing | buildWithdrawCollateralTx simulates (ghost position) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-063 | test/simulate/trade-open.test.ts | trade-open | buildPlaceOrderTx simulates market-form entry on BTCUSD | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-064 | test/simulate/trade-orders.test.ts | trade-orders | buildCancelOrderTx simulates (ghost order id) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-065 | test/simulate/trade-orders.test.ts | trade-orders | buildUpdateOrderTx simulates (ghost order id) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-066 | test/simulate/trade-position.test.ts | trade-position | simulates increase on discovered row | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-067 | test/simulate/trade-position.test.ts | trade-position | simulates partial decrease on discovered row | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-068 | test/simulate/trade-position.test.ts | trade-position | simulates deposit collateral (+1 USDC unit) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-069 | test/simulate/trade-position.test.ts | trade-position | simulates tiny withdraw collateral | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-070 | test/simulate/trade-position.test.ts | trade-position | simulates close with wide acceptable price | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-071 | test/simulate/trade-pre-order-requests.test.ts | trade-pre-order-requests | buildCancelPreOrderTx simulates (ghost main/pre ids) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-072 | test/simulate/trade-pre-order-requests.test.ts | trade-pre-order-requests | buildAddPreOrderTx simulates reduce-only TP leg (ghost main order) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-073 | test/simulate/trade-pre-orders.test.ts | trade-pre-orders | buildPlaceOrderTx with reduce-only pre-order legs (simulate) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-074 | test/simulate/tx-builders-smoke.test.ts | tx-builders-smoke | buildPlaceOrderTx simulates (market form) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-075 | test/simulate/wlp-redeem.test.ts | wlp-redeem | requestRedeemWlp simulates (discovered wxa WLP balance) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-076 | test/simulate/wlp-redeem.test.ts | wlp-redeem | cancelRedeemWlp simulates (discovered pending queue row) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；鏈上 wxa 有餘額/持倉（無則 `ctx.skip`） | 組 PTB → `devInspectTransactionBlock` / simulate | simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功 |
| E-077 | test/simulate/wlp.test.ts | wlp | buildMintWlpTx composes refresh + mint (discovered wxa USDC) | `WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa；Hermes Pyth 可用（503/521 可能 skip） | 組 PTB → `devInspectTransactionBlock` / simulate | 斷言通過（型別/值/PTB 結構） |

---

## 三、Integration 測試（test/integration/）

| 編號 | 模組/檔案 | 測試套件 | 用例名稱 | 前置條件 | 操作步驟 | 預期結果 |
| --- | --- | --- | --- | --- | --- | --- |
| I-001 | test/integration/user/trader-close-position.test.ts | trader-close-position | closes a single position (pinned or newest across lifecycle tickers) | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名並 `signAndExecute` 多步交易（開倉/調整/平倉） | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-002 | test/integration/user/trader-credit-pipeline.test.ts | trader-credit-pipeline | mints CREDIT via mintCreditToAccount when wxa balance is low | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 鏈上 mint / enqueue withdraw 等簽名交易 | `assertSuccess` 或環境/部署不符時 `ctx.skip` |
| I-003 | test/integration/user/trader-credit-pipeline.test.ts | trader-credit-pipeline | buildRequestCreditWithdrawTx native route enqueues from wxa CREDIT | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 鏈上 mint / enqueue withdraw 等簽名交易 | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-004 | test/integration/user/trader-custody.test.ts | trader-custody | mints CREDIT into the integration wxa account from wallet backing coin | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 鏈上 mint / enqueue withdraw 等簽名交易 | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-005 | test/integration/user/trader-e2e-persistent-state.test.ts | trader-e2e-persistent-state | runE2ePersistentPreflight seeds keeper slots and wxa WLP | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名執行 WLP/staking/keeper PTB | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-006 | test/integration/user/trader-keeper-roundtrip.test.ts | trader-keeper-roundtrip | updateFundingRate executes on BTCUSD | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名執行整合場景 PTB | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-007 | test/integration/user/trader-keeper-roundtrip.test.ts | trader-keeper-roundtrip | openPositionByKeeper then closePositionByKeeper on an empty ticker slot | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名並 `signAndExecute` 多步交易（開倉/調整/平倉） | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-008 | test/integration/user/trader-market-onchain-config.test.ts | trader-market-onchain-config | lifecycle + persistent tickers (when deployed) | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名並 `signAndExecute` 多步交易（開倉/調整/平倉） | `assertSuccess` 或環境/部署不符時 `ctx.skip` |
| I-009 | test/integration/user/trader-open-smoke.test.ts | trader-open-smoke | single openPositionByKeeper when a lifecycle ticker has zero position | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名並 `signAndExecute` 多步交易（開倉/調整/平倉） | `assertSuccess` 或環境/部署不符時 `ctx.skip` |
| I-010 | test/integration/user/trader-position-lifecycle.test.ts | trader-position-lifecycle | open → deposit → withdraw → increase → decrease → close | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名並 `signAndExecute` 多步交易（開倉/調整/平倉） | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-011 | test/integration/user/trader-staking.test.ts | trader-staking | stakes 1 WLP then unstakes 1 WLP | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名執行 WLP/staking/keeper PTB | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |
| I-012 | test/integration/user/trader-wlp-redeem.test.ts | trader-wlp-redeem | requestRedeemWlp then cancelRedeemWlp on the integration wxa account | `WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas | 簽名執行整合場景 PTB | `assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip` |

---

## 附錄：依檔案索引

| 檔案 | 用例數 | 編號範圍 |
| --- | ---: | --- |
| test/unit/account-request.test.ts | 4 | U-001–U-004 |
| test/unit/canonical-testnet-account.test.ts | 3 | U-005–U-007 |
| test/unit/client.test.ts | 13 | U-008–U-020 |
| test/unit/config-load.test.ts | 10 | U-021–U-030 |
| test/unit/config-utils.test.ts | 3 | U-031–U-033 |
| test/unit/constants.test.ts | 5 | U-034–U-038 |
| test/unit/e2e-preflight.test.ts | 2 | U-039–U-040 |
| test/unit/expected-open-trading-fee.test.ts | 2 | U-041–U-042 |
| test/unit/fetch-simulate.test.ts | 6 | U-043–U-048 |
| test/unit/fetch-view-data.test.ts | 25 | U-049–U-073 |
| test/unit/integration-gas.test.ts | 3 | U-074–U-076 |
| test/unit/integration-market-snapshot.test.ts | 2 | U-077–U-078 |
| test/unit/math.test.ts | 43 | U-079–U-121 |
| test/unit/pyth-branches.test.ts | 21 | U-122–U-142 |
| test/unit/pyth.test.ts | 10 | U-143–U-152 |
| test/unit/referral.test.ts | 3 | U-153–U-155 |
| test/unit/sdk-imports.test.ts | 5 | U-156–U-160 |
| test/unit/tx-builders.test.ts | 14 | U-161–U-174 |
| test/unit/user-account.test.ts | 5 | U-175–U-179 |
| test/unit/user-credit.test.ts | 19 | U-180–U-198 |
| test/unit/user-custody.test.ts | 10 | U-199–U-208 |
| test/unit/user-order-ptb.test.ts | 6 | U-209–U-214 |
| test/unit/user-staking-ptb.test.ts | 6 | U-215–U-220 |
| test/unit/user-trading-ptb.test.ts | 8 | U-221–U-228 |
| test/unit/user-wlp.test.ts | 5 | U-229–U-233 |
| test/unit/wormhole.test.ts | 17 | U-234–U-250 |
| test/simulate/account-wxa.test.ts | 1 | E-001–E-001 |
| test/simulate/builders-compose.test.ts | 2 | E-002–E-003 |
| test/simulate/config-views.test.ts | 5 | E-004–E-008 |
| test/simulate/credit.test.ts | 12 | E-009–E-020 |
| test/simulate/custody.test.ts | 12 | E-021–E-032 |
| test/simulate/fetch-errors.test.ts | 1 | E-033–E-033 |
| test/simulate/keeper.test.ts | 3 | E-034–E-036 |
| test/simulate/oracle-pyth.test.ts | 1 | E-037–E-037 |
| test/simulate/read-account.test.ts | 3 | E-038–E-040 |
| test/simulate/read-pagination.test.ts | 2 | E-041–E-042 |
| test/simulate/read-position-order.test.ts | 3 | E-043–E-045 |
| test/simulate/read-referral.test.ts | 3 | E-046–E-048 |
| test/simulate/read-views.test.ts | 6 | E-049–E-054 |
| test/simulate/read-wlp-queue.test.ts | 1 | E-055–E-055 |
| test/simulate/referral.test.ts | 1 | E-056–E-056 |
| test/simulate/staking.test.ts | 1 | E-057–E-057 |
| test/simulate/trade-ghost-sizing.test.ts | 5 | E-058–E-062 |
| test/simulate/trade-open.test.ts | 1 | E-063–E-063 |
| test/simulate/trade-orders.test.ts | 2 | E-064–E-065 |
| test/simulate/trade-position.test.ts | 5 | E-066–E-070 |
| test/simulate/trade-pre-order-requests.test.ts | 2 | E-071–E-072 |
| test/simulate/trade-pre-orders.test.ts | 1 | E-073–E-073 |
| test/simulate/tx-builders-smoke.test.ts | 1 | E-074–E-074 |
| test/simulate/wlp-redeem.test.ts | 2 | E-075–E-076 |
| test/simulate/wlp.test.ts | 1 | E-077–E-077 |
| test/integration/user/trader-close-position.test.ts | 1 | I-001–I-001 |
| test/integration/user/trader-credit-pipeline.test.ts | 2 | I-002–I-003 |
| test/integration/user/trader-custody.test.ts | 1 | I-004–I-004 |
| test/integration/user/trader-e2e-persistent-state.test.ts | 1 | I-005–I-005 |
| test/integration/user/trader-keeper-roundtrip.test.ts | 2 | I-006–I-007 |
| test/integration/user/trader-market-onchain-config.test.ts | 1 | I-008–I-008 |
| test/integration/user/trader-open-smoke.test.ts | 1 | I-009–I-009 |
| test/integration/user/trader-position-lifecycle.test.ts | 1 | I-010–I-010 |
| test/integration/user/trader-staking.test.ts | 1 | I-011–I-011 |
| test/integration/user/trader-wlp-redeem.test.ts | 1 | I-012–I-012 |
