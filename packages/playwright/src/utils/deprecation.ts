import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/playwright:playwright executor. The inferred
// plugin (@nx/playwright/plugin) and the convert-to-inferred generator stay
// supported.
export const PLAYWRIGHT_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/playwright:playwright` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/playwright:convert-to-inferred` to migrate to the `@nx/playwright/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnPlaywrightExecutorDeprecation(): void {
  logger.warn(PLAYWRIGHT_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnPlaywrightExecutorGenerating(): void {
  logger.warn(
    'Generating a target that uses the deprecated `@nx/playwright:playwright` executor. The executor will be removed in Nx v24. Run `nx g @nx/playwright:convert-to-inferred` next to migrate this target to the `@nx/playwright/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
