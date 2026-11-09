/* Daily to-do widget — browser half.
 *
 * Three native seats and one transient notice:
 *   main                 the full to-do page, selected from the sidebar
 *   sidebar.panellist    the navigation icon that selects that page
 *   conversation.composer.dock   a compact entry under the composer
 *   shell.overlay        the due reminder, only while something is overdue
 *
 * The model module owns every state transition; this file owns rendering and
 * one shared store so the page, the dock entry and the notice agree.
 */
window.__ModuleLoader__.load({
  id: '@local/todo-widget',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'todo.widget';
    const PANEL_ID = 'todo-widget';
    /*__MODEL__*/
    /*__LOCALES__*/
    /*__CSS__*/

    const DOC_KEY = 'dsh.todo-widget.doc.v1';
    const TICK_MS = 15000;
    const SNOOZE_MINUTES = 10;

    /* ── storage ───────────────────────────────────────────────────────── */

    function readJson(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    }

    function writeJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }

    /* ── formatting ────────────────────────────────────────────────────── */

    function fill(text, values) {
      return String(text ?? '').replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
    }

    function dayLabel(day, t, now) {
      const date = parseDayKey(day);
      if (!date) return day;
      const sameYear = date.getFullYear() === new Date(now).getFullYear();
      const pattern = t(sameYear ? 'dayFormat' : 'dayFormatYear');
      return `${fill(pattern, { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() })} ${t(`weekday.${date.getDay()}`)}`;
    }

    function dayShort(epoch, t) {
      const date = new Date(epoch);
      return fill(t('dayFormat'), { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() });
    }

    /* ── icons ─────────────────────────────────────────────────────────── */

    function svg(children, size = 16, weight = 1.7) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: weight, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, focusable: 'false',
      }, children);
    }

    function TodoMark(size = 16) {
      return svg([
        h('path', { key: 'a', d: 'M4.2 7.4 6 9.2l3-3.4' }),
        h('path', { key: 'b', d: 'M12.6 7.2h7.2' }),
        h('path', { key: 'c', d: 'M4.2 16.6 6 18.4l3-3.4' }),
        h('path', { key: 'd', d: 'M12.6 16.4h7.2' }),
      ], size);
    }

    const IconCheck = size => svg([h('path', { key: 'c', d: 'M5 12.5 9.5 17 19 7.5' })], size);
    const IconPlus = size => svg([h('path', { key: 'p', d: 'M12 5v14M5 12h14' })], size);
    const IconClose = size => svg([h('path', { key: 'x', d: 'M6 6l12 12M18 6L6 18' })], size);
    const IconClock = size => svg([
      h('circle', { key: 'c', cx: 12, cy: 12, r: 8.5 }),
      h('path', { key: 'h', d: 'M12 7.5V12l3 2' }),
    ], size);
    const IconChevron = (direction, size) => svg([
      h('path', { key: 'a', d: direction === 'left' ? 'M14.5 6 9 12l5.5 6' : 'M9.5 6 15 12l-5.5 6' }),
    ], size);
    const IconTrash = size => svg([
      h('path', { key: 'l', d: 'M4.5 7h15' }),
      h('path', { key: 'b', d: 'M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7' }),
      h('path', { key: 'c', d: 'M6.5 7l.8 11.1A1.9 1.9 0 0 0 9.2 20h5.6a1.9 1.9 0 0 0 1.9-1.9L17.5 7' }),
    ], size);
    const IconPencil = size => svg([
      h('path', { key: 'p', d: 'M4.5 19.5l.9-3.6L16.7 4.6a1.8 1.8 0 0 1 2.5 0l.2.2a1.8 1.8 0 0 1 0 2.5L8.1 18.6z' }),
      h('path', { key: 'l', d: 'M15.4 6l2.6 2.6' }),
    ], size);
    const IconBell = size => svg([
      h('path', { key: 'b', d: 'M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5' }),
      h('path', { key: 'c', d: 'M10.3 19a2 2 0 0 0 3.4 0' }),
    ], size);

    /* ── shared stores ─────────────────────────────────────────────────── */

    function createStore(initial) {
      let doc = normalizeDoc(initial);
      // Probe storage once so the page can report an unwritable origin before
      // the first edit, and so a stale document is compacted on load.
      let writable = writeJson(DOC_KEY, pruneDoc(doc));
      const listeners = new Set();
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };
      const persist = () => {
        const next = writeJson(DOC_KEY, pruneDoc(doc));
        if (next !== writable) writable = next;
      };
      return {
        get: () => doc,
        writable: () => writable,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        update(change) {
          const next = change(doc);
          if (next === doc) return;
          doc = next;
          persist();
          notify();
        },
        adopt(raw) {
          const next = normalizeDoc(raw);
          if (next === doc) return;
          doc = next;
          notify();
        },
      };
    }

    function createClock() {
      let now = Date.now();
      const listeners = new Set();
      return {
        get: () => now,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        tick() {
          now = Date.now();
          for (const listener of [...listeners]) listener();
        },
      };
    }

    function createFocus() {
      let version = 0;
      let day = null;
      let snapshot = { version, day };
      const listeners = new Set();
      const publish = () => {
        snapshot = { version, day };
        for (const listener of [...listeners]) listener();
      };
      return {
        get: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        request(nextDay) {
          day = nextDay;
          version += 1;
          publish();
        },
        consume() {
          if (day === null) return null;
          const value = day;
          day = null;
          publish();
          return value;
        },
      };
    }

    function useSource(source) {
      return React.useSyncExternalStore(source.subscribe, source.get, source.get);
    }

    /* ── page ──────────────────────────────────────────────────────────── */

    function TodoPage({ t, store, clock, focus }) {
      const doc = useSource(store);
      const now = useSource(clock);
      const focusState = useSource(focus);
      const [pinnedDay, setPinnedDay] = React.useState(null);
      const [draft, setDraft] = React.useState('');
      const [draftTime, setDraftTime] = React.useState('');
      const [editing, setEditing] = React.useState(null);

      React.useEffect(() => {
        const requested = focus.consume();
        if (requested !== null) setPinnedDay(requested === dayKeyOf(Date.now()) ? null : requested);
      }, [focusState.version]);

      const today = dayKeyOf(now);
      const day = pinnedDay !== null && parseDayKey(pinnedDay) !== null ? pinnedDay : today;
      const isOtherDay = day !== today;
      const yesterday = shiftDayKey(today, -1);
      const carryCount = day === today ? unfinishedFrom(doc, yesterday).length : 0;
      const items = sortItems(itemsOf(doc, day));
      const stats = dayStats(doc, day, now);
      const settings = doc.settings;

      const submit = event => {
        event.preventDefault();
        const text = draft.trim();
        if (text === '') return;
        const stamp = Date.now();
        store.update(current => addItem(current, day, text, draftTime, stamp));
        setDraft('');
        setDraftTime('');
      };

      const defaultDue = () => clockOf(Date.now() + 30 * 60 * 1000);

      const renderItem = item => {
        const overdue = isOverdue(item, now);
        const editingText = editing !== null && editing.id === item.id && editing.field === 'text';
        const editingDue = editing !== null && editing.id === item.id && editing.field === 'due';
        const editingDone = editing !== null && editing.id === item.id && editing.field === 'done';

        let meta = null;
        if (item.done) {
          const doneText = item.doneAt === null
            ? ''
            : dayKeyOf(item.doneAt) === day
              ? clockOf(item.doneAt)
              : `${dayShort(item.doneAt, t)} ${clockOf(item.doneAt)}`;
          meta = editingDone
            ? h('input', {
              type: 'time', className: 'tdw-time', value: clockOf(item.doneAt), autoFocus: true,
              'aria-label': t('doneAtLabel'),
              onChange: event => {
                if (normalizeTime(event.target.value) !== null) {
                  store.update(current => setItemDoneAt(current, day, item.id, event.target.value));
                }
              },
              onBlur: () => setEditing(null),
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === 'Escape') setEditing(null);
              },
            })
            : h('button', {
              type: 'button', className: 'tdw-meta-link', title: t('changeDoneAt'),
              onClick: () => setEditing({ id: item.id, field: 'done' }),
            }, fill(t('doneAt'), { time: doneText }));
        }

        const side = item.done
          ? null
          : editingDue
            ? h('input', {
              type: 'time', className: 'tdw-time', value: item.dueAt !== null ? clockOf(item.dueAt) : '', autoFocus: true,
              'aria-label': t('remindAt'),
              onChange: event => store.update(current => setItemDue(current, day, item.id, event.target.value)),
              onBlur: () => setEditing(null),
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === 'Escape') setEditing(null);
              },
            })
            : item.dueAt !== null
              ? h('button', {
                type: 'button', className: `tdw-chip${overdue ? ' is-overdue' : ''}`, title: t('changeDue'),
                onClick: () => setEditing({ id: item.id, field: 'due' }),
              }, IconClock(12), h('span', null, clockOf(item.dueAt)))
              : h('button', {
                type: 'button', className: 'tdw-chip is-quiet', title: t('setTime'),
                onClick: () => setEditing({ id: item.id, field: 'due' }),
              }, IconClock(12), h('span', null, t('setTime')));

        const text = editingText
          ? h('input', {
            type: 'text', className: 'tdw-edit', defaultValue: item.text, autoFocus: true,
            maxLength: MAX_TEXT, 'aria-label': t('rename'),
            onKeyDown: event => {
              if (event.key === 'Enter') {
                const value = event.currentTarget.value;
                store.update(current => setItemText(current, day, item.id, value));
                setEditing(null);
              } else if (event.key === 'Escape') {
                setEditing(null);
              }
            },
            onBlur: event => {
              const value = event.currentTarget.value;
              store.update(current => setItemText(current, day, item.id, value));
              setEditing(null);
            },
          })
          : h('span', {
            className: 'tdw-text', title: t('editHint'),
            onDoubleClick: () => setEditing({ id: item.id, field: 'text' }),
          }, item.text);

        return h('li', {
          key: item.id,
          className: `tdw-item${item.done ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}`,
        },
          h('button', {
            type: 'button', role: 'checkbox', 'aria-checked': item.done, className: 'tdw-check',
            'aria-label': item.done ? t('markUndone') : t('markDone'),
            onClick: () => store.update(current => toggleItem(current, day, item.id, Date.now())),
          }, item.done ? IconCheck(11) : null),
          h('div', { className: 'tdw-item-main' },
            text,
            meta !== null ? h('div', { className: 'tdw-meta' }, meta) : null),
          h('div', { className: 'tdw-item-side' },
            side,
            h('div', { className: 'tdw-row-actions' },
              h('button', {
                type: 'button', className: 'tdw-icon', title: t('rename'), 'aria-label': t('rename'),
                onClick: () => setEditing({ id: item.id, field: 'text' }),
              }, IconPencil(14)),
              h('button', {
                type: 'button', className: 'tdw-icon is-danger', title: t('delete'), 'aria-label': t('delete'),
                onClick: () => store.update(current => removeItem(current, day, item.id)),
              }, IconTrash(14)))));
      };

      const subtitle = h('p', { className: 'tdw-sub' },
        fill(t('progress'), { done: stats.done, total: stats.total }),
        stats.overdue > 0 ? h('span', { className: 'tdw-overdue' }, ` · ${fill(t('overdue'), { n: stats.overdue })}`) : null);

      const head = h('header', { className: 'tdw-page-head' },
        h('div', { className: 'tdw-page-copy' },
          h('h1', null, t('title')),
          subtitle),
        isOtherDay
          ? h('button', { type: 'button', className: 'tdw-btn', onClick: () => setPinnedDay(null) }, t('backToday'))
          : null);

      const daybar = h('div', { className: 'tdw-daybar' },
        h('button', {
          type: 'button', className: 'tdw-icon', title: t('prevDay'), 'aria-label': t('prevDay'),
          onClick: () => setPinnedDay(shiftDayKey(day, -1)),
        }, IconChevron('left', 15)),
        h('span', { className: 'tdw-day' },
          day === today ? `${t('today')} · ${dayLabel(day, t, now)}` : dayLabel(day, t, now)),
        h('button', {
          type: 'button', className: 'tdw-icon', title: t('nextDay'), 'aria-label': t('nextDay'),
          onClick: () => setPinnedDay(shiftDayKey(day, 1)),
        }, IconChevron('right', 15)));

      const carryBanner = carryCount > 0
        ? h('div', { className: 'tdw-carry' },
          h('span', { className: 'tdw-carry-text' }, fill(t('carryText'), { n: carryCount })),
          h('div', { className: 'tdw-carry-actions' },
            h('button', {
              type: 'button', className: 'tdw-link',
              onClick: () => setPinnedDay(yesterday),
            }, t('viewYesterday')),
            h('button', {
              type: 'button', className: 'tdw-carry-btn', title: t('carryHint'),
              onClick: () => store.update(current => carryOver(current, yesterday, today, Date.now())),
            }, t('carryAction'))))
        : null;

      const addForm = h('form', { className: 'tdw-add', onSubmit: submit },
        h('input', {
          className: 'tdw-input', value: draft, placeholder: t('placeholder'), 'aria-label': t('placeholder'),
          maxLength: MAX_TEXT, autoComplete: 'off', spellCheck: false, autoFocus: true,
          onChange: event => setDraft(event.target.value),
        }),
        h('button', {
          type: 'button', className: `tdw-icon${draftTime !== '' ? ' is-on' : ''}`, title: t('setTime'),
          'aria-label': t('setTime'), 'aria-pressed': draftTime !== '',
          onClick: () => setDraftTime(draftTime !== '' ? '' : defaultDue()),
        }, IconClock(15)),
        h('button', {
          type: 'submit', className: 'tdw-add-btn', title: t('add'), 'aria-label': t('add'),
          disabled: draft.trim() === '',
        }, t('add')));

      const draftRow = draftTime !== ''
        ? h('div', { className: 'tdw-add-time' },
          h('span', null, t('remindAt')),
          h('input', {
            type: 'time', className: 'tdw-time', value: draftTime, 'aria-label': t('remindAt'),
            onChange: event => setDraftTime(event.target.value),
          }),
          h('button', { type: 'button', className: 'tdw-link', onClick: () => setDraftTime('') }, t('clearTime')))
        : null;

      const list = items.length > 0
        ? h('ul', { className: 'tdw-list' }, items.map(renderItem))
        : h('div', { className: 'tdw-empty' },
          h('span', { className: 'tdw-empty-mark' }, TodoMark(20)),
          h('p', null, isOtherDay ? t('emptyOtherDay') : t('empty')),
          h('p', { className: 'tdw-empty-hint' }, t('emptyHint')));

      const boardFoot = stats.done > 0
        ? h('div', { className: 'tdw-board-foot' },
          h('button', {
            type: 'button', className: 'tdw-link',
            onClick: () => store.update(current => clearCompleted(current, day)),
          }, t('clearDone')))
        : null;

      const settingsSection = h('section', { className: 'tdw-section', 'aria-labelledby': 'tdw-settings-title' },
        h('h2', { id: 'tdw-settings-title', className: 'tdw-section-title' }, t('settings')),
        h('div', { className: 'tdw-row' },
          h('div', { className: 'tdw-row-copy' },
            h('strong', null, t('wrapUpTitle')),
            h('small', null, t('wrapUpHint'))),
          h('div', { className: 'tdw-row-controls' },
            h('input', {
              type: 'checkbox', className: 'tdw-box', checked: settings.wrapUpEnabled,
              'aria-label': t('wrapUpTitle'),
              onChange: event => store.update(current => updateSettings(current, { wrapUpEnabled: event.target.checked })),
            }),
            h('input', {
              type: 'time', className: 'tdw-time', value: settings.wrapUpTime,
              'aria-label': t('wrapUpTime'), disabled: !settings.wrapUpEnabled,
              onChange: event => {
                const value = normalizeTime(event.target.value);
                if (value !== null) store.update(current => updateSettings(current, { wrapUpTime: value }));
              },
            }))),
        h('div', { className: 'tdw-row' },
          h('div', { className: 'tdw-row-copy' },
            h('strong', null, t('showDockTitle')),
            h('small', null, t('showDockHint'))),
          h('div', { className: 'tdw-row-controls' },
            h('input', {
              type: 'checkbox', className: 'tdw-box', checked: settings.showDock !== false,
              'aria-label': t('showDockTitle'),
              onChange: event => store.update(current => updateSettings(current, { showDock: event.target.checked })),
            }))),
        h('p', { className: 'tdw-hint' }, fill(t('snoozeHint'), { n: SNOOZE_MINUTES })),
        h('p', { className: `tdw-hint${store.writable() ? '' : ' is-warning'}` },
          store.writable() ? t('storageHint') : t('storageWarning')));

      return h('section', { className: 'tdw-page', 'aria-label': t('title') },
        h('div', { className: 'tdw-page-inner' },
          head,
          h('div', { className: 'tdw-board' }, daybar, carryBanner, addForm, draftRow, list, boardFoot),
          settingsSection));
    }

    /* ── composer entry ────────────────────────────────────────────────── */

    function TodoDock({ t, store, clock, openPanel }) {
      const doc = useSource(store);
      const now = useSource(clock);
      if (doc.settings.showDock === false) return null;
      const today = dayKeyOf(now);
      const stats = dayStats(doc, today, now);
      return h('button', {
        type: 'button', className: 'tdw-dock', title: t('openPanel'),
        onClick: () => openPanel(today),
      },
        h('span', { className: 'tdw-dock-mark' }, TodoMark(13)),
        h('span', null, t('dockLabel')),
        stats.total > 0 ? h('b', null, `${stats.done}/${stats.total}`) : null,
        stats.overdue > 0 ? h('em', null, fill(t('overdue'), { n: stats.overdue })) : null);
    }

    /* ── reminder notice ───────────────────────────────────────────────── */

    function TodoReminder({ t, store, clock, openPanel }) {
      const doc = useSource(store);
      const now = useSource(clock);
      const reminder = React.useMemo(() => computeReminder(doc, now), [doc, now]);
      const kind = reminder.due.length > 0 ? 'due' : reminder.wrapUp ? 'wrap' : null;
      if (kind === null) return null;

      const rows = kind === 'due' ? reminder.due.slice(0, 4) : unfinishedRecent(doc, reminder.today, 4);
      const more = kind === 'due' ? reminder.due.length - rows.length : 0;
      // An evening due notice and the daily sweep describe the same unfinished
      // work, so acknowledging the notice also settles the sweep. An earlier
      // due notice must not consume a sweep that has not happened yet.
      const scope = kind === 'wrap' ? 'wrapUp' : reminder.wrapUp ? 'all' : 'due';
      const dismiss = () => store.update(current => acknowledgeReminder(current, reminder, Date.now(), scope));
      const snooze = () => store.update(current => snoozeReminder(current, reminder, Date.now(), SNOOZE_MINUTES * 60000));

      return h('section', {
        className: 'tdw-toast', role: 'alertdialog', 'aria-label': t('reminderTitle'),
        onKeyDown: event => {
          if (event.key === 'Escape') dismiss();
        },
      },
        h('header', { className: 'tdw-toast-head' },
          h('span', { className: 'tdw-toast-badge' }, IconBell(14)),
          h('div', { className: 'tdw-toast-titles' },
            h('strong', null, kind === 'due' ? t('dueTitle') : t('wrapTitle')),
            h('span', null, kind === 'due'
              ? fill(t('dueNote'), { n: reminder.due.length })
              : fill(t('wrapNote'), { n: reminder.unfinished }))),
          h('button', {
            type: 'button', className: 'tdw-icon', title: t('dismiss'), 'aria-label': t('dismiss'),
            onClick: dismiss,
          }, IconClose(14))),
        h('ul', { className: 'tdw-toast-list' },
          rows.map(({ day: rowDay, item }) => h('li', { key: `${rowDay}:${item.id}` },
            h('button', {
              type: 'button', className: 'tdw-toast-row',
              onClick: () => openPanel(rowDay),
            },
              h('span', { className: 'tdw-toast-text' }, item.text),
              h('span', { className: `tdw-toast-time${isOverdue(item, now) ? ' is-overdue' : ''}` },
                rowDay === reminder.today
                  ? (item.dueAt !== null ? clockOf(item.dueAt) : '')
                  : dayLabel(rowDay, t, now))))),
          more > 0 ? h('li', { className: 'tdw-toast-more' }, fill(t('more'), { n: more })) : null),
        h('div', { className: 'tdw-toast-actions' },
          h('button', { type: 'button', className: 'tdw-btn', onClick: dismiss }, t('dismiss')),
          h('button', { type: 'button', className: 'tdw-btn is-primary', onClick: snooze },
            fill(t('snooze'), { n: SNOOZE_MINUTES }))));
    }

    function TodoPanelIcon({ size }) {
      return TodoMark(size ?? 18);
    }

    /* ── plugin ────────────────────────────────────────────────────────── */

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        const store = createStore(readJson(DOC_KEY));
        const clock = createClock();
        const focus = createFocus();
        const openPanel = day => {
          if (day !== undefined && day !== null) focus.request(day);
          ctx.layout.selectPanel(PANEL_ID);
        };

        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES));
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@local/todo-widget';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => tag.remove();
        });
        ctx.effect(() => {
          const handle = window.setInterval(() => clock.tick(), TICK_MS);
          const wake = () => {
            if (document.visibilityState !== 'hidden') clock.tick();
          };
          window.addEventListener('focus', wake);
          document.addEventListener('visibilitychange', wake);
          return () => {
            window.clearInterval(handle);
            window.removeEventListener('focus', wake);
            document.removeEventListener('visibilitychange', wake);
          };
        });
        ctx.effect(() => {
          const onStorage = event => {
            if (event.key === null || event.key === DOC_KEY) store.adopt(readJson(DOC_KEY));
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        });

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_ID, locale: NS,
          inject: () => ({ store, clock, focus }),
        }, TodoPage));

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 20, locale: NS,
          label: () => ctx.locale.bind(NS)('title'),
        }, TodoPanelIcon));

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'todo-widget', order: 4, locale: NS,
          inject: () => ({ store, clock, openPanel }),
        }, TodoDock));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'todo-widget.reminder', order: 40, locale: NS,
          inject: () => ({ store, clock, openPanel }),
        }, TodoReminder));
      },
    };
  },
});
