# TODO

## Current state: all commands verified

Uniswap swap (V3) + LP surface works end-to-end against Base mainnet
with the shared E2E wallet. All write tests round-trip to recover
funds (only gas consumed).

## Potential additions

- [ ] Uniswap V4 hooks — V4's hook system is a major ecosystem
      shift. We currently target V3. When V4 pool liquidity grows
      enough to be the primary path, add V4 support. Today V3 is
      still the right default.
- [ ] Universal Router — Uniswap's newer aggregating router
      (supports V2 + V3 + V4 + Permit2). Cleaner for multi-hop
      swaps. Our current swap path uses SwapRouter02 which is V3-
      only.
- [ ] `quoteExactOutput` — we have `quoteExactInput`. The output-
      driven path is useful for "I want exactly X of token B" flows
      rather than "I want to spend X of token A."
- [ ] Position manager: `collectFees`, `decreaseLiquidity` without
      removing the whole position. Today `remove-liquidity` takes
      the position out entirely.

## Docs

- [ ] `docs/guide.md` has the swap example but not the "provide
      liquidity and earn fees over time" pattern. Walk through a
      mint → wait → collect cycle.

## Testing hygiene

- [ ] Current E2E mints a position at a fixed price range. If the
      pool's current tick moves outside that range between test
      runs, the position becomes inactive. Use a tick range relative
      to the current pool tick rather than absolute ticks.
