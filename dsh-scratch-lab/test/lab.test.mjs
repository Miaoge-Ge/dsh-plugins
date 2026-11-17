import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import {
  DEFAULT_TITLE,
  defaultLabRoot,
  ensureLabWorkspace,
  resolveLabRoot,
} from '../src/lab.mjs';

const home = join('C:', 'Users', 'tester');
const cwd = join('C:', 'work');

test('the default root is ~/.dsh/lab', () => {
  assert.equal(defaultLabRoot(home), join(home, '.dsh', 'lab'));
  assert.equal(resolveLabRoot('', home, cwd), join(home, '.dsh', 'lab'));
});

test('configured roots expand ~ and resolve relative paths', () => {
  assert.equal(resolveLabRoot('~', home, cwd), home);
  assert.equal(resolveLabRoot('~/demo', home, cwd), join(home, 'demo'));
  assert.equal(resolveLabRoot('~\\demo', home, cwd), join(home, 'demo'));
  assert.equal(resolveLabRoot(join(home, 'custom'), home, cwd), join(home, 'custom'));
  assert.equal(resolveLabRoot('relative-lab', home, cwd), resolve(cwd, 'relative-lab'));
});

test('a missing Workspace is created after its directory is prepared', async () => {
  const calls = [];
  const registry = {
    async resolveByPath(path) {
      calls.push(['resolve', path]);
      return undefined;
    },
    async create(path, title) {
      calls.push(['create', path, title]);
      return { path, title };
    },
  };
  const mkdir = async (path, options) => {
    calls.push(['mkdir', path, options]);
  };
  const workspace = await ensureLabWorkspace({ registry, root: 'C:\\lab', title: DEFAULT_TITLE, mkdir });
  assert.equal(workspace.title, DEFAULT_TITLE);
  assert.deepEqual(calls, [
    ['mkdir', 'C:\\lab', { recursive: true }],
    ['resolve', 'C:\\lab'],
    ['create', 'C:\\lab', DEFAULT_TITLE],
  ]);
});

test('an existing Workspace is reused and never retitled', async () => {
  const calls = [];
  const existing = { path: 'C:\\lab', title: 'My own title' };
  const registry = {
    async resolveByPath() {
      calls.push('resolve');
      return existing;
    },
    async create() {
      calls.push('create');
      throw new Error('must not create');
    },
  };
  const workspace = await ensureLabWorkspace({
    registry,
    root: 'C:\\lab',
    title: '试验区',
    mkdir: async () => { calls.push('mkdir'); },
  });
  assert.equal(workspace, existing);
  assert.deepEqual(calls, ['mkdir', 'resolve']);
});

test('a blank title falls back to the default', async () => {
  const registry = {
    async resolveByPath() { return undefined; },
    async create(_path, title) { return { title }; },
  };
  const workspace = await ensureLabWorkspace({
    registry,
    root: 'C:\\lab',
    title: '   ',
    mkdir: async () => {},
  });
  assert.equal(workspace.title, DEFAULT_TITLE);
});

test('directory preparation failures propagate without touching the registry', async () => {
  let resolved = false;
  const registry = {
    async resolveByPath() { resolved = true; return undefined; },
    async create() { return undefined; },
  };
  await assert.rejects(
    ensureLabWorkspace({
      registry,
      root: 'C:\\lab',
      mkdir: async () => { throw new Error('denied'); },
    }),
    /denied/u,
  );
  assert.equal(resolved, false);
});
