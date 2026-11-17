/** Host half of the scratch lab: prepare one durable Workspace for demo Sessions. */
import z from '@deepseek-ai/schemastery';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { DEFAULT_TITLE, ensureLabWorkspace, resolveLabRoot } from './src/lab.mjs';

/** Configuration served to the browser through the plugin's settings form. */
export const Config = z.object({
  root: z.string().default(''),
  title: z.string().default(DEFAULT_TITLE),
});

/**
 * Create the scratch directory and register it as a Workspace once the Host
 * services are available. A failure is logged instead of aborting the profile
 * so the rest of the application still starts; the panel reports the missing
 * Workspace.
 * @param {object} ctx - Cordis Host context.
 * @param {object} [config] - validated plugin configuration.
 */
export function apply(ctx, config = {}) {
  const root = resolveLabRoot(config.root, homedir(), process.cwd());
  const title = String(config.title ?? '').trim() || DEFAULT_TITLE;
  ctx.inject(['settings', 'workspaceRegistry'], child => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      'scratch-lab: settings presentation',
    );
    child.effect(() => {
      let active = true;
      void ensureLabWorkspace({ registry: child.workspaceRegistry, root, title, mkdir })
        .catch(error => {
          if (!active) return;
          const message = error instanceof Error ? error.message : String(error);
          child.logger.warn(`scratch-lab: cannot prepare "${root}": ${message}`);
        });
      return () => { active = false; };
    }, 'scratch-lab: prepare workspace');
  });
}
