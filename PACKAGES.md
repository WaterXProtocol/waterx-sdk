# WaterX Protocol — Package IDs & Shared Objects (Testnet)

## Package IDs

| Package               | ID                                                                   |
| --------------------- | -------------------------------------------------------------------- |
| `waterx_perp`         | `0x712439e28f9c6c8f8fab9aaca3c45e1465470e3017ab2748ac8e056dc9321ab4` |
| `bucket_v2_framework` | `0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790` |
| `bucket_v2_oracle`    | `0xa00eb6c923368aef9aade69d75b348f53dc2ee344771ce3c3629dee05a0fb88c` |
| `pyth_rule`           | `0xecd0b3db574ac2ad6b1d6828e5643e7ffb9ff919d8b04843d411dd8b7e027e94` |
| `wlp`                 | `0x4453c86df34a0f64407673a590ee166e69eccba630faf9fd067889701c3769e8` |
| `mock_usdc`           | `0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a` |
| `mock_usdt`           | `0x44a34861e63fa84463018428bd129fbc2e8739c6b6151387e7b8b38d3d43a69f` |
| `waterx_coins`        | `0x64158e48941d4c6e868b3ef0dad03ee587d3acafcb928cf139be42f5df8a9c36` |
| `waterx_coins_extra`  | `0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4` |

### External Dependencies

| Package            | ID                                                                   |
| ------------------ | -------------------------------------------------------------------- |
| Pyth (testnet)     | `0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837` |
| Wormhole (testnet) | `0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94` |

## Shared Objects

### Protocol Singletons

| Object          | Type                                         | ID                                                                   |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| GlobalConfig    | `waterx_perp::global_config::GlobalConfig`   | `0x8eb4d71d525921ae759040e5dd6746719784184b8d6a0a9c655454f48cac32f0` |
| AccountRegistry | `waterx_perp::user_account::AccountRegistry` | `0x54f234e17fa7709c2e4b0a54e79fd6321bde5179eee29db59efc54fbef638ad4` |
| ReferralTable   | `waterx_perp::referral_table::ReferralTable` | `0x70745470300fe3e3c29e17fd5f27a304894d94c2bca69d401c3ccd8589f1f49a` |
| WlpPool         | `waterx_perp::lp_pool::WlpPool<WLP>`         | `0xbce13b7be3f0663aacef841197e137fe9206414e1a938d4f65c1dbe05a882e4a` |

### Markets (per-asset shared objects)

| Market | Type                       | ID                                                                   |
| ------ | -------------------------- | -------------------------------------------------------------------- |
| BTC    | `Market<WATERX_BTC, WLP>`  | `0x45ae1c32758d575541b99ecb406869d1bf6542d4191ec4dc4d4a6b506cac39b1` |
| ETH    | `Market<WATERX_ETH, WLP>`  | `0x7d6c271229fba55e1c2c530868b206dfc4e91923dfa966d5447b1ed6f30aba2d` |
| SOL    | `Market<WATERX_SOL, WLP>`  | `0xe549de3ce563c12b9cc7fd9f83ae80f74ef49d176abf6430524983d701584724` |
| SUI    | `Market<WATERX_SUI, WLP>`  | `0x2509ffdb19e6d9164064b1fadbd0a2dc8bdfe61cc34fdea3efcdd5e2c37c567a` |
| DEEP   | `Market<WATERX_DEEP, WLP>` | `0xdb26aa8166a45d4cff92a01844b5ef9fa905b38783f31b5e38765054816992d4` |
| WAL    | `Market<WATERX_WAL, WLP>`  | `0x49891a2bd762ee3b202435a9e9094e8bfe8e266343cfd4eb5570593204b8ea9e` |

### Price Aggregators (bucket_oracle)

| Token | ID                                                                   |
| ----- | -------------------------------------------------------------------- |
| BTC   | `0x49b4ef44726620f8bc60fbaf721e3b5f84a7ddc2a8f7a4e55b396dff5cb77528` |
| ETH   | `0x7a54a6c68947fe1ed6c59ffe37fb03960863261993b2c556041e7944ae35c33c` |
| SOL   | `0xf9947f871cc67cb734a8a6b5f29368cce4753a93ba4c0d96516277475fa0e141` |
| SUI   | `0x6198facaceec8333930fa99108d809a43d2f31b3231424a082f6cbef227b7218` |
| DEEP  | `0xce7192008606def9cce51a7ab959170b4901eac570464e71f8494924120f548d` |
| WAL   | `0x7ef03c33d79898f805ec0e0c7082604c6dbf805f2bae1bfe77f20952f011628b` |
| USDC  | `0x6f9cd2133e7073376ac4de314873e625a8606bddb4daa33affd0a08933b8b2a7` |

