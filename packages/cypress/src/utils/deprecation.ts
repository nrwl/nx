import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/cypress:cypress executor. The inferred plugin
// (@nx/cypress/plugin) and the convert-to-inferred generator stay supported.
export const CYPRESS_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/cypress:cypress` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/cypress:convert-to-inferred` to migrate to the `@nx/cypress/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnCypressExecutorDeprecation(): void {
  logger.warn(CYPRESS_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/cypress:configuration or :component-configuration
// generator is about to generate a target that uses the deprecated executor —
// i.e. when @nx/cypress/plugin isn't registered in nx.json. Surfaces the
// deprecation at generation time rather than only when the user later runs the
// generated target.
export function warnCypressExecutorGenerating(): void {
  logger.warn(
    'Generating a target that uses the deprecated `@nx/cypress:cypress` executor. The executor will be removed in Nx v24. Run `nx g @nx/cypress:convert-to-inferred` next to migrate this target to the `@nx/cypress/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
