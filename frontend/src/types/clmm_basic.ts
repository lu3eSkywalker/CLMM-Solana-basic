/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/clmm_basic.json`.
 */
export type ClmmBasic = {
  "address": "8wTERW3SPDTkoPvvBgzcpKouA4YrVWbEmqVp9vDwxZTG",
  "metadata": {
    "name": "clmmBasic",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createPool",
      "discriminator": [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      "accounts": [
        {
          "name": "poolCreator",
          "docs": [
            "Address paying to create the pool. Can be anyone"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "poolState",
          "docs": [
            "Initialize an account to store the pool state"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  115,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint0"
              },
              {
                "kind": "account",
                "path": "tokenMint1"
              }
            ]
          }
        },
        {
          "name": "tokenMint0",
          "docs": [
            "Token_0 mint, the key must be smaller then token_1 mint."
          ]
        },
        {
          "name": "tokenMint1",
          "docs": [
            "Token_1 mint"
          ]
        },
        {
          "name": "tokenVault0",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "poolState"
              },
              {
                "kind": "account",
                "path": "tokenMint0"
              }
            ]
          }
        },
        {
          "name": "tokenVault1",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "poolState"
              },
              {
                "kind": "account",
                "path": "tokenMint1"
              }
            ]
          }
        },
        {
          "name": "tokenProgram0",
          "docs": [
            "Spl token program or token program 2022"
          ]
        },
        {
          "name": "tokenProgram1",
          "docs": [
            "Spl token program or token program 2022"
          ]
        },
        {
          "name": "systemProgram",
          "docs": [
            "To create a new program account"
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "docs": [
            "Sysvar for program account"
          ],
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sqrtPriceX64",
          "type": "u128"
        }
      ]
    },
    {
      "name": "decreaseLiquidity",
      "discriminator": [
        160,
        38,
        208,
        111,
        104,
        91,
        44,
        1
      ],
      "accounts": [
        {
          "name": "poolState",
          "writable": true
        },
        {
          "name": "tokenVault0",
          "docs": [
            "Token_0 vault"
          ],
          "writable": true
        },
        {
          "name": "tokenVault1",
          "docs": [
            "Token_1 vault"
          ],
          "writable": true
        },
        {
          "name": "tickArrayLower",
          "writable": true
        },
        {
          "name": "tickArrayUpper",
          "writable": true
        },
        {
          "name": "recipientTokenAccount0",
          "writable": true
        },
        {
          "name": "recipientTokenAccount1",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "liquidity",
          "type": "u128"
        },
        {
          "name": "amount0Min",
          "type": "u64"
        },
        {
          "name": "amount1Min",
          "type": "u64"
        },
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "increaseLiquidity",
      "discriminator": [
        46,
        156,
        243,
        118,
        13,
        205,
        251,
        178
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "poolState",
          "writable": true
        },
        {
          "name": "tickArrayLower",
          "writable": true
        },
        {
          "name": "tickArrayUpper",
          "writable": true
        },
        {
          "name": "tokenAccount0",
          "docs": [
            "Payer's token account for token_0"
          ],
          "writable": true
        },
        {
          "name": "tokenAccount1",
          "docs": [
            "Payer's token account for token_1"
          ],
          "writable": true
        },
        {
          "name": "tokenVault0",
          "docs": [
            "Address which holds pool tokens for token_0"
          ],
          "writable": true
        },
        {
          "name": "tokenVault1",
          "docs": [
            "Address which holds pool tokens for token_1"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "liquidity",
          "type": "u128"
        },
        {
          "name": "amount0Max",
          "type": "u64"
        },
        {
          "name": "amount1Max",
          "type": "u64"
        },
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "openPosition",
      "discriminator": [
        135,
        128,
        47,
        77,
        15,
        152,
        240,
        49
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "poolState",
          "writable": true
        },
        {
          "name": "tickArrayLower",
          "docs": [
            "CHECK"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  95,
                  97,
                  114,
                  114,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "poolState"
              },
              {
                "kind": "arg",
                "path": "tickArrayLowerStartIndex"
              }
            ]
          }
        },
        {
          "name": "tickArrayUpper",
          "docs": [
            "CHECK"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  95,
                  97,
                  114,
                  114,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "poolState"
              },
              {
                "kind": "arg",
                "path": "tickArrayUpperStartIndex"
              }
            ]
          }
        },
        {
          "name": "tokenAccount0",
          "writable": true
        },
        {
          "name": "tokenAccount1",
          "writable": true
        },
        {
          "name": "tokenVault0",
          "writable": true
        },
        {
          "name": "tokenVault1",
          "writable": true
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        },
        {
          "name": "tickArrayLowerStartIndex",
          "type": "i32"
        },
        {
          "name": "tickArrayUpperStartIndex",
          "type": "i32"
        },
        {
          "name": "liquidity",
          "type": "u128"
        },
        {
          "name": "amount0Max",
          "type": "u64"
        },
        {
          "name": "amount1Max",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "poolState",
          "writable": true
        },
        {
          "name": "inputTokenAccount",
          "writable": true
        },
        {
          "name": "outputTokenAccount",
          "writable": true
        },
        {
          "name": "inputVault",
          "writable": true
        },
        {
          "name": "outputVault",
          "writable": true
        },
        {
          "name": "tickArray",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "otherAmountThreshold",
          "type": "u64"
        },
        {
          "name": "sqrtPriceLimitX64",
          "type": "u128"
        },
        {
          "name": "isBaseInput",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "poolState",
      "discriminator": [
        247,
        237,
        227,
        245,
        215,
        195,
        222,
        70
      ]
    },
    {
      "name": "tickArrayState",
      "discriminator": [
        192,
        155,
        85,
        205,
        49,
        249,
        129,
        42
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "maxTokenOverflow",
      "msg": "Max Token Overflow"
    },
    {
      "code": 6001,
      "name": "liquiditySubValueError",
      "msg": "Liquidity Subtraction Error"
    },
    {
      "code": 6002,
      "name": "liquidityAddValueError",
      "msg": "Liquidity Addition Error"
    },
    {
      "code": 6003,
      "name": "zeroSupplyLiquidity",
      "msg": "Zero Supply Liquidity"
    },
    {
      "code": 6004,
      "name": "slippageCheck",
      "msg": "Slippage Check"
    },
    {
      "code": 6005,
      "name": "invalidLiquidity",
      "msg": "Invalid Liquidity"
    },
    {
      "code": 6006,
      "name": "zeroToken0Amount",
      "msg": "Invalid Token 0 Amount"
    },
    {
      "code": 6007,
      "name": "zeroToken1Amount",
      "msg": "Invalid Token 1 Amount"
    },
    {
      "code": 6008,
      "name": "invalidVault",
      "msg": "Invalid Vault Account"
    },
    {
      "code": 6009,
      "name": "invalidMessage",
      "msg": "Test Invalid Message"
    },
    {
      "code": 6010,
      "name": "invalidTickArray",
      "msg": "Invalid Tick Array"
    }
  ],
  "types": [
    {
      "name": "poolState",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c",
        "packed": true
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sqrtPriceX64",
            "type": "u128"
          },
          {
            "name": "liquidity",
            "type": "u128"
          },
          {
            "name": "tokenMint0",
            "type": "pubkey"
          },
          {
            "name": "tokenMint1",
            "type": "pubkey"
          },
          {
            "name": "tokenVault0",
            "type": "pubkey"
          },
          {
            "name": "tokenVault1",
            "type": "pubkey"
          },
          {
            "name": "openTime",
            "type": "u64"
          },
          {
            "name": "tickSpacing",
            "type": "u16"
          },
          {
            "name": "currentTick",
            "type": "i32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tickArrayState",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "pubkey"
          },
          {
            "name": "startTickIndex",
            "type": "i32"
          },
          {
            "name": "ticks",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "tickState"
                  }
                },
                60
              ]
            }
          },
          {
            "name": "initializedTickCount",
            "type": "u8"
          },
          {
            "name": "recentEpoch",
            "type": "u64"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                107
              ]
            }
          }
        ]
      }
    },
    {
      "name": "tickState",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c",
        "packed": true
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tick",
            "type": "i32"
          },
          {
            "name": "liquidityNet",
            "type": "i128"
          },
          {
            "name": "liquidityGross",
            "type": "u128"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u32",
                13
              ]
            }
          }
        ]
      }
    }
  ]
};
