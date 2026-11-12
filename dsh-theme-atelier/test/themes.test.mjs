import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { themes } from '../catalog.js';
import { compileTheme, validateTheme, contrast, mountLayer } from '../src/tokens.mjs';

test('all palettes keep text, secondary text, links and buttons readable', () => {
  assert.equal(new Set(themes.map(t => t.id)).size, themes.length);
  for (const theme of themes) for (const mode of ['light', 'dark']) {
    const p = theme[mode];
    for (const bg of ['bg', 'sidebar', 'surface', 'raised', 'soft', 'code']) for (const fg of ['text', 'muted', 'accent']) {
      assert.ok(contrast(p[fg], p[bg]) >= 4.5, `${theme.id}/${mode}: ${fg} on ${bg}`);
    }
    assert.ok(contrast(p.accent, p.onAccent) >= 4.5);
  }
});

test('every override has both modes, and inherited semantics stay native', () => {
  for (const theme of themes) {
    const tokens = compileTheme(theme);
    assert.ok(Object.keys(tokens).length > 70);
    for (const [key, pair] of Object.entries(tokens)) {
      assert.match(key, /^--dsw-/);
      assert.equal(typeof pair.light, 'string'); assert.equal(typeof pair.dark, 'string');
    }
    for (const suffix of ['alias-state-error-primary', 'alias-state-success-primary', 'alias-code-diff-added', 'font-family']) assert.equal(tokens[`--dsw-${suffix}`], undefined);
    assert.equal(tokens['--dsh-content-font-size'], undefined);
    assert.equal(compileTheme(theme, false)['--dsw-radius-md'], undefined);
    assert.equal(compileTheme(theme, false)['--dsw-font-markdown-h1-font-family'], undefined);
  }
});

test('covers the rc.2 card, hovercard, notification and sidebar surfaces', () => {
  const surfaces = [
    'alias-card-fill', 'alias-card-fill-hover', 'alias-card-tile-fill', 'alias-border-selected',
    'alias-label-on-color', 'alias-hovercard-bg', 'alias-hovercard-label-primary',
    'alias-hovercard-label-secondary', 'alias-hovercard-label-tertiary', 'alias-toast-action',
    'alias-tooltip-label', 'alias-trajectory-accent', 'specific-guide-hero',
    'specific-file-upload-track', 'specific-sidebar-tint', 'specific-sidebar-glass-fill',
    'specific-sidebar-glass-hover', 'specific-sidebar-glass-collapsed-fill',
    'specific-sidebar-glass-collapsed-hover', 'specific-sidebar-wash-top',
    'specific-sidebar-wash-top-clear', 'specific-sidebar-wash-bottom',
    'specific-sidebar-wash-bottom-clear', 'specific-sidebar-right-flash',
  ];
  for (const theme of themes) {
    const tokens = compileTheme(theme);
    for (const name of surfaces) {
      const pair = tokens[`--dsw-${name}`];
      assert.ok(pair, `${theme.id}: missing --dsw-${name}`);
      assert.equal(typeof pair.light, 'string', `${theme.id}: ${name} needs a light value`);
      assert.equal(typeof pair.dark, 'string', `${theme.id}: ${name} needs a dark value`);
    }
    // Data visualisation and state colours stay native on purpose.
    for (const name of ['alias-chart-messages', 'alias-chart-system', 'alias-chart-tools', 'alias-json-tree-string', 'alias-hovercard-state-done', 'alias-hovercard-state-error']) {
      assert.equal(tokens[`--dsw-${name}`], undefined, `${theme.id}: ${name} must stay native`);
    }
  }
});

test('serif heading tokens reach the shorthand the markdown CSS actually uses', () => {
  for (const theme of themes) {
    const tokens = compileTheme(theme);
    const serif = theme.design === 'editorial' || theme.design === 'organic';
    for (const level of [1, 2, 3]) {
      const family = tokens[`--dsw-font-markdown-h${level}-font-family`];
      const shorthand = tokens[`--dsw-font-markdown-h${level}`];
      if (!serif) {
        assert.equal(family, undefined);
        assert.equal(shorthand, undefined);
        continue;
      }
      assert.match(family.light, /Sitka Display/);
      assert.equal(family.light, family.dark);
      for (const mode of ['light', 'dark']) {
        for (const part of ['font-weight', 'font-size', 'line-height', 'font-family']) {
          assert.ok(shorthand[mode].includes(`var(--dsw-font-markdown-h${level}-${part})`), `${theme.id}/${mode}: h${level} ${part}`);
        }
      }
    }
  }
});

