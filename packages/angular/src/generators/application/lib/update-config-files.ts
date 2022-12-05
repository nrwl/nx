import type { Tree } from '@nrwl/devkit';
import {
  addProjectConfiguration,
  getProjects,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { replaceAppNameWithPath } from '@nrwl/workspace/src/utils/cli-config-utils';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { NormalizedSchema } from './normalized-schema';
import { createTsConfig } from '../../utils/create-ts-config';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';

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
    },
    exclude: [
      ...new Set([
        ...(json.exclude || []),
        'jest.config.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ]),
    ],
  }));

  // tsconfig.json
  createTsConfig(
    host,
    options.appProjectRoot,
    'app',
    options,
    getRelativePathToRootTsConfig(host, options.appProjectRoot)
  );
}

function updateAppAndE2EProjectConfigurations(
  host: Tree,
  options: NormalizedSchema
) {
  // workspace.json
  let project = readProjectConfiguration(host, options.name);

  if (options.ngCliSchematicAppRoot !== options.appProjectRoot) {
    project = replaceAppNameWithPath(
      project,
      options.ngCliSchematicAppRoot,
      options.appProjectRoot
    );
    // project already has the right root, but the above function, makes it incorrect.
    // This corrects it.
    project.root = options.appProjectRoot;
  }

  delete project.targets.test;

  // Ensure the outputs property comes after the executor for
  // better readability.
  const { executor, ...rest } = project.targets.build;
  project.targets.build = {
    executor,
    outputs: ['{options.outputPath}'],
    ...rest,
    options: {
      ...rest.options,
      outputPath: joinPathFragments(
        'dist',
        !options.rootProject ? options.appProjectRoot : options.name
      ),
    },
  };

  if (project.generators) {
    delete project.generators;
  }

  if (options.port) {
    project.targets.serve = {
      ...project.targets.serve,
      options: {
        ...project.targets.serve.options,
        port: options.port,
      },
    };
  }

  project.tags = options.parsedTags;

  /**
   * The "$schema" property on our configuration files is only added when the
   * project configuration is added and not when updating it. It's done this
   * way to avoid re-adding "$schema" when updating a project configuration
   * and that property was intentionally removed by the devs.
   *
   * Since the project gets created by the Angular application schematic,
   * the "$schema" property is not added, so we remove the project and add
   * it back to workaround that.
   */
  removeProjectConfiguration(host, options.name);
  addProjectConfiguration(
    host,
    options.name,
    project,
    options.standaloneConfig
  );

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
}
