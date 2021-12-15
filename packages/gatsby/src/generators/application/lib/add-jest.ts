import { jestProjectGenerator } from '@nrwl/jest';
import { NormalizedSchema } from './normalize-options';
import { Tree, updateJson } from '@nrwl/devkit';

export async function addJest(host: Tree, options: NormalizedSchema) {
  if (options?.unitTestRunner !== 'jest') {
    return () => {};
  }

  const installTask = await jestProjectGenerator(host, {
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'babel',
  });

  updateJson(host, `${options.projectRoot}/tsconfig.spec.json`, (json) => {
    json.compilerOptions.jsx = 'react';
    return json;
  });

  return installTask;
}
