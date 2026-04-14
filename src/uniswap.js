/**
 * Uniswap V3 on-chain client.
 *
 * Swaps go through SwapRouter02 (exactInputSingle). Liquidity
 * positions are managed via NonfungiblePositionManager (mint,
 * increase, decrease, collect, positions).
 *
 * All on-chain operations go through the W3 bridge:
 *   - Reads: bridge.chain('ethereum', 'read-contract', ...)
 *   - Writes: bridge.chain('ethereum', 'call-contract', ...)
 */

import { W3ActionError, bridge } from '@w3-io/action-core'
import {
  CHAINS,
  SWAP_ROUTER,
  POSITION_MANAGER,
  SWAP_ROUTER_ABI,
  POSITION_MANAGER_ABI,
} from './registry.js'

export class UniswapError extends W3ActionError {
  constructor(code, message, { details } = {}) {
    super(code, message, { details })
    this.name = 'UniswapError'
  }
}

// ── Chain resolution ──────────────────────────────────────────────

function resolveChain(chain, rpcUrl) {
  if (!chain) throw new UniswapError('MISSING_CHAIN', 'chain is required')
  const config = CHAINS[chain.toLowerCase()]
  if (!config) {
    throw new UniswapError(
      'UNSUPPORTED_CHAIN',
      `Chain "${chain}" not supported. Available: ${Object.keys(CHAINS).join(', ')}`,
    )
  }
  return {
    network: config.bridgeNetwork,
    params: rpcUrl ? { rpcUrl } : {},
  }
}

function getSwapRouter(chain) {
  const addr = SWAP_ROUTER[chain.toLowerCase()]
  if (!addr) throw new UniswapError('UNSUPPORTED_CHAIN', `No SwapRouter02 for ${chain}`)
  return addr
}

function getPositionManager(chain) {
  const addr = POSITION_MANAGER[chain.toLowerCase()]
  if (!addr) throw new UniswapError('UNSUPPORTED_CHAIN', `No PositionManager for ${chain}`)
  return addr
}

// ── Bridge helpers ────────────────────────────────────────────────

function unwrapBridgeResult(result) {
  if (result && typeof result === 'object' && 'ok' in result) {
    if (!result.ok) {
      throw new UniswapError(result.code || 'BRIDGE_ERROR', result.error || 'Bridge call failed')
    }
    if (result.result !== undefined) return result.result
    return result
  }
  return result
}

