import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const source = await read('client.js');
const zh = JSON.parse(await read('locale/zh.json'));
const en = JSON.parse(await read('locale/en.json'));
const { dayKeyOf, timeAtDay, clockOf } = await import('../src/model.mjs');

const DOC_KEY = 'dsh.todo-widget.doc.v1';

/** Minimal element tree: enough to execute a render and read its text. */
function createElement(type, props, ...children) {
  return { type, props: props ?? {}, children: children.flat(Infinity) };
}

function makeReact() {
  const hooks = { index: 0, values: [] };
  return {
    createElement,
    useState(initial) {
      const slot = hooks.index++;
      if (!(slot in hooks.values)) hooks.values[slot] = typeof initial === 'function' ? initial() : initial;
      return [hooks.values[slot], () => {}];
    },
    useEffect() {},
    useMemo(factory) {
      return factory();
    },
    useRef(value) {
      return { current: value };
    },
    useCallback(fn) {
      return fn;
    },
    useSyncExternalStore(_subscribe, getSnapshot) {
      return getSnapshot();
    },
    reset() {
      hooks.index = 0;
      hooks.values = [];
    },
  };
}

function textOf(node, out = []) {
  if (node === null || node === undefined || node === false || node === true) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, out);
    return out;
  }
  if (Array.isArray(node.children)) for (const child of node.children) textOf(child, out);
  return out;
}

function findByClass(node, className, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) findByClass(child, className, out);
    return out;
  }
  const classes = typeof node.props.className === 'string' ? node.props.className.split(/\s+/u) : [];
  if (classes.includes(className)) out.push(node);
  for (const child of node.children ?? []) findByClass(child, className, out);
  return out;
}

function item(overrides = {}) {
  return {
    id: overrides.id ?? 'x1',
    text: overrides.text ?? '写周报',
    createdAt: overrides.createdAt ?? Date.now() - 3_600_000,
    dueAt: overrides.dueAt ?? null,
    done: overrides.done ?? false,
    doneAt: overrides.doneAt ?? null,
  };
}

/** Load the generated module, apply it against stubs, return its seats. */
async function loadWidget({ doc = null, ui = null } = {}) {
  const React = makeReact();
  const registrations = [];
  const locales = [];
  const storage = new Map();
  const selected = [];
  let definition = null;

  if (doc !== null) storage.set(DOC_KEY, JSON.stringify(doc));
  if (ui !== null) storage.set('dsh.todo-widget.ui.v1', JSON.stringify(ui));

  const document = {
    visibilityState: 'visible',
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { appendChild() {} },
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {
    __ModuleLoader__: { load(candidate) { definition = candidate; } },
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
    setInterval: () => 2,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
  };
  vm.runInContext(source, vm.createContext({
    window,
    document,
    Element: class Element {},
    Date,
    Math,
    JSON,
    console,
    setTimeout: () => 1,
    clearTimeout() {},
    clearInterval() {},
  }), { filename: 'client.js' });

  assert.ok(definition, 'the client module registers itself');
  assert.equal(definition.id, '@local/todo-widget');

  const plugin = definition.factory(name => {
    assert.equal(name, 'react');
    return React;
  });
  plugin.apply({
    effect: callback => {
      const dispose = callback();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    locale: {
      register: (namespace, dictionaries) => {
        locales.push({ namespace, dictionaries });
        return () => {};
      },
      bind: namespace => key => locales.at(-1)?.dictionaries?.zh?.[key] ?? key,
    },
    layout: {
      selectPanel: id => selected.push(id),
    },
    slots: {
      inject: (_key, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component });
        return () => {};
      },
    },
  });

  assert.ok(locales[0], 'the locale namespace is registered');
  return { React, registrations, storage, selected, locales };
}

function seat(registrations, name) {
  const found = registrations.find(entry => entry.options.name === name);
  assert.ok(found, `missing ${name} registration`);
  return found;
}

function render(seatEntry, { t = key => zh.ui[key] ?? key, extra = {} } = {}) {
  const props = typeof seatEntry.options.inject === 'function' ? seatEntry.options.inject() : {};
  return seatEntry.component({ ...props, ...extra, t });
}

