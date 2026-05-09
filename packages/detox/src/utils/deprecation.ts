import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/detox:build and @nx/detox:test executors and the
// convert-to-inferred generator. The inferred plugin (@nx/detox/plugin) and
// the application/init generators stay supported.
export const DETOX_EXECUTORS_DEPRECATION_MESSAGE =
  '`@nx/detox:build` and `@nx/detox:test` are deprecated and will be removed in Nx v24. Run `nx g @nx/detox:convert-to-inferred` to migrate to the `@nx/detox/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnDetoxExecutorsDeprecation(): void {
  logger.warn(DETOX_EXECUTORS_DEPRECATION_MESSAGE);
}

// Fired when the @nx/detox:application generator is about to generate
// build-ios/test-ios/build-android/test-android targets that use the deprecated
// executors — i.e. when @nx/detox/plugin isn't registered in nx.json. Surfaces
// the deprecation at generation time rather than only when the user later runs
// the generated targets.
export function warnDetoxExecutorsGenerating(): void {
  logger.warn(
    'Generating `build-ios`, `test-ios`, `build-android`, and `test-android` targets that use the deprecated `@nx/detox:build` and `@nx/detox:test` executors. These executors will be removed in Nx v24. Run `nx g @nx/detox:convert-to-inferred` next to migrate these targets to the `@nx/detox/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
