import z from '@deepseek-ai/schemastery';

export const Config = z.object({rates:z.string().default('{}').volatile()});
export function apply(ctx) {
  ctx.inject(['settings'], child => child.effect(() => child.settings.configure({auto:false},ctx.fiber)));
}
