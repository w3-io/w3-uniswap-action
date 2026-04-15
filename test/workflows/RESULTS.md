# E2E Test Results

> Last verified: 2026-04-15

## Prerequisites

| Credential | Env var | Source |
|-----------|---------|--------|
| Ethereum private key | `W3_SECRET_ETHEREUM` | Bridge signer |
| Alchemy Base RPC URL | `ALCHEMY_BASE_RPC` | Alchemy dashboard |

### On-chain requirements

Funded EVM wallet on Base with ETH + tokens.

## Results

| # | Step | Command | Status | Notes |
|---|------|---------|--------|-------|
| 1 | Quote WETH to USDC | `quote` | PASS | |
| 2 | Print quote results | (run step) | PASS | |
| 3 | Swap WETH to USDC | `swap` | PASS | |
| 4 | Approve USDC for SwapRouter02 | (run step) | SKIP | Reverse swap needs WETH pre-approval (known issue) |
| 5 | Reverse swap USDC to WETH | `swap` | SKIP | Depends on approval step above |
| 6 | Multi-hop WETH to USDbC | `multi-hop-swap` | PASS | |
| 7 | Reverse multi-hop USDbC to WETH | `multi-hop-swap` | PASS | Recovery |
| 8 | Print swap results | (run step) | PASS | |
| 9 | Mint LP position | `mint` | PASS | |
| 10 | Get position | `get-position` | PASS | |
| 11 | Increase liquidity | `increase-liquidity` | PASS | |
| 12 | Get position after increase | `get-position` | PASS | |
| 13 | Decrease all liquidity | `decrease-liquidity` | PASS | Recovery |
| 14 | Collect all tokens | `collect` | PASS | Recovery |
| 15 | Print liquidity results | (run step) | PASS | |

**Summary: 13/13 active steps pass (2 skipped).**

## Skipped Commands

| Command | Reason |
|---------|--------|
| N/A | All commands tested |

## How to run

```bash
# Export credentials
export W3_SECRET_ETHEREUM="..."
export ALCHEMY_BASE_RPC="..."

# Start bridge (on-chain)
w3 bridge serve --port 8232 --signer-ethereum "$W3_SECRET_ETHEREUM" --allow "*" &
export W3_BRIDGE_URL="http://host.docker.internal:8232"

# Run
w3 workflow test --execute test/workflows/e2e.yaml
```
