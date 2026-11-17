import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

const document = {
  createElement() {
    return {
      dataset: {},
      textContent: '',
      remove() {},
    };
  },
  head: { appendChild() {} },
};

const React = { createElement() {} };

function textOf(node, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, out);
    return out;
  }
  for (const child of node.children ?? []) textOf(child, out);
  return out;
}

function loadClient(ReactImpl = React) {
  let descriptor;
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { descriptor = value; } } },
    document,
    TextEncoder,
  });
  assert.equal(descriptor.id, '@local/scratch-lab');
  return descriptor.factory(name => {
    assert.equal(name, 'react');
    return ReactImpl;
  });
}

function createContext() {
  const registered = [];
  const components = new Map();
  const opened = [];
  const created = [];
  const renamed = [];
  let refreshCalls = 0;
  let renameResult = { ok: true, value: {} };
  const form = {
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'ready', value: { root: '', title: '试验区' } }),
  };
  const ctx = {
    effect(fn) {
      const dispose = fn();
      return dispose;
    },
    locale: {
      register() {},
      bind() { return key => key; },
    },
    slots: {
      inject(_name, setup) { setup(); },
      register(definition, component) {
        registered.push(definition);
        components.set(definition, component);
        return () => {};
      },
    },
    configForms: { get() { return form; } },
    sessions: {
      async create(options) {
        created.push(options);
        return 's1';
      },
      async refresh() { refreshCalls += 1; },
    },
    remote: {
      session: {
        async rename(request) {
          renamed.push(request);
          return renameResult;
        },
      },
    },
    uiWorkspace: {
      openSession(target) { opened.push(target); },
    },
    get(name) {
      if (name === 'sessions') return this.sessions;
      if (name === 'uiWorkspace') return this.uiWorkspace;
      return undefined;
    },
  };
  return {
    ctx,
    registered,
    components,
    opened,
    created,
    renamed,
    refresh: () => refreshCalls,
    failRename(message = 'denied') {
      renameResult = { ok: false, error: { message } };
    },
  };
}

test('the client bundle registers the React factory and exact services', () => {
  const client = loadClient();
  assert.deepEqual(Array.from(client.inject), [
    'slots', 'locale', 'sessions', 'remote', 'uiWorkspace', 'configForms',
  ]);
  assert.equal(typeof client.apply, 'function');
});

test('apply registers the sidebar icon and the keyed main page', () => {
  const client = loadClient();
  const harness = createContext();
  client.apply(harness.ctx);
  const main = harness.registered.find(row => row.name === 'main');
  const sidebar = harness.registered.find(row => row.name === 'sidebar.panellist');
  assert.ok(main, 'main page must be registered');
  assert.equal(main.key, 'scratch-lab');
  assert.ok(sidebar, 'sidebar icon must be registered');
  assert.equal(sidebar.id, 'scratch-lab');
  assert.equal(sidebar.order, 24);
  assert.equal(sidebar.label(), 'title');
});

test('createDemo creates, names, opens, and refreshes the Session', async () => {
  const client = loadClient();
  const harness = createContext();
  client.apply(harness.ctx);
  const main = harness.registered.find(row => row.name === 'main');
  const actions = main.inject();

  const result = await actions.createDemo({ name: '  Login   page ', workspaceId: 'w1' });
  assert.equal(result.sessionId, 's1');
  assert.equal(result.title, 'Login page');
  assert.equal(result.renamed, true);
  assert.equal(result.warning, '');
  assert.equal(harness.created.length, 1);
  assert.equal(harness.created[0].workspaceId, 'w1');
  assert.equal(harness.renamed.length, 1);
  assert.equal(harness.renamed[0].sessionId, 's1');
  assert.equal(harness.renamed[0].title, 'Login page');
  assert.deepEqual(harness.opened, ['s1']);
  assert.equal(harness.refresh(), 1);
});

