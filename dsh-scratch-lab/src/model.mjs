/** Pure browser-side helpers shared by the panel and its tests. */

/** Workspace title used when configuration is unavailable or blank. */
export const DEFAULT_LAB_TITLE = '试验区';

/** Symbolic path shown before the Workspace snapshot arrives. */
export const DEFAULT_LAB_DISPLAY = '~/.dsh/lab';

const encoder = new TextEncoder();

/**
 * Replace `{name}` placeholders with values. The Host `t` translator returns
 * templates, so the panel fills its counts and messages through this helper.
 * @param {string} template - translated template.
 * @param {Record<string, unknown>} [params] - placeholder values.
 * @returns {string} filled text.
 */
export function fill(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/gu, (match, key) =>
    Object.hasOwn(params, key) ? String(params[key]) : match);
}

/**
 * Cut a string to a UTF-8 byte budget without splitting a code point.
 * @param {string} text - source text.
 * @param {number} [maxBytes] - maximum UTF-8 bytes.
 * @returns {string} possibly truncated text.
 */
export function truncateUtf8(text, maxBytes = 80) {
  const value = String(text ?? '');
  if (encoder.encode(value).length <= maxBytes) return value;
  let result = '';
  for (const character of value) {
    if (encoder.encode(result + character).length > maxBytes) break;
    result += character;
  }
  return result;
}

/**
 * Normalize a user-entered demo name into a Session title. Whitespace is
 * collapsed, the value is capped to the Host title budget (80 UTF-8 bytes),
 * and a blank name falls back to a local-time timestamp.
 * @param {unknown} raw - user input.
 * @param {number} [now] - clock used for the timestamp fallback.
 * @returns {string} non-empty title.
 */
export function cleanDemoName(raw, now = Date.now()) {
  const text = String(raw ?? '').replace(/\s+/gu, ' ').trim();
  if (text !== '') return truncateUtf8(text, 80).trim();
  const date = new Date(now);
  const pad = value => String(value).padStart(2, '0');
  return `demo-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * Normalize a filesystem path for comparison without changing what is shown.
 * @param {string} value - path text.
 * @returns {string} slash-normalized, lowercase path without trailing slashes.
 */
export function normalizePath(value) {
  return String(value ?? '').replace(/\\/gu, '/').replace(/\/+$/u, '').toLowerCase();
}

/**
 * Locate the lab Workspace in a Workspace snapshot. A configured absolute root
 * is matched exactly; `~/...` and the default root fall back to title and then
 * to the stable `/.dsh/lab` suffix, because the user may rename the Workspace.
 * @param {readonly object[]} items - Workspace view rows.
 * @param {string} [title] - configured Workspace title.
 * @param {string} [root] - configured scratch root.
 * @returns {object | undefined} the matching Workspace.
 */
export function findLabWorkspace(items, title = DEFAULT_LAB_TITLE, root = '') {
  const list = Array.isArray(items) ? items : [];
  const configured = String(root ?? '').trim();
  if (configured !== '' && !configured.startsWith('~')) {
    const exact = list.find(item => normalizePath(item?.path) === normalizePath(configured));
    if (exact !== undefined) return exact;
  }
  const suffix = configured === '' ? '' : normalizePath(configured.replace(/^~[\\/]?/u, ''));
  const titled = list.filter(item => item?.title === title);
  if (titled.length === 1) return titled[0];
  if (titled.length > 1) {
    const preferred = titled.find(item => suffix !== '' && normalizePath(item?.path).endsWith(`/${suffix}`))
      ?? titled.find(item => /(^|\/)\.dsh\/lab$/u.test(normalizePath(item?.path)));
    return preferred ?? titled[0];
  }
  return list.find(item => (suffix !== '' && normalizePath(item?.path).endsWith(`/${suffix}`))
    || /(^|\/)\.dsh\/lab$/u.test(normalizePath(item?.path)));
}

/**
 * List the ordinary, unarchived Sessions accounted to a Workspace, preserving
 * the Workspace's saved order (new members are prepended by the Host).
 * @param {object | undefined} workspace - Workspace view row.
 * @param {{ byId?: Record<string, object> } | undefined} sessions - Session list snapshot.
 * @param {readonly string[]} [archivedIds] - registry-global archived Session ids.
 * @returns {object[]} Session summaries.
 */
export function listLabSessions(workspace, sessions, archivedIds = []) {
  if (workspace === undefined || workspace === null) return [];
  const archived = new Set(Array.isArray(archivedIds) ? archivedIds : []);
  const byId = sessions?.byId ?? {};
  const rows = [];
  for (const id of workspace.sessionIds ?? []) {
    if (archived.has(id)) continue;
    const summary = byId[id];
    if (summary === undefined || summary.origin === 'subagent') continue;
    rows.push(summary);
  }
  return rows;
}