test('layer steps and derived interaction colors stay deliberate', () => {
  for (const theme of themes) {
    const tokens = compileTheme(theme);
    const accent = tokens['--dsw-alias-brand-primary'];
    const hover = tokens['--dsw-alias-button-primary-hover'];
    for (const mode of ['light', 'dark']) {
      const p = theme[mode];
      assert.notEqual(p.bg, p.surface, `${theme.id}/${mode}: surface needs its own layer`);
      assert.match(hover[mode], /^#[0-9a-f]{6}$/);
      assert.notEqual(hover[mode], accent[mode]);
      assert.match(tokens['--dsw-alias-interactive-bg-hover'][mode], /^#[0-9a-f]{6}[0-9a-f]{2}$/);
      assert.match(tokens['--dsw-specific-sidebar-nav-item-active'][mode], /^#[0-9a-f]{6}[0-9a-f]{2}$/);
    }
  }
});

test('theme data stays name-and-palette only', () => {
  for (const theme of themes) {
    assert.deepEqual(Object.keys(theme).sort(), ['dark', 'design', 'id', 'light', 'name', 'radii']);
    assert.ok(theme.name.zh.trim());
    assert.ok(theme.name.en.trim());
    assert.equal(theme.style, undefined);
    assert.equal(theme.description, undefined);
  }
});

test('invalid extension data fails at build boundary', () => {
  for (const patch of [{id:'native'}, {id:'../../bad'}, {name:{}}, {radii:[1]}, {design:'unknown'}, {light:{...themes[0].light, bg:'url(https://example.com)'}}]) {
    assert.throws(() => validateTheme({...themes[0], ...patch}));
  }
});

test('settings adoption replaces only the owned layer; native reset and disposal clean up', () => {
  let state = {status:'loading'}, listener, calls = 0;
  const layers = new Map([['another-plugin', {sentinel:true}]]);
  const theme = {overrideTokens(source, tokens) {
    const current = {tokens}; layers.set(source, current); calls++;
    return () => { if (layers.get(source) === current) layers.delete(source); };
  }};
  const form = {getSnapshot:() => state, subscribe(fn) {listener = fn; return () => {listener = undefined;};}};
  const stop = mountLayer(theme, form, themes);
  assert.equal(calls, 0);
  state = {status:'ready', value:{theme:'obsidian', signature:true}}; listener();
  assert.equal(calls, 1); listener(); assert.equal(calls, 1);
  state = {...state, value:{theme:'paper', signature:false}}; listener();
  assert.equal(calls, 2); assert.equal(layers.size, 2);
  assert.equal(layers.get('@local/dsh-theme-atelier').tokens['--dsw-radius-md'], undefined);
  state = {...state, value:{theme:'native'}}; listener(); assert.equal(layers.size, 1);
  state = {...state, value:{theme:'terminal'}}; listener(); assert.equal(layers.size, 2);
  stop(); stop(); assert.equal(layers.size, 1); assert.equal(listener, undefined);
  assert.deepEqual(layers.get('another-plugin'), {sentinel:true});
});

test('client factory is side-effect free, uses host React, and declares required services', async () => {
  let descriptor;
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {window:{__ModuleLoader__:{load(d){descriptor = d;}}}});
  assert.equal(descriptor.id, '@local/dsh-theme-atelier');
  const imports = [];
  const client = descriptor.factory(name => { imports.push(name); return {createElement(){}}; });
  assert.deepEqual(imports, ['react']);
  assert.deepEqual(Array.from(client.inject), ['slots', 'theme', 'configForms', 'locale']);
  assert.equal(typeof client.apply, 'function');
});

test('metadata, translated UI and distributable entry points are complete', async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const zh = JSON.parse(await read('locale/zh.json')), en = JSON.parse(await read('locale/en.json'));
  assert.deepEqual(Object.keys(zh.ui).sort(), Object.keys(en.ui).sort());
  for (const locale of [zh,en]) {assert.ok(locale.meta.title); assert.ok(locale.meta.description);}
  const manifest = JSON.parse(await read('package.json'));
  assert.equal(manifest.dsh.client.platform, 'web');
  for (const key of ['.', './client', './icon']) assert.ok((await read(manifest.exports[key])).length);
  const css = await read('src/style.css');
  assert.ok(css.includes('prefers-reduced-motion')); assert.ok(css.includes('forced-colors'));
  assert.ok(!css.includes('!important') || css.includes('prefers-reduced-motion'));
  assert.ok(!/https?:|@import|url\(/.test(css));
});
