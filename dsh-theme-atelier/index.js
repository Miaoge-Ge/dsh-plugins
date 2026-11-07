import z from '@deepseek-ai/schemastery';
import { themes } from './catalog.js';

// Volatile settings are persisted by Harness without reloading the plugin.
export const Config = z.object({
  theme: z.union(['native', ...themes.map(theme => theme.id)]).default('obsidian').volatile(),
  signature: z.boolean().default(true).volatile(),
});

export function apply(ctx) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
