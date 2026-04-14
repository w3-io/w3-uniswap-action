# Uniswap V3 Integration

## What is Uniswap?

Uniswap V3 is a decentralized exchange protocol with concentrated liquidity. Liquidity providers can allocate capital within custom price ranges, earning swap fees proportional to their share of in-range liquidity. Swaps execute against these concentrated pools via the SwapRouter02 contract.

## Common inputs

| Input     | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `chain`   | Blockchain: `ethereum`, `base`, `arbitrum`, `polygon`, `optimism` |
| `rpc-url` | Custom RPC URL (recommended for reliability)                      |

---

## Swap commands

### `swap`

Execute a single-hop exact-input swap via SwapRouter02.

| Input                | Required | Description                            |
| -------------------- | -------- | -------------------------------------- |
| `chain`              | yes      | Target chain                           |
| `token-in`           | yes      | Input token address                    |
| `token-out`          | yes      | Output token address                   |
| `fee`                | yes      | Pool fee tier (100, 500, 3000, 10000)  |
| `amount-in`          | yes      | Amount of input token (smallest unit)  |
| `amount-out-minimum` | no       | Minimum output for slippage protection |
| `recipient`          | yes      | Address to receive output tokens       |

**Output:** `{ txHash, chain, tokenIn, tokenOut, fee, amountIn, amountOutMinimum, recipient }`

```yaml
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
    amount-out-minimum: '500000000000000000'
    recipient: '0xYourAddress'
```

### `multi-hop-swap`

Execute a multi-hop exact-input swap via SwapRouter02. Routes through multiple pools using packed path encoding.

| Input                | Required | Description                                       |
| -------------------- | -------- | ------------------------------------------------- |
| `chain`              | yes      | Target chain                                      |
| `path`               | yes      | JSON array of `{token, fee}` segments (see below) |
| `amount-in`          | yes      | Amount of input token (smallest unit)             |
| `amount-out-minimum` | no       | Minimum output for slippage protection            |
| `recipient`          | yes      | Address to receive output tokens                  |

The `path` is a JSON array where each element has a `token` address and a `fee` tier, except the last element which only has `token`. For example, to swap USDC -> WETH -> DAI:

```json
[
  { "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "fee": "500" },
  { "token": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "fee": "3000" },
  { "token": "0x6B175474E89094C44Da98b954EedeAC495271d0F" }
]
```

**Output:** `{ txHash, chain, path, amountIn, amountOutMinimum, recipient }`

```yaml
- uses: w3-io/w3-uniswap-action@v0
  env:
    W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
  bridge-allow: [ethereum/call-contract]
  with:
    command: multi-hop-swap
    chain: ethereum
    path: '[{"token":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","fee":"500"},{"token":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","fee":"3000"},{"token":"0x6B175474E89094C44Da98b954EedeAC495271d0F"}]'
    amount-in: '1000000000'
    amount-out-minimum: '900000000000000000'
    recipient: '0xYourAddress'
```

### `quote`

Simulate a single-hop swap via QuoterV2 without executing. Returns expected output amount without spending gas.

| Input       | Required | Description                           |
| ----------- | -------- | ------------------------------------- |
| `chain`     | yes      | Target chain                          |
| `token-in`  | yes      | Input token address                   |
| `token-out` | yes      | Output token address                  |
| `fee`       | yes      | Pool fee tier (100, 500, 3000, 10000) |
| `amount-in` | yes      | Amount of input token (smallest unit) |

**Output:** `{ amountOut, chain, tokenIn, tokenOut, fee, amountIn }`

```yaml
- uses: w3-io/w3-uniswap-action@v0
  id: quote
  with:
    command: quote
    chain: ethereum
    token-in: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    token-out: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    fee: '3000'
    amount-in: '1000000000'
```

---

## Position commands

### `get-position`

Read a liquidity position by NFT token ID.

| Input      | Required | Description     |
| ---------- | -------- | --------------- |
| `chain`    | yes      | Target chain    |
| `token-id` | yes      | NFT position ID |

**Output:** `{ tokenId, chain, nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, tokensOwed0, tokensOwed1 }`

```yaml
- uses: w3-io/w3-uniswap-action@v0
  id: pos
  with:
    command: get-position
    chain: ethereum
    token-id: '12345'
```

### `mint`

Create a new concentrated liquidity position.

| Input             | Required | Description                     |
| ----------------- | -------- | ------------------------------- |
| `chain`           | yes      | Target chain                    |
| `token-in`        | yes      | Token0 address                  |
| `token-out`       | yes      | Token1 address                  |
| `fee`             | yes      | Pool fee tier                   |
| `tick-lower`      | yes      | Lower price tick                |
| `tick-upper`      | yes      | Upper price tick                |
| `amount0-desired` | yes      | Desired token0 amount           |
| `amount1-desired` | yes      | Desired token1 amount           |
| `amount0-min`     | no       | Minimum token0 (slippage)       |
| `amount1-min`     | no       | Minimum token1 (slippage)       |
| `recipient`       | yes      | Address to own the position NFT |

**Output:** `{ txHash, chain, token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, recipient }`

```yaml
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

### `increase-liquidity`

Add liquidity to an existing position.

| Input             | Required | Description               |
| ----------------- | -------- | ------------------------- |
| `chain`           | yes      | Target chain              |
| `token-id`        | yes      | NFT position ID           |
| `amount0-desired` | yes      | Desired token0 to add     |
| `amount1-desired` | yes      | Desired token1 to add     |
| `amount0-min`     | no       | Minimum token0 (slippage) |
| `amount1-min`     | no       | Minimum token1 (slippage) |

**Output:** `{ txHash, chain, tokenId, amount0Desired, amount1Desired }`

### `decrease-liquidity`

Remove liquidity from an existing position.

| Input         | Required | Description                |
| ------------- | -------- | -------------------------- |
| `chain`       | yes      | Target chain               |
| `token-id`    | yes      | NFT position ID            |
| `liquidity`   | yes      | Liquidity amount to remove |
| `amount0-min` | no       | Minimum token0 (slippage)  |
| `amount1-min` | no       | Minimum token1 (slippage)  |

**Output:** `{ txHash, chain, tokenId, liquidity }`

### `collect`

Collect accrued fees and tokens from a position. Collects all available amounts.

| Input       | Required | Description             |
| ----------- | -------- | ----------------------- |
| `chain`     | yes      | Target chain            |
| `token-id`  | yes      | NFT position ID         |
| `recipient` | yes      | Address to receive fees |

**Output:** `{ txHash, chain, tokenId, recipient }`

---

## Authentication

No API key required. Write operations need the bridge signing secret:

```yaml
env:
  W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
bridge-allow: [ethereum/call-contract]
```

## Error codes

| Code                | Meaning                     |
| ------------------- | --------------------------- |
| `MISSING_CHAIN`     | No chain provided           |
| `UNSUPPORTED_CHAIN` | Chain not in supported list |
| `MISSING_TOKEN_IN`  | token-in input missing      |
| `MISSING_TOKEN_OUT` | token-out input missing     |
| `MISSING_FEE`       | fee input missing           |
| `MISSING_AMOUNT_IN` | amount-in input missing     |
| `MISSING_AMOUNT`    | amountIn input missing      |
| `MISSING_PATH`      | path input missing          |
| `MISSING_RECIPIENT` | recipient input missing     |
| `MISSING_TOKEN_ID`  | token-id input missing      |
| `MISSING_LIQUIDITY` | liquidity input missing     |
| `BRIDGE_ERROR`      | Bridge call failed          |
