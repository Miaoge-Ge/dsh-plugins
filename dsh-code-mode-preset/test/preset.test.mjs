import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDocument} from 'yaml';

const source = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
const document = parseDocument(source, {
  customTags: [{tag: 'tag:yaml.org,2002:js', resolve: (value) => value}],
});
const patch = document.toJS();

/** Rows the patch inserts into the profile, groups flattened depth-first. */
function insertedRows() {
  const rows = [];
  const walk = (list) => {
    for (const row of list) {
      rows.push(row);
      if (row.group === true) walk(row.config);
    }
  };
  for (const entry of patch) if (Array.isArray(entry.insert)) walk(entry.insert);
  return rows;
}

const preset = patch.flatMap((entry) => entry.insert ?? []).find((row) => row.id === 'preset-code');
const catalog = preset?.config?.plugins ?? [];
const byId = new Map(catalog.map((row) => [row.id, row]));
const persona = byId.get('persona')?.config?.prefix ?? '';

test('the patch parses and carries an insert list', () => {
  assert.equal(document.errors.length, 0);
  assert.ok(Array.isArray(patch));
  assert.ok(patch.some((entry) => Array.isArray(entry.insert)));
});

test('the read-before-write guard is enabled in place, never inserted twice', () => {
  const override = patch.find((entry) => !entry.insert && entry.id === 'fs-observation-policy');
  assert.ok(override, 'must override the base row by id');
  assert.equal(override.name, '@deepseek-ai/dsh-fs-observation-policy');
  assert.equal(override.disabled, false);
  assert.equal(
    insertedRows().filter((row) => row.id === 'fs-observation-policy').length,
    0,
    'inserting the row again would duplicate the base id',
  );
});

test('the preset keeps its roster identity', () => {
  assert.ok(preset, 'preset-code must be declared');
  assert.equal(preset.name, '@deepseek-ai/dsh-agent-preset');
  assert.equal(preset.config.id, 'code');
  assert.equal(preset.config.name, 'Code 模式');
  assert.equal(preset.config.order, 0);
  assert.equal(typeof preset.config.description, 'string');
  assert.ok(preset.config.description.length > 0, 'the roster needs a description');
  assert.ok(preset.config.description.length <= 80, 'the description must fit the preset roster');
});

test('every row is addressable, named, and unique', () => {
  const ids = new Set();
  for (const row of insertedRows()) {
    assert.equal(typeof row.name, 'string', `${row.id} must name a plugin`);
    assert.ok(row.name.length > 0, `${row.id} must name a plugin`);
    if (row.id !== undefined) {
      assert.ok(!ids.has(row.id), `duplicate row id ${row.id}`);
      ids.add(row.id);
    }
    if (row.group === true) {
      assert.equal(row.name, 'cordis:group');
      assert.ok(Array.isArray(row.config), `${row.id} group must hold a row list`);
    }
  }
});

test('the standard catalog survives the preset', () => {
  for (const id of [
    'agent-instructions',
    'time-context',
    'tool-fs',
    'tool-fs-search',
    'tool-jobs',
    'tool-schedule',
    'skill-filesystem',
    'tool-skill',
    'command-goal',
    'tool-goal',
    'tool-ask-user',
    'tool-todo',
    'tool-web',
    'present',
    'tool-office',
  ]) {
    assert.ok(byId.has(id), `missing tool row ${id}`);
  }
  assert.equal(byId.get('tool-fs').config.applyPatch, false);
  for (const group of ['planning', 'compaction', 'delegation']) {
    assert.equal(byId.get(group)?.group, true, `${group} group must stay mounted`);
  }
});

test('the delegation tools follow the rc.2 built-in interrupt default', () => {
  const control = byId.get('delegation')?.config?.find((row) => row.id === 'tool-subagent-control');
  assert.ok(control, 'tool-subagent-control must stay mounted');
  assert.equal(control.config?.interrupt, false, 'rc.2 presets disable interrupt_agent');
  assert.ok(byId.has('tool-office'), 'rc.2 standard catalog includes the native Office tool');
});

test('the shell tools switch by platform', () => {
  const disabled = (id) => byId.get(id)?.disabled;
  assert.match(String(disabled('tool-bash')), /win32/);
  assert.match(String(disabled('tool-pwsh')), /platform !== 'win32'/);
});

test('the terminal group isolates the service and offers both dialects', () => {
  const group = byId.get('shell-terminal');
  assert.ok(group, 'shell-terminal group must stay mounted');
  assert.deepEqual(group.isolate, {terminals: true});
  const ids = group.config.map((row) => row.id);
  assert.deepEqual(ids, ['terminal', 'terminal-shell-bash', 'terminal-shell-pwsh', 'tool-terminal']);
  assert.equal(group.config[0].name, '@deepseek-ai/dsh-terminal');
  assert.equal(group.config[3].name, '@deepseek-ai/dsh-tool-terminal');
  assert.equal(group.config.find((row) => row.id === 'terminal-shell-pwsh').config.shellDialect, 'pwsh');
  assert.match(String(group.config.find((row) => row.id === 'terminal-shell-bash').disabled), /win32/);
});

test('the worktree group isolates the service and mounts the tool', () => {
  const group = byId.get('git-worktree');
  assert.ok(group, 'git-worktree group must stay mounted');
  assert.deepEqual(group.isolate, {worktrees: true});
  assert.deepEqual(
    group.config.map((row) => [row.id, row.name]),
    [
      ['worktree', '@deepseek-ai/dsh-experimental-worktree'],
      ['tool-worktree', '@deepseek-ai/dsh-experimental-tool-worktree'],
    ],
  );
});

test('the persona keeps the contract that matters', () => {
  assert.match(persona, /\{\{model\}\}/);
  assert.match(persona, /git status --short/);
  assert.match(persona, /force-push/);
  assert.match(persona, /create_worktree/);
  assert.match(persona, /terminal_close/);
  assert.match(persona, /Edit applied|edit applied|not done because/);
  const words = persona.trim().split(/\s+/).length;
  assert.ok(words > 600, `persona lost its detail (${words} words)`);
  assert.ok(words < 1100, `persona grew past its budget (${words} words)`);
});
