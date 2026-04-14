import * as core from '@actions/core'
import { createCommandRouter, setJsonOutput, handleError } from '@w3-io/action-core'
import {
  swap,
  multiHopSwap,
  quoteSwap,
  getPosition,
  mint,
  increaseLiquidity,
  decreaseLiquidity,
  collect,
  UniswapError,
} from './uniswap.js'

/**
 * W3 Uniswap Action — command dispatch.
 *
 * Swap: Single-hop exact-input swaps via SwapRouter02
 * Liquidity: Concentrated positions via NonfungiblePositionManager
 */

function rpcUrl() {
  return core.getInput('rpc-url') || undefined
}

function chain() {
  return core.getInput('chain', { required: true })
}

const handlers = {
  // ── Swap ────────────────────────────────────────────────────────

  swap: async () => {
    const result = await swap(chain(), {
      tokenIn: core.getInput('token-in', { required: true }),
      tokenOut: core.getInput('token-out', { required: true }),
      fee: core.getInput('fee', { required: true }),
      amountIn: core.getInput('amount-in', { required: true }),
      amountOutMinimum: core.getInput('amount-out-minimum') || '0',
      recipient: core.getInput('recipient', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'multi-hop-swap': async () => {
    const result = await multiHopSwap(chain(), {
      path: core.getInput('path', { required: true }),
      amountIn: core.getInput('amount-in', { required: true }),
      amountOutMinimum: core.getInput('amount-out-minimum') || '0',
      recipient: core.getInput('recipient', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  quote: async () => {
    const result = await quoteSwap(chain(), {
      tokenIn: core.getInput('token-in', { required: true }),
      tokenOut: core.getInput('token-out', { required: true }),
      fee: core.getInput('fee', { required: true }),
      amountIn: core.getInput('amount-in', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  // ── Position read ───────────────────────────────────────────────

  'get-position': async () => {
    const result = await getPosition(chain(), {
      tokenId: core.getInput('token-id', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  // ── Liquidity: Write ────────────────────────────────────────────

  mint: async () => {
    const result = await mint(chain(), {
      token0: core.getInput('token-in', { required: true }),
      token1: core.getInput('token-out', { required: true }),
      fee: core.getInput('fee', { required: true }),
      tickLower: core.getInput('tick-lower', { required: true }),
      tickUpper: core.getInput('tick-upper', { required: true }),
      amount0Desired: core.getInput('amount0-desired', { required: true }),
      amount1Desired: core.getInput('amount1-desired', { required: true }),
      amount0Min: core.getInput('amount0-min') || '0',
      amount1Min: core.getInput('amount1-min') || '0',
      recipient: core.getInput('recipient', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'increase-liquidity': async () => {
    const result = await increaseLiquidity(chain(), {
      tokenId: core.getInput('token-id', { required: true }),
      amount0Desired: core.getInput('amount0-desired', { required: true }),
      amount1Desired: core.getInput('amount1-desired', { required: true }),
      amount0Min: core.getInput('amount0-min') || '0',
      amount1Min: core.getInput('amount1-min') || '0',
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'decrease-liquidity': async () => {
    const result = await decreaseLiquidity(chain(), {
      tokenId: core.getInput('token-id', { required: true }),
      liquidity: core.getInput('liquidity', { required: true }),
      amount0Min: core.getInput('amount0-min') || '0',
      amount1Min: core.getInput('amount1-min') || '0',
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  collect: async () => {
    const result = await collect(chain(), {
      tokenId: core.getInput('token-id', { required: true }),
      recipient: core.getInput('recipient', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },
}

const router = createCommandRouter(handlers)

export async function run() {
  try {
    await router()
  } catch (error) {
    if (error instanceof UniswapError) {
      core.setFailed(`Uniswap error (${error.code}): ${error.message}`)
    } else {
      handleError(error)
    }
  }
}
