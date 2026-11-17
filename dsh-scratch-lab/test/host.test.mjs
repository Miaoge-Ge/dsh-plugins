import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../index.js';

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for the Host preparation');
}

function childOf(calls) {
  return {
    effect(fn) {
      const dispose = fn();
      calls.push(['effect']);
      return dispose;
    },
    settings: {
      configure(options, owner) {
        calls.push(['configure', options, owner]);
        return () => {};
      },
    },
    logger: {
      warn(message) { calls.push(['warn', message]); },
    },
  };
}

test('apply prepares the configured Workspace behind the Host services', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-scratch-host-'));
  const calls = [];
  const fiber = {};
  const child = childOf(calls);
  child.workspaceRegistry = {
    async resolveByPath(path) {
      calls.push(['resolve', path]);
      return undefined;
    },
    async create(path, title) {
      calls.push(['create', path, title]);
      return { path, title };
    },
  };
  const ctx = {
    fiber,
    inject(services, callback) {
      calls.push(['inject', services]);
      callback(child);
    },
  };
  try {
    apply(ctx, { root, title: 'T' });
    await waitFor(() => calls.some(call => call[0] === 'create'));
    assert.deepEqual(calls.find(call => call[0] === 'inject')[1], ['settings', 'workspaceRegistry']);
    const configure = calls.find(call => call[0] === 'configure');
    assert.deepEqual(configure[1], { auto: false });
    assert.equal(configure[2], fiber);
    const create = calls.find(call => call[0] === 'create');
    assert.equal(create[1], root);
    assert.equal(create[2], 'T');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('apply logs instead of rejecting when Workspace preparation fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-scratch-host-'));
  const calls = [];
  const child = childOf(calls);
  child.workspaceRegistry = {
    async resolveByPath() { throw new Error('registry down'); },
  };
  const ctx = {
    fiber: {},
    inject(_services, callback) { callback(child); },
  };
  try {
    apply(ctx, { root, title: 'T' });
    await waitFor(() => calls.some(call => call[0] === 'warn'));
    assert.match(calls.find(call => call[0] === 'warn')[1], /registry down/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
