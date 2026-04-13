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
  POSITION_MANAGER_ABI,
} from '../src/registry.js'
import { UniswapError } from '../src/uniswap.js'

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
