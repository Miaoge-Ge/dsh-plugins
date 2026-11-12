// Public, pure compiler. Theme files contain data only; no CSS selectors or scripts.
export const paletteKeys = ['bg', 'sidebar', 'surface', 'raised', 'text', 'muted', 'accent', 'onAccent', 'line', 'soft', 'code'];

// Small color utility for the few derived tokens the design system needs.
// Inputs are validated six-digit hex colors, so the arithmetic is safe.
function mix(a, b, weight) {
  const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const value = i => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * weight);
  return '#' + [0, 1, 2].map(i => value(i).toString(16).padStart(2, '0')).join('');
}

export function validateTheme(theme) {
  if (!theme || !/^[a-z][a-z0-9-]{1,39}$/.test(theme.id) || theme.id === 'native') throw new Error('Invalid theme id');
  for (const key of ['name']) {
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

  // Canvas and layered surfaces. Each step is a small lift, never a jump, so
  // nested cards and menus read as one material instead of stacked boxes.
  set('alias-bg-base alias-bg-document-preview', p.bg);
  set('alias-bg-layer-1 specific-input-major alias-button-floating-fill', p.surface);
  set('alias-bg-layer-2 alias-bg-overlay specific-menu menu-surface-fill alias-menu-group-header-fill', p.raised);
  set('alias-bg-layer-3 alias-bg-module-platform alias-bg-multi-select specific-selector specific-tip alias-button-floating-hover alias-interactive-bg-hover-solid', p.soft);

  // Type. Primary and secondary are deliberately close in value; the page
  // stays readable in long sessions without grey-on-grey captions.
  set('alias-label-primary alias-label-primary-bluish alias-brand-text alias-menu-icon alias-label-document-preview', p.text);
  set('alias-label-secondary alias-label-primary-dimmed alias-label-tertiary alias-label-caption', p.muted);

  // Accent and its controls. Hover is derived from the accent itself so every
  // palette keeps a believable pressed state instead of a flat fill.
  set('alias-brand-primary alias-brand-primary-new-colorprimary-new-color alias-state-business-primary alias-link alias-button-primary-fill alias-button-info-fill alias-button-info-hover alias-button-contrast-fill focus-ring-color', p.accent);
  set('alias-button-primary-hover', mix(p.accent, dark ? '#ffffff' : '#000000', 0.14));
  set('alias-label-primary-foreground', p.onAccent);
  // Inverted text sits on the inverse neutral surface, not the brand surface.
  set('alias-label-primary-inverted', p.bg);
  set('alias-brand-primary-invert', p.text);
  set('alias-border-l1 alias-border-l2 alias-border-l2-darkmode-thin alias-border-l3 alias-border-l4 alias-button-ghost-active-border elevation-stroke-color', p.line);

  // Interaction fills: a whisper of accent, never a wash of color.
  set('alias-button-primary-dimmed alias-button-elevated-fill alias-button-ghost-active-fill alias-button-ghost-active-hover', p.soft);
  set('alias-interactive-bg-hover', p.accent + (dark ? '1c' : '0f'));
  set('alias-interactive-bg-active alias-interactive-bg-hover-accent', p.accent + '2b');
  set('alias-bg-document-selection', p.accent + '33');
  set('alias-state-business-tertiary specific-bubble specific-bubble-highlight specific-sidebar-nav-item-active-accent', p.soft);

  // DSH 0.2.2-rc.2 added dedicated card, hovercard, toast-action and sidebar
  // surface tokens. Without these the new surfaces keep the native palette and
  // a chosen theme stops at the older controls.
  set('alias-card-fill', p.surface);
  set('alias-card-fill-hover', p.soft);
  set('alias-card-tile-fill', p.soft);
  set('alias-border-selected', p.accent);
  set('alias-label-on-color', p.onAccent);
  set('alias-hovercard-bg', p.raised);
  set('alias-hovercard-label-primary', p.text);
  set('alias-hovercard-label-secondary', p.muted);
  set('alias-hovercard-label-tertiary', p.muted + 'cc');
  // The light toast sits on the inverted `alias-toast-bg` (the primary text
  // colour), so its action uses the on-accent foreground instead of the accent.
  set('alias-toast-action', dark ? p.accent : p.onAccent);
  set('alias-tooltip-label', dark ? p.text : p.bg);
  set('alias-trajectory-accent', p.accent);
  set('specific-guide-hero', p.surface);
  set('specific-file-upload-track', p.soft);

  // Sidebar. The active row is a tinted veil rather than another grey block.
  set('specific-sidebar-fill', p.sidebar);
  set('specific-sidebar-nav-item-active', p.accent + (dark ? '26' : '12'));
  // Translucent glass and wash layers keep the native depth while following
  // the palette; the dark sheet lightens with the raised surface, the light
  // sheet uses the sidebar colour, and the `-clear` pairs fade the gradients
  // to the same hue.
  set('specific-sidebar-tint', p.accent + (dark ? '1f' : '10'));
  set('specific-sidebar-glass-fill', (dark ? p.soft : p.sidebar) + (dark ? '26' : '8c'));
  set('specific-sidebar-glass-hover', p.soft + (dark ? '33' : '4d'));
  set('specific-sidebar-glass-collapsed-fill', dark ? p.soft + '26' : 'transparent');
  set('specific-sidebar-glass-collapsed-hover', dark ? p.soft + '33' : p.accent + '0f');
  set('specific-sidebar-wash-top', p.accent + (dark ? '14' : '1a'));
  set('specific-sidebar-wash-top-clear', p.accent + '00');
  set('specific-sidebar-wash-bottom', p.muted + (dark ? '12' : '17'));
  set('specific-sidebar-wash-bottom-clear', p.muted + '00');
  set('specific-sidebar-right-flash', p.accent + '14');

  // Code and quoting materials.
  set('alias-markdown-code-block alias-markdown-inline-code specific-login-input', p.code);
  set('alias-markdown-code-block-banner', mix(p.code, dark ? '#ffffff' : '#000000', 0.05));
  set('alias-markdown-citation alias-markdown-tag alias-markdown-placeholder alias-markdown-code-segment-selected alias-markdown-code-segment-unselected', p.soft);

  // Chrome details.
  set('alias-scrollbar-bg-l1 alias-scrollbar-bg-l2', p.muted + '4d');
  set('alias-scrollbar-hover-l1 alias-scrollbar-hover-l2', p.muted);
  set('alias-label-dimmed', p.muted + 'a6');
  set('alias-tooltip-bg alias-toast-bg', dark ? p.raised : p.text);
  set('alias-toast-label', dark ? p.text : p.bg);
  set('alias-tooltip-key-bg', dark ? p.soft : mix(p.text, '#ffffff', 0.22));
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
    // The shipped markdown CSS paints headings with the composite `font`
    // shorthand (`font: var(--dsw-font-markdown-h1)`), so overriding only the
    // family token would never reach a heading. Rebuild the shorthand from the
    // host's own weight/size/line-height tokens, keeping its responsive scale.
    if (theme.design === 'editorial' || theme.design === 'organic') {
      const serif = '"Sitka Display", "Palatino Linotype", "Book Antiqua", Charter, Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", SimSun, serif';
      for (const level of [1, 2, 3]) {
        const family = `--dsw-font-markdown-h${level}-font-family`;
        tokens[family] = { light: serif, dark: serif };
        const shorthand = `var(--dsw-font-markdown-h${level}-font-weight) var(--dsw-font-markdown-h${level}-font-size) / var(--dsw-font-markdown-h${level}-line-height) var(${family})`;
        tokens[`--dsw-font-markdown-h${level}`] = { light: shorthand, dark: shorthand };
      }
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
