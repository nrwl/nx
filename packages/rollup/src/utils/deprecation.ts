import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/rollup:rollup executor. The inferred plugin
// (@nx/rollup/plugin) and the convert-to-inferred generator stay supported.
export const ROLLUP_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/rollup:rollup` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/rollup:convert-to-inferred` to migrate to the `@nx/rollup/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnRollupExecutorDeprecation(): void {
  logger.warn(ROLLUP_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/rollup:configuration generator is about to scaffold a
// target that uses the deprecated executor — i.e. when @nx/rollup/plugin
// isn't registered in nx.json. Surfaces the deprecation at scaffold time
// rather than only when the user later runs the generated target.
export function warnRollupExecutorScaffolding(): void {
  logger.warn(
    'Scaffolding a target that uses the deprecated `@nx/rollup:rollup` executor. The executor will be removed in Nx v24. Run `nx g @nx/rollup:convert-to-inferred` after this scaffold to migrate the generated target to the `@nx/rollup/plugin` inferred plugin. To skip emitting executor targets entirely on future scaffolds, register `@nx/rollup/plugin` in `nx.json` first (`nx add @nx/rollup` or a manual plugin entry). See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
