import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/react-native:build-android, :build-ios, :bundle,
// :pod-install, :run-android, :run-ios, :start, and :upgrade executors. The
// inferred plugin (@nx/react-native/plugin) and the convert-to-inferred
// generator stay supported. (`:storybook`, `:sync-deps`, and `:ensure-symlink`
// are Nx-specific glue with no inferred replacement and stay as-is.)

function buildMessage(executorName: string): string {
  return `The \`@nx/react-native:${executorName}\` executor is deprecated and will be removed in Nx v24. Run \`nx g @nx/react-native:convert-to-inferred\` to migrate to the \`@nx/react-native/plugin\` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.`;
}

export function warnReactNativeExecutorDeprecation(executorName: string): void {
  logger.warn(buildMessage(executorName));
}

export function warnReactNativeExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/react-native:build-android`, `@nx/react-native:build-ios`, `@nx/react-native:bundle`, `@nx/react-native:pod-install`, `@nx/react-native:run-android`, `@nx/react-native:run-ios`, `@nx/react-native:start`, and `@nx/react-native:upgrade` executors. These executors will be removed in Nx v24. Run `nx g @nx/react-native:convert-to-inferred` next to migrate these targets to the `@nx/react-native/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