test('the page, the sidebar icon, the composer entry and the notice register on native seats', async () => {
  const { registrations } = await loadWidget();
  assert.equal(registrations.length, 4);
  assert.equal(seat(registrations, 'main').options.key, 'todo-widget');
  assert.equal(seat(registrations, 'sidebar.panellist').options.id, 'todo-widget');
  assert.equal(seat(registrations, 'conversation.composer.dock').options.id, 'todo-widget');
  assert.equal(seat(registrations, 'shell.overlay').options.id, 'todo-widget.reminder');
  assert.equal(seat(registrations, 'main').options.locale, 'todo.widget');
});

test('the page renders today with its empty state', async () => {
  const { registrations, React } = await loadWidget();
  React.reset();
  const tree = render(seat(registrations, 'main'));
  const text = textOf(tree).join('');
  assert.ok(text.includes('每日待办'));
  assert.ok(text.includes('今天还没有待办'));
  assert.ok(text.includes('0/0 已完成'));
  const input = findByClass(tree, 'tdw-input');
  assert.equal(input.length, 1);
  assert.equal(input[0].props.placeholder, '添加待办，回车保存');
  assert.equal(findByClass(tree, 'tdw-page').length, 1);
});

test('the page offers to carry yesterday unfinished items into today', async () => {
  const now = Date.now();
  const today = dayKeyOf(now);
  const yesterday = dayKeyOf(new Date(now).setDate(new Date(now).getDate() - 1));
  const { registrations, React } = await loadWidget({
    doc: {
      v: 1,
      days: { [yesterday]: [item({ id: 'open', text: '没写完' })] },
      settings: { wrapUpEnabled: false },
    },
  });
  React.reset();
  const tree = render(seat(registrations, 'main'));
  const text = textOf(tree).join('');
  assert.ok(text.includes('昨天还有 1 项未完成'));
  assert.ok(text.includes('移到今天'));
  assert.ok(text.includes('今天'));
  assert.equal(findByClass(tree, 'tdw-carry').length, 1);
});

test('the page lists rows with completion and reminder times', async () => {
  const now = Date.now();
  const today = dayKeyOf(now);
  const doneAt = timeAtDay(today, '10:24');
  const dueAt = now - 60_000;
  const second = await loadWidget({
    doc: {
      v: 1,
      days: { [today]: [item({ id: 'done', text: '回复邮件', done: true, doneAt }), item({ id: 'open', text: '写周报', dueAt })] },
      settings: { wrapUpEnabled: false },
    },
  });
  second.React.reset();
  const tree = render(seat(second.registrations, 'main'));
  const text = textOf(tree).join('');
  assert.ok(text.includes('回复邮件'));
  assert.ok(text.includes(`完成于 ${clockOf(doneAt)}`));
  assert.ok(text.includes('写周报'));
  assert.ok(text.includes(clockOf(dueAt)));
  assert.ok(text.includes('1/2 已完成'));
  assert.ok(text.includes('1 项逾期'));
  assert.equal(findByClass(tree, 'tdw-item').length, 2);
  assert.equal(findByClass(tree, 'is-done').length, 1);
  const checks = findByClass(tree, 'tdw-check');
  assert.equal(checks.length, 2);
  assert.equal(checks[0].props['aria-checked'], false);
  assert.equal(checks[1].props['aria-checked'], true);
});

test('the page settings bind the daily sweep and the composer entry', async () => {
  const { registrations, React } = await loadWidget();
  React.reset();
  const tree = render(seat(registrations, 'main'));
  const boxes = findByClass(tree, 'tdw-box');
  assert.equal(boxes.length, 2);
  assert.equal(boxes[0].props.checked, true);
  assert.equal(boxes[1].props.checked, true);
  const times = findByClass(tree, 'tdw-time');
  assert.ok(times.some(node => node.props.value === '18:00'));
});

