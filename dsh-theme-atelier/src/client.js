window.__ModuleLoader__.load({
  id: '@local/dsh-theme-atelier',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'theme.atelier';
    /*__CATALOG__*/
    /*__CORE__*/
    /*__LOCALES__*/
    /*__STYLES__*/

    const SERIF = '"Sitka Display", "Palatino Linotype", "Book Antiqua", Charter, Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", SimSun, serif';

    // Native is a selectable choice like every theme, so the panel needs a
    // representative palette for its preview. It follows the host's default
    // light/dark surfaces and blue accent, but is never installed as a theme
    // layer: choosing it simply releases this plugin's overrides.
    const NATIVE = {
      id: 'native',
      design: 'minimal',
      radii: [4, 6, 8, 10, 12, 14],
      light: {
        bg: '#ffffff', sidebar: '#f5f6f8', surface: '#ffffff', raised: '#ffffff',
        text: '#1f2329', muted: '#5c6370', accent: '#4176e6', line: '#e4e7ec',
        soft: '#f0f2f5', code: '#f7f8fa',
      },
      dark: {
        bg: '#151517', sidebar: '#101012', surface: '#1c1d20', raised: '#232428',
        text: '#e8eaed', muted: '#a0a4ab', accent: '#7aaaff', line: '#33353a',
        soft: '#292a2e', code: '#191a1d',
      },
    };

    function PaletteMark({ size = 18 }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M4 19 10 5h4l6 14h-5l-1.4-4H9.4L8 19z', fill: 'currentColor' }));
    }

    function CheckMark() {
      return h('svg', { viewBox: '0 0 12 12', width: 10, height: 10, fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M2.2 6.2 4.8 8.8 9.8 3.4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function previewStyle(palette, theme) {
      return {
        '--pv-bg': palette.bg,
        '--pv-sidebar': palette.sidebar,
        '--pv-surface': palette.surface,
        '--pv-raised': palette.raised,
        '--pv-text': palette.text,
        '--pv-muted': palette.muted,
        '--pv-accent': palette.accent,
        '--pv-line': palette.line,
        '--pv-soft': palette.soft,
        '--pv-rad': `${Math.min(theme.radii[2], 10)}px`,
        '--pv-font': theme.design === 'editorial' || theme.design === 'organic' ? SERIF : 'inherit',
      };
    }

    // A miniature work surface painted from one palette. The theme name sits
    // in the window's title bar, so the label cannot be mistaken for a caption
    // that belongs to some other card.
    function ThemePreview({ theme, scheme, label, applied }) {
      return h('span', { className: 'at-stage', style: previewStyle(theme[scheme], theme), 'aria-hidden': true },
        h('span', { className: 'at-topbar' },
          h('span', { className: 'at-topbar-dot' }),
          h('span', { className: 'at-topbar-name' }, label),
          applied ? h('span', { className: 'at-topbar-check' }, h(CheckMark)) : null),
        h('span', { className: 'at-workspace' },
          h('span', { className: 'at-rail' },
            h('span', { className: 'at-rail-mark' }),
            h('span', { className: 'at-rail-line at-w70' }),
            h('span', { className: 'at-rail-line at-w50' }),
            h('span', { className: 'at-rail-line at-w60' })),
          h('span', { className: 'at-main' },
            h('span', { className: 'at-type' }, 'Aa'),
            h('span', { className: 'at-text-line at-w90' }),
            h('span', { className: 'at-mini-card' },
              h('span', { className: 'at-mini-line at-w60' }),
              h('span', { className: 'at-mini-line at-w90' })),
            h('span', { className: 'at-cta' }))));
    }

    function ThemeCard({ theme, scheme, label, applied, disabled, onPick, t }) {
      return h('button', {
        type: 'button', className: 'at-card', 'aria-pressed': applied, disabled,
        'aria-label': `${label}${applied ? ` · ${t('applied')}` : ''}`,
        onClick: () => onPick(theme.id),
      },
        h(ThemePreview, { theme, scheme, label, applied }));
    }

    function Atelier({ t, useSettings, useTheme, save, setMode, compatible }) {
      const settings = useSettings(), current = useTheme();
      const [pending, setPending] = React.useState(false), [message, setMessage] = React.useState('');
      const value = settings.value ?? {};
      const scheme = current?.active?.colorScheme === 'dark' ? 'dark' : 'light';
      const selected = themes.find(theme => theme.id === value.theme);
      const locked = pending || settings.status !== 'ready' || !settings.writable || !compatible;
      const run = async operation => {
        setPending(true); setMessage('');
        try { setMessage(t(await operation() ? 'saved' : 'saveError')); }
        catch { setMessage(t('saveError')); }
        finally { setPending(false); }
      };
      const currentPalette = selected ? selected[scheme] : NATIVE[scheme];
      const currentLabel = selected ? t(`${selected.id}.name`) : t('native');
      const choices = [...themes, NATIVE];

      return h('section', { className: 'at-page', 'aria-label': t('title'), 'aria-busy': pending },
        h('header', { className: 'at-head' },
          h('div', { className: 'at-head-copy' },
            h('h1', null, t('title')),
            h('p', { className: 'at-subtitle' }, t('subtitle')),
            h('p', { className: 'at-current' },
              h('i', { style: { background: currentPalette.accent }, 'aria-hidden': true }),
              `${t('current')} · ${currentLabel} · ${t(scheme)}`))),

        !compatible ? h('p', { className: 'at-note', role: 'alert' }, t('unsupported')) : null,
        settings.status !== 'ready' ? h('p', { className: 'at-note', role: 'status' }, t(settings.status === 'unavailable' ? 'unavailable' : 'loading')) : null,
        settings.status === 'ready' && !settings.writable ? h('p', { className: 'at-note' }, t('readOnly')) : null,

        h('section', { className: 'at-gallery', 'aria-label': t('collection') },
          h('div', { className: 'at-grid' }, choices.map(theme => {
            const label = theme.id === 'native' ? t('native') : t(`${theme.id}.name`);
            return h(ThemeCard, {
              key: theme.id, theme, scheme, label, t,
              applied: value.theme === theme.id,
              disabled: locked,
              onPick: id => run(() => save('theme', id)),
            });
          }))),

        h('section', { className: 'at-settings', 'aria-labelledby': 'at-settings-title' },
          h('div', { className: 'at-section-head' },
            h('h2', { id: 'at-settings-title' }, t('makeItYours'))),
          h('div', { className: 'at-panel' },
            h('div', { className: 'at-row' },
              h('div', { className: 'at-row-copy' },
                h('h3', null, t('appearance')),
                h('p', null, t('appearanceDescription'))),
              h('div', { className: 'at-segment', role: 'group', 'aria-label': t('appearance') },
                ['light', 'dark', 'system'].map(mode => h('button', {
                  key: mode, type: 'button', 'aria-pressed': current?.preference === mode, disabled: locked,
                  onClick: () => run(() => setMode(mode)),
                }, t(mode))))),
            h('div', { className: 'at-row' },
              h('div', { className: 'at-row-copy' },
                h('h3', null, t('signature')),
                h('p', null, t('signatureDescription'))),
              h('button', {
                type: 'button', className: 'at-switch', role: 'switch', 'aria-label': t('signature'),
                'aria-checked': value.signature !== false, disabled: locked,
                onClick: () => run(() => save('signature', value.signature === false)),
              }, h('span'))))),

        h('p', { className: 'at-foot' }, t('footer')),
        h('p', { className: 'at-status', role: 'status', 'aria-live': 'polite' }, pending ? t('saving') : message));
    }

    return {
      inject: ['slots', 'theme', 'configForms', 'locale'],
      apply(ctx) {
        const compatible = typeof ctx.theme.overrideTokens === 'function';
        const form = ctx.configForms.get('theme-atelier');
        const nativeForm = ctx.configForms.get('ui-theme');
        const locale = {};
        for (const lang of ['zh', 'en']) {
          locale[lang] = { ...dictionaries[lang].ui };
          for (const theme of themes) locale[lang][`${theme.id}.name`] = theme.name[lang];
        }
        ctx.effect(() => ctx.locale.register(NS, locale));
        if (compatible) ctx.effect(() => mountLayer(ctx.theme, form, themes));
        // Styles belong to the plugin lifecycle, never mutate host stylesheet rules.
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@local/dsh-theme-atelier';
          tag.textContent = styles;
          document.head.appendChild(tag);
          return () => tag.remove();
        });
        const subscribeForm = notify => form.subscribe(notify);
        const getForm = () => form.getSnapshot();
        const subscribeTheme = notify => ctx.on('theme/change', notify);
        const getTheme = () => ctx.theme.getTheme();
        const actions = {
          compatible,
          useSettings: () => React.useSyncExternalStore(subscribeForm, getForm, getForm),
          useTheme: () => React.useSyncExternalStore(subscribeTheme, getTheme, getTheme),
          save: (field, value) => form.set(field, value),
          // Use the native settings queue so failures reach this panel and every
          // Appearance control follows the same accepted preference.
          setMode: mode => nativeForm.set('preference', mode),
        };
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'theme-atelier', order: 5, locale: NS,
          label: () => ctx.locale.bind(NS)('title'), inject: () => actions,
        }, Atelier));
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon', id: 'theme-atelier',
        }, PaletteMark));
      },
    };
  },
});