function extractTxHash(receipt) {
  let rx = receipt
  if (typeof rx === 'string') {
    try {
      rx = JSON.parse(rx)
    } catch {
      return rx
    }
  }
  const hash = rx?.txHash || rx?.tx_hash || rx?.transactionId
  if (hash && typeof hash === 'object') return String(hash)
  return hash || String(receipt)
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

function extractTokenId(receipt) {
  let logs = receipt?.logs
  if (!logs) return null
  if (typeof logs === 'string') {
    try {
      logs = JSON.parse(logs)
    } catch {
      return null
    }
  }
  if (!Array.isArray(logs)) return null
  for (const log of logs) {
    const topics = log?.topics
    if (!Array.isArray(topics) || topics.length < 4) continue
    if (topics[0] === TRANSFER_TOPIC) {
      return BigInt(topics[3]).toString()
    }
  }
  return null
}

// ── Deadline helper ───────────────────────────────────────────────

function defaultDeadline() {
  // 20 minutes from now
  return String(Math.floor(Date.now() / 1000) + 1200)
}

// ── Swap ──────────────────────────────────────────────────────────

/**
 * Execute a single-hop exact-input swap via SwapRouter02.
 */
export async function swap(
  chain,
  { tokenIn, tokenOut, fee, amountIn, amountOutMinimum, recipient, rpcUrl },
) {
  if (!tokenIn) throw new UniswapError('MISSING_TOKEN_IN', 'token-in is required')
  if (!tokenOut) throw new UniswapError('MISSING_TOKEN_OUT', 'token-out is required')
  if (!fee) throw new UniswapError('MISSING_FEE', 'fee is required')
  if (!amountIn) throw new UniswapError('MISSING_AMOUNT_IN', 'amount-in is required')
  if (!recipient) throw new UniswapError('MISSING_RECIPIENT', 'recipient is required')

  const net = resolveChain(chain, rpcUrl)
  const router = getSwapRouter(chain)

  const receipt = await bridge.chain(
    'ethereum',
    'call-contract',
    {
      contract: router,
      method: 'exactInputSingle',
      abi: SWAP_ROUTER_ABI,
      args: [
        `(${tokenIn}, ${tokenOut}, ${fee}, ${recipient}, ${amountIn}, ${amountOutMinimum || '0'}, 0)`,
      ],
      ...net.params,
    },
    net.network,
  )

  return {
    txHash: extractTxHash(receipt),
    chain,
    tokenIn,
    tokenOut,
    fee,
    amountIn,
    amountOutMinimum: amountOutMinimum || '0',
    recipient,
  }
}

// ── Position read ─────────────────────────────────────────────────

/**
 * Read a liquidity position by token ID.
 */
export async function getPosition(chain, { tokenId, rpcUrl }) {
  if (!tokenId) throw new UniswapError('MISSING_TOKEN_ID', 'token-id is required')

  const net = resolveChain(chain, rpcUrl)
  const manager = getPositionManager(chain)

  const raw = unwrapBridgeResult(
    await bridge.chain(
      'ethereum',
      'read-contract',
      {
        contract: manager,
        method: 'positions',
        abi: POSITION_MANAGER_ABI,
        args: [tokenId],
        ...net.params,
      },
      net.network,
    ),
  )

  let data = raw
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      /* use as-is */
    }
  }

  return {
    tokenId,
    chain,
    nonce: String(Array.isArray(data) ? data[0] : data?.nonce || '0'),
    operator: String(Array.isArray(data) ? data[1] : data?.operator || ''),
    token0: String(Array.isArray(data) ? data[2] : data?.token0 || ''),
    token1: String(Array.isArray(data) ? data[3] : data?.token1 || ''),
    fee: String(Array.isArray(data) ? data[4] : data?.fee || '0'),
    tickLower: String(Array.isArray(data) ? data[5] : data?.tickLower || '0'),
    tickUpper: String(Array.isArray(data) ? data[6] : data?.tickUpper || '0'),
    liquidity: String(Array.isArray(data) ? data[7] : data?.liquidity || '0'),
    feeGrowthInside0LastX128: String(
      Array.isArray(data) ? data[8] : data?.feeGrowthInside0LastX128 || '0',
    ),
    feeGrowthInside1LastX128: String(
      Array.isArray(data) ? data[9] : data?.feeGrowthInside1LastX128 || '0',
    ),
    tokensOwed0: String(Array.isArray(data) ? data[10] : data?.tokensOwed0 || '0'),
    tokensOwed1: String(Array.isArray(data) ? data[11] : data?.tokensOwed1 || '0'),
  }
}

// ── Mint ──────────────────────────────────────────────────────────

/**
 * Mint a new concentrated liquidity position.
 */
export async function mint(
  chain,
  {
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min,
    amount1Min,
    recipient,
    rpcUrl,
  },
) {
  if (!token0) throw new UniswapError('MISSING_TOKEN0', 'token0 is required')
  if (!token1) throw new UniswapError('MISSING_TOKEN1', 'token1 is required')
  if (!fee) throw new UniswapError('MISSING_FEE', 'fee is required')
  if (!recipient) throw new UniswapError('MISSING_RECIPIENT', 'recipient is required')

  const net = resolveChain(chain, rpcUrl)
  const manager = getPositionManager(chain)
  const deadline = defaultDeadline()

  const receipt = await bridge.chain(
    'ethereum',
    'call-contract',
    {
      contract: manager,
      method: 'mint',
      abi: POSITION_MANAGER_ABI,
      args: [
        `(${token0}, ${token1}, ${fee}, ${tickLower || '0'}, ${tickUpper || '0'}, ${amount0Desired || '0'}, ${amount1Desired || '0'}, ${amount0Min || '0'}, ${amount1Min || '0'}, ${recipient}, ${deadline})`,
      ],
      ...net.params,
    },
    net.network,
  )

  return {
    txHash: extractTxHash(receipt),
    tokenId: extractTokenId(receipt),
    chain,
    token0,
    token1,
    fee,
    tickLower: tickLower || '0',
    tickUpper: tickUpper || '0',
    amount0Desired: amount0Desired || '0',
    amount1Desired: amount1Desired || '0',
    recipient,
  }
}

