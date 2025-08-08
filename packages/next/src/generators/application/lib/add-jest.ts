import {
  ensurePackage,
  joinPathFragments,
  readJson,
  Tree,
  updateJson,
  GeneratorCallback,
} from '@nx/devkit';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addJest(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  if (options.unitTestRunner !== 'jest') {
    return () => {};
  }

  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );
  const jestTask = await configurationGenerator(host, {
    ...options,
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'babel',
    skipFormat: true,
    runtimeTsconfigFileName: 'tsconfig.json',
  });

  const tsConfigSpecJson = readJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.spec.json')
  );

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      json.compilerOptions ??= {};
      json.compilerOptions.types ??= [];
      json.compilerOptions.types.push(
        ...(tsConfigSpecJson?.compilerOptions?.types ?? [])
      );

      return json;
    }
  );

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.spec.json'),
    (json) => {
      json.compilerOptions.jsx = 'react';
      // have to override exclude otherwise lint will fail with setParserOptionsProject and jest.config.ts
      if (options.setParserOptionsProject) {
        const tsConfig = readJson(
          host,
          joinPathFragments(options.appProjectRoot, 'tsconfig.json')
        );
        json.exclude = tsConfig.exclude.filter((e) => e !== 'jest.config.ts');
      }
      return json;
    }
  );

  return jestTask;
}
