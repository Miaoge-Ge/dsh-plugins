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

    function PaletteMark({ size = 18 }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M4 19 10 5h4l6 14h-5l-1.4-4H9.4L8 19z', fill: 'currentColor' }));
    }

    // One card per design family. The swatch band is painted from the theme's own
    // palette in the active scheme, so the choice reads as colour rather than as
    // a screenshot of a fake workspace.
    function ThemeCard({ theme, scheme, applied, disabled, onPick, t }) {
      const p = theme[scheme];
      return h('button', {
        type: 'button', className: 'at-card', 'aria-pressed': applied, disabled,
        'aria-label': `${t(`${theme.id}.name`)} · ${t(`${theme.id}.style`)}`,
        title: t(`${theme.id}.description`), onClick: () => onPick(theme.id),
      },
        h('span', { className: 'at-swatch', 'aria-hidden': true },
          h('i', { style: { background: p.bg } }),
          h('i', { style: { background: p.sidebar } }),
          h('i', { style: { background: p.surface } }),
          h('i', { style: { background: p.accent } })),
        h('span', { className: 'at-card-body' },
          h('strong', null, t(`${theme.id}.name`)),
          h('small', null, t(`${theme.id}.style`))),
        h('span', {className:'at-card-description'}, t(`${theme.id}.description`)),
        h('span', { className: 'at-card-state' }, applied ? t('applied') : '\u2192'),
      );
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
      const currentLabel = selected ? t(`${selected.id}.name`) : t('native');

      return h('section', { className: 'at-page', 'aria-label': t('title'), 'aria-busy': pending },
        h('header', { className: 'at-head' },
          h('div', { className: 'at-head-main' },
            h('h1', null, t('title')),
            h('p', null, `${t('current')} \u00b7 ${currentLabel}`)),
          h('button', {
            type: 'button', className: 'at-btn', disabled: locked || value.theme === 'native',
            onClick: () => run(() => save('theme', 'native')),
          }, t('restore'))),

        !compatible ? h('p', { className: 'at-note', role: 'alert' }, t('unsupported')) : null,
        settings.status !== 'ready' ? h('p', { className: 'at-note', role: 'status' }, t(settings.status === 'unavailable' ? 'unavailable' : 'loading')) : null,
        settings.status === 'ready' && !settings.writable ? h('p', { className: 'at-note' }, t('readOnly')) : null,

        h('div', { className: 'at-grid' }, themes.map(theme => h(ThemeCard, {
          key: theme.id, theme, scheme, t,
          applied: value.theme === theme.id,
          disabled: locked,
          onPick: id => run(() => save('theme', id)),
        }))),

        h('div', { className: 'at-settings' },
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
            }, h('span')))),

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
          for (const theme of themes) for (const key of ['name', 'description', 'style']) locale[lang][`${theme.id}.${key}`] = theme[key][lang];
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
