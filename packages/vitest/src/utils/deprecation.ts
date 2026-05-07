import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/vitest:test executor. The inferred plugin
// (@nx/vitest/plugin) and the convert-to-inferred generator stay supported.
export const VITEST_TEST_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vitest:test` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vitest:convert-to-inferred` to migrate to the `@nx/vitest/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnVitestTestExecutorDeprecation(): void {
  logger.warn(VITEST_TEST_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/vitest:configuration generator is about to generate a
// target that uses the deprecated executor — i.e. when @nx/vitest/plugin
// isn't registered in nx.json. Surfaces the deprecation at generation time
// rather than only when the user later runs the generated target.
export function warnVitestExecutorGenerating(): void {
  logger.warn(
    'Generating a target that uses the deprecated `@nx/vitest:test` executor. This executor will be removed in Nx v24. Run `nx g @nx/vitest:convert-to-inferred` next to migrate this target to the `@nx/vitest/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
