/**
 * Pure state model for the daily to-do widget.
 *
 * Everything here is a plain function over plain JSON so the client half can
 * inline this module without a bundler and the Node tests can exercise it
 * directly. No timers, no DOM, no storage: the caller owns "now".
 */

export const VERSION = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_MS = 10 * 60 * 1000;
export const BACKLOG_DAYS = 3;
export const MAX_TEXT = 200;
export const MAX_DAYS = 400;
export const DEFAULT_WRAP_UP_TIME = '18:00';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

export function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

/** Local calendar day of an epoch, never the UTC one. */
export function dayKeyOf(epoch) {
  const date = new Date(epoch);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parse `YYYY-MM-DD` into a local midnight Date, rejecting impossible days. */
export function parseDayKey(key) {
  const match = typeof key === 'string' ? DAY_PATTERN.exec(key) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function shiftDayKey(key, delta) {
  const date = parseDayKey(key) ?? new Date();
  date.setDate(date.getDate() + delta);
  return dayKeyOf(date.getTime());
}

/** Accept `H:mm`, `HH:mm` and the empty value; return canonical `HH:mm` or null. */
export function normalizeTime(value) {
  const match = typeof value === 'string' ? TIME_PATTERN.exec(value.trim()) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/** Epoch of a clock time on one local day, or null when either input is invalid. */
export function timeAtDay(key, time) {
  const day = parseDayKey(key);
  const clock = normalizeTime(time);
  if (!day || !clock) return null;
  const [hours, minutes] = clock.split(':').map(Number);
  day.setHours(hours, minutes, 0, 0);
  return day.getTime();
}

export function clockOf(epoch) {
  if (!Number.isFinite(epoch)) return '';
  const date = new Date(epoch);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

let sequence = 0;
export function newId(now = Date.now()) {
  sequence += 1;
  return `t${Math.max(0, Math.floor(now)).toString(36)}${sequence.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function isOverdue(item, now) {
  return item.done !== true && Number.isFinite(item.dueAt) && item.dueAt <= now;
}

function defaultSettings() {
  return {
    wrapUpEnabled: true,
    wrapUpTime: DEFAULT_WRAP_UP_TIME,
    wrapUpShownOn: null,
    wrapUpSnoozeUntil: null,
    showDock: true,
  };
}

export function emptyDoc() {
  return { v: VERSION, days: {}, settings: defaultSettings() };
}

function normalizeItem(raw, fallbackNow) {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) return null;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : fallbackNow;
  const done = raw.done === true;
  let doneAt = Number.isFinite(raw.doneAt) ? raw.doneAt : null;
  if (done && doneAt === null) doneAt = createdAt;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(createdAt),
    text,
    createdAt,
    dueAt: Number.isFinite(raw.dueAt) ? raw.dueAt : null,
    done,
    doneAt: done ? doneAt : null,
    remindedAt: done ? null : Number.isFinite(raw.remindedAt) ? raw.remindedAt : null,
    snoozeUntil: done ? null : Number.isFinite(raw.snoozeUntil) ? raw.snoozeUntil : null,
  };
}

function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const settings = defaultSettings();
  if (source.wrapUpEnabled === false) settings.wrapUpEnabled = false;
  settings.wrapUpTime = normalizeTime(source.wrapUpTime) ?? DEFAULT_WRAP_UP_TIME;
  settings.wrapUpShownOn = typeof source.wrapUpShownOn === 'string' && parseDayKey(source.wrapUpShownOn)
    ? source.wrapUpShownOn
    : null;
  settings.wrapUpSnoozeUntil = Number.isFinite(source.wrapUpSnoozeUntil) ? source.wrapUpSnoozeUntil : null;
  if (source.showDock === false) settings.showDock = false;
  return settings;
}

/** Rebuild a trusted document from anything that may have been in storage. */
export function normalizeDoc(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Number(raw.v) > VERSION) return emptyDoc();
  const days = {};
  const entries = raw.days && typeof raw.days === 'object' ? Object.entries(raw.days) : [];
  for (const [key, list] of entries) {
    if (!parseDayKey(key) || !Array.isArray(list)) continue;
    const seen = new Set();
    const items = [];
    for (const candidate of list) {
      const item = normalizeItem(candidate, now);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    if (items.length > 0) days[key] = items;
  }
  const result = { v: VERSION, days, settings: normalizeSettings(raw.settings) };
  return pruneDoc(result);
}

/** Cap the number of stored days so local storage cannot grow without bound. */
export function pruneDoc(doc) {
  const keys = Object.keys(doc.days);
  if (keys.length <= MAX_DAYS) return doc;
  const keep = new Set(keys.sort().slice(keys.length - MAX_DAYS));
  const days = {};
  for (const key of Object.keys(doc.days)) if (keep.has(key)) days[key] = doc.days[key];
  return { ...doc, days };
}

export function itemsOf(doc, day) {
  return doc.days[day] ?? [];
}

export function sortItems(items) {
  return items.slice().sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    if (left.done) return (right.doneAt ?? 0) - (left.doneAt ?? 0);
    if (left.dueAt !== null && right.dueAt !== null) return left.dueAt - right.dueAt;
    if (left.dueAt !== null) return -1;
    if (right.dueAt !== null) return 1;
    return left.createdAt - right.createdAt;
  });
}

export function dayStats(doc, day, now) {
  const items = itemsOf(doc, day);
  const done = items.filter(item => item.done).length;
  const overdue = items.filter(item => isOverdue(item, now)).length;
  return { total: items.length, done, pending: items.length - done, overdue };
}

function cloneDay(doc, day, items) {
  const days = { ...doc.days };
  if (items.length > 0) days[day] = items;
  else delete days[day];
  return { ...doc, days };
}

function replaceItem(doc, day, id, change) {
  const items = itemsOf(doc, day);
  if (!items.some(item => item.id === id)) return doc;
  return cloneDay(doc, day, items.map(item => (item.id === id ? change(item) : item)));
}

export function addItem(doc, day, text, dueTime, now) {
  const clean = String(text ?? '').trim().slice(0, MAX_TEXT);
  if (!clean || !parseDayKey(day)) return doc;
  const items = itemsOf(doc, day).concat({
    id: newId(now),
    text: clean,
    createdAt: now,
    dueAt: dueTime ? timeAtDay(day, dueTime) : null,
    done: false,
    doneAt: null,
    remindedAt: null,
    snoozeUntil: null,
  });
  return cloneDay(doc, day, items);
}

export function toggleItem(doc, day, id, now) {
  return replaceItem(doc, day, id, item => (item.done
    ? { ...item, done: false, doneAt: null }
    : { ...item, done: true, doneAt: now, remindedAt: null, snoozeUntil: null }));
}

export function setItemText(doc, day, id, text) {
  const clean = String(text ?? '').trim().slice(0, MAX_TEXT);
  if (!clean) return doc;
  return replaceItem(doc, day, id, item => ({ ...item, text: clean }));
}

export function setItemDue(doc, day, id, dueTime) {
  return replaceItem(doc, day, id, item => ({
    ...item,
    dueAt: dueTime ? timeAtDay(day, dueTime) : null,
    remindedAt: null,
    snoozeUntil: null,
  }));
}

export function setItemDoneAt(doc, day, id, doneTime) {
  const doneAt = doneTime ? timeAtDay(day, doneTime) : null;
  if (doneAt === null) return doc;
  return replaceItem(doc, day, id, item => (item.done ? { ...item, doneAt } : item));
}

export function removeItem(doc, day, id) {
  const items = itemsOf(doc, day);
  if (!items.some(item => item.id === id)) return doc;
  return cloneDay(doc, day, items.filter(item => item.id !== id));
}

export function clearCompleted(doc, day) {
  const items = itemsOf(doc, day);
  if (!items.some(item => item.done)) return doc;
  return cloneDay(doc, day, items.filter(item => !item.done));
}

export function unfinishedFrom(doc, day) {
  return itemsOf(doc, day).filter(item => !item.done);
}

/**
 * Move one day's unfinished items onto another day, leaving completed items
 * behind. A reminder time belonged to the old day, so it is cleared rather
 * than silently moved; the item itself keeps its text and its place in the
 * ordering. Moving is one history-free document change, so the caller can
 * offer it as a single action.
 */
export function carryOver(doc, fromDay, toDay, now) {
  if (fromDay === toDay || parseDayKey(fromDay) === null || parseDayKey(toDay) === null) return doc;
  const source = itemsOf(doc, fromDay);
  const moving = source.filter(item => !item.done);
  if (moving.length === 0) return doc;
  const added = moving.map(item => ({
    ...item,
    id: newId(now),
    createdAt: now,
    dueAt: null,
    remindedAt: null,
    snoozeUntil: null,
  }));
  const next = cloneDay(doc, fromDay, source.filter(item => item.done));
  return cloneDay(next, toDay, itemsOf(next, toDay).concat(added));
}

export function updateSettings(doc, patch) {
  return { ...doc, settings: normalizeSettings({ ...doc.settings, ...patch }) };
}

/** Every unfinished item from today plus recently missed days, newest first. */
export function unfinishedRecent(doc, today, limit = 4) {
  const floor = shiftDayKey(today, -BACKLOG_DAYS);
  const rows = [];
  for (const [day, items] of Object.entries(doc.days)) {
    if (day > today || day < floor) continue;
    for (const item of items) if (!item.done) rows.push({ day, item });
  }
  rows.sort((left, right) => {
    if (left.day !== right.day) return left.day < right.day ? 1 : -1;
    if (left.item.dueAt !== null && right.item.dueAt !== null) return left.item.dueAt - right.item.dueAt;
    if (left.item.dueAt !== null) return -1;
    if (right.item.dueAt !== null) return 1;
    return left.item.createdAt - right.item.createdAt;
  });
  return rows.slice(0, limit);
}

/**
 * What should interrupt the user right now.
 *
 * `due` holds clock reminders whose moment passed and that were neither
 * acknowledged nor snoozed; `wrapUp` reports the once-a-day sweep. Both are
 * derived state, so completing an item while the popup is open removes it
 * without any extra bookkeeping.
 */
export function computeReminder(doc, now) {
  const today = dayKeyOf(now);
  const floor = shiftDayKey(today, -BACKLOG_DAYS);
  const due = [];
  let unfinishedToday = 0;
  let backlog = 0;
  for (const [day, items] of Object.entries(doc.days)) {
    if (day > today) continue;
    for (const item of items) {
      if (item.done) continue;
      if (day === today) unfinishedToday += 1;
      else if (day >= floor) backlog += 1;
      if (item.dueAt === null || item.dueAt > now) continue;
      if (item.remindedAt !== null) continue;
      if (item.snoozeUntil !== null && item.snoozeUntil > now) continue;
      due.push({ day, item });
    }
  }
  due.sort((left, right) => left.item.dueAt - right.item.dueAt);
  const settings = doc.settings;
  const wrapAt = timeAtDay(today, settings.wrapUpTime);
  const wrapUp = settings.wrapUpEnabled === true
    && wrapAt !== null
    && now >= wrapAt
    && settings.wrapUpShownOn !== today
    && !(settings.wrapUpSnoozeUntil !== null && settings.wrapUpSnoozeUntil > now)
    && unfinishedToday + backlog > 0;
  return { today, due, wrapUp, unfinishedToday, backlog, unfinished: unfinishedToday + backlog };
}

/**
 * Dismiss: due items stay overdue but stop interrupting; the sweep waits a day.
 *
 * `scope` names what the notice actually showed. A due notice and the daily
 * sweep can be pending at the same moment, and acknowledging the visible one
 * must not silently consume the other before the user ever saw it.
 */
export function acknowledgeReminder(doc, reminder, now, scope = 'all') {
  let next = doc;
  if (reminder.due.length > 0 && scope !== 'wrapUp') {
    const days = { ...next.days };
    for (const { day, item } of reminder.due) {
      days[day] = (days[day] ?? []).map(row => (row.id === item.id ? { ...row, remindedAt: now, snoozeUntil: null } : row));
    }
    next = { ...next, days };
  }
  if (reminder.wrapUp && scope !== 'due') {
    next = { ...next, settings: { ...next.settings, wrapUpShownOn: reminder.today, wrapUpSnoozeUntil: null } };
  }
  return next;
}

/** Snooze: the same popup returns after the interval. */
export function snoozeReminder(doc, reminder, now, duration = SNOOZE_MS) {
  const until = now + duration;
  let next = doc;
  if (reminder.due.length > 0) {
    const days = { ...next.days };
    for (const { day, item } of reminder.due) {
      days[day] = (days[day] ?? []).map(row => (row.id === item.id ? { ...row, snoozeUntil: until } : row));
    }
    next = { ...next, days };
  }
  if (reminder.wrapUp) next = { ...next, settings: { ...next.settings, wrapUpSnoozeUntil: until } };
  return next;
}
