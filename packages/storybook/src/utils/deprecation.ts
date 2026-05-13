import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/storybook:storybook and @nx/storybook:build
// executors. The inferred plugin (@nx/storybook/plugin) and the
// convert-to-inferred generator stay supported.
export const STORYBOOK_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/storybook:storybook` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/storybook:convert-to-inferred` to migrate to the `@nx/storybook/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const STORYBOOK_BUILD_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/storybook:build` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/storybook:convert-to-inferred` to migrate to the `@nx/storybook/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnStorybookExecutorDeprecation(): void {
  logger.warn(STORYBOOK_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnStorybookBuildExecutorDeprecation(): void {
  logger.warn(STORYBOOK_BUILD_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnStorybookExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/storybook:storybook` and `@nx/storybook:build` executors. These executors will be removed in Nx v24. Run `nx g @nx/storybook:convert-to-inferred` next to migrate these targets to the `@nx/storybook/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
