export type Network = "MAINNET" | "TESTNET";

// ======== Base Asset Identifiers ========
export type BaseAsset =
  | "BTC"
  | "ETH"
  | "SOL"
  | "SUI"
  | "DEEP"
  | "WAL"
  | "AAPLX"
  | "GOOGLX"
  | "METAX"
  | "NVDAX"
  | "QQQX"
  | "SPYX"
  | "TSLAX";
export type CollateralAsset = "USDC" | "USDSUI";

// ======== Permission Constants ========
export const PERM_OPEN_POSITION = 1;
export const PERM_CLOSE_POSITION = 2;
export const PERM_PLACE_ORDER = 4;
export const PERM_CANCEL_ORDER = 8;
export const PERM_INCREASE_COLLATERAL = 16;
export const PERM_RELEASE_COLLATERAL = 32;
export const PERM_DEPOSIT = 64;
export const PERM_WITHDRAW = 128;
export const PERM_TRANSFER = 256;
export const PERM_MINT_WLP = 512;
export const PERM_REDEEM_WLP = 1024;
export const PERM_MANAGE_DELEGATES = 2048;
export const PERM_ALL_TRADING = 63;
export const PERM_ALL = 4095;

// ======== Order Type Tags ========
export const ORDER_LIMIT_BUY = 0;
export const ORDER_LIMIT_SELL = 1;
export const ORDER_STOP_BUY = 2;
export const ORDER_STOP_SELL = 3;

// ======== Mainnet Package IDs ========
// Source: waterx-contracts/*/Published.toml
export const MAINNET_PACKAGE_IDS = {
  WATERX_PERP: "0x17235897a9c2e977d60f3ded7b05e85724d7ee846b1519e6d8af7fdbc840da37",
  BUCKET_FRAMEWORK: "0xe2d49d67ff42dc500275f2d84841bf35632aa6c1abdb70af66a10e1de93a4400",
  BUCKET_ORACLE: "0xe23120dae1a64fb48f38f1fc9a6e9ab4dd5b8bc9e6c54b5bf02286e3fc622faa",
  REWARD_DISTRIBUTOR: "0x52e854335056ca09d581660bfd9b6a9f15ed0d44563ed1a59acc04d2bafd876c",
  WLP: "0x00381bd74749ccc1290e448dd5514f83716b330cba3481029fbacb00078f06a5",
  PYTH_RULE: "0x98867517245a2833cc742c731d331133cf0eee221ea9db6950d567ad68950a3f",
  MARKET_SYMBOL: "0xe5a95e2eb52a8ea594d295db9f4930cf07cc84871a584bfc7569946a5408c998",
  PYTH_SPONSOR_RULE: "0x5feea5debebf3cb15fbfd886e7c70b80658346cd92ce747bdec6caffa4d8ee68",
} as const;

// ======== Mainnet Token Types ========
export const MAINNET_TYPES = {
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC" as const,
  USDSUI:
    "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI" as const,
  SUI: "0x2::sui::SUI" as const,
  WLP: `${MAINNET_PACKAGE_IDS.WLP}::wlp::WLP` as const,
  // Crypto (market_symbol)
  BTC_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::BTC_USD` as const,
  ETH_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::ETH_USD` as const,
  SOL_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::SOL_USD` as const,
  SUI_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::SUI_USD` as const,
  DEEP_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::DEEP_USD` as const,
  WAL_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::WAL_USD` as const,
  // xStock (market_symbol)
  AAPLX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::AAPLX_USD` as const,
  GOOGLX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::GOOGLX_USD` as const,
  METAX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::METAX_USD` as const,
  NVDAX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::NVDAX_USD` as const,
  QQQX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::QQQX_USD` as const,
  SPYX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::SPYX_USD` as const,
  TSLAX_USD: `${MAINNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::TSLAX_USD` as const,
} as const;

