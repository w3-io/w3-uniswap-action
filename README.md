# W3 Uniswap Action

Uniswap V3 swaps and concentrated liquidity for W3 workflows. 6 commands for token swaps and position management on Ethereum, Base, Arbitrum, Polygon, and Optimism.

## Quick start

```yaml
# Swap USDC for WETH on Ethereum
- uses: w3-io/w3-uniswap-action@v0
  env:
    W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
  bridge-allow: [ethereum/call-contract]
  with:
    command: swap
    chain: ethereum
    token-in: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    token-out: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    fee: '3000'
    amount-in: '1000000000'
    amount-out-minimum: '0'
    recipient: '0xYourAddress'

# Read a liquidity position
- uses: w3-io/w3-uniswap-action@v0
  id: pos
  with:
    command: get-position
    chain: ethereum
    token-id: '12345'

# Mint a new concentrated liquidity position
- uses: w3-io/w3-uniswap-action@v0
  env:
    W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
  bridge-allow: [ethereum/call-contract]
  with:
    command: mint
    chain: ethereum
    token-in: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    token-out: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    fee: '3000'
    tick-lower: '-887220'
    tick-upper: '887220'
    amount0-desired: '1000000000'
    amount1-desired: '500000000000000000'
    recipient: '0xYourAddress'
```

## Commands

| Command              | Description                                     | Bridge        |
| -------------------- | ----------------------------------------------- | ------------- |
| `swap`               | Single-hop exact-input swap via SwapRouter02     | call-contract |
| `get-position`       | Read a liquidity position by NFT token ID        | read-contract |
| `mint`               | Create a new concentrated liquidity position     | call-contract |
| `increase-liquidity` | Add liquidity to an existing position            | call-contract |
| `decrease-liquidity` | Remove liquidity from an existing position       | call-contract |
| `collect`            | Collect accrued fees from a position             | call-contract |

## Inputs

| Input                | Required | Default | Description                                      |
| -------------------- | -------- | ------- | ------------------------------------------------ |
| `command`            | yes      |         | Operation to perform                              |
| `chain`              | yes      |         | Target chain                                      |
| `rpc-url`            | no       |         | Custom RPC URL                                    |
| `token-in`           | no       |         | Input token address (swap) / token0 (mint)        |
| `token-out`          | no       |         | Output token address (swap) / token1 (mint)       |
| `fee`                | no       |         | Pool fee tier: 100, 500, 3000, 10000              |
| `amount-in`          | no       |         | Input amount for swap                             |
| `amount-out-minimum` | no       | `0`     | Minimum output (slippage protection)              |
| `recipient`          | no       |         | Recipient address                                 |
| `token-id`           | no       |         | NFT position token ID                             |
| `tick-lower`         | no       |         | Lower tick bound                                  |
| `tick-upper`         | no       |         | Upper tick bound                                  |
| `amount0-desired`    | no       |         | Desired token0 amount                             |
| `amount1-desired`    | no       |         | Desired token1 amount                             |
| `amount0-min`        | no       | `0`     | Minimum token0 (slippage)                         |
| `amount1-min`        | no       | `0`     | Minimum token1 (slippage)                         |
| `liquidity`          | no       |         | Liquidity to remove                               |

## Outputs

| Name     | Description            |
| -------- | ---------------------- |
| `result` | JSON result object     |

## Supported chains

Ethereum, Base, Arbitrum, Polygon, Optimism.

## Fee tiers

| Name     | Value   | Typical use          |
| -------- | ------- | -------------------- |
| lowest   | 100     | Stablecoin pairs     |
| low      | 500     | Stable-like pairs    |
| medium   | 3000    | Most pairs           |
| high     | 10000   | Exotic pairs         |

## Authentication

No API key needed. Write operations require the bridge secret for the target chain:

```yaml
env:
  W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
bridge-allow: [ethereum/call-contract]
```
