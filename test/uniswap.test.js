/**
 * Uniswap client unit tests.
 *
 * Tests validation logic, error handling, and bridge interactions.
 * Bridge calls are mocked via the exported bridge object from action-core.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAINS,
  SWAP_ROUTER,
  POSITION_MANAGER,
  FEE_TIERS,
  SWAP_ROUTER_ABI,
  SWAP_ROUTER_MULTI_ABI,
  POSITION_MANAGER_ABI,
  QUOTER,
  QUOTER_ABI,
} from '../src/registry.js'
import {
  UniswapError,
  encodePath,
  swap,
  multiHopSwap,
  quoteSwap,
  getPosition,
  mint,
  increaseLiquidity,
  decreaseLiquidity,
  collect,
} from '../src/uniswap.js'
import { bridge } from '@w3-io/action-core'

// ── Bridge mock helpers ──────────────────────────────────────────

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const RECIPIENT = '0x1111111111111111111111111111111111111111'

let originalChain

function mockBridge(fn) {
  originalChain = bridge.chain
  bridge.chain = fn
}

function restoreBridge() {
  if (originalChain) bridge.chain = originalChain
}

// ── Registry tests ────────────────────────────────────────────────

describe('Registry: CHAINS', () => {
  it('has all five supported chains', () => {
    const expected = ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']
    for (const chain of expected) {
      assert.ok(CHAINS[chain], `Missing chain: ${chain}`)
      assert.ok(CHAINS[chain].chainId, `Missing chainId for ${chain}`)
      assert.ok(CHAINS[chain].bridgeNetwork, `Missing bridgeNetwork for ${chain}`)
    }
  })

  it('has correct chain IDs', () => {
    assert.equal(CHAINS.ethereum.chainId, 1)
    assert.equal(CHAINS.base.chainId, 8453)
    assert.equal(CHAINS.arbitrum.chainId, 42161)
    assert.equal(CHAINS.polygon.chainId, 137)
    assert.equal(CHAINS.optimism.chainId, 10)
  })
})

describe('Registry: SWAP_ROUTER', () => {
  it('has addresses for all chains', () => {
    for (const chain of Object.keys(CHAINS)) {
      assert.ok(SWAP_ROUTER[chain], `Missing SwapRouter for ${chain}`)
      assert.match(SWAP_ROUTER[chain], /^0x[0-9a-fA-F]{40}$/, `Invalid address for ${chain}`)
    }
  })

  it('base has a different address from ethereum', () => {
    assert.notEqual(SWAP_ROUTER.base, SWAP_ROUTER.ethereum)
  })

  it('ethereum, polygon, arbitrum, optimism share the same address', () => {
    assert.equal(SWAP_ROUTER.ethereum, SWAP_ROUTER.polygon)
    assert.equal(SWAP_ROUTER.ethereum, SWAP_ROUTER.arbitrum)
    assert.equal(SWAP_ROUTER.ethereum, SWAP_ROUTER.optimism)
  })
})

describe('Registry: POSITION_MANAGER', () => {
  it('has addresses for all chains', () => {
    for (const chain of Object.keys(CHAINS)) {
      assert.ok(POSITION_MANAGER[chain], `Missing PositionManager for ${chain}`)
      assert.match(POSITION_MANAGER[chain], /^0x[0-9a-fA-F]{40}$/, `Invalid address for ${chain}`)
    }
  })

  it('base has a different address from ethereum', () => {
    assert.notEqual(POSITION_MANAGER.base, POSITION_MANAGER.ethereum)
  })
})

describe('Registry: FEE_TIERS', () => {
  it('has all four tiers', () => {
    assert.equal(FEE_TIERS.lowest, 100)
    assert.equal(FEE_TIERS.low, 500)
    assert.equal(FEE_TIERS.medium, 3000)
    assert.equal(FEE_TIERS.high, 10000)
  })
})

describe('Registry: ABIs parse as valid JSON', () => {
  it('SWAP_ROUTER_ABI is valid JSON with exactInputSingle', () => {
    const abi = JSON.parse(SWAP_ROUTER_ABI)
    assert.ok(Array.isArray(abi))
    const fn = abi.find((f) => f.name === 'exactInputSingle')
    assert.ok(fn, 'Missing exactInputSingle')
    assert.equal(fn.inputs[0].type, 'tuple')
    assert.equal(fn.inputs[0].components.length, 7)
  })

  it('POSITION_MANAGER_ABI is valid JSON with all functions', () => {
    const abi = JSON.parse(POSITION_MANAGER_ABI)
    assert.ok(Array.isArray(abi))
    const names = abi.map((f) => f.name)
    assert.ok(names.includes('mint'))
    assert.ok(names.includes('increaseLiquidity'))
    assert.ok(names.includes('decreaseLiquidity'))
    assert.ok(names.includes('collect'))
    assert.ok(names.includes('positions'))
  })

  it('positions function has 12 outputs', () => {
    const abi = JSON.parse(POSITION_MANAGER_ABI)
    const pos = abi.find((f) => f.name === 'positions')
    assert.equal(pos.outputs.length, 12)
  })
})

// ── Error class tests ─────────────────────────────────────────────

describe('UniswapError', () => {
  it('extends Error with code and name', () => {
    const err = new UniswapError('TEST_CODE', 'test message')
    assert.ok(err instanceof Error)
    assert.equal(err.code, 'TEST_CODE')
    assert.equal(err.message, 'test message')
    assert.equal(err.name, 'UniswapError')
  })
})

// ── Input validation tests (import functions to test) ─────────────

describe('Validation: swap', () => {
  // We can't call swap() directly without the bridge, but we can
  // verify the error class works and registry is consistent.
  it('UniswapError carries structured code', () => {
    const err = new UniswapError('MISSING_TOKEN_IN', 'token-in is required')
    assert.equal(err.code, 'MISSING_TOKEN_IN')
  })
})

// ── Multi-hop swap tests ─────────────────────────────────────────

describe('Registry: SWAP_ROUTER_MULTI_ABI', () => {
  it('is valid JSON with exactInput', () => {
    const abi = JSON.parse(SWAP_ROUTER_MULTI_ABI)
    assert.ok(Array.isArray(abi))
    const fn = abi.find((f) => f.name === 'exactInput')
    assert.ok(fn, 'Missing exactInput')
    assert.equal(fn.inputs[0].type, 'tuple')
    assert.equal(fn.inputs[0].components.length, 4)
  })

  it('has path, recipient, amountIn, amountOutMinimum components', () => {
    const abi = JSON.parse(SWAP_ROUTER_MULTI_ABI)
    const fn = abi.find((f) => f.name === 'exactInput')
    const names = fn.inputs[0].components.map((c) => c.name)
    assert.deepEqual(names, ['path', 'recipient', 'amountIn', 'amountOutMinimum'])
  })
})

describe('encodePath', () => {
  it('encodes a two-hop path correctly', () => {
    const path = [
      { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', fee: '500' },
      { token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', fee: '3000' },
      { token: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    ]
    const encoded = encodePath(path)

    // token0 (20 bytes) + fee0 (3 bytes) + token1 (20 bytes) + fee1 (3 bytes) + token2 (20 bytes)
    // 0x prefix + 40 + 6 + 40 + 6 + 40 = 134 chars after 0x
    assert.ok(encoded.startsWith('0x'))
    assert.equal(encoded.length, 2 + 40 + 6 + 40 + 6 + 40)

    // Verify fee encoding: 500 = 0x0001f4, 3000 = 0x000bb8
    assert.ok(encoded.includes('0001f4'))
    assert.ok(encoded.includes('000bb8'))
  })

  it('encodes a single-hop path correctly', () => {
    const path = [
      { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', fee: '3000' },
      { token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    ]
    const encoded = encodePath(path)
    assert.equal(encoded.length, 2 + 40 + 6 + 40)
  })

  it('accepts a JSON string as input', () => {
    const pathStr = JSON.stringify([
      { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', fee: '500' },
      { token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    ])
    const encoded = encodePath(pathStr)
    assert.ok(encoded.startsWith('0x'))
    assert.equal(encoded.length, 2 + 40 + 6 + 40)
  })

  it('lowercases token addresses', () => {
    const path = [
      { token: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', fee: '500' },
      { token: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
    ]
    const encoded = encodePath(path)
    assert.ok(!encoded.includes('A'))
    assert.ok(!encoded.includes('B'))
    assert.ok(encoded.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))
    assert.ok(encoded.includes('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'))
  })
})

describe('Validation: multiHopSwap', () => {
  it('UniswapError carries MISSING_PATH code', () => {
    const err = new UniswapError('MISSING_PATH', 'path is required')
    assert.equal(err.code, 'MISSING_PATH')
  })

  it('UniswapError carries MISSING_AMOUNT code', () => {
    const err = new UniswapError('MISSING_AMOUNT', 'amountIn is required')
    assert.equal(err.code, 'MISSING_AMOUNT')
  })
})

// ── Quote tests ──────────────────────────────────────────────────

describe('Registry: QUOTER', () => {
  it('has addresses for all chains', () => {
    for (const chain of Object.keys(CHAINS)) {
      assert.ok(QUOTER[chain], `Missing QuoterV2 for ${chain}`)
      assert.match(QUOTER[chain], /^0x[0-9a-fA-F]{40}$/, `Invalid address for ${chain}`)
    }
  })

  it('base has a different address from ethereum', () => {
    assert.notEqual(QUOTER.base, QUOTER.ethereum)
  })

  it('ethereum, polygon, arbitrum, optimism share the same address', () => {
    assert.equal(QUOTER.ethereum, QUOTER.polygon)
    assert.equal(QUOTER.ethereum, QUOTER.arbitrum)
    assert.equal(QUOTER.ethereum, QUOTER.optimism)
  })
})

describe('Registry: QUOTER_ABI', () => {
  it('is valid JSON with quoteExactInputSingle', () => {
    const abi = JSON.parse(QUOTER_ABI)
    assert.ok(Array.isArray(abi))
    const fn = abi.find((f) => f.name === 'quoteExactInputSingle')
    assert.ok(fn, 'Missing quoteExactInputSingle')
    assert.equal(fn.stateMutability, 'view')
    assert.equal(fn.inputs[0].type, 'tuple')
    assert.equal(fn.inputs[0].components.length, 5)
  })

  it('has four outputs', () => {
    const abi = JSON.parse(QUOTER_ABI)
    const fn = abi.find((f) => f.name === 'quoteExactInputSingle')
    assert.equal(fn.outputs.length, 4)
    const names = fn.outputs.map((o) => o.name)
    assert.deepEqual(names, [
      'amountOut',
      'sqrtPriceX96After',
      'initializedTicksCrossed',
      'gasEstimate',
    ])
  })
})

describe('Validation: quoteSwap', () => {
  it('UniswapError carries MISSING_TOKEN_IN code', () => {
    const err = new UniswapError('MISSING_TOKEN_IN', 'tokenIn is required')
    assert.equal(err.code, 'MISSING_TOKEN_IN')
  })

  it('UniswapError carries MISSING_FEE code', () => {
    const err = new UniswapError('MISSING_FEE', 'fee is required')
    assert.equal(err.code, 'MISSING_FEE')
  })
})

// ══════════════════════════════════════════════════════════════════
// Input validation — verify bad inputs are rejected before bridge
// ══════════════════════════════════════════════════════════════════

describe('swap: input validation', () => {
  it('rejects missing chain', async () => {
    await assert.rejects(
      () =>
        swap(null, {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: '3000',
          amountIn: '1000',
          recipient: RECIPIENT,
        }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_CHAIN',
    )
  })

  it('rejects unsupported chain', async () => {
    await assert.rejects(
      () =>
        swap('solana', {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: '3000',
          amountIn: '1000',
          recipient: RECIPIENT,
        }),
      (err) => err instanceof UniswapError && err.code === 'UNSUPPORTED_CHAIN',
    )
  })

  it('rejects missing tokenIn', async () => {
    await assert.rejects(
      () =>
        swap('ethereum', { tokenOut: WETH, fee: '3000', amountIn: '1000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_IN',
    )
  })

  it('rejects missing tokenOut', async () => {
    await assert.rejects(
      () =>
        swap('ethereum', { tokenIn: USDC, fee: '3000', amountIn: '1000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_OUT',
    )
  })

  it('rejects missing fee', async () => {
    await assert.rejects(
      () =>
        swap('ethereum', { tokenIn: USDC, tokenOut: WETH, amountIn: '1000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_FEE',
    )
  })

  it('rejects missing amountIn', async () => {
    await assert.rejects(
      () => swap('ethereum', { tokenIn: USDC, tokenOut: WETH, fee: '3000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_AMOUNT_IN',
    )
  })

  it('rejects missing recipient', async () => {
    await assert.rejects(
      () => swap('ethereum', { tokenIn: USDC, tokenOut: WETH, fee: '3000', amountIn: '1000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_RECIPIENT',
    )
  })
})

describe('mint: input validation', () => {
  it('rejects missing token0', async () => {
    await assert.rejects(
      () => mint('ethereum', { token1: WETH, fee: '3000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN0',
    )
  })

  it('rejects missing token1', async () => {
    await assert.rejects(
      () => mint('ethereum', { token0: USDC, fee: '3000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN1',
    )
  })

  it('rejects missing fee', async () => {
    await assert.rejects(
      () => mint('ethereum', { token0: USDC, token1: WETH, recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_FEE',
    )
  })

  it('rejects missing recipient', async () => {
    await assert.rejects(
      () => mint('ethereum', { token0: USDC, token1: WETH, fee: '3000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_RECIPIENT',
    )
  })
})

describe('decreaseLiquidity: input validation', () => {
  it('rejects missing tokenId', async () => {
    await assert.rejects(
      () => decreaseLiquidity('ethereum', { liquidity: '1000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_ID',
    )
  })

  it('rejects missing liquidity', async () => {
    await assert.rejects(
      () => decreaseLiquidity('ethereum', { tokenId: '123' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_LIQUIDITY',
    )
  })
})

describe('multiHopSwap: input validation', () => {
  it('rejects missing path', async () => {
    await assert.rejects(
      () => multiHopSwap('ethereum', { amountIn: '1000', recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_PATH',
    )
  })

  it('rejects missing amountIn', async () => {
    await assert.rejects(
      () =>
        multiHopSwap('ethereum', {
          path: [{ token: USDC, fee: '500' }, { token: WETH }],
          recipient: RECIPIENT,
        }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_AMOUNT',
    )
  })

  it('rejects missing recipient', async () => {
    await assert.rejects(
      () =>
        multiHopSwap('ethereum', {
          path: [{ token: USDC, fee: '500' }, { token: WETH }],
          amountIn: '1000',
        }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_RECIPIENT',
    )
  })
})

describe('quoteSwap: input validation', () => {
  it('rejects missing tokenIn', async () => {
    await assert.rejects(
      () => quoteSwap('ethereum', { tokenOut: WETH, fee: '3000', amountIn: '1000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_IN',
    )
  })

  it('rejects missing tokenOut', async () => {
    await assert.rejects(
      () => quoteSwap('ethereum', { tokenIn: USDC, fee: '3000', amountIn: '1000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_OUT',
    )
  })

  it('rejects missing fee', async () => {
    await assert.rejects(
      () => quoteSwap('ethereum', { tokenIn: USDC, tokenOut: WETH, amountIn: '1000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_FEE',
    )
  })

  it('rejects missing amountIn', async () => {
    await assert.rejects(
      () => quoteSwap('ethereum', { tokenIn: USDC, tokenOut: WETH, fee: '3000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_AMOUNT',
    )
  })
})

describe('collect: input validation', () => {
  it('rejects missing tokenId', async () => {
    await assert.rejects(
      () => collect('ethereum', { recipient: RECIPIENT }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_ID',
    )
  })

  it('rejects missing recipient', async () => {
    await assert.rejects(
      () => collect('ethereum', { tokenId: '123' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_RECIPIENT',
    )
  })
})

describe('increaseLiquidity: input validation', () => {
  it('rejects missing tokenId', async () => {
    await assert.rejects(
      () => increaseLiquidity('ethereum', { amount0Desired: '1000' }),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_ID',
    )
  })
})

describe('getPosition: input validation', () => {
  it('rejects missing tokenId', async () => {
    await assert.rejects(
      () => getPosition('ethereum', {}),
      (err) => err instanceof UniswapError && err.code === 'MISSING_TOKEN_ID',
    )
  })
})

// ══════════════════════════════════════════════════════════════════
// Quote happy path — mock bridge read, verify returned structure
// ══════════════════════════════════════════════════════════════════

describe('quoteSwap: happy path (mocked bridge)', () => {
  afterEach(() => restoreBridge())

  it('returns expected quote structure', async () => {
    mockBridge(async (network, method, params, bridgeNetwork) => {
      assert.equal(network, 'ethereum')
      assert.equal(method, 'read-contract')
      assert.equal(params.method, 'quoteExactInputSingle')
      assert.equal(params.contract, QUOTER.ethereum)
      assert.equal(bridgeNetwork, 'ethereum')
      return { ok: true, result: '1500000000000000000' }
    })

    const result = await quoteSwap('ethereum', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '3000',
      amountIn: '1000000000',
    })

    assert.equal(result.amountOut, '1500000000000000000')
    assert.equal(result.chain, 'ethereum')
    assert.equal(result.tokenIn, USDC)
    assert.equal(result.tokenOut, WETH)
    assert.equal(result.fee, '3000')
    assert.equal(result.amountIn, '1000000000')
  })

  it('passes rpcUrl through to bridge params', async () => {
    mockBridge(async (_net, _method, params) => {
      assert.equal(params.rpcUrl, 'https://my-rpc.example.com')
      return { ok: true, result: '100' }
    })

    await quoteSwap('ethereum', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '3000',
      amountIn: '1000',
      rpcUrl: 'https://my-rpc.example.com',
    })
  })

  it('uses base quoter address for base chain', async () => {
    mockBridge(async (_net, _method, params) => {
      assert.equal(params.contract, QUOTER.base)
      return { ok: true, result: '200' }
    })

    await quoteSwap('base', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '500',
      amountIn: '1000',
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// Swap parameter construction — verify bridge call arguments
// ══════════════════════════════════════════════════════════════════

describe('swap: bridge call construction (mocked)', () => {
  afterEach(() => restoreBridge())

  it('sends correct exactInputSingle args to bridge', async () => {
    let captured
    mockBridge(async (network, method, params, bridgeNetwork) => {
      captured = { network, method, params, bridgeNetwork }
      return { ok: true, result: { txHash: '0xabc123' } }
    })

    const result = await swap('ethereum', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '3000',
      amountIn: '1000000000',
      amountOutMinimum: '500000000',
      recipient: RECIPIENT,
    })

    assert.equal(captured.network, 'ethereum')
    assert.equal(captured.method, 'call-contract')
    assert.equal(captured.params.contract, SWAP_ROUTER.ethereum)
    assert.equal(captured.params.method, 'exactInputSingle')
    assert.equal(captured.params.abi, SWAP_ROUTER_ABI)
    assert.equal(captured.bridgeNetwork, 'ethereum')

    // Verify args tuple structure: [tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96]
    const args = captured.params.args
    assert.equal(args.length, 1) // Single tuple arg
    assert.deepEqual(args[0], [USDC, WETH, '3000', RECIPIENT, '1000000000', '500000000', '0'])

    assert.equal(result.txHash, '0xabc123')
    assert.equal(result.chain, 'ethereum')
    assert.equal(result.tokenIn, USDC)
    assert.equal(result.tokenOut, WETH)
    assert.equal(result.amountOutMinimum, '500000000')
  })

  it('defaults amountOutMinimum to 0 when omitted', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xdef' } }
    })

    const result = await swap('ethereum', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '3000',
      amountIn: '1000',
      recipient: RECIPIENT,
    })

    assert.equal(captured.args[0][5], '0') // amountOutMinimum
    assert.equal(result.amountOutMinimum, '0')
  })

  it('uses base swap router for base chain', async () => {
    let captured
    mockBridge(async (_net, _method, params, bridgeNetwork) => {
      captured = { params, bridgeNetwork }
      return { ok: true, result: { txHash: '0x999' } }
    })

    await swap('base', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '500',
      amountIn: '100',
      recipient: RECIPIENT,
    })

    assert.equal(captured.params.contract, SWAP_ROUTER.base)
    assert.equal(captured.bridgeNetwork, 'base')
  })

  it('extracts txHash from string receipt', async () => {
    mockBridge(async () => ({ ok: true, result: '0xplaintxhash' }))

    const result = await swap('ethereum', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '3000',
      amountIn: '100',
      recipient: RECIPIENT,
    })

    assert.equal(result.txHash, '0xplaintxhash')
  })

  it('extracts txHash from JSON string receipt', async () => {
    mockBridge(async () => ({
      ok: true,
      result: JSON.stringify({ txHash: '0xjsonhash' }),
    }))

    const result = await swap('ethereum', {
      tokenIn: USDC,
      tokenOut: WETH,
      fee: '3000',
      amountIn: '100',
      recipient: RECIPIENT,
    })

    assert.equal(result.txHash, '0xjsonhash')
  })
})

// ══════════════════════════════════════════════════════════════════
// Multi-hop swap — verify path encoding and bridge call
// ══════════════════════════════════════════════════════════════════

describe('multiHopSwap: bridge call construction (mocked)', () => {
  afterEach(() => restoreBridge())

  it('sends encoded 3-token path to bridge', async () => {
    const threePath = [{ token: USDC, fee: '500' }, { token: WETH, fee: '3000' }, { token: DAI }]
    const expectedEncoded = encodePath(threePath)

    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xmulti' } }
    })

    const result = await multiHopSwap('ethereum', {
      path: threePath,
      amountIn: '5000000',
      amountOutMinimum: '4900000',
      recipient: RECIPIENT,
    })

    assert.equal(captured.method, 'exactInput')
    assert.equal(captured.abi, SWAP_ROUTER_MULTI_ABI)
    assert.equal(captured.contract, SWAP_ROUTER.ethereum)

    // Args: [encodedPath, recipient, amountIn, amountOutMinimum]
    const args = captured.args
    assert.equal(args.length, 1)
    assert.equal(args[0][0], expectedEncoded)
    assert.equal(args[0][1], RECIPIENT)
    assert.equal(args[0][2], '5000000')
    assert.equal(args[0][3], '4900000')

    assert.equal(result.txHash, '0xmulti')
    assert.equal(result.amountOutMinimum, '4900000')
  })

  it('defaults amountOutMinimum to 0', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xm2' } }
    })

    await multiHopSwap('ethereum', {
      path: [{ token: USDC, fee: '500' }, { token: WETH }],
      amountIn: '1000',
      recipient: RECIPIENT,
    })

    assert.equal(captured.args[0][3], '0')
  })
})

describe('encodePath: 3-token route correctness', () => {
  it('produces correct byte layout for USDC->WETH->DAI', () => {
    const path = [{ token: USDC, fee: '500' }, { token: WETH, fee: '3000' }, { token: DAI }]
    const encoded = encodePath(path)

    // Expected: 0x + usdc(40) + fee500(6) + weth(40) + fee3000(6) + dai(40)
    assert.equal(encoded.length, 2 + 40 + 6 + 40 + 6 + 40)

    const body = encoded.slice(2)
    assert.equal(body.slice(0, 40), USDC.slice(2).toLowerCase())
    assert.equal(body.slice(40, 46), '0001f4') // 500
    assert.equal(body.slice(46, 86), WETH.slice(2).toLowerCase())
    assert.equal(body.slice(86, 92), '000bb8') // 3000
    assert.equal(body.slice(92, 132), DAI.slice(2).toLowerCase())
  })
})

// ══════════════════════════════════════════════════════════════════
// Mint — verify bridge call and return structure
// ══════════════════════════════════════════════════════════════════

describe('mint: bridge call construction (mocked)', () => {
  afterEach(() => restoreBridge())

  it('sends correct mint args to bridge', async () => {
    let captured
    mockBridge(async (_net, _method, params, bridgeNetwork) => {
      captured = { params, bridgeNetwork }
      return {
        ok: true,
        result: {
          txHash: '0xmint123',
          logs: [
            {
              topics: [
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                '0x0000000000000000000000000000000000000000000000000000000000000000',
                '0x0000000000000000000000001111111111111111111111111111111111111111',
                '0x0000000000000000000000000000000000000000000000000000000000000042',
              ],
            },
          ],
        },
      }
    })

    const result = await mint('ethereum', {
      token0: USDC,
      token1: WETH,
      fee: '3000',
      tickLower: '-887220',
      tickUpper: '887220',
      amount0Desired: '1000000000',
      amount1Desired: '500000000000000000',
      amount0Min: '990000000',
      amount1Min: '495000000000000000',
      recipient: RECIPIENT,
    })

    assert.equal(captured.params.method, 'mint')
    assert.equal(captured.params.contract, POSITION_MANAGER.ethereum)
    assert.equal(captured.params.abi, POSITION_MANAGER_ABI)
    assert.equal(captured.bridgeNetwork, 'ethereum')

    const args = captured.params.args
    assert.equal(args.length, 1) // Single tuple
    assert.equal(args[0][0], USDC) // token0
    assert.equal(args[0][1], WETH) // token1
    assert.equal(args[0][2], '3000') // fee
    assert.equal(args[0][3], '-887220') // tickLower
    assert.equal(args[0][4], '887220') // tickUpper
    assert.equal(args[0][5], '1000000000') // amount0Desired
    assert.equal(args[0][6], '500000000000000000') // amount1Desired
    assert.equal(args[0][7], '990000000') // amount0Min
    assert.equal(args[0][8], '495000000000000000') // amount1Min
    assert.equal(args[0][9], RECIPIENT) // recipient
    assert.ok(args[0][10]) // deadline (non-empty)

    assert.equal(result.txHash, '0xmint123')
    assert.equal(result.tokenId, '66') // 0x42 = 66
    assert.equal(result.chain, 'ethereum')
    assert.equal(result.token0, USDC)
    assert.equal(result.token1, WETH)
    assert.equal(result.tickLower, '-887220')
    assert.equal(result.tickUpper, '887220')
    assert.equal(result.recipient, RECIPIENT)
  })

  it('defaults optional amounts to 0', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xm2' } }
    })

    await mint('ethereum', {
      token0: USDC,
      token1: WETH,
      fee: '3000',
      recipient: RECIPIENT,
    })

    const args = captured.args[0]
    assert.equal(args[3], '0') // tickLower default
    assert.equal(args[4], '0') // tickUpper default
    assert.equal(args[5], '0') // amount0Desired default
    assert.equal(args[6], '0') // amount1Desired default
    assert.equal(args[7], '0') // amount0Min default
    assert.equal(args[8], '0') // amount1Min default
  })

  it('returns null tokenId when no Transfer log', async () => {
    mockBridge(async () => ({ ok: true, result: { txHash: '0xnotx' } }))

    const result = await mint('ethereum', {
      token0: USDC,
      token1: WETH,
      fee: '3000',
      recipient: RECIPIENT,
    })

    assert.equal(result.tokenId, null)
  })
})

// ══════════════════════════════════════════════════════════════════
// Increase liquidity — verify bridge call
// ══════════════════════════════════════════════════════════════════

describe('increaseLiquidity: bridge call (mocked)', () => {
  afterEach(() => restoreBridge())

  it('sends correct args to bridge', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xinc' } }
    })

    const result = await increaseLiquidity('ethereum', {
      tokenId: '42',
      amount0Desired: '1000',
      amount1Desired: '2000',
      amount0Min: '900',
      amount1Min: '1800',
    })

    assert.equal(captured.method, 'increaseLiquidity')
    assert.equal(captured.contract, POSITION_MANAGER.ethereum)
    const args = captured.args[0]
    assert.equal(args[0], '42') // tokenId
    assert.equal(args[1], '1000')
    assert.equal(args[2], '2000')
    assert.equal(args[3], '900')
    assert.equal(args[4], '1800')
    assert.ok(args[5]) // deadline

    assert.equal(result.txHash, '0xinc')
    assert.equal(result.tokenId, '42')
    assert.equal(result.amount0Desired, '1000')
    assert.equal(result.amount1Desired, '2000')
  })

  it('defaults amounts to 0', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xinc2' } }
    })

    await increaseLiquidity('ethereum', { tokenId: '99' })

    const args = captured.args[0]
    assert.equal(args[1], '0')
    assert.equal(args[2], '0')
    assert.equal(args[3], '0')
    assert.equal(args[4], '0')
  })
})

// ══════════════════════════════════════════════════════════════════
// Decrease liquidity — verify bridge call
// ══════════════════════════════════════════════════════════════════

describe('decreaseLiquidity: bridge call (mocked)', () => {
  afterEach(() => restoreBridge())

  it('sends correct args to bridge', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xdec' } }
    })

    const result = await decreaseLiquidity('ethereum', {
      tokenId: '42',
      liquidity: '5000',
      amount0Min: '100',
      amount1Min: '200',
    })

    assert.equal(captured.method, 'decreaseLiquidity')
    assert.equal(captured.contract, POSITION_MANAGER.ethereum)
    const args = captured.args[0]
    assert.equal(args[0], '42')
    assert.equal(args[1], '5000')
    assert.equal(args[2], '100')
    assert.equal(args[3], '200')
    assert.ok(args[4]) // deadline

    assert.equal(result.txHash, '0xdec')
    assert.equal(result.liquidity, '5000')
  })

  it('defaults amount mins to 0', async () => {
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xd2' } }
    })

    await decreaseLiquidity('ethereum', { tokenId: '42', liquidity: '100' })

    assert.equal(captured.args[0][2], '0')
    assert.equal(captured.args[0][3], '0')
  })
})

// ══════════════════════════════════════════════════════════════════
// Collect — verify bridge call
// ══════════════════════════════════════════════════════════════════

describe('collect: bridge call (mocked)', () => {
  afterEach(() => restoreBridge())

  it('sends MAX_UINT128 for both amount maxes', async () => {
    const MAX_UINT128 = '340282366920938463463374607431768211455'
    let captured
    mockBridge(async (_net, _method, params) => {
      captured = params
      return { ok: true, result: { txHash: '0xcoll' } }
    })

    const result = await collect('ethereum', {
      tokenId: '42',
      recipient: RECIPIENT,
    })

    assert.equal(captured.method, 'collect')
    assert.equal(captured.contract, POSITION_MANAGER.ethereum)
    const args = captured.args[0]
    assert.equal(args[0], '42')
    assert.equal(args[1], RECIPIENT)
    assert.equal(args[2], MAX_UINT128)
    assert.equal(args[3], MAX_UINT128)

    assert.equal(result.txHash, '0xcoll')
    assert.equal(result.tokenId, '42')
    assert.equal(result.recipient, RECIPIENT)
  })
})

// ══════════════════════════════════════════════════════════════════
// getPosition — verify bridge read and response parsing
// ══════════════════════════════════════════════════════════════════

describe('getPosition: bridge call (mocked)', () => {
  afterEach(() => restoreBridge())

  it('parses array-form position data', async () => {
    mockBridge(async (_net, _method, params) => {
      assert.equal(params.method, 'positions')
      return {
        ok: true,
        result: [
          '0', // nonce
          RECIPIENT, // operator
          USDC, // token0
          WETH, // token1
          '3000', // fee
          '-887220', // tickLower
          '887220', // tickUpper
          '1000000', // liquidity
          '0', // feeGrowthInside0LastX128
          '0', // feeGrowthInside1LastX128
          '500', // tokensOwed0
          '300', // tokensOwed1
        ],
      }
    })

    const pos = await getPosition('ethereum', { tokenId: '42' })

    assert.equal(pos.tokenId, '42')
    assert.equal(pos.chain, 'ethereum')
    assert.equal(pos.nonce, '0')
    assert.equal(pos.operator, RECIPIENT)
    assert.equal(pos.token0, USDC)
    assert.equal(pos.token1, WETH)
    assert.equal(pos.fee, '3000')
    assert.equal(pos.tickLower, '-887220')
    assert.equal(pos.tickUpper, '887220')
    assert.equal(pos.liquidity, '1000000')
    assert.equal(pos.tokensOwed0, '500')
    assert.equal(pos.tokensOwed1, '300')
  })

  it('parses object-form position data', async () => {
    mockBridge(async () => ({
      ok: true,
      result: {
        nonce: '1',
        operator: RECIPIENT,
        token0: USDC,
        token1: WETH,
        fee: '500',
        tickLower: '-100',
        tickUpper: '100',
        liquidity: '9999',
        feeGrowthInside0LastX128: '10',
        feeGrowthInside1LastX128: '20',
        tokensOwed0: '5',
        tokensOwed1: '6',
      },
    }))

    const pos = await getPosition('ethereum', { tokenId: '7' })
    assert.equal(pos.nonce, '1')
    assert.equal(pos.fee, '500')
    assert.equal(pos.liquidity, '9999')
  })

  it('parses JSON-string position data', async () => {
    mockBridge(async () => ({
      ok: true,
      result: JSON.stringify([
        '0',
        RECIPIENT,
        USDC,
        WETH,
        '3000',
        '-100',
        '100',
        '5000',
        '0',
        '0',
        '10',
        '20',
      ]),
    }))

    const pos = await getPosition('ethereum', { tokenId: '55' })
    assert.equal(pos.liquidity, '5000')
    assert.equal(pos.tokensOwed0, '10')
  })
})

// ══════════════════════════════════════════════════════════════════
// Error handling — bridge failures wrapped in UniswapError
// ══════════════════════════════════════════════════════════════════

describe('Error handling: bridge revert wrapping', () => {
  afterEach(() => restoreBridge())

  it('wraps bridge {ok:false} into UniswapError', async () => {
    mockBridge(async () => ({
      ok: false,
      code: 'EXECUTION_REVERTED',
      error: 'STF',
    }))

    await assert.rejects(
      () =>
        swap('ethereum', {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: '3000',
          amountIn: '1000',
          recipient: RECIPIENT,
        }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.equal(err.code, 'EXECUTION_REVERTED')
        assert.match(err.message, /STF/)
        return true
      },
    )
  })

  it('wraps bridge {ok:false} without code into BRIDGE_ERROR', async () => {
    mockBridge(async () => ({ ok: false }))

    await assert.rejects(
      () =>
        swap('ethereum', {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: '3000',
          amountIn: '1000',
          recipient: RECIPIENT,
        }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.equal(err.code, 'BRIDGE_ERROR')
        return true
      },
    )
  })

  it('wraps bridge revert on mint', async () => {
    mockBridge(async () => ({
      ok: false,
      code: 'EXECUTION_REVERTED',
      error: 'Price slippage check',
    }))

    await assert.rejects(
      () =>
        mint('ethereum', {
          token0: USDC,
          token1: WETH,
          fee: '3000',
          recipient: RECIPIENT,
        }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.equal(err.code, 'EXECUTION_REVERTED')
        return true
      },
    )
  })

  it('wraps bridge revert on decreaseLiquidity', async () => {
    mockBridge(async () => ({
      ok: false,
      code: 'EXECUTION_REVERTED',
      error: 'Not approved',
    }))

    await assert.rejects(
      () => decreaseLiquidity('ethereum', { tokenId: '42', liquidity: '100' }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.match(err.message, /Not approved/)
        return true
      },
    )
  })

  it('wraps bridge revert on collect', async () => {
    mockBridge(async () => ({ ok: false, error: 'timeout' }))

    await assert.rejects(
      () => collect('ethereum', { tokenId: '1', recipient: RECIPIENT }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.match(err.message, /timeout/)
        return true
      },
    )
  })

  it('wraps bridge revert on quoteSwap', async () => {
    mockBridge(async () => ({
      ok: false,
      code: 'EXECUTION_REVERTED',
      error: 'SPL',
    }))

    await assert.rejects(
      () =>
        quoteSwap('ethereum', {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: '3000',
          amountIn: '999999999999999999999',
        }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.equal(err.code, 'EXECUTION_REVERTED')
        return true
      },
    )
  })

  it('wraps bridge revert on multiHopSwap', async () => {
    mockBridge(async () => ({
      ok: false,
      code: 'EXECUTION_REVERTED',
      error: 'Too little received',
    }))

    await assert.rejects(
      () =>
        multiHopSwap('ethereum', {
          path: [{ token: USDC, fee: '500' }, { token: WETH }],
          amountIn: '1000',
          recipient: RECIPIENT,
        }),
      (err) => {
        assert.ok(err instanceof UniswapError)
        assert.match(err.message, /Too little received/)
        return true
      },
    )
  })
})