// ======== Mainnet Shared Objects ========
// Source: Published.toml extra fields + deployments.json
export const MAINNET_OBJECTS = {
  ADMIN_CAP: "0xfd2e7a38a59be63810aa5907ef0e2080b68216a5f20912ba93e46c2eaa2dd320",
  GLOBAL_CONFIG: "0x4ad00a6ea0c0c30fc6e8ac96e08e4ed55438b2da4e3ac34969a1221ccfae2b69",
  ACCOUNT_REGISTRY: "0xfcfeb75c33f157f08d9c33e00b5a102672d982d5715083bf9bdd477ffbd1893d",
  REFERRAL_TABLE: "0xbbbfeed8ebdca08e4d43eaf6f2f937ddf193b3d08ee93a4864693dbfa0d0df7b",
  WLP_POOL: "0xe80638c3c0bfc1c123bc0e7d8d25ed98fb72b917fb5fcf49cb9fb446d7a75aff",
  PYTH_RULE_CONFIG: "0x292239e3c42e7683203d66fa2e1c78ed74cdc813331736a22b8406bbf8fe0c33",
  ORACLE_LISTING_CAP: "0x39537645b23845acb16f80a4a38b27b904b6a019bc9328264e2db0bdf20eaf06",
  PYTH_SPONSOR: "0xb89643465d89efa589db115d2c7bec423eeb39985818dd51b752b4d22f8a77c5",
  REWARD_DISTRIBUTOR: "0x73359477d8f6aa959490f111be96d96a79bcb125b9dbdf3025c2d7e7d3cc22dd",
  CLOCK: "0x6",
} as const;

// ======== Mainnet Per-Market Config ========
export const MAINNET_MARKETS: Record<
  BaseAsset,
  {
    marketId: string;
    aggregatorId: string;
    priceInfoId: string;
    baseType: string;
    feedKey: string;
  }