test('an empty name uses the timestamp fallback', async () => {
  const client = loadClient();
  const harness = createContext();
  client.apply(harness.ctx);
  const actions = harness.registered.find(row => row.name === 'main').inject();
  const result = await actions.createDemo({ name: '   ', workspaceId: 'w1' });
  assert.match(result.title, /^demo-\d{8}-\d{4}$/u);
  assert.equal(result.renamed, true);
});

test('a failed rename still opens the created Session and reports the warning', async () => {
  const client = loadClient();
  const harness = createContext();
  harness.failRename('host refused');
  client.apply(harness.ctx);
  const actions = harness.registered.find(row => row.name === 'main').inject();
  const result = await actions.createDemo({ name: 'Demo', workspaceId: 'w1' });
  assert.equal(result.renamed, false);
  assert.equal(result.warning, 'host refused');
  assert.deepEqual(harness.opened, ['s1']);
});

test('openSession delegates to the workspace navigator', () => {
  const client = loadClient();
  const harness = createContext();
  client.apply(harness.ctx);
  const actions = harness.registered.find(row => row.name === 'main').inject();
  actions.openSession('s9');
  assert.deepEqual(harness.opened, ['s9']);
});

function renderReact() {
  return {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat(Infinity) };
    },
    useMemo(factory) { return factory(); },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
  };
}

const dictionary = {
  title: '试验区', subtitle: '临时 Demo 会话', pathLabel: '目录', nameLabel: 'Demo 名称',
  namePlaceholder: 'Demo 名称', create: '新建并打开', creating: '正在创建…',
  sessions: 'Demo 会话', sessionCount: '{n} 个会话', empty: '还没有 Demo',
  emptyHint: '输入名字创建', unstarted: '未开始', running: '运行中',
  updatedAt: '更新于 {time}', open: '打开会话', loading: '正在准备试验区…',
  unavailable: '试验区工作区未就绪', unavailableHint: '目标路径：{path}。',
  prepareHint: '检查目录权限。', renamedFailed: '命名失败', createFailed: '创建失败：{message}',
};
const translate = key => dictionary[key] ?? key;

test('the page renders the lab Workspace and its Sessions', () => {
  const client = loadClient(renderReact());
  const harness = createContext();
  client.apply(harness.ctx);
  const main = harness.registered.find(row => row.name === 'main');
  const Component = harness.components.get(main);
  const actions = main.inject();
  const workspaces = {
    items: [{ workspaceId: 'w1', title: '试验区', path: 'C:\\Users\\x\\.dsh\\lab', sessionIds: ['s1'] }],
    archivedSessionIds: [],
    state: 'idle',
  };
  const sessions = {
    byId: {
      s1: {
        id: 's1', title: 'Demo A', displayTitle: 'Demo A', blank: false, running: true,
        updatedAt: new Date(2026, 10, 12, 14, 5).getTime(),
      },
    },
  };
  const tree = Component({
    useWorkspaces: selector => selector(workspaces),
    useSessions: selector => selector(sessions),
    useConfig: () => ({ root: '', title: '试验区' }),
    createDemo: actions.createDemo,
    openSession: actions.openSession,
    t: translate,
  });
  const text = textOf(tree).join(' ');
  assert.match(text, /试验区/u);
  assert.match(text, /Demo A/u);
  assert.match(text, /运行中/u);
  assert.match(text, /1 个会话/u);
});

test('the page reports a missing or loading Workspace', () => {
  const client = loadClient(renderReact());
  const harness = createContext();
  client.apply(harness.ctx);
  const main = harness.registered.find(row => row.name === 'main');
  const Component = harness.components.get(main);
  const actions = main.inject();
  const render = (state) => textOf(Component({
    useWorkspaces: selector => selector({ items: [], archivedSessionIds: [], state }),
    useSessions: selector => selector({ byId: {} }),
    useConfig: () => ({ root: '', title: '试验区' }),
    createDemo: actions.createDemo,
    openSession: actions.openSession,
    t: translate,
  })).join(' ');
  assert.match(render('idle'), /工作区未就绪/u);
  assert.match(render('loading'), /正在准备试验区/u);
});
