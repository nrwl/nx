import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/detox:build and @nx/detox:test executors and the
// convert-to-inferred generator. The inferred plugin (@nx/detox/plugin) and
// the application/init generators stay supported.
export const DETOX_EXECUTORS_DEPRECATION_MESSAGE =
  '`@nx/detox:build` and `@nx/detox:test` are deprecated and will be removed in Nx v24. Run `nx g @nx/detox:convert-to-inferred` to migrate to the `@nx/detox/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnDetoxExecutorsDeprecation(): void {
  logger.warn(DETOX_EXECUTORS_DEPRECATION_MESSAGE);
}

// Fired when the @nx/detox:application generator is about to scaffold
// build-ios/test-ios/build-android/test-android targets that use the deprecated
// executors — i.e. when @nx/detox/plugin isn't registered in nx.json. Surfaces
// the deprecation at scaffold time rather than only when the user later runs
// the generated targets.
export function warnDetoxExecutorsScaffolding(): void {
  logger.warn(
    'Scaffolding `build-ios`, `test-ios`, `build-android`, and `test-android` targets that use the deprecated `@nx/detox:build` and `@nx/detox:test` executors. These executors will be removed in Nx v24. Run `nx g @nx/detox:convert-to-inferred` after this scaffold to migrate the generated targets to the `@nx/detox/plugin` inferred plugin. To skip emitting executor targets entirely on future scaffolds, register `@nx/detox/plugin` in `nx.json` first (`nx add @nx/detox` or a manual plugin entry). See https://nx.dev/docs/technologies/test-tools/detox/introduction for details.'
  );
}
