import { logger } from '@nx/devkit';

// Webpack gives this option to ts-loader's getCustomTransformers; rspack
// compiles TypeScript with `builtin:swc-loader`, which cannot run TypeScript
// transformer plugins.
export const RSPACK_TRANSFORMERS_UNSUPPORTED_MESSAGE =
  'The `transformers` option is not supported by `@nx/rspack` and has no effect. Rspack compiles TypeScript with `builtin:swc-loader`, which cannot run TypeScript transformer plugins. Remove the option, or keep using `@nx/webpack` for projects that need a TypeScript transformer such as the `@nestjs/swagger` CLI plugin.';

const warnedProjects = new Set<string>();

// Keyed per project so a `run-many` still reports every affected project, while
// watch rebuilds of one project log a single line.
export function warnUnsupportedTransformers(
  hasTransformers: boolean,
  projectRoot: string
): void {
  if (!hasTransformers || warnedProjects.has(projectRoot)) return;
  warnedProjects.add(projectRoot);
  logger.warn(RSPACK_TRANSFORMERS_UNSUPPORTED_MESSAGE);
}
