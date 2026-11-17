import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LAB_TITLE,
  cleanDemoName,
  fill,
  findLabWorkspace,
  listLabSessions,
  normalizePath,
  truncateUtf8,
} from '../src/model.mjs';

const encoder = new TextEncoder();
const fixed = new Date(2026, 10, 12, 14, 5).getTime();

test('demo names are trimmed, collapsed, and fall back to a timestamp', () => {
  assert.equal(cleanDemoName('  My   Demo  ', fixed), 'My Demo');
  assert.equal(cleanDemoName('', fixed), 'demo-20261112-1405');
  assert.equal(cleanDemoName('   ', fixed), 'demo-20261112-1405');
  assert.match(cleanDemoName(undefined, fixed), /^demo-20261112-1405$/u);
});

test('demo names respect the Host title byte budget', () => {
  const long = '中'.repeat(40);
  const result = cleanDemoName(long, fixed);
  assert.ok(encoder.encode(result).length <= 80);
  assert.ok(result.length > 0);
  assert.equal(truncateUtf8('abc', 2), 'ab');
  assert.equal(truncateUtf8('中中', 3), '中');
  assert.equal(truncateUtf8('plain', 80), 'plain');
});

test('templates fill known placeholders only', () => {
  assert.equal(fill('{n} sessions for {who}', { n: 2, who: 'me' }), '2 sessions for me');
  assert.equal(fill('{n} sessions', {}), '{n} sessions');
});

test('the configured root is matched by path, title, and .dsh/lab suffix', () => {
  const lab = { workspaceId: 'w1', title: DEFAULT_LAB_TITLE, path: 'C:\\Users\\x\\.dsh\\lab' };
  const work = { workspaceId: 'w2', title: 'Work', path: 'C:\\work' };
  const renamed = { ...lab, title: 'Renamed' };
  assert.equal(findLabWorkspace([work, lab], DEFAULT_LAB_TITLE, ''), lab);
  assert.equal(findLabWorkspace([renamed], DEFAULT_LAB_TITLE, ''), renamed);
  assert.equal(
    findLabWorkspace([lab], 'Different', 'C:\\Users\\x\\.dsh\\lab'),
    lab,
  );
  const demo = { workspaceId: 'w3', title: 'Demo', path: 'C:\\Users\\x\\demo' };
  assert.equal(findLabWorkspace([demo], 'Demo', '~/demo'), demo);
  assert.equal(findLabWorkspace([work], DEFAULT_LAB_TITLE, ''), undefined);
  assert.equal(findLabWorkspace([], DEFAULT_LAB_TITLE, ''), undefined);
});

test('duplicate titles prefer the canonical lab path', () => {
  const lab = { workspaceId: 'w1', title: DEFAULT_LAB_TITLE, path: 'C:\\Users\\x\\.dsh\\lab' };
  const duplicate = { workspaceId: 'w2', title: DEFAULT_LAB_TITLE, path: 'C:\\other' };
  assert.equal(findLabWorkspace([duplicate, lab], DEFAULT_LAB_TITLE, ''), lab);
});

test('session lists preserve Workspace order and drop archived, subagent, and missing rows', () => {
  const workspace = { sessionIds: ['s2', 's1', 's3', 's4'] };
  const sessions = {
    byId: {
      s2: { id: 's2', displayTitle: 'Second' },
      s1: { id: 's1', displayTitle: 'Child', origin: 'subagent' },
      s4: { id: 's4', displayTitle: 'Fourth' },
    },
  };
  assert.deepEqual(listLabSessions(workspace, sessions, ['s4']).map(row => row.id), ['s2']);
  assert.deepEqual(listLabSessions(workspace, sessions, []).map(row => row.id), ['s2', 's4']);
  assert.deepEqual(listLabSessions(undefined, sessions, []), []);
});

test('path comparison is separator- and case-insensitive', () => {
  assert.equal(normalizePath('C:\\Users\\X\\Lab\\'), 'c:/users/x/lab');
  assert.equal(normalizePath('/home/x/lab/'), '/home/x/lab');
});
