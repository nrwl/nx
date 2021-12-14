import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  updateJson,
  getProjects,
  readProjectConfiguration,
  updateProjectConfiguration,
  removeProjectConfiguration,
  offsetFromRoot,
} from '@nrwl/devkit';
import { replaceAppNameWithPath } from '@nrwl/workspace';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';

export function updateConfigFiles(host: Tree, options: NormalizedSchema) {
  updateTsConfigOptions(host, options);
  updateAppAndE2EProjectConfigurations(host, options);
}

function updateTsConfigOptions(host: Tree, options: NormalizedSchema) {
  // tsconfig.app.json
  updateJson(host, `${options.appProjectRoot}/tsconfig.app.json`, (json) => ({
    ...json,
    extends: './tsconfig.json',
    compilerOptions: {
      ...json.compilerOptions,
      outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc`,
      target: 'ES2017',
    },
    exclude: [
      ...new Set([...(json.exclude || []), '**/*.test.ts', '**/*.spec.ts']),
    ],
  }));
}

function updateAppAndE2EProjectConfigurations(
  host: Tree,
  options: NormalizedSchema
) {
  // workspace.json
  const project = readProjectConfiguration(host, options.name);

  let fixedProject = replaceAppNameWithPath(
    project,
    options.name,
    options.appProjectRoot
  );

  delete fixedProject.targets.test;

  // Ensure the outputs property comes after the executor for
  // better readability.
  const { executor, ...rest } = fixedProject.targets.build;
  fixedProject.targets.build = {
    executor,
    outputs: ['{options.outputPath}'],
    ...rest,
  };

  if (fixedProject.generators) {
    delete fixedProject.generators;
  }

  if (options.port) {
    fixedProject.targets.serve = {
      ...fixedProject.targets.serve,
      options: {
        ...fixedProject.targets.serve.options,
        port: options.port,
      },
    };
  }

  fixedProject.tags = options.parsedTags;

  updateProjectConfiguration(host, options.name, fixedProject);

  if (options.unitTestRunner === UnitTestRunner.None) {
    host.delete(`${options.appProjectRoot}/src/app/app.component.spec.ts`);
    host.delete(`${options.appProjectRoot}/tsconfig.spec.json`);
  }

  if (options.e2eTestRunner === E2eTestRunner.None) {
    const projects = getProjects(host);
    if (projects.has(options.e2eProjectName)) {
      removeProjectConfiguration(host, options.e2eProjectName);
    }
  }

  // delete some default test configs
  host.delete(`${options.appProjectRoot}/karma.conf.js`);
  host.delete(`${options.appProjectRoot}/src/test.ts`);
}
