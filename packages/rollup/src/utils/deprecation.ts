import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/rollup:rollup executor. The inferred plugin
// (@nx/rollup/plugin) and the convert-to-inferred generator stay supported.
export const ROLLUP_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/rollup:rollup` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/rollup:convert-to-inferred` to migrate to the `@nx/rollup/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnRollupExecutorDeprecation(): void {
  logger.warn(ROLLUP_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/rollup:configuration generator is about to generate a
// target that uses the deprecated executor — i.e. when @nx/rollup/plugin
// isn't registered in nx.json. Surfaces the deprecation at generation time
// rather than only when the user later runs the generated target.
export function warnRollupExecutorGenerating(): void {
  logger.warn(
    'Generating a target that uses the deprecated `@nx/rollup:rollup` executor. The executor will be removed in Nx v24. Run `nx g @nx/rollup:convert-to-inferred` next to migrate this target to the `@nx/rollup/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
