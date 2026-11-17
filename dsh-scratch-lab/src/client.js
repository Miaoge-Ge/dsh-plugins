/* Scratch lab — browser half.
 *
 * One sidebar entry and one page. The page never stores demo state itself:
 * Sessions are the source of truth, so the native sidebar, archive actions and
 * restart persistence all keep working unchanged.
 */
window.__ModuleLoader__.load({
  id: '@local/scratch-lab',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'scratch.lab';
    const PANEL_ID = 'scratch-lab';
    /*__MODEL__*/
    /*__LOCALES__*/
    /*__CSS__*/

    function LabIcon({ size = 18, active = false }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        'aria-hidden': true, focusable: 'false',
        stroke: 'currentColor', strokeWidth: active ? 1.9 : 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      },
        h('path', { key: 'neck', d: 'M9.2 3h5.6' }),
        h('path', { key: 'body', d: 'M10.2 3v5.1L5.6 16.8A3 3 0 0 0 8.3 21h7.4a3 3 0 0 0 2.7-4.2L13.8 8.1V3' }),
        h('path', { key: 'level', d: 'M7.6 14.2h8.8' }));
    }

    function timeText(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
      try {
        return new Intl.DateTimeFormat(undefined, {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(new Date(value));
      } catch {
        return '';
      }
    }

    function sessionLabel(row, t) {
      if (typeof row.title === 'string' && row.title.trim() !== '') return row.title;
      if (row.blank === true) return t('unstarted');
      return row.displayTitle || row.id;
    }

    function sessionMeta(row, t) {
      const parts = [];
      if (row.running === true) parts.push(t('running'));
      const time = timeText(row.updatedAt);
      if (time !== '') parts.push(fill(t('updatedAt'), { time }));
      return parts.join(' \u00b7 ');
    }

    function LabPanel({ useWorkspaces, useSessions, useConfig, createDemo, openSession, t }) {
      const config = useConfig();
      const items = useWorkspaces(snapshot => snapshot.items);
      const archived = useWorkspaces(snapshot => snapshot.archivedSessionIds);
      const workspaceState = useWorkspaces(snapshot => snapshot.state);
      const sessionState = useSessions(snapshot => snapshot);
      const workspace = React.useMemo(
        () => findLabWorkspace(items, config.title, config.root),
        [items, config.title, config.root],
      );
      const rows = React.useMemo(
        () => listLabSessions(workspace, sessionState, archived),
        [workspace, sessionState, archived],
      );
      const [name, setName] = React.useState('');
      const [pending, setPending] = React.useState(false);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const unavailable = workspace === undefined;
      const loading = unavailable && workspaceState === 'loading';
      const path = workspace?.path ?? (config.root || DEFAULT_LAB_DISPLAY);

      const submit = async event => {
        event.preventDefault();
        if (pending || unavailable) return;
        setPending(true);
        setError('');
        setNotice('');
        try {
          const result = await createDemo({ name, workspaceId: workspace.workspaceId });
          setName('');
          if (!result.renamed) setNotice(t('renamedFailed'));
        } catch (failure) {
          setError(fill(t('createFailed'), {
            message: failure instanceof Error ? failure.message : String(failure),
          }));
        } finally {
          setPending(false);
        }
      };

      return h('section', { className: 'sc-page', 'aria-label': t('title') },
        h('div', { className: 'sc-inner' },
          h('header', { className: 'sc-head' },
            h('div', { className: 'sc-head-copy' },
              h('h1', null, t('title')),
              h('p', { className: 'sc-sub' }, t('subtitle'))),
            h('p', { className: 'sc-path' },
              h('span', null, t('pathLabel')),
              h('code', { title: path }, path))),

          unavailable
            ? loading
              ? h('p', { className: 'sc-alert sc-alert-note', role: 'status' }, t('loading'))
              : h('div', { className: 'sc-alert', role: 'alert' },
                  h('strong', null, t('unavailable')),
                  h('p', null, fill(t('unavailableHint'), { path })),
                  h('p', null, t('prepareHint')))
            : null,

          h('form', { className: 'sc-create', onSubmit: submit },
            h('label', { className: 'sc-field' },
              h('span', null, t('nameLabel')),
              h('input', {
                value: name,
                onChange: event => setName(event.target.value),
                placeholder: t('namePlaceholder'),
                maxLength: 120,
                disabled: pending || unavailable,
                autoFocus: true,
              })),
            h('button', {
              type: 'submit',
              className: 'sc-primary',
              disabled: pending || unavailable,
            }, pending ? t('creating') : t('create'))),

          error !== ''
            ? h('p', { className: 'sc-alert sc-alert-error', role: 'alert' }, error)
            : null,
          notice !== ''
            ? h('p', { className: 'sc-alert sc-alert-note', role: 'status' }, notice)
            : null,

          h('section', { className: 'sc-list', 'aria-label': t('sessions') },
            h('div', { className: 'sc-list-head' },
              h('h2', null, t('sessions')),
              h('span', null, fill(t('sessionCount'), { n: rows.length }))),
            rows.length === 0
              ? h('div', { className: 'sc-empty' },
                  h('strong', null, t('empty')),
                  h('p', null, t('emptyHint')))
              : h('ul', { className: 'sc-rows' }, rows.map(row => {
                  const label = sessionLabel(row, t);
                  const meta = sessionMeta(row, t);
                  return h('li', { key: row.id },
                    h('button', {
                      type: 'button',
                      className: 'sc-row',
                      onClick: () => openSession(row.id),
                      'aria-label': `${t('open')} ${label}`,
                    },
                      h('span', { className: 'sc-row-main' },
                        h('strong', null, label),
                        meta !== '' ? h('span', { className: 'sc-row-meta' }, meta) : null),
                      h('span', { className: 'sc-row-arrow', 'aria-hidden': true }, '\u203a')));
                })))));
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'remote', 'uiWorkspace', 'configForms'],
      apply(ctx) {
        const sessions = ctx.get('sessions');
        const uiWorkspace = ctx.get('uiWorkspace');
        const rawForm = ctx.configForms.get('scratch-lab');
        const form = rawForm ?? {
          subscribe: () => () => {},
          getSnapshot: () => ({ status: 'unavailable' }),
        };
        const subscribeConfig = notify => form.subscribe(notify);
        const readConfig = () => form.getSnapshot();
        const useConfig = () => {
          const snapshot = React.useSyncExternalStore(subscribeConfig, readConfig, readConfig);
          const value = snapshot?.status === 'ready' ? snapshot.value : undefined;
          const root = typeof value?.root === 'string' ? value.root : '';
          const title = typeof value?.title === 'string' && value.title.trim() !== ''
            ? value.title.trim()
            : DEFAULT_LAB_TITLE;
          return { root, title };
        };

        const createDemo = async ({ name, workspaceId }) => {
          const title = cleanDemoName(name, Date.now());
          const sessionId = await sessions.create({ workspaceId });
          let renamed = true;
          let warning = '';
          try {
            const result = await ctx.remote.session.rename({ sessionId, title });
            if (!result?.ok) {
              renamed = false;
              warning = result?.error?.message ?? 'rename failed';
            }
          } catch (failure) {
            renamed = false;
            warning = failure instanceof Error ? failure.message : String(failure);
          }
          uiWorkspace.openSession(sessionId);
          void sessions.refresh().catch(() => {});
          return { sessionId, title, renamed, warning };
        };

        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES));
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.plugin = '@local/scratch-lab';
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        });

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 24,
          locale: NS,
          label: () => ctx.locale.bind(NS)('title'),
        }, LabIcon));

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({
            useConfig,
            createDemo,
            openSession: target => uiWorkspace.openSession(target),
          }),
        }, LabPanel));
      },
    };
  },
});