// ── Increase liquidity ────────────────────────────────────────────

/**
 * Add liquidity to an existing position.
 */
export async function increaseLiquidity(
  chain,
  { tokenId, amount0Desired, amount1Desired, amount0Min, amount1Min, rpcUrl },
) {
  if (!tokenId) throw new UniswapError('MISSING_TOKEN_ID', 'token-id is required')

  const net = resolveChain(chain, rpcUrl)
  const manager = getPositionManager(chain)
  const deadline = defaultDeadline()

  const receipt = await bridge.chain(
    'ethereum',
    'call-contract',
    {
      contract: manager,
      method: 'increaseLiquidity',
      abi: POSITION_MANAGER_ABI,
      args: [
        `(${tokenId}, ${amount0Desired || '0'}, ${amount1Desired || '0'}, ${amount0Min || '0'}, ${amount1Min || '0'}, ${deadline})`,
      ],
      ...net.params,
    },
    net.network,
  )

  return {
    txHash: extractTxHash(receipt),
    chain,
    tokenId,
    amount0Desired: amount0Desired || '0',
    amount1Desired: amount1Desired || '0',
  }
}

// ── Decrease liquidity ────────────────────────────────────────────

/**
 * Remove liquidity from an existing position.
 */
export async function decreaseLiquidity(
  chain,
  { tokenId, liquidity, amount0Min, amount1Min, rpcUrl },
) {
  if (!tokenId) throw new UniswapError('MISSING_TOKEN_ID', 'token-id is required')
  if (!liquidity) throw new UniswapError('MISSING_LIQUIDITY', 'liquidity is required')

  const net = resolveChain(chain, rpcUrl)
  const manager = getPositionManager(chain)
  const deadline = defaultDeadline()

  const receipt = await bridge.chain(
    'ethereum',
    'call-contract',
    {
      contract: manager,
      method: 'decreaseLiquidity',
      abi: POSITION_MANAGER_ABI,
      args: [`(${tokenId}, ${liquidity}, ${amount0Min || '0'}, ${amount1Min || '0'}, ${deadline})`],
      ...net.params,
    },
    net.network,
  )

  return {
    txHash: extractTxHash(receipt),
    chain,
    tokenId,
    liquidity,
  }
}

// ── Collect ───────────────────────────────────────────────────────

// Max uint128 — collect all owed tokens
const MAX_UINT128 = '340282366920938463463374607431768211455'

/**
 * Collect accrued fees and tokens from a position.
 */
export async function collect(chain, { tokenId, recipient, rpcUrl }) {
  if (!tokenId) throw new UniswapError('MISSING_TOKEN_ID', 'token-id is required')
  if (!recipient) throw new UniswapError('MISSING_RECIPIENT', 'recipient is required')

  const net = resolveChain(chain, rpcUrl)
  const manager = getPositionManager(chain)

  const receipt = await bridge.chain(
    'ethereum',
    'call-contract',
    {
      contract: manager,
      method: 'collect',
      abi: POSITION_MANAGER_ABI,
      args: [`(${tokenId}, ${recipient}, ${MAX_UINT128}, ${MAX_UINT128})`],
      ...net.params,
    },
    net.network,
  )

  return {
    txHash: extractTxHash(receipt),
    chain,
    tokenId,
    recipient,
  }
}
