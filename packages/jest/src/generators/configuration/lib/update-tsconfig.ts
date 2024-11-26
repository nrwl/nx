import {
  joinPathFragments,
  logger,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import type { NormalizedJestProjectSchema } from '../schema';

export function updateTsConfig(
  host: Tree,
  options: NormalizedJestProjectSchema
) {
  const { root, projectType } = readProjectConfiguration(host, options.project);
  if (!host.exists(joinPathFragments(root, 'tsconfig.json'))) {
    throw new Error(
      `Expected ${joinPathFragments(
        root,
        'tsconfig.json'
      )} to exist. Please create one.`
    );
  }
  updateJson(host, joinPathFragments(root, 'tsconfig.json'), (json) => {
    if (
      json.references &&
      !json.references.some((r) => r.path === './tsconfig.spec.json')
    ) {
      json.references.push({
        path: './tsconfig.spec.json',
      });
    }
    return json;
  });

  // fall-back runtime tsconfig file path in case the user didn't provide one
  let runtimeTsconfigPath = joinPathFragments(
    root,
    projectType === 'application' ? 'tsconfig.app.json' : 'tsconfig.lib.json'
  );
  if (options.runtimeTsconfigFileName) {
    runtimeTsconfigPath = joinPathFragments(
      root,
      options.runtimeTsconfigFileName
    );
    if (!host.exists(runtimeTsconfigPath)) {
      // the user provided a runtimeTsconfigFileName that doesn't exist, so we throw an error
      throw new Error(
        `Cannot find the provided runtimeTsConfigFileName ("${options.runtimeTsconfigFileName}") at the project root "${root}".`
      );
    }
  }

  if (host.exists(runtimeTsconfigPath)) {
    updateJson(host, runtimeTsconfigPath, (json) => {
      const uniqueExclude = new Set([
        ...(json.exclude || []),
        options.js ? 'jest.config.js' : 'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        ...(options.js ? ['src/**/*.spec.js', 'src/**/*.test.js'] : []),
      ]);
      json.exclude = [...uniqueExclude];
      return json;
    });
  } else {
    logger.warn(
      `Couldn't find a runtime tsconfig file at ${runtimeTsconfigPath} to exclude the test files from. ` +
        `If you're using a different filename for your runtime tsconfig, please provide it with the '--runtimeTsconfigFileName' flag.`
    );
  }
}
