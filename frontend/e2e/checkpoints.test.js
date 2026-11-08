import test from 'node:test'
import assert from 'node:assert/strict'
import { generateTowns } from './generate-checkpoints.js'

test('checkpoint generation reinforces every bridge after finite nodes regrow', () => {
  const towns = generateTowns()
  const reinforced = towns['all-reinforced']
  assert.equal(reinforced.bridges.length, 5)
  for (const bridge of reinforced.bridges) assert.equal(bridge.type, 'reinforced', bridge.route)
  assert.ok(reinforced.buildings.some((b) => b.type === 'market'))
  assert.deepEqual(generateTowns()['all-reinforced'].deposits, reinforced.deposits)
})