> = {
  SUI: {
    marketId: "0xa9d949520d34c499821cd3d0c46eba59eba2e92db5c4fdd04dc30e71bc543889",
    aggregatorId: "0x36c2d256465b49e8c3cb0ff4711b2b1ad7477b9ba5163dff156df7875d860498",
    priceInfoId: "0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37",
    baseType: MAINNET_TYPES.SUI_USD,
    feedKey: "SUI/USD",
  },
  BTC: {
    marketId: "0x700f637783e7dabb7df5e66ae19d2f478a9c42a967cc53ef84af9da89cfdb716",
    aggregatorId: "0x5f0a7110d6055e51269cfa656f31f15ff97c73182def563608ad894878aeb4ad",
    priceInfoId: "0x9a62b4863bdeaabdc9500fce769cf7e72d5585eeb28a6d26e4cafadc13f76ab2",
    baseType: MAINNET_TYPES.BTC_USD,
    feedKey: "BTC/USD",
  },
  ETH: {
    marketId: "0xe1c96f5787c41ca1bf8559642176e51480478b9a23dda16a1b8b23664ecd6a62",
    aggregatorId: "0xb92a1ddab529f4cf93fb21deacbf0d0f3d60e1688f88684564fd1fa126c76e72",
    priceInfoId: "0x9193fd47f9a0ab99b6e365a464c8a9ae30e6150fc37ed2a89c1586631f6fc4ab",
    baseType: MAINNET_TYPES.ETH_USD,
    feedKey: "ETH/USD",
  },
  SOL: {
    marketId: "0x3cb39f4bb01ee609ae453756178652a4d7a975f8e0ac5b06f0b5111a8c9475fc",
    aggregatorId: "0xa07c775c85b13c4665a66192e73f40bc0d33ab09f612cbd414aeef94b14a4d9a",
    priceInfoId: "0x9d0d275efbd37d8a8855f6f2c761fa5983293dd8ce202ee5196626de8fcd4469",
    baseType: MAINNET_TYPES.SOL_USD,
    feedKey: "SOL/USD",
  },
  DEEP: {
    marketId: "0xffcb78a95bed581db2f1326ff55eba6a771597ac595f81b6d990906e9fc4a165",
    aggregatorId: "0x659d4ef7cd33b35cf02e8ac9dfdae8118a3b400fd98fedfffdfbce65d7b56fa7",
    priceInfoId: "0x8c7f3a322b94cc69db2a2ac575cbd94bf5766113324c3a3eceac91e3e88a51ed",
    baseType: MAINNET_TYPES.DEEP_USD,
    feedKey: "DEEP/USD",
  },
  WAL: {
    marketId: "0x2035647a52155701c2dedab9c5ad1e4f3a4eff1e8b763ecac0c95cf727ef40e5",
    aggregatorId: "0x00581ee9404a89bb38412884018b42867fbb32afd8568420f575ced0bd2b6d4e",
    priceInfoId: "0xeb7e669f74d976c0b99b6ef9801e3a77716a95f1a15754e0f1399ce3fb60973d",
    baseType: MAINNET_TYPES.WAL_USD,
    feedKey: "WAL/USD",
  },
  QQQX: {
    marketId: "0x62d02b8c01d129441afa14b2014793244485477f5c1867317e44d82a609ac41c",
    aggregatorId: "0x17cbfc766db88740a1c42326fc3738f76c36bc8bcf71138f6d65e8d9b850b3aa",
    priceInfoId: "0xcce836357b028bd85e866320f194980125b58e6117a2e86a24ed5c154df1e799",
    baseType: MAINNET_TYPES.QQQX_USD,
    feedKey: "QQQX/USD",
  },
  SPYX: {
    marketId: "0x4569fbf66f4a92425a4e04dc076aa8dc41150efb14e7ca75612732faae050c2a",
    aggregatorId: "0x12ee8c4a95c85cedbdb221fc285cca7a0d5afcf2dd4840b34b661e276899c2b5",
    priceInfoId: "0x6a2d53a802faee96b26f5fa86d9ccf05d58008e4f32c95985d12edb60f5e23ea",
    baseType: MAINNET_TYPES.SPYX_USD,
    feedKey: "SPYX/USD",
  },
  NVDAX: {
    marketId: "0x0e4eba6d8f776560ee67ad0de7da73276f4ca0da34574dafc1ec4636791795be",
    aggregatorId: "0x4d5430e0ddfdc97db7778fd75556b76020c1fb2f4ec2cded31ebad79393992a0",
    priceInfoId: "0x1ccc57727035cc40a122cecd95f15240de4fb3f2acd5542c8f2109ebc47871a1",
    baseType: MAINNET_TYPES.NVDAX_USD,
    feedKey: "NVDAX/USD",
  },
  TSLAX: {
    marketId: "0x37cefd59a55814442873bad4ce962dab5759fff23b37a489bdd29f388c99db2a",
    aggregatorId: "0x7daad357d5ac4eb66a40d31e8805ee9a60b8e41d8f4579f699aa799e91aadbfb",
    priceInfoId: "0x678fee0f8d449160f7df3a14db41d7318e917c3afae98eed434a87073cb80c6b",
    baseType: MAINNET_TYPES.TSLAX_USD,
    feedKey: "TSLAX/USD",
  },
  AAPLX: {
    marketId: "0x46e5c817eca6b703f706ee8124e7902f563026a2093bda6082e68a3d6714159d",
    aggregatorId: "0x073bec53d49ac7fbc5a47ad8116eae827c2811977ee9460eba11dc72331c9a4f",
    priceInfoId: "0x80c9fa9060e2682528a9b02e0facfd6c4816e1bb363bdc3c9a6e94224618e03d",
    baseType: MAINNET_TYPES.AAPLX_USD,
    feedKey: "AAPLX/USD",
  },
  GOOGLX: {
    marketId: "0xd3a43e10e9a032c21e930ccfa1092079b284794a8431bf6a0894881f1515e9f2",
    aggregatorId: "0x19a38142f86b8153590b41daefb6c8a08835061ddec52cb8770f57aa1c35136a",
    priceInfoId: "0xff0bda4e0c212f409b89c6c5714c1957f6a867eced1bcfde863bd074d2a0d54c",
    baseType: MAINNET_TYPES.GOOGLX_USD,
    feedKey: "GOOGLX/USD",
  },
  METAX: {
    marketId: "0x7abfb5b48175c741e3c7c5373dedabdb1cf8d9c3ddbfc2b79f9ddd3dd52fded0",
    aggregatorId: "0x189852a6cbd75b26c5663db9ac36079ae993cf5972125d5be2dc63f03d4252ac",
    priceInfoId: "0x0cd398ea0262b504a946b3d4acde457a21bee9d41a27083ebf6ec19f99272155",
    baseType: MAINNET_TYPES.METAX_USD,
    feedKey: "METAX/USD",
  },
};

