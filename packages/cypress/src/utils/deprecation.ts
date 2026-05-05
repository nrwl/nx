import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/cypress:cypress executor. The inferred plugin
// (@nx/cypress/plugin) and the convert-to-inferred generator stay supported.
export const CYPRESS_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/cypress:cypress` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/cypress:convert-to-inferred` to migrate to the `@nx/cypress/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnCypressExecutorDeprecation(): void {
  logger.warn(CYPRESS_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/cypress:configuration or :component-configuration
// generator is about to scaffold a target that uses the deprecated executor —
// i.e. when @nx/cypress/plugin isn't registered in nx.json. Surfaces the
// deprecation at scaffold time rather than only when the user later runs the
// generated target.
export function warnCypressExecutorScaffolding(): void {
  logger.warn(
    'Scaffolding a target that uses the deprecated `@nx/cypress:cypress` executor. The executor will be removed in Nx v24. Run `nx g @nx/cypress:convert-to-inferred` after this scaffold to migrate the generated target to the `@nx/cypress/plugin` inferred plugin. To skip emitting executor targets entirely on future scaffolds, register `@nx/cypress/plugin` in `nx.json` first (`nx add @nx/cypress` or a manual plugin entry). See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
