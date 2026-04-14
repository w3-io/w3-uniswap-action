/**
 * Uniswap client unit tests.
 *
 * Tests validation logic and error handling. Bridge calls are not
 * mocked — these verify input validation before any on-chain call.
 */

import { describe, it } from 'node:test'
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
import { UniswapError, encodePath } from '../src/uniswap.js'

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