/** All mainnet collateral token configs keyed by CollateralAsset. */
export const MAINNET_COLLATERALS: Record<
  CollateralAsset,
  {
    type: string;
    aggregatorId: string;
    priceInfoId: string;
    feedKey: string;
  }
> = {
  USDC: {
    type: MAINNET_TYPES.USDC,
    aggregatorId: "0x32cd896edfbc511fb48d89abcb2ab956d8f50bbd36a705aaba19462c155855c5",
    priceInfoId: "0x5dec622733a204ca27f5a90d8c2fad453cc6665186fd5dff13a83d0b6c9027ab",
    feedKey: "USDC/USD",
  },
  USDSUI: {
    type: MAINNET_TYPES.USDSUI,
    aggregatorId: "0x4b96cbfd6855a8352f06d0abb25ec749db59b3eb7df833db075d94c6af1e0f5b",
    priceInfoId: "0x68644a3ab7a1aab113a4a68b6115a5b51eba4cb6aaac2d99b734be2e5e748425",
    feedKey: "USDSUI/USD",
  },
};

// ======== Testnet Package IDs ========
// Source: waterx-contracts/*/Published.toml
export const TESTNET_PACKAGE_IDS = {
  MOCK_USDC: "0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a",
  MOCK_USDSUI: "0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016",
  REWARD_DISTRIBUTOR: "0xd48680eaeb34138fd791e40a03166d55abc502477204dcad171086e708c70598",
  BUCKET_FRAMEWORK: "0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790",
  BUCKET_ORACLE: "0xa00eb6c923368aef9aade69d75b348f53dc2ee344771ce3c3629dee05a0fb88c",
  MARKET_SYMBOL: "0xd08f5c03e1d5a87d411b39969e5294eb0e5d10560105a747aefa77c0b17facae",
  PYTH_RULE: "0xecd0b3db574ac2ad6b1d6828e5643e7ffb9ff919d8b04843d411dd8b7e027e94",
  WLP: "0x7d3c94df3644f025ec6dfe5ece2e2bd3d7d7eda8fee59697c0930bffad4123bc",
  WATERX_PERP: "0xda4549239e3a1d0dc8e5a6788934f95a723ec81b02112de072cd1b03ccf1eddf",
  PYTH_SPONSOR_RULE: "0x307737604317ee0c353bafb6d89832f05906b57dc5d357f7ef32fa59ae14db00",
} as const;

// ======== Testnet Token Types ========
// Base-token types are market_symbol::<SYM>_USD witness structs (not per-asset coin packages).
export const TESTNET_TYPES = {
  USDC: `${TESTNET_PACKAGE_IDS.MOCK_USDC}::mock_usdc::MOCK_USDC` as const,
  USDSUI: `${TESTNET_PACKAGE_IDS.MOCK_USDSUI}::mock_usdsui::MOCK_USDSUI` as const,
  /** Native Sui (`0x2::sui::SUI`) — used as the reward distributor reward token. */
  SUI: "0x2::sui::SUI" as const,
  WLP: `${TESTNET_PACKAGE_IDS.WLP}::wlp::WLP` as const,
  // Crypto (market_symbol)
  BTC_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::BTC_USD` as const,
  ETH_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::ETH_USD` as const,
  SOL_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::SOL_USD` as const,
  SUI_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::SUI_USD` as const,
  DEEP_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::DEEP_USD` as const,
  WAL_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::WAL_USD` as const,
  // xStock (market_symbol)
  AAPLX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::AAPLX_USD` as const,
  GOOGLX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::GOOGLX_USD` as const,
  METAX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::METAX_USD` as const,
  NVDAX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::NVDAX_USD` as const,
  QQQX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::QQQX_USD` as const,
  SPYX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::SPYX_USD` as const,
  TSLAX_USD: `${TESTNET_PACKAGE_IDS.MARKET_SYMBOL}::market_symbol::TSLAX_USD` as const,
} as const;