### Oracle Objects

| Object                   | ID                                                                   |
| ------------------------ | -------------------------------------------------------------------- |
| Pyth Rule Config         | `0xa4633aeb3c8a8f6a9cce50b767026e88db31e9364156949d1f4be9ce61d3ebb8` |
| Oracle Listing Cap       | `0xa5d55065e5f4dda8d17213e425176198332ac639dee5b732c1892a4d8cc49854` |
| Pyth State (testnet)     | `0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c` |
| Wormhole State (testnet) | `0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790` |

### Pyth PriceInfoObjects

| Token | ID                                                                   |
| ----- | -------------------------------------------------------------------- |
| BTC   | `0x72431a238277695d3f31e4425225a4462674ee6cceeea9d66447b210755fffba` |
| ETH   | `0x4fde30cb8a5dc3cfee1c1c358fc66dc308408827efb217247c7ba54d76ccbee9` |
| SOL   | `0x33fbce1cad5ca155f2f5051430b23a694bc6e5de6df43e0f8aefe29f4a84336d` |
| SUI   | `0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0` |
| DEEP  | `0x52e5fb291bd86ca8bdd3e6d89ef61d860ea02e009a64bcc287bc703907ff3e8a` |
| WAL   | `0xa98cbb7a97b4ce306eafdbc52a602578dea25165e6578fe6603caeb002fe02aa` |
| USDC  | `0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81` |

### Owned Objects

| Object        | ID                                                                   |
| ------------- | -------------------------------------------------------------------- |
| AdminCap      | `0x3f1947f25e7b583eccf3d552407ff70a1f97b87d4ab6055e731e3e6d618023b7` |
| USDC Treasury | `0x30d016ca37b34046a561845ea22fc834241b7d33fb746bc2e0b4023d58c93a3e` |

### System Objects

| Object | ID    |
| ------ | ----- |
| Clock  | `0x6` |

## Token Types

| Token       | Full Type                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- |
| USDC        | `0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a::mock_usdc::MOCK_USDC`     |
| USDT        | `0x44a34861e63fa84463018428bd129fbc2e8739c6b6151387e7b8b38d3d43a69f::mock_usdt::MOCK_USDT`     |
| WLP         | `0x4453c86df34a0f64407673a590ee166e69eccba630faf9fd067889701c3769e8::wlp::WLP`                 |
| WATERX_BTC  | `0x64158e48941d4c6e868b3ef0dad03ee587d3acafcb928cf139be42f5df8a9c36::waterx_btc::WATERX_BTC`   |
| WATERX_ETH  | `0x64158e48941d4c6e868b3ef0dad03ee587d3acafcb928cf139be42f5df8a9c36::waterx_eth::WATERX_ETH`   |
| WATERX_SOL  | `0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_sol::WATERX_SOL`   |
| WATERX_SUI  | `0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_sui::WATERX_SUI`   |
| WATERX_DEEP | `0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_deep::WATERX_DEEP` |
| WATERX_WAL  | `0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_wal::WATERX_WAL`   |

## Pyth Price Feed IDs

### Mainnet

| Feed     | ID                                                                   |
| -------- | -------------------------------------------------------------------- |
| BTC/USD  | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD  | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| SOL/USD  | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| SUI/USD  | `0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744` |
| DEEP/USD | `0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff` |
| WAL/USD  | `0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341` |
| USDC/USD | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |

### Testnet

| Feed     | ID                                                                   |
| -------- | -------------------------------------------------------------------- |
| BTC/USD  | `0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b` |
| ETH/USD  | `0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6` |
| SOL/USD  | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| SUI/USD  | `0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744` |
| DEEP/USD | `0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff` |
| WAL/USD  | `0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341` |
| USDC/USD | `0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722` |
