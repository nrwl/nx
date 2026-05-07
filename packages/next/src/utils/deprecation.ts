import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/next:build and @nx/next:server executors. The
// inferred plugin (@nx/next/plugin) and the convert-to-inferred generator
// stay supported.
export const NEXT_BUILD_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/next:build` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/next:convert-to-inferred` to migrate to the `@nx/next/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const NEXT_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/next:server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/next:convert-to-inferred` to migrate to the `@nx/next/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnNextBuildExecutorDeprecation(): void {
  logger.warn(NEXT_BUILD_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnNextServerExecutorDeprecation(): void {
  logger.warn(NEXT_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/next:application generator is about to generate targets
// that use the deprecated executors — i.e. when @nx/next/plugin isn't
// registered in nx.json. Surfaces the deprecation at generation time rather
// than only when the user later runs the generated targets.
export function warnNextExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/next:build` and `@nx/next:server` executors. These executors will be removed in Nx v24. Run `nx g @nx/next:convert-to-inferred` next to migrate these targets to the `@nx/next/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
