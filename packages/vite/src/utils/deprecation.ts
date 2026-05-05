import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/vite:build, @nx/vite:dev-server, and
// @nx/vite:preview-server executors. The inferred plugin (@nx/vite/plugin)
// and the convert-to-inferred generator stay supported. (`@nx/vite:test`
// is being deprecated in a separate change for the test-runner batch.)
export const VITE_BUILD_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vite:build` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` to migrate to the `@nx/vite/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const VITE_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vite:dev-server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` to migrate to the `@nx/vite/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const VITE_PREVIEW_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vite:preview-server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` to migrate to the `@nx/vite/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnViteBuildExecutorDeprecation(): void {
  logger.warn(VITE_BUILD_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnViteDevServerExecutorDeprecation(): void {
  logger.warn(VITE_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnVitePreviewServerExecutorDeprecation(): void {
  logger.warn(VITE_PREVIEW_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/vite:configuration generator is about to scaffold
// targets that use the deprecated executors — i.e. when @nx/vite/plugin
// isn't registered in nx.json. Surfaces the deprecation at scaffold time
// rather than only when the user later runs the generated targets.
export function warnViteExecutorScaffolding(): void {
  logger.warn(
    'Scaffolding targets that use the deprecated `@nx/vite:build`, `@nx/vite:dev-server`, and `@nx/vite:preview-server` executors. These executors will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` after this scaffold to migrate the generated targets to the `@nx/vite/plugin` inferred plugin. To skip emitting executor targets entirely on future scaffolds, register `@nx/vite/plugin` in `nx.json` first (`nx add @nx/vite` or a manual plugin entry). See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
