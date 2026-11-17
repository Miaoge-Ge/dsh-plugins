import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RATES, apply} from '../index.js';
import {parseRates,priceRecord} from '../src/accounting.mjs';

test('default third-party rates are valid and do not inherit peak discounts', () => {
  const rates = parseRates(JSON.stringify(DEFAULT_RATES));
  assert.deepEqual(Object.keys(rates).sort(), [
    'glm/glm5.3-flash',
    'minimax/MiniMax-M3.1-Flash',
    'qwen/qwen3.8-flash',
    'xiaomi/mimo-v2.6-flash',
    'xiaomi/mimo-v2.6-pro',
  ]);
  for (const rate of Object.values(rates)) {
    for (const key of ['input','cacheRead','cacheWrite','output']) {
      assert.equal(typeof rate[key], 'number');
      assert.ok(rate[key] >= 0);
    }
  }
  const record = {
    provider: 'qwen',
    model: 'qwen3.8-flash',
    time: Date.parse('2026-11-17T02:00:00Z'),
    tokens: {input: 1e6, cacheRead: 0, cacheWrite: 0, output: 0},
  };
  assert.ok(Math.abs(priceRecord(record, rates).input - 0.8) < 1e-9);
});

test('provider-balance command registers and reports the Qwen limitation', async () => {
  const definitions = [];
  const ctx = {
    inject: (deps, fn) => {
      assert.deepEqual(deps, ['settings', 'commands']);
      fn({
        effect: effect => effect(),
        commands: {register: definition => { definitions.push(definition); return () => {}; }},
        settings: {configure: () => {}},
      });
    },
    get: () => undefined,
  };
  apply(ctx);
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].name, 'provider-balance');
  const result = await definitions[0].handler({rawInput: 'qwen'});
  assert.equal(result.kind, 'success');
  assert.match(result.text, /QWEN_API_KEY/);
});