// ======== Testnet Shared Objects ========
export const TESTNET_OBJECTS = {
  ADMIN_CAP: "0x44dede8e6dcc4175fe255355470df1d5e6f27d1d5603ace07beb2baac245b744",
  GLOBAL_CONFIG: "0x930e831f4946025d2b75d8f192a02a4e904ed207b583248471f46f65ca5d9ab3",
  ACCOUNT_REGISTRY: "0x038714aab7bcdf6bea5acacb1fd30dfb33e8425fcfe20973b2fb4b53e633b4ff",
  REFERRAL_TABLE: "0xb008a69a277ed7a62318566fd1bba6bc213cdd642232cf62ed3bf58fe437515f",
  WLP_POOL: "0x50167b112bc1d4dbe4907e22c11129074f8b2841519316b27f3405bef35c96a3",
  REWARD_DISTRIBUTOR: "0x8e8f3c056de2fc2424b7cd3d2f52eecb99816d6bdc1b06c27fe8370519c79817",
  PYTH_RULE_CONFIG: "0xa4633aeb3c8a8f6a9cce50b767026e88db31e9364156949d1f4be9ce61d3ebb8",
  ORACLE_LISTING_CAP: "0xa5d55065e5f4dda8d17213e425176198332ac639dee5b732c1892a4d8cc49854",
  USDC_TREASURY: "0x30d016ca37b34046a561845ea22fc834241b7d33fb746bc2e0b4023d58c93a3e",
  PYTH_SPONSOR: "0x31e383d0df7de65568f5dcd129e57367c3291e022115e876d4a5ae5e7db2bbc2",
  CLOCK: "0x6",
} as const;

// ======== Testnet Per-Market Config ========
/** All per-market object IDs, token types, and oracle info keyed by BaseAsset. */
export const TESTNET_MARKETS: Record<
  BaseAsset,
  {
    marketId: string;
    aggregatorId: string;
    priceInfoId: string;
    baseType: string;
    feedKey: string;
  }
