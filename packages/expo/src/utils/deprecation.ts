import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/expo:build, :export, :install, :prebuild, :run,
// :serve, :start, and :submit executors. The inferred plugin
// (@nx/expo/plugin) and the convert-to-inferred generator stay supported.
// (`@nx/expo:build-list`, `:sync-deps`, `:update`, and `:ensure-symlink`
// are not covered by `convert-to-inferred` and stay as-is.)

function buildMessage(executorName: string): string {
  return `The \`@nx/expo:${executorName}\` executor is deprecated and will be removed in Nx v24. Run \`nx g @nx/expo:convert-to-inferred\` to migrate to the \`@nx/expo/plugin\` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.`;
}

export function warnExpoExecutorDeprecation(executorName: string): void {
  logger.warn(buildMessage(executorName));
}

export function expoSchemaDeprecationMessage(executorName: string): string {
  return buildMessage(executorName);
}

export function warnExpoExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/expo:build`, `@nx/expo:export`, `@nx/expo:install`, `@nx/expo:prebuild`, `@nx/expo:run`, `@nx/expo:serve`, `@nx/expo:start`, and `@nx/expo:submit` executors. These executors will be removed in Nx v24. Run `nx g @nx/expo:convert-to-inferred` next to migrate these targets to the `@nx/expo/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
