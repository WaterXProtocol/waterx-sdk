import { z } from "zod";
declare const _default: z.ZodObject<{
    schema_version: z.ZodLiteral<2>;
    network: z.ZodEnum<["mainnet", "testnet"]>;
    chain_id: z.ZodString;
    symbols: z.ZodRecord<z.ZodString, z.ZodObject<{
        kind: z.ZodEnum<["perp", "spot", "xstock", "commodity", "fx", "prediction"]>;
    }, "strip", z.ZodTypeAny, {
        kind: "perp" | "spot" | "xstock" | "commodity" | "fx" | "prediction";
    }, {
        kind: "perp" | "spot" | "xstock" | "commodity" | "fx" | "prediction";
    }>>;
    packages: z.ZodRecord<z.ZodString, z.ZodObject<{
        published_at: z.ZodString;
        original_id: z.ZodString;
        version: z.ZodNumber;
        upgrade_capability: z.ZodOptional<z.ZodString>;
        mvr: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            package_info_id: z.ZodString;
            app_cap_id: z.ZodString;
            git: z.ZodOptional<z.ZodObject<{
                repo: z.ZodString;
                path: z.ZodString;
                version: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                path: string;
                version: number;
                repo: string;
            }, {
                path: string;
                version: number;
                repo: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            package_info_id: string;
            app_cap_id: string;
            git?: {
                path: string;
                version: number;
                repo: string;
            } | undefined;
        }, {
            name: string;
            package_info_id: string;
            app_cap_id: string;
            git?: {
                path: string;
                version: number;
                repo: string;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        published_at: string;
        original_id: string;
        version: number;
        upgrade_capability?: string | undefined;
        mvr?: {
            name: string;
            package_info_id: string;
            app_cap_id: string;
            git?: {
                path: string;
                version: number;
                repo: string;
            } | undefined;
        } | undefined;
    }, {
        published_at: string;
        original_id: string;
        version: number;
        upgrade_capability?: string | undefined;
        mvr?: {
            name: string;
            package_info_id: string;
            app_cap_id: string;
            git?: {
                path: string;
                version: number;
                repo: string;
            } | undefined;
        } | undefined;
    }>>;
    objects: z.ZodObject<{
        oracle: z.ZodObject<{
            oracle: z.ZodString;
            listing_cap: z.ZodString;
            aggregators: z.ZodRecord<z.ZodString, z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            oracle: string;
            listing_cap: string;
            aggregators: Record<string, string>;
        }, {
            oracle: string;
            listing_cap: string;
            aggregators: Record<string, string>;
        }>;
        perp: z.ZodObject<{
            global_config: z.ZodString;
            admin_cap: z.ZodString;
            market_registry_wlp: z.ZodString;
            markets: z.ZodRecord<z.ZodString, z.ZodObject<{
                market: z.ZodString;
                config: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                market: string;
                config: string;
            }, {
                market: string;
                config: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            global_config: string;
            admin_cap: string;
            market_registry_wlp: string;
            markets: Record<string, {
                market: string;
                config: string;
            }>;
        }, {
            global_config: string;
            admin_cap: string;
            market_registry_wlp: string;
            markets: Record<string, {
                market: string;
                config: string;
            }>;
        }>;
        wlp: z.ZodObject<{
            pool: z.ZodString;
            aum: z.ZodString;
            currency_type: z.ZodString;
            metadata_cap: z.ZodString;
            pool_tokens: z.ZodRecord<z.ZodString, z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            pool: string;
            aum: string;
            currency_type: string;
            metadata_cap: string;
            pool_tokens: Record<string, string>;
        }, {
            pool: string;
            aum: string;
            currency_type: string;
            metadata_cap: string;
            pool_tokens: Record<string, string>;
        }>;
        staking: z.ZodObject<{
            admin_cap: z.ZodString;
            pools: z.ZodRecord<z.ZodString, z.ZodString>;
            rewarders: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
                rewarder_id: z.ZodString;
                coin_type: z.ZodString;
                decimals: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            admin_cap: string;
            pools: Record<string, string>;
            rewarders: Record<string, Record<string, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>;
        }, {
            admin_cap: string;
            pools: Record<string, string>;
            rewarders: Record<string, Record<string, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>;
        }>;
        account: z.ZodObject<{
            registry: z.ZodString;
            admin_cap: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            admin_cap: string;
            registry: string;
        }, {
            admin_cap: string;
            registry: string;
        }>;
        referral: z.ZodObject<{
            table: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            table: string;
        }, {
            table: string;
        }>;
        credit: z.ZodObject<{
            registry: z.ZodString;
            credit_type: z.ZodString;
            registries: z.ZodRecord<z.ZodString, z.ZodObject<{
                registry: z.ZodString;
                credit_type: z.ZodString;
                decimals: z.ZodNumber;
                metadata_cap: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            registry: string;
            credit_type: string;
            registries: Record<string, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>;
        }, {
            registry: string;
            credit_type: string;
            registries: Record<string, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>;
        }>;
        custody: z.ZodObject<{
            vault: z.ZodString;
            assets: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodString;
                decimal: z.ZodNumber;
                mint_fee_scaled: z.ZodString;
                burn_fee_scaled: z.ZodString;
                min_burn_amount: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }, {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }>, "many">;
            vaults: z.ZodRecord<z.ZodString, z.ZodObject<{
                vault: z.ZodString;
                assets: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    type: z.ZodString;
                    decimal: z.ZodNumber;
                    mint_fee_scaled: z.ZodString;
                    burn_fee_scaled: z.ZodString;
                    min_burn_amount: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }, {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>>;
        }, "strip", z.ZodTypeAny, {
            vault: string;
            assets: {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }[];
            vaults: Record<string, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>;
        }, {
            vault: string;
            assets: {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }[];
            vaults: Record<string, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>;
        }>;
        bridge: z.ZodObject<{
            state: z.ZodString;
            emitter_cap: z.ZodString;
            wormhole_state: z.ZodString;
            limits: z.ZodObject<{
                max_mint_per_tx: z.ZodString;
                max_burn_per_tx: z.ZodString;
                daily_mint: z.ZodString;
                daily_burn: z.ZodString;
                personal_burn: z.ZodObject<{
                    cap_amount: z.ZodString;
                    window_ms: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    cap_amount: string;
                    window_ms: string;
                }, {
                    cap_amount: string;
                    window_ms: string;
                }>;
            }, "strip", z.ZodTypeAny, {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            }, {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            }>;
        }, "strip", z.ZodTypeAny, {
            state: string;
            emitter_cap: string;
            wormhole_state: string;
            limits: {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            };
        }, {
            state: string;
            emitter_cap: string;
            wormhole_state: string;
            limits: {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            };
        }>;
        withdrawal_queue: z.ZodObject<{
            queue: z.ZodString;
            executors: z.ZodArray<z.ZodString, "many">;
            queues: z.ZodRecord<z.ZodString, z.ZodObject<{
                queue: z.ZodString;
                executors: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                queue: string;
                executors: string[];
            }, {
                queue: string;
                executors: string[];
            }>>;
        }, "strip", z.ZodTypeAny, {
            queue: string;
            executors: string[];
            queues: Record<string, {
                queue: string;
                executors: string[];
            }>;
        }, {
            queue: string;
            executors: string[];
            queues: Record<string, {
                queue: string;
                executors: string[];
            }>;
        }>;
        prediction: z.ZodObject<{
            global_config: z.ZodString;
            admin_cap: z.ZodString;
            market_registries: z.ZodRecord<z.ZodString, z.ZodString>;
            settlement_coin_types: z.ZodRecord<z.ZodString, z.ZodString>;
            claimable_link_config: z.ZodString;
            gift_admin_cap: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            global_config: string;
            admin_cap: string;
            market_registries: Record<string, string>;
            settlement_coin_types: Record<string, string>;
            claimable_link_config: string;
            gift_admin_cap: string;
        }, {
            global_config: string;
            admin_cap: string;
            market_registries: Record<string, string>;
            settlement_coin_types: Record<string, string>;
            claimable_link_config: string;
            gift_admin_cap: string;
        }>;
        usd: z.ZodObject<{
            metadata_cap: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            metadata_cap: string;
        }, {
            metadata_cap: string;
        }>;
        faucet: z.ZodOptional<z.ZodObject<{
            faucet: z.ZodString;
            whitelist: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            faucet: string;
            whitelist: string[];
        }, {
            faucet: string;
            whitelist: string[];
        }>>;
        mock_usdsui: z.ZodOptional<z.ZodObject<{
            currency_type: z.ZodString;
            metadata_cap: z.ZodString;
            treasury_cap: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            currency_type: string;
            metadata_cap: string;
            treasury_cap: string;
        }, {
            currency_type: string;
            metadata_cap: string;
            treasury_cap: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        perp: {
            global_config: string;
            admin_cap: string;
            market_registry_wlp: string;
            markets: Record<string, {
                market: string;
                config: string;
            }>;
        };
        prediction: {
            global_config: string;
            admin_cap: string;
            market_registries: Record<string, string>;
            settlement_coin_types: Record<string, string>;
            claimable_link_config: string;
            gift_admin_cap: string;
        };
        oracle: {
            oracle: string;
            listing_cap: string;
            aggregators: Record<string, string>;
        };
        wlp: {
            pool: string;
            aum: string;
            currency_type: string;
            metadata_cap: string;
            pool_tokens: Record<string, string>;
        };
        staking: {
            admin_cap: string;
            pools: Record<string, string>;
            rewarders: Record<string, Record<string, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>;
        };
        account: {
            admin_cap: string;
            registry: string;
        };
        referral: {
            table: string;
        };
        credit: {
            registry: string;
            credit_type: string;
            registries: Record<string, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>;
        };
        custody: {
            vault: string;
            assets: {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }[];
            vaults: Record<string, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>;
        };
        bridge: {
            state: string;
            emitter_cap: string;
            wormhole_state: string;
            limits: {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            };
        };
        withdrawal_queue: {
            queue: string;
            executors: string[];
            queues: Record<string, {
                queue: string;
                executors: string[];
            }>;
        };
        usd: {
            metadata_cap: string;
        };
        faucet?: {
            faucet: string;
            whitelist: string[];
        } | undefined;
        mock_usdsui?: {
            currency_type: string;
            metadata_cap: string;
            treasury_cap: string;
        } | undefined;
    }, {
        perp: {
            global_config: string;
            admin_cap: string;
            market_registry_wlp: string;
            markets: Record<string, {
                market: string;
                config: string;
            }>;
        };
        prediction: {
            global_config: string;
            admin_cap: string;
            market_registries: Record<string, string>;
            settlement_coin_types: Record<string, string>;
            claimable_link_config: string;
            gift_admin_cap: string;
        };
        oracle: {
            oracle: string;
            listing_cap: string;
            aggregators: Record<string, string>;
        };
        wlp: {
            pool: string;
            aum: string;
            currency_type: string;
            metadata_cap: string;
            pool_tokens: Record<string, string>;
        };
        staking: {
            admin_cap: string;
            pools: Record<string, string>;
            rewarders: Record<string, Record<string, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>;
        };
        account: {
            admin_cap: string;
            registry: string;
        };
        referral: {
            table: string;
        };
        credit: {
            registry: string;
            credit_type: string;
            registries: Record<string, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>;
        };
        custody: {
            vault: string;
            assets: {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }[];
            vaults: Record<string, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>;
        };
        bridge: {
            state: string;
            emitter_cap: string;
            wormhole_state: string;
            limits: {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            };
        };
        withdrawal_queue: {
            queue: string;
            executors: string[];
            queues: Record<string, {
                queue: string;
                executors: string[];
            }>;
        };
        usd: {
            metadata_cap: string;
        };
        faucet?: {
            faucet: string;
            whitelist: string[];
        } | undefined;
        mock_usdsui?: {
            currency_type: string;
            metadata_cap: string;
            treasury_cap: string;
        } | undefined;
    }>;
    oracle_rules: z.ZodObject<{
        waterx: z.ZodObject<{
            package: z.ZodString;
            rule_config_object: z.ZodString;
            enclave: z.ZodObject<{
                object: z.ZodString;
                cap: z.ZodString;
                config: z.ZodString;
                pubkey: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            }, {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            package: string;
            rule_config_object: string;
            enclave: {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            };
        }, {
            package: string;
            rule_config_object: string;
            enclave: {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            };
        }>;
        pyth: z.ZodObject<{
            package: z.ZodString;
            pyth_config_object: z.ZodString;
            pyth_price_feeds: z.ZodRecord<z.ZodString, z.ZodObject<{
                feed_id: z.ZodString;
                price_info_object: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                feed_id: string;
                price_info_object: string;
            }, {
                feed_id: string;
                price_info_object: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            package: string;
            pyth_config_object: string;
            pyth_price_feeds: Record<string, {
                feed_id: string;
                price_info_object: string;
            }>;
        }, {
            package: string;
            pyth_config_object: string;
            pyth_price_feeds: Record<string, {
                feed_id: string;
                price_info_object: string;
            }>;
        }>;
        pyth_lazer: z.ZodOptional<z.ZodObject<{
            package: z.ZodString;
            lazer_state_object: z.ZodString;
            lazer_config_object: z.ZodString;
            lazer_feed_ids: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            package: string;
            lazer_state_object: string;
            lazer_config_object: string;
            lazer_feed_ids: Record<string, number>;
        }, {
            package: string;
            lazer_state_object: string;
            lazer_config_object: string;
            lazer_feed_ids: Record<string, number>;
        }>>;
        constant: z.ZodObject<{
            package: z.ZodString;
            rule_config_object: z.ZodString;
            constant_prices: z.ZodRecord<z.ZodString, z.ZodObject<{
                price: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                price: string;
            }, {
                price: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            package: string;
            rule_config_object: string;
            constant_prices: Record<string, {
                price: string;
            }>;
        }, {
            package: string;
            rule_config_object: string;
            constant_prices: Record<string, {
                price: string;
            }>;
        }>;
        supra: z.ZodOptional<z.ZodObject<{
            package: z.ZodString;
            rule_config_object: z.ZodString;
            pair_ids: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            package: string;
            rule_config_object: string;
            pair_ids: Record<string, number>;
        }, {
            package: string;
            rule_config_object: string;
            pair_ids: Record<string, number>;
        }>>;
    }, "strip", z.ZodTypeAny, {
        waterx: {
            package: string;
            rule_config_object: string;
            enclave: {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            };
        };
        pyth: {
            package: string;
            pyth_config_object: string;
            pyth_price_feeds: Record<string, {
                feed_id: string;
                price_info_object: string;
            }>;
        };
        constant: {
            package: string;
            rule_config_object: string;
            constant_prices: Record<string, {
                price: string;
            }>;
        };
        pyth_lazer?: {
            package: string;
            lazer_state_object: string;
            lazer_config_object: string;
            lazer_feed_ids: Record<string, number>;
        } | undefined;
        supra?: {
            package: string;
            rule_config_object: string;
            pair_ids: Record<string, number>;
        } | undefined;
    }, {
        waterx: {
            package: string;
            rule_config_object: string;
            enclave: {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            };
        };
        pyth: {
            package: string;
            pyth_config_object: string;
            pyth_price_feeds: Record<string, {
                feed_id: string;
                price_info_object: string;
            }>;
        };
        constant: {
            package: string;
            rule_config_object: string;
            constant_prices: Record<string, {
                price: string;
            }>;
        };
        pyth_lazer?: {
            package: string;
            lazer_state_object: string;
            lazer_config_object: string;
            lazer_feed_ids: Record<string, number>;
        } | undefined;
        supra?: {
            package: string;
            rule_config_object: string;
            pair_ids: Record<string, number>;
        } | undefined;
    }>;
    evm: z.ZodObject<{
        bridge: z.ZodObject<{
            chains: z.ZodRecord<z.ZodString, z.ZodObject<{
                chain_id: z.ZodNumber;
                wormhole_chain_id: z.ZodNumber;
                wormhole_core: z.ZodString;
                wormhole_executor: z.ZodString;
                block_explorer: z.ZodString;
                deposit_vault: z.ZodString;
                tokens: z.ZodRecord<z.ZodString, z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>>;
        }, "strip", z.ZodTypeAny, {
            chains: Record<string, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>;
        }, {
            chains: Record<string, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>;
        }>;
    }, "strip", z.ZodTypeAny, {
        bridge: {
            chains: Record<string, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>;
        };
    }, {
        bridge: {
            chains: Record<string, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    schema_version: 2;
    network: "mainnet" | "testnet";
    chain_id: string;
    symbols: Record<string, {
        kind: "perp" | "spot" | "xstock" | "commodity" | "fx" | "prediction";
    }>;
    packages: Record<string, {
        published_at: string;
        original_id: string;
        version: number;
        upgrade_capability?: string | undefined;
        mvr?: {
            name: string;
            package_info_id: string;
            app_cap_id: string;
            git?: {
                path: string;
                version: number;
                repo: string;
            } | undefined;
        } | undefined;
    }>;
    objects: {
        perp: {
            global_config: string;
            admin_cap: string;
            market_registry_wlp: string;
            markets: Record<string, {
                market: string;
                config: string;
            }>;
        };
        prediction: {
            global_config: string;
            admin_cap: string;
            market_registries: Record<string, string>;
            settlement_coin_types: Record<string, string>;
            claimable_link_config: string;
            gift_admin_cap: string;
        };
        oracle: {
            oracle: string;
            listing_cap: string;
            aggregators: Record<string, string>;
        };
        wlp: {
            pool: string;
            aum: string;
            currency_type: string;
            metadata_cap: string;
            pool_tokens: Record<string, string>;
        };
        staking: {
            admin_cap: string;
            pools: Record<string, string>;
            rewarders: Record<string, Record<string, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>;
        };
        account: {
            admin_cap: string;
            registry: string;
        };
        referral: {
            table: string;
        };
        credit: {
            registry: string;
            credit_type: string;
            registries: Record<string, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>;
        };
        custody: {
            vault: string;
            assets: {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }[];
            vaults: Record<string, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>;
        };
        bridge: {
            state: string;
            emitter_cap: string;
            wormhole_state: string;
            limits: {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            };
        };
        withdrawal_queue: {
            queue: string;
            executors: string[];
            queues: Record<string, {
                queue: string;
                executors: string[];
            }>;
        };
        usd: {
            metadata_cap: string;
        };
        faucet?: {
            faucet: string;
            whitelist: string[];
        } | undefined;
        mock_usdsui?: {
            currency_type: string;
            metadata_cap: string;
            treasury_cap: string;
        } | undefined;
    };
    oracle_rules: {
        waterx: {
            package: string;
            rule_config_object: string;
            enclave: {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            };
        };
        pyth: {
            package: string;
            pyth_config_object: string;
            pyth_price_feeds: Record<string, {
                feed_id: string;
                price_info_object: string;
            }>;
        };
        constant: {
            package: string;
            rule_config_object: string;
            constant_prices: Record<string, {
                price: string;
            }>;
        };
        pyth_lazer?: {
            package: string;
            lazer_state_object: string;
            lazer_config_object: string;
            lazer_feed_ids: Record<string, number>;
        } | undefined;
        supra?: {
            package: string;
            rule_config_object: string;
            pair_ids: Record<string, number>;
        } | undefined;
    };
    evm: {
        bridge: {
            chains: Record<string, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>;
        };
    };
}, {
    schema_version: 2;
    network: "mainnet" | "testnet";
    chain_id: string;
    symbols: Record<string, {
        kind: "perp" | "spot" | "xstock" | "commodity" | "fx" | "prediction";
    }>;
    packages: Record<string, {
        published_at: string;
        original_id: string;
        version: number;
        upgrade_capability?: string | undefined;
        mvr?: {
            name: string;
            package_info_id: string;
            app_cap_id: string;
            git?: {
                path: string;
                version: number;
                repo: string;
            } | undefined;
        } | undefined;
    }>;
    objects: {
        perp: {
            global_config: string;
            admin_cap: string;
            market_registry_wlp: string;
            markets: Record<string, {
                market: string;
                config: string;
            }>;
        };
        prediction: {
            global_config: string;
            admin_cap: string;
            market_registries: Record<string, string>;
            settlement_coin_types: Record<string, string>;
            claimable_link_config: string;
            gift_admin_cap: string;
        };
        oracle: {
            oracle: string;
            listing_cap: string;
            aggregators: Record<string, string>;
        };
        wlp: {
            pool: string;
            aum: string;
            currency_type: string;
            metadata_cap: string;
            pool_tokens: Record<string, string>;
        };
        staking: {
            admin_cap: string;
            pools: Record<string, string>;
            rewarders: Record<string, Record<string, {
                rewarder_id: string;
                coin_type: string;
                decimals: number;
            }>>;
        };
        account: {
            admin_cap: string;
            registry: string;
        };
        referral: {
            table: string;
        };
        credit: {
            registry: string;
            credit_type: string;
            registries: Record<string, {
                metadata_cap: string;
                decimals: number;
                registry: string;
                credit_type: string;
            }>;
        };
        custody: {
            vault: string;
            assets: {
                type: string;
                name: string;
                decimal: number;
                mint_fee_scaled: string;
                burn_fee_scaled: string;
                min_burn_amount: string;
            }[];
            vaults: Record<string, {
                vault: string;
                assets: {
                    type: string;
                    name: string;
                    decimal: number;
                    mint_fee_scaled: string;
                    burn_fee_scaled: string;
                    min_burn_amount: string;
                }[];
            }>;
        };
        bridge: {
            state: string;
            emitter_cap: string;
            wormhole_state: string;
            limits: {
                max_mint_per_tx: string;
                max_burn_per_tx: string;
                daily_mint: string;
                daily_burn: string;
                personal_burn: {
                    cap_amount: string;
                    window_ms: string;
                };
            };
        };
        withdrawal_queue: {
            queue: string;
            executors: string[];
            queues: Record<string, {
                queue: string;
                executors: string[];
            }>;
        };
        usd: {
            metadata_cap: string;
        };
        faucet?: {
            faucet: string;
            whitelist: string[];
        } | undefined;
        mock_usdsui?: {
            currency_type: string;
            metadata_cap: string;
            treasury_cap: string;
        } | undefined;
    };
    oracle_rules: {
        waterx: {
            package: string;
            rule_config_object: string;
            enclave: {
                object: string;
                config: string;
                cap: string;
                pubkey: string;
            };
        };
        pyth: {
            package: string;
            pyth_config_object: string;
            pyth_price_feeds: Record<string, {
                feed_id: string;
                price_info_object: string;
            }>;
        };
        constant: {
            package: string;
            rule_config_object: string;
            constant_prices: Record<string, {
                price: string;
            }>;
        };
        pyth_lazer?: {
            package: string;
            lazer_state_object: string;
            lazer_config_object: string;
            lazer_feed_ids: Record<string, number>;
        } | undefined;
        supra?: {
            package: string;
            rule_config_object: string;
            pair_ids: Record<string, number>;
        } | undefined;
    };
    evm: {
        bridge: {
            chains: Record<string, {
                chain_id: number;
                wormhole_chain_id: number;
                wormhole_core: string;
                wormhole_executor: string;
                block_explorer: string;
                deposit_vault: string;
                tokens: Record<string, string>;
            }>;
        };
    };
}>;
export default _default;
