import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DAYS,
  SNOOZE_MS,
  acknowledgeReminder,
  addItem,
  carryOver,
  clearCompleted,
  clockOf,
  computeReminder,
  dayKeyOf,
  dayStats,
  emptyDoc,
  itemsOf,
  normalizeDoc,
  normalizeTime,
  pruneDoc,
  removeItem,
  setItemDoneAt,
  setItemDue,
  setItemText,
  shiftDayKey,
  snoozeReminder,
  sortItems,
  timeAtDay,
  toggleItem,
  unfinishedFrom,
  unfinishedRecent,
  updateSettings,
} from '../src/model.mjs';

/** Local wall-clock epoch, so the suite never depends on the machine zone. */
function at(year, month, day, hours = 0, minutes = 0) {
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

const DAY = '2026-11-09';
const NOON = at(2026, 11, 9, 12, 0);

function item(overrides = {}) {
  return {
    id: overrides.id ?? 'x1',
    text: overrides.text ?? '写周报',
    createdAt: overrides.createdAt ?? at(2026, 11, 9, 9, 0),
    dueAt: overrides.dueAt ?? null,
    done: overrides.done ?? false,
    doneAt: overrides.doneAt ?? null,
    remindedAt: overrides.remindedAt ?? null,
    snoozeUntil: overrides.snoozeUntil ?? null,
  };
}

function docWith(dayItems, settings = {}) {
  return { ...emptyDoc(), days: { ...dayItems }, settings: { ...emptyDoc().settings, ...settings } };
}

test('day keys follow local midnight, not UTC', () => {
  assert.equal(dayKeyOf(at(2026, 11, 9, 0, 5)), DAY);
  assert.equal(dayKeyOf(at(2026, 11, 9, 23, 55)), DAY);
  assert.equal(dayKeyOf(at(2026, 12, 31, 23, 59)), '2026-12-31');
  assert.equal(shiftDayKey(DAY, 1), '2026-11-10');
  assert.equal(shiftDayKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01');
});

test('clock parsing rejects impossible values and normalizes padding', () => {
  assert.equal(normalizeTime('9:05'), '09:05');
  assert.equal(normalizeTime('23:59'), '23:59');
  assert.equal(normalizeTime('24:00'), null);
  assert.equal(normalizeTime('9:5'), null);
  assert.equal(normalizeTime(''), null);
  assert.equal(normalizeTime('noon'), null);
  assert.equal(clockOf(timeAtDay(DAY, '8:07')), '08:07');
  assert.equal(timeAtDay('2026-02-30', '10:00'), null);
});

test('normalizeDoc rebuilds a trusted document from storage noise', () => {
  const doc = normalizeDoc({
    v: 1,
    days: {
      [DAY]: [
        { id: 'a', text: '  买牛奶  ', createdAt: at(2026, 11, 9, 8, 0), dueAt: at(2026, 11, 9, 18, 0), done: false },
        { id: 'b', text: '', createdAt: NOON },
        { id: 'a', text: '重复 id', createdAt: NOON },
        { id: 'c', text: '完成项', done: true },
      ],
      'nope': [{ text: '丢弃', createdAt: NOON }],
    },
    settings: { wrapUpTime: '25:00' },
  }, NOON);
  assert.deepEqual(Object.keys(doc.days), [DAY]);
  const items = itemsOf(doc, DAY);
  assert.equal(items.length, 2);
  assert.equal(items[0].text, '买牛奶');
  assert.equal(items[1].text, '完成项');
  // A completed item without a completion stamp inherits its creation time.
  assert.equal(items[1].createdAt, NOON);
  assert.equal(items[1].doneAt, NOON);
  assert.equal(doc.settings.wrapUpTime, '18:00');
  assert.equal(doc.settings.wrapUpEnabled, true);
});

test('normalizeDoc refuses a document from a newer schema', () => {
  const doc = normalizeDoc({ v: 99, days: { [DAY]: [item()] } });
  assert.deepEqual(doc.days, {});
});

test('the composer entry preference defaults on and only an explicit false turns it off', () => {
  assert.equal(normalizeDoc({ v: 1 }).settings.showDock, true);
  assert.equal(normalizeDoc({ v: 1, settings: { showDock: false } }).settings.showDock, false);
  assert.equal(normalizeDoc({ v: 1, settings: { showDock: 'no' } }).settings.showDock, true);
  assert.equal(updateSettings(emptyDoc(), { showDock: false }).settings.showDock, false);
});

test('add, rename, reschedule, complete and delete one item', () => {
  let doc = emptyDoc();
  doc = addItem(doc, DAY, '  写周报  ', '18:00', NOON);
  assert.equal(itemsOf(doc, DAY).length, 1);
  const id = itemsOf(doc, DAY)[0].id;
  assert.equal(itemsOf(doc, DAY)[0].text, '写周报');
  assert.equal(itemsOf(doc, DAY)[0].dueAt, at(2026, 11, 9, 18, 0));

  doc = setItemText(doc, DAY, id, '写月报');
  assert.equal(itemsOf(doc, DAY)[0].text, '写月报');
  doc = setItemText(doc, DAY, id, '   ');
  assert.equal(itemsOf(doc, DAY)[0].text, '写月报');

  doc = toggleItem(doc, DAY, id, NOON);
  assert.equal(itemsOf(doc, DAY)[0].done, true);
  assert.equal(itemsOf(doc, DAY)[0].doneAt, NOON);
  assert.equal(itemsOf(doc, DAY)[0].remindedAt, null);

  doc = setItemDoneAt(doc, DAY, id, '10:30');
  assert.equal(clockOf(itemsOf(doc, DAY)[0].doneAt), '10:30');

  doc = toggleItem(doc, DAY, id, NOON + 1000);
  assert.equal(itemsOf(doc, DAY)[0].done, false);
  assert.equal(itemsOf(doc, DAY)[0].doneAt, null);

  doc = setItemDue(doc, DAY, id, '09:00');
  assert.equal(itemsOf(doc, DAY)[0].dueAt, at(2026, 11, 9, 9, 0));
  doc = setItemDue(doc, DAY, id, '');
  assert.equal(itemsOf(doc, DAY)[0].dueAt, null);

  doc = removeItem(doc, DAY, id);
  assert.equal(itemsOf(doc, DAY).length, 0);
  assert.equal(doc.days[DAY], undefined);
});

test('addItem ignores blank text and unknown days', () => {
  let doc = addItem(emptyDoc(), DAY, '   ', null, NOON);
  assert.deepEqual(doc.days, {});
  doc = addItem(doc, '2026-13-01', 'x', null, NOON);
  assert.deepEqual(doc.days, {});
});

test('ordering keeps open items first with due times ascending, done items last', () => {
  const items = [
    item({ id: 'done1', done: true, doneAt: at(2026, 11, 9, 11, 0) }),
    item({ id: 'none', createdAt: at(2026, 11, 9, 8, 0) }),
    item({ id: 'late', dueAt: at(2026, 11, 9, 18, 0) }),
    item({ id: 'early', dueAt: at(2026, 11, 9, 9, 0) }),
    item({ id: 'done2', done: true, doneAt: at(2026, 11, 9, 12, 0) }),
  ];
  assert.deepEqual(sortItems(items).map(row => row.id), ['early', 'late', 'none', 'done2', 'done1']);
});

test('dayStats counts done, pending and overdue', () => {
  const doc = docWith({
    [DAY]: [
      item({ id: 'a', dueAt: at(2026, 11, 9, 9, 0) }),
      item({ id: 'b', dueAt: at(2026, 11, 9, 23, 0) }),
      item({ id: 'c', done: true, doneAt: NOON }),
    ],
  });
  assert.deepEqual(dayStats(doc, DAY, NOON), { total: 3, done: 1, pending: 2, overdue: 1 });
  assert.deepEqual(dayStats(doc, '2026-11-10', NOON), { total: 0, done: 0, pending: 0, overdue: 0 });
});

test('a passed reminder is due until it is acknowledged', () => {
  const doc = docWith({ [DAY]: [item({ id: 'a', dueAt: at(2026, 11, 9, 11, 0) })] });
  const reminder = computeReminder(doc, NOON);
  assert.equal(reminder.due.length, 1);
  assert.equal(reminder.due[0].day, DAY);

  const acknowledged = acknowledgeReminder(doc, reminder, NOON);
  assert.equal(computeReminder(acknowledged, NOON + 60_000).due.length, 0);
  assert.equal(itemsOf(acknowledged, DAY)[0].remindedAt, NOON);
});

test('acknowledging the visible reminder leaves the other kind pending', () => {
  const doc = docWith(
    { [DAY]: [item({ id: 'a', dueAt: at(2026, 11, 9, 11, 0) })] },
    { wrapUpEnabled: true, wrapUpTime: '09:00' },
  );
  const reminder = computeReminder(doc, NOON);
  assert.equal(reminder.due.length, 1);
  assert.equal(reminder.wrapUp, true);

  const dueAcknowledged = acknowledgeReminder(doc, reminder, NOON, 'due');
  assert.equal(computeReminder(dueAcknowledged, NOON + 1000).due.length, 0);
  assert.equal(computeReminder(dueAcknowledged, NOON + 1000).wrapUp, true);

  const sweepAcknowledged = acknowledgeReminder(doc, reminder, NOON, 'wrapUp');
  assert.equal(computeReminder(sweepAcknowledged, NOON + 1000).wrapUp, false);
  assert.equal(computeReminder(sweepAcknowledged, NOON + 1000).due.length, 1);
});

test('snooze hides the reminder for the interval, then it returns', () => {
  const doc = docWith({ [DAY]: [item({ id: 'a', dueAt: at(2026, 11, 9, 11, 0) })] });
  const reminder = computeReminder(doc, NOON);
  const snoozed = snoozeReminder(doc, reminder, NOON);
  assert.equal(computeReminder(snoozed, NOON + SNOOZE_MS - 1000).due.length, 0);
  assert.equal(computeReminder(snoozed, NOON + SNOOZE_MS + 1000).due.length, 1);
});

test('future reminders and future days never interrupt', () => {
  const doc = docWith({
    [DAY]: [item({ id: 'later', dueAt: at(2026, 11, 9, 18, 0) })],
    '2026-11-10': [item({ id: 'tomorrow', dueAt: at(2026, 11, 10, 9, 0) })],
  });
  assert.equal(computeReminder(doc, NOON).due.length, 0);
});

test('the daily sweep appears at its time and only once per day', () => {
  const doc = docWith({ [DAY]: [item({ id: 'a' })] });
  assert.equal(computeReminder(doc, at(2026, 11, 9, 17, 59)).wrapUp, false);
  const reminder = computeReminder(doc, at(2026, 11, 9, 18, 0));
  assert.equal(reminder.wrapUp, true);
  assert.equal(reminder.unfinished, 1);

  const acknowledged = acknowledgeReminder(doc, reminder, at(2026, 11, 9, 18, 0));
  assert.equal(computeReminder(acknowledged, at(2026, 11, 9, 20, 0)).wrapUp, false);
  // A new day gets its own sweep.
  assert.equal(computeReminder(acknowledged, at(2026, 11, 10, 18, 1)).wrapUp, true);
});

test('the sweep follows its configured time and can be turned off', () => {
  let doc = docWith({ [DAY]: [item({ id: 'a' })] }, { wrapUpTime: '21:30' });
  assert.equal(computeReminder(doc, at(2026, 11, 9, 21, 0)).wrapUp, false);
  assert.equal(computeReminder(doc, at(2026, 11, 9, 21, 30)).wrapUp, true);
  doc = updateSettings(doc, { wrapUpEnabled: false });
  assert.equal(computeReminder(doc, at(2026, 11, 9, 23, 0)).wrapUp, false);
});

test('the sweep stays quiet when every item is done', () => {
  const doc = docWith({ [DAY]: [item({ id: 'a', done: true, doneAt: NOON })] });
  assert.equal(computeReminder(doc, at(2026, 11, 9, 22, 0)).wrapUp, false);
});

test('unfinishedRecent reaches back three days but not further', () => {
  const doc = docWith({
    '2026-11-09': [item({ id: 'today' })],
    '2026-11-08': [item({ id: 'yesterday' })],
    '2026-11-05': [item({ id: 'old' })],
  });
  assert.deepEqual(unfinishedRecent(doc, DAY, 10).map(row => row.item.id), ['today', 'yesterday']);
  const backlogOnly = computeReminder(doc, at(2026, 11, 9, 19, 0));
  assert.equal(backlogOnly.backlog, 1);
  assert.equal(backlogOnly.unfinished, 2);
});

test('clearCompleted keeps open items and drops the day when nothing is left', () => {
  let doc = docWith({ [DAY]: [item({ id: 'a', done: true, doneAt: NOON }), item({ id: 'b' })] });
  doc = clearCompleted(doc, DAY);
  assert.deepEqual(itemsOf(doc, DAY).map(row => row.id), ['b']);
  doc = clearCompleted(doc, DAY);
  assert.deepEqual(itemsOf(doc, DAY).map(row => row.id), ['b']);
});

test('carryOver moves yesterday unfinished items and leaves completed ones behind', () => {
  const yesterday = '2026-11-08';
  const doc = docWith({
    [yesterday]: [
      item({ id: 'open', text: '没写完' }),
      item({ id: 'done', text: '写完了', done: true, doneAt: at(2026, 11, 8, 20, 0) }),
    ],
    [DAY]: [item({ id: 'today', text: '今天的事' })],
  });
  const moved = carryOver(doc, yesterday, DAY, NOON);
  const todayItems = itemsOf(moved, DAY);
  assert.deepEqual(todayItems.map(row => row.text), ['今天的事', '没写完']);
  assert.equal(unfinishedFrom(moved, yesterday).length, 0);
  assert.deepEqual(itemsOf(moved, yesterday).map(row => row.id), ['done']);
  // The old reminder time belonged to yesterday and is not silently reused.
  assert.equal(todayItems[1].dueAt, null);
  assert.notEqual(todayItems[1].id, 'open');
  assert.equal(carryOver(moved, DAY, DAY, NOON), moved);
  assert.equal(carryOver(moved, 'bad-day', DAY, NOON), moved);
  assert.equal(carryOver(moved, yesterday, DAY, NOON), moved);
});

test('carryOver drops a source day once only unfinished items leave it', () => {
  const yesterday = '2026-11-08';
  const doc = docWith({ [yesterday]: [item({ id: 'open' })] });
  const moved = carryOver(doc, yesterday, DAY, NOON);
  assert.equal(moved.days[yesterday], undefined);
  assert.equal(unfinishedFrom(moved, DAY).length, 1);
});

test('pruneDoc caps stored days at MAX_DAYS and keeps the newest', () => {
  const days = {};
  for (let index = 0; index < MAX_DAYS + 20; index += 1) {
    const key = shiftDayKey('2026-01-01', index);
    days[key] = [item({ id: `id-${index}` })];
  }
  const pruned = pruneDoc({ ...emptyDoc(), days });
  assert.equal(Object.keys(pruned.days).length, MAX_DAYS);
  assert.equal(pruned.days[shiftDayKey('2026-01-01', 19)], undefined);
  assert.ok(pruned.days[shiftDayKey('2026-01-01', 20)] !== undefined);
});
