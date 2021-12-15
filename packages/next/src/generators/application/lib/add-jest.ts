import { Tree, updateJson } from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { NormalizedSchema } from './normalize-options';

export async function addJest(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner !== 'jest') {
    return () => {};
  }

  const jestTask = await jestProjectGenerator(host, {
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'babel',
  });

  updateJson(host, `${options.appProjectRoot}/tsconfig.spec.json`, (json) => {
    json.compilerOptions.jsx = 'react';
    return json;
  });

  return jestTask;
}