> = {
  BTC: {
    marketId: "0x2e7fc12efaa46a7d0204ac995a93bb85d2c20cea03fa63948ef6fccc94f412de",
    aggregatorId: "0x08ea081a12e2f459eab1f36c94ba1be1bdbd46139640649975c269fb1c3b7dec",
    priceInfoId: "0x72431a238277695d3f31e4425225a4462674ee6cceeea9d66447b210755fffba",
    baseType: TESTNET_TYPES.BTC_USD,
    feedKey: "BTC/USD",
  },
  ETH: {
    marketId: "0x4ba6ac9899b6c8c46f6deac9df652ad47d138495f69ef931f1cc6a209668df99",
    aggregatorId: "0xe2e651ded77da7e1b5b8e3c187f557c75c05ac884e138186c3a51ecb1f959300",
    priceInfoId: "0x4fde30cb8a5dc3cfee1c1c358fc66dc308408827efb217247c7ba54d76ccbee9",
    baseType: TESTNET_TYPES.ETH_USD,
    feedKey: "ETH/USD",
  },
  SOL: {
    marketId: "0xda58a8f95feac6e50718c700e9e8691d81cf84888964b796ef7dd55fc2602f52",
    aggregatorId: "0xdaae52b3ad95350e36961f19de8d98eb978def18738d38b75055a1a7ee2a0904",
    priceInfoId: "0x33fbce1cad5ca155f2f5051430b23a694bc6e5de6df43e0f8aefe29f4a84336d",
    baseType: TESTNET_TYPES.SOL_USD,
    feedKey: "SOL/USD",
  },
  SUI: {
    marketId: "0xecd5fd7f562da477ccb20120253dde3c5f1339237431e82a16e7f5e084353c22",
    aggregatorId: "0x6acf526baea5776e716dcf81670445643677365a995b9cb59fb4ad1aa658c1cc",
    priceInfoId: "0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0",
    baseType: TESTNET_TYPES.SUI_USD,
    feedKey: "SUI/USD",
  },
  DEEP: {
    marketId: "0xc77e6da2130e98644dd4edac7f691586829014fd46652500abf9861c6de562f0",
    aggregatorId: "0x1b4295b67ef598a610b5ec64c305f3fb6b69715ae80946884f00309998cb9c39",
    priceInfoId: "0xa98cbb7a97b4ce306eafdbc52a602578dea25165e6578fe6603caeb002fe02aa",
    baseType: TESTNET_TYPES.DEEP_USD,
    feedKey: "DEEP/USD",
  },
  WAL: {
    marketId: "0x1b2b4fef4dc3a4ce65b7dd8edd2cb10cee9b70f3b91be1c72d6436fb78061efa",
    aggregatorId: "0x1fe2ce6a512cbf76cccc40e7e2d44bf23b4b82d5696cbf75eefeb700d5a94412",
    priceInfoId: "0x52e5fb291bd86ca8bdd3e6d89ef61d860ea02e009a64bcc287bc703907ff3e8a",
    baseType: TESTNET_TYPES.WAL_USD,
    feedKey: "WAL/USD",
  },
  AAPLX: {
    marketId: "0x1afd1ca441a0cf8ea7dcccd863f1130fca592ef0907b02275065e32273a6d00a",
    aggregatorId: "0xee88eaf67f6c98071a2adbb2d915cb23ffc61e871427dad79405e5f9608296dc",
    priceInfoId: "0x2d4821a62956e8f1b071494ca9dc08e28f6188973593c27dca7009c87690b24d",
    baseType: TESTNET_TYPES.AAPLX_USD,
    feedKey: "AAPLX/USD",
  },
  GOOGLX: {
    marketId: "0xb41ff672b3ee8bfe6f67bb64e6ce8adfd93209dd27ca0d97c3f7f2ef59f47091",
    aggregatorId: "0x53473eac66da0b9c7a549012b072fbb2854abd3eb5b768b79145f8b2ffe2eed4",
    priceInfoId: "0x7b4d3cf9c76f362aec5966d5795714ab8c1b46f562557e0073a327b92676f818",
    baseType: TESTNET_TYPES.GOOGLX_USD,
    feedKey: "GOOGLX/USD",
  },
  METAX: {
    marketId: "0xf4deb8c2bbd50a424891ec6e13016a1481721a06ed5f70cae7c4c7e658a23a5b",
    aggregatorId: "0x0f4e538ba45ae0e94338f311565e7d4688e8ada098720ed1083d1c00b4ee267f",
    priceInfoId: "0x01bc231ce32545e288901387f86461bba5fde539ada370a82e1ba271a5caf60b",
    baseType: TESTNET_TYPES.METAX_USD,
    feedKey: "METAX/USD",
  },
  NVDAX: {
    marketId: "0x603bc50a022fb40b5d992bfc88364539ee59830e9d2b9655f56160041e2523ed",
    aggregatorId: "0x74b85ac35f17557eed187a8a2e78fc8a8aa1a1abff52b044c6cb08a4fed4991b",
    priceInfoId: "0x93536866dc067411e3f033256e91c43a43fa11262d93d63fd8be7d5011ed4ac4",
    baseType: TESTNET_TYPES.NVDAX_USD,
    feedKey: "NVDAX/USD",
  },
  QQQX: {
    marketId: "0x5d572cc431e90a2f6701773d8283ee72395490c63c890c00683af64cced5628c",
    aggregatorId: "0x1dc24ffd2c099db39bb4925ebf66d712d7cd15114a576f310e610990e69d4f86",
    priceInfoId: "0x03fee32dd53462496dab3395b9fbaeb2b546bc53698e5e180da7f6a3ff4b3c13",
    baseType: TESTNET_TYPES.QQQX_USD,
    feedKey: "QQQX/USD",
  },
  SPYX: {
    marketId: "0x7e00e6f59be38e6d79a7dda1d1a3225f58cf8f44357c5dd62693e8802281b6d7",
    aggregatorId: "0xff55139353e4fe93579b8be93b158bb1ff91a73936c71d7a7ce2012be2276e16",
    priceInfoId: "0x808e71381a054caa1f4f4ec62ff9ea7e62a3c71ef55ac67a61d0ea59d849f4ac",
    baseType: TESTNET_TYPES.SPYX_USD,
    feedKey: "SPYX/USD",
  },
  TSLAX: {
    marketId: "0xf80d6cd00490eece860307bf59d995bd2ccab26712374fa4f4066863a82f297c",
    aggregatorId: "0xe302afff10fb153cc27a83cf5a9aeacc91971bfeba600bdc33e9f453a199c825",
    priceInfoId: "0x851a380d945fd69942eb321665bbf5f1d7990a2958708b346758737c546bbd01",
    baseType: TESTNET_TYPES.TSLAX_USD,
    feedKey: "TSLAX/USD",
  },
};