test('the composer entry shows today progress beside the input', async () => {
  const now = Date.now();
  const today = dayKeyOf(now);
  const { registrations, React } = await loadWidget({
    doc: {
      v: 1,
      days: { [today]: [item({ id: 'a', text: '买牛奶' }), item({ id: 'b', text: '取快递', done: true, doneAt: now })] },
      settings: { wrapUpEnabled: false },
    },
  });
  React.reset();
  const tree = render(seat(registrations, 'conversation.composer.dock'));
  const text = textOf(tree).join('');
  assert.ok(text.includes('今日待办'));
  assert.ok(text.includes('1/2'));
  assert.equal(findByClass(tree, 'tdw-dock').length, 1);
});

test('the composer entry can be turned off and flags overdue items', async () => {
  const now = Date.now();
  const today = dayKeyOf(now);
  const off = await loadWidget({
    doc: { v: 1, days: { [today]: [item({ id: 'a' })] }, settings: { wrapUpEnabled: false, showDock: false } },
  });
  off.React.reset();
  assert.equal(render(seat(off.registrations, 'conversation.composer.dock')), null);

  const late = await loadWidget({
    doc: {
      v: 1,
      days: { [today]: [item({ id: 'a', dueAt: now - 60_000 })] },
      settings: { wrapUpEnabled: false },
    },
  });
  late.React.reset();
  assert.ok(textOf(render(seat(late.registrations, 'conversation.composer.dock'))).join('').includes('1 项逾期'));
});

test('an overdue item raises the reminder notice with its actions', async () => {
  const now = Date.now();
  const today = dayKeyOf(now);
  const { registrations, React } = await loadWidget({
    doc: {
      v: 1,
      days: { [today]: [item({ id: 'late', text: '交周报', dueAt: now - 60_000 })] },
      settings: { wrapUpEnabled: false },
    },
  });
  React.reset();
  const tree = render(seat(registrations, 'shell.overlay'));
  const text = textOf(tree).join('');
  assert.ok(text.includes('到点了'));
  assert.ok(text.includes('交周报'));
  assert.ok(text.includes('知道了'));
  assert.ok(text.includes('稍后 10 分钟'));
  assert.equal(findByClass(tree, 'tdw-toast').length, 1);
});

test('the daily sweep raises the notice when the configured time passed', async () => {
  const now = Date.now();
  const today = dayKeyOf(now);
  const { registrations, React } = await loadWidget({
    doc: {
      v: 1,
      days: { [today]: [item({ id: 'open', text: '整理笔记' })] },
      settings: { wrapUpEnabled: true, wrapUpTime: '00:00', wrapUpShownOn: null },
    },
  });
  React.reset();
  const text = textOf(render(seat(registrations, 'shell.overlay'))).join('');
  assert.ok(text.includes('今日收尾'));
  assert.ok(text.includes('还有 1 项没有完成'));
});

test('the notice is absent while nothing is due', async () => {
  const { registrations, React } = await loadWidget({
    doc: { v: 1, days: {}, settings: { wrapUpEnabled: false } },
  });
  React.reset();
  assert.equal(render(seat(registrations, 'shell.overlay')), null);
});

test('English dictionaries cover the same strings', async () => {
  const { registrations, React } = await loadWidget();
  React.reset();
  const tree = render(seat(registrations, 'main'), { t: key => en.ui[key] ?? key });
  const text = textOf(tree).join('');
  assert.ok(text.includes('Daily to-dos'));
  assert.ok(text.includes('Nothing planned yet'));
});

test('every literal translation key exists in both locales', async () => {
  const used = new Set();
  const pattern = /\bt\('([A-Za-z0-9_.]+)'\)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) used.add(match[1]);
  assert.ok(used.has('title'));
  for (const key of used) {
    assert.ok(Object.hasOwn(zh.ui, key), `zh missing ${key}`);
    assert.ok(Object.hasOwn(en.ui, key), `en missing ${key}`);
  }
  for (let index = 0; index < 7; index += 1) {
    assert.ok(Object.hasOwn(zh.ui, `weekday.${index}`), `zh missing weekday.${index}`);
    assert.ok(Object.hasOwn(en.ui, `weekday.${index}`), `en missing weekday.${index}`);
  }
});
