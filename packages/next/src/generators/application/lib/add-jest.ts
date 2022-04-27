import { joinPathFragments, readJson, Tree, updateJson } from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { NormalizedSchema } from './normalize-options';

export async function addJest(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner !== 'jest') {
    return () => {};
  }

  const jestTask = await jestProjectGenerator(host, {
    ...options,
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'babel',
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

  const tsConfig = readJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json')
  );

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.spec.json'),
    (json) => {
      json.compilerOptions.jsx = 'react';
      // have to override exclude otherwise lint will fail with setParserOptionsProject and jest.config.ts
      if (options.setParserOptionsProject) {
        json.exclude = tsConfig.exclude.filter((e) => e !== 'jest.config.ts');
      }
      return json;
    }
  );

  return jestTask;
}
