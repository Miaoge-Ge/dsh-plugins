// Public, pure compiler. Theme files contain data only; no CSS selectors or scripts.
export const paletteKeys = ['bg', 'sidebar', 'surface', 'raised', 'text', 'muted', 'accent', 'onAccent', 'line', 'soft', 'code'];
export function validateTheme(theme) {
  if (!theme || !/^[a-z][a-z0-9-]{1,39}$/.test(theme.id) || theme.id === 'native') throw new Error('Invalid theme id');
  for (const key of ['name', 'description', 'style']) {
    if (!theme[key] || ['zh', 'en'].some(lang => typeof theme[key][lang] !== 'string' || !theme[key][lang].trim())) throw new Error(`${theme.id}: ${key} requires zh and en`);
  }
  if (!['minimal', 'editorial', 'glass', 'organic', 'geometric', 'terminal'].includes(theme.design)) throw new Error(`${theme.id}: invalid design`);
  if (!Array.isArray(theme.radii) || theme.radii.length !== 6 || theme.radii.some(x => !Number.isInteger(x) || x < 0 || x > 40)) throw new Error(`${theme.id}: invalid radii`);
  for (const mode of ['light', 'dark']) {
    for (const key of paletteKeys) if (!/^#[\da-f]{6}$/i.test(theme[mode]?.[key] ?? '')) throw new Error(`${theme.id}.${mode}.${key}: use a six-digit hex color`);
  }
  return theme;
}

export function contrast(a, b) {
  const luma = hex => {
    const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luma(a), y = luma(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function paletteTokens(p, dark) {
  const t = {};
  const set = (names, value) => names.split(' ').forEach(name => { t[`--dsw-${name}`] = value; });
  set('alias-bg-base alias-bg-document-preview', p.bg);
  set('alias-bg-layer-1 specific-input-major alias-button-floating-fill', p.surface);
  set('alias-bg-layer-2 alias-bg-overlay specific-menu menu-surface-fill alias-menu-group-header-fill', p.raised);
  set('alias-bg-layer-3 alias-bg-module-platform alias-bg-multi-select specific-selector specific-tip alias-button-floating-hover alias-interactive-bg-hover-solid', p.soft);
  set('alias-label-primary alias-label-primary-bluish alias-brand-text alias-menu-icon alias-label-document-preview', p.text);
  set('alias-label-secondary alias-label-primary-dimmed alias-label-tertiary alias-label-caption', p.muted);
  set('alias-brand-primary alias-brand-primary-new-colorprimary-new-color alias-state-business-primary alias-link alias-button-primary-fill alias-button-info-fill alias-button-info-hover alias-button-contrast-fill focus-ring-color', p.accent);
  set('alias-label-primary-foreground', p.onAccent);
  // Inverted text sits on the inverse neutral surface, not the brand surface.
  set('alias-label-primary-inverted', p.bg);
  set('alias-brand-primary-invert', p.text);
  set('alias-border-l1 alias-border-l2 alias-border-l2-darkmode-thin alias-border-l3 alias-border-l4 alias-button-ghost-active-border elevation-stroke-color', p.line);
  set('alias-button-primary-hover', p.accent);
  set('alias-button-primary-dimmed alias-button-elevated-fill alias-button-ghost-active-fill alias-button-ghost-active-hover', p.soft);
  set('alias-interactive-bg-hover', p.accent + (dark ? '16' : '0c'));
  set('alias-interactive-bg-active alias-interactive-bg-hover-accent alias-bg-document-selection', p.accent + '28');
  set('alias-state-business-tertiary specific-bubble specific-bubble-highlight specific-sidebar-nav-item-active-accent', p.soft);
  set('specific-sidebar-fill', p.sidebar);
  set('specific-sidebar-nav-item-active', p.soft);
  set('alias-markdown-code-block alias-markdown-code-block-banner alias-markdown-inline-code specific-login-input', p.code);
  set('alias-markdown-citation alias-markdown-tag alias-markdown-placeholder alias-markdown-code-segment-selected alias-markdown-code-segment-unselected', p.soft);
  set('alias-scrollbar-bg-l1 alias-scrollbar-bg-l2', p.muted + '66');
  set('alias-scrollbar-hover-l1 alias-scrollbar-hover-l2', p.muted);
  set('alias-label-dimmed', p.muted + '99');
  set('alias-tooltip-bg alias-toast-bg', dark ? p.raised : p.text);
  set('alias-toast-label', dark ? p.text : p.bg);
  set('alias-tooltip-key-bg', dark ? p.soft : p.muted);
  set('alias-turn-trigger-bg', p.surface);
  set('alias-turn-trigger-bg-hover', p.soft);
  set('alias-switch-thumb', dark ? p.text : '#ffffff');
  set('alias-label-deep-diving alias-label-deep-diving-shimmer', p.accent);
  set('alias-illustration-background', p.surface);
  set('alias-illustration-backing alias-illustration-inset alias-illustration-shadow', p.soft);
  set('alias-illustration-surface', p.raised);
  set('alias-illustration-detail', p.muted);
  // Success/error/diff colors, syntax highlighting, masks, sizing and user fonts
  // deliberately inherit the native light/dark design system.
  return t;
}

export function compileTheme(theme, signature = true) {
  validateTheme(theme);
  const light = paletteTokens(theme.light, false), dark = paletteTokens(theme.dark, true);
  const tokens = Object.fromEntries(Object.keys(light).map(key => [key, { light: light[key], dark: dark[key] }]));
  if (signature) {
    ['xs', 'sm', 'md', 'lg', 'xl', 'panel'].forEach((name, i) => {
      tokens[`--dsw-radius-${name}`] = { light: `${theme.radii[i]}px`, dark: `${theme.radii[i]}px` };
    });
    // Public heading tokens: editorial character without touching body/code fonts.
    if (theme.design === 'editorial' || theme.design === 'organic') {
      const serif = '"Iowan Old Style", "Palatino Linotype", "Songti SC", "SimSun", Georgia, serif';
      for (const level of [1, 2]) tokens[`--dsw-font-markdown-h${level}-font-family`] = { light: serif, dark: serif };
    }
  }
  return tokens;
}

// Settings subscription owns one replaceable layer. Cleanup never resets other plugins.
export function mountLayer(themeService, form, catalog) {
  let release, previous, disposed = false;
  const sync = () => {
    if (disposed) return;
    const state = form.getSnapshot();
    if (state.status !== 'ready' || !state.value) return;
    const theme = catalog.find(item => item.id === state.value.theme);
    const key = `${theme?.id ?? 'native'}:${state.value.signature !== false}`;
    if (key === previous) return;
    previous = key;
    if (theme) {
      // Replacing the same source is atomic in ThemeRuntime. The old disposer
      // cannot remove the new layer, avoiding a native-palette flash on switch.
      const next = themeService.overrideTokens('@local/dsh-theme-atelier', compileTheme(theme, state.value.signature !== false));
      release?.();
      release = next;
    } else {
      release?.();
      release = undefined;
    }
  };
  const unsubscribe = form.subscribe(sync);
  sync();
  return () => { disposed = true; unsubscribe(); release?.(); release = undefined; };
}
