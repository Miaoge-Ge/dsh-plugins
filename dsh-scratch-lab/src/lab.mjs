/** Host-side path policy and idempotent Workspace preparation for the lab. */
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

/** Workspace title used when the configured title is blank. */
export const DEFAULT_TITLE = '试验区';

/** Default scratch directory below the operating-system home. */
export function defaultLabRoot(home = homedir()) {
  return join(home, '.dsh', 'lab');
}

/**
 * Resolve the configured scratch root into an absolute path.
 * Blank selects `~/.dsh/lab`; `~` and `~/...` expand against the home
 * directory; a relative path resolves against the Host working directory.
 * @param {string | undefined} configured - `root` from plugin configuration.
 * @param {string} [home] - operating-system home.
 * @param {string} [cwd] - working directory for relative paths.
 * @returns {string} absolute scratch root.
 */
export function resolveLabRoot(configured, home = homedir(), cwd = process.cwd()) {
  const raw = String(configured ?? '').trim();
  if (raw === '') return defaultLabRoot(home);
  if (raw === '~') return home;
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return join(home, raw.slice(2));
  return isAbsolute(raw) ? raw : resolve(cwd, raw);
}

/**
 * Ensure the scratch directory exists and is registered as a Workspace.
 * The directory is created recursively before registration because the
 * Workspace registry canonicalizes only existing directories. An existing
 * registration is reused as-is, so a user rename is never overwritten.
 * @param {object} options - injected filesystem and registry seams.
 * @param {object} options.registry - Workspace registry service.
 * @param {string} options.root - absolute scratch root.
 * @param {string} [options.title] - title for a newly created Workspace.
 * @param {(path: string, options: { recursive: true }) => Promise<void>} options.mkdir - directory creator.
 * @returns {Promise<object>} the existing or created Workspace.
 */
export async function ensureLabWorkspace({ registry, root, title = DEFAULT_TITLE, mkdir }) {
  await mkdir(root, { recursive: true });
  const existing = await registry.resolveByPath(root);
  if (existing !== undefined) return existing;
  return registry.create(root, String(title ?? '').trim() || DEFAULT_TITLE);
}