/** All collateral token configs keyed by CollateralAsset. */
export const TESTNET_COLLATERALS: Record<
  CollateralAsset,
  {
    type: string;
    aggregatorId: string;
    priceInfoId: string;
    feedKey: string;
  }
> = {
  USDC: {
    type: TESTNET_TYPES.USDC,
    aggregatorId: "0x6f9cd2133e7073376ac4de314873e625a8606bddb4daa33affd0a08933b8b2a7",
    priceInfoId: "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81",
    feedKey: "USDC/USD",
  },
  USDSUI: {
    type: TESTNET_TYPES.USDSUI,
    aggregatorId: "0x861d7fe0e5130ca818481f32eff768be1e097c897aa0c35ed9ae10d3f0553179",
    priceInfoId: "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81",
    feedKey: "USDSUI/USD",
  },
};

// ======== Pyth Oracle ========
export const PYTH_STATE_ID: Record<Network, string> = {
  MAINNET: "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
  TESTNET: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
};

export const PYTH_WORMHOLE_STATE_ID: Record<Network, string> = {
  MAINNET: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
  TESTNET: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
};

export const PYTH_HERMES_ENDPOINT: Record<Network, string> = {
  MAINNET: "https://hermes.pyth.network",
  TESTNET: "https://hermes-beta.pyth.network",
};

export const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "USDC/USD": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  "SOL/USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "SUI/USD": "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  "DEEP/USD": "0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff",
  "WAL/USD": "0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341",
  // Collateral
  "USDSUI/USD": "0xd510fcdb3a63f35d3bb118d5db3afc5815a3f13bc55d48abb893b63f0315902a",
  // xStocks (Crypto — 24/7 synthetic feeds, NOT Equity.US which is market-hours only)
  "AAPLX/USD": "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
  "GOOGLX/USD": "0xb911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e",
  "METAX/USD": "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
  "NVDAX/USD": "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
  "QQQX/USD": "0x178a6f73a5aede9d0d682e86b0047c9f333ed0efe5c6537ca937565219c4054d",
  "SPYX/USD": "0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
  "TSLAX/USD": "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
};

export const PYTH_TESTNET_FEED_IDS: Record<string, string> = {
  "BTC/USD": "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b",
  "ETH/USD": "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6",
  "USDC/USD": "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
  "SOL/USD": "0xfe650f0367d4a7ef9815a593ea15d36593f0643aaaf0149bb04be67ab851decd",
  "SUI/USD": "0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
  "DEEP/USD": "0xe18bf5fa857d5ca8af1f6a458b26e853ecdc78fc2f3dc17f4821374ad94d8327",
  "WAL/USD": "0xa6ba0195b5364be116059e401fb71484ed3400d4d9bfbdf46bd11eab4f9b7cea",
  // xStocks (Hermes-beta)
  "AAPLX/USD": "0x44070926d0c056ac8a0dbeeaffa4f9d280843e2b501d0989c5030e88662d62e2",
  "GOOGLX/USD": "0xdb2cfe5ab1c383cc89a4056322f66af72579eeff3d4d240b7dd884f2bd479166",
  "METAX/USD": "0x94d5f287020347f5cb3b9acf4bb21aff91c1ad728b185c1c7cdc7c11fa07fee3",
  "NVDAX/USD": "0x2a8801c7d8b5c186fdb603c106b2f0030b95bd1ced87c96eac8f0e7b49a3674e",
  "QQQX/USD": "0xbe2ffdb65178deddc325db952c02195ab82d2c826af00f52564d9b718ab94563",
  "SPYX/USD": "0xec0a56d175d9317e22b59fc6cc6f157a57d232a64ab93d7212ebae63d97df51d",
  "TSLAX/USD": "0xadf87c6e8a23f1fe7d8909c18da06abb1c9e6cbb32aac8818480c648e264845c",
  // Collateral (no dedicated USDSUI feed on hermes-beta, use USDC)
  "USDSUI/USD": "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
};

export const SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";
