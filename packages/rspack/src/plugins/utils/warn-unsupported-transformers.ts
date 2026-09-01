import { logger } from '@nx/devkit';

// The `transformers` option came over with the schema when the rspack executor
// was aligned with webpack. Webpack feeds it to ts-loader's getCustomTransformers;
// rspack compiles TypeScript with `builtin:swc-loader`, which cannot run
// TypeScript transformer plugins, so the option has never had an effect here.
export const RSPACK_TRANSFORMERS_UNSUPPORTED_MESSAGE =
  'The `transformers` option is not supported by `@nx/rspack` and has no effect. Rspack compiles TypeScript with `builtin:swc-loader`, which cannot run TypeScript transformer plugins. Remove the option, or keep using `@nx/webpack` for projects that need a TypeScript transformer such as the `@nestjs/swagger` CLI plugin.';

let warned = false;

// Warn once per process so watch rebuilds don't repeat the line.
export function warnUnsupportedTransformers(hasTransformers: boolean): void {
  if (warned || !hasTransformers) return;
  warned = true;
  logger.warn(RSPACK_TRANSFORMERS_UNSUPPORTED_MESSAGE);
}
