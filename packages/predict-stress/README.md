# WaterX Predict Stress

獨立交付的多錢包壓測工具包。用於對 staging API + testnet broker fill 做漸進式並行下單（1→2→4→8）或 hammer 模式。

## 快速開始（同事版）

```bash
cd packages/predict-stress
pnpm install
pnpm init                    # 複製 wallets.example.json → wallets.json
```

編輯 `config/wallets.json`：每筆填入 `privateKey`、`accountId`（可先留空）、可選 `betUsd`。

```bash
pnpm accounts                # 建立 wxa account，回寫 accountId
E2E_STRESS_DEPOSIT_ALL=1 pnpm deposits   # 把錢包裡 MOCK_USDC 存入 account
pnpm dry-run                 # 只掃 catalog + 印設定，不打鏈
pnpm ramp                    # 預設：1→2→4→8 + fill 量測 + 30s cooldown
```

## 設定方式（建議只用這兩個檔）

| 檔案                        | 用途                                     |
| --------------------------- | ---------------------------------------- |
| `config/stress.config.json` | API、下注金額、segments、各 profile 行為 |
| `config/wallets.json`       | 錢包私鑰 + accountId（**勿 commit**）    |

`.env` 只放可選覆寫（RPC、deposit 金額）。**Shell 已 export 的變數優先於 JSON。**

### `config/stress.config.json` 範例

```json
{
  "api": { "env": "staging", "baseUrl": "https://api-waterx.up.railway.app" },
  "walletsFile": "config/wallets.json",
  "stakes": { "startUsd": 1.01, "stepUsd": 0.01 },
  "run": {
    "segments": ["crypto", "sport"],
    "brokerWaitMs": 45000,
    "cooldownMs": 30000
  }
}
```

改 `profiles.ramp.phases` 即可自訂漸進曲線，不必記一堆 env。

### `config/wallets.json` 每筆欄位

```json
{
  "label": "presstest1",
  "privateKey": "suiprivkey1…",
  "accountId": "0x…",
  "betUsd": 1.01
}
```

- `privateKey`：必填（獨立包不依賴 Sui CLI keystore）
- `accountId`：跑 `pnpm accounts` 後自動填入
- `betUsd`：可選；未設則用 `startUsd + index * stepUsd`

## 常用指令

| 指令                | 說明                                       |
| ------------------- | ------------------------------------------ |
| `pnpm dry-run`      | 驗證 API + 錢包設定                        |
| `pnpm smoke`        | 1 錢包，只 place                           |
| `pnpm smoke-fill`   | 1 錢包，place + fill 耗時                  |
| `pnpm ramp`         | **預設** 1→2→4→8 + fill 量測               |
| `pnpm timing-max`   | 8 並行 + fill，無 cooldown                 |
| `pnpm hammer-smoke` | 1 輪 × 全錢包，只 place                    |
| `pnpm hammer`       | 10 輪 × 全錢包，只 place（不打 fill poll） |

## 輸出欄位

每筆成功訂單：

- `build` — `POST /predict/bets/place` RTT
- `placeTx` — 簽名 + 上鏈 place
- `fill` — place 確認後 → 鏈上出現 `OrderFilled`（輪詢粒度約 **1s**）
- `total` — 整段 wall clock

Phase 摘要的 `fill latency min/p50/p95/max` 是該 phase 各錢包 `fill` 的統計。

## 進階覆寫（可選 env）

```bash
E2E_STRESS_COOLDOWN_MS=0 pnpm ramp
E2E_STRESS_PHASES=1,2,4 pnpm ramp
E2E_STRESS_ROUNDS=5 pnpm hammer
E2E_GRPC_URL=https://your-node pnpm ramp
```

## 交付給同事

### 方式 A：壓縮整包目錄

在 SDK repo 內：

```bash
cd packages/predict-stress
pnpm install
cd ../..
pnpm build    # 建置 @waterx/perp-sdk（本地 file: 依賴需要 dist/）
tar -czvf predict-stress.tar.gz \
  --exclude=node_modules \
  --exclude=config/wallets.json \
  packages/predict-stress
```

同事解壓後：

```bash
cd predict-stress
# 若 tarball 不含 node_modules：
pnpm install
# 若無法 file: 依賴 SDK，改 package.json：
#   "@waterx/perp-sdk": "^2.1.2"
pnpm init && …
```

### 方式 B：留在 monorepo 使用

```bash
cd waterx-sdk-1/packages/predict-stress
pnpm ramp
```

### SDK 維護者同步程式碼

當 `test/prediction/` 的 helper 有更新：

```bash
cd packages/predict-stress
pnpm sync    # 從 ../../test/prediction 複製並改 import
# bootstrap 腳本有本地 patch（privateKey 優先），sync 後需檢查
```

## 前置條件

- Node.js ≥ 20
- 各錢包 testnet **SUI**（gas）+ **MOCK_USDC**（deposit）
- staging API 可連線
- `@waterx/perp-sdk` 已安裝且含 `dist/`（或從 npm 安裝正式版）

## 疑難排解

| 症狀                     | 處理                                             |
| ------------------------ | ------------------------------------------------ |
| `wallets file not found` | `pnpm init` 或複製 `config/wallets.example.json` |
| fill poll HTTP 429       | 用 `pnpm hammer`（不 poll fill）或換私有 RPC     |
| `no wxa account`         | `pnpm accounts`                                  |
| 餘額不足                 | `E2E_STRESS_DEPOSIT_ALL=1 pnpm deposits`         |
