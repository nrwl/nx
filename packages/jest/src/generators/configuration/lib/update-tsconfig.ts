import {
  joinPathFragments,
  logger,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import type { NormalizedJestProjectSchema } from '../schema';
import { getProjectType } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getInstalledJestMajorVersion } from '../../../utils/versions';

export function updateTsConfig(
  host: Tree,
  options: NormalizedJestProjectSchema
) {
  const { root, projectType: _projectType } = readProjectConfiguration(
    host,
    options.project
  );
  if (!host.exists(joinPathFragments(root, 'tsconfig.json'))) {
    throw new Error(
      `Expected ${joinPathFragments(
        root,
        'tsconfig.json'
      )} to exist. Please create one.`
    );
  }

  // Detect Jest 30+ to determine the correct config extension
  const jestMajorVersion = getInstalledJestMajorVersion(host);
  const useCommonJsConfig = jestMajorVersion === null || jestMajorVersion >= 30;
  let jestConfigFile: string;
  if (useCommonJsConfig) {
    jestConfigFile = 'jest.config.cts';
  } else if (options.js) {
    jestConfigFile = 'jest.config.js';
  } else {
    jestConfigFile = 'jest.config.ts';
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
  const projectType = getProjectType(host, root, _projectType);

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
    // If the app is Next.js it will not have a tsconfig.app.json
    const extensions = ['js', 'ts', 'mjs', 'cjs'];
    const hasNextConfig = extensions.some((ext) =>
      host.exists(joinPathFragments(root, `next.config.${ext}`))
    );

    if (hasNextConfig && projectType === 'application') {
      runtimeTsconfigPath = joinPathFragments(root, 'tsconfig.json');
    }

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
        jestConfigFile,
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
