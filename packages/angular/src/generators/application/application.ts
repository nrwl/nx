import type { Schema } from './schema';

import {
  readJson,
  getWorkspacePath,
  moveFilesToNewDirectory,
  formatFiles,
  installPackagesTask,
  Tree,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { convertToNxProjectGenerator } from '@nrwl/workspace';

import { UnitTestRunner } from '../../utils/test-runners';
import init from '../init/init';

import {
  createFiles,
  normalizeOptions,
  updateComponentStyles,
  updateComponentTemplate,
  updateConfigFiles,
  addE2e,
  updateComponentSpec,
  addRouterRootConfiguration,
  updateEditorTsConfig,
  addProxyConfig,
  enableStrictTypeChecking,
  setApplicationStrictDefault,
  addLinting,
  addMfe,
} from './lib';
import { addUnitTestRunner } from './lib/add-unit-test-runner';

export async function applicationGenerator(
  host: Tree,
  schema: Partial<Schema>
) {
  const options = normalizeOptions(host, schema);

  // Determine the roots where @schematics/angular will place the projects
  // This is not where the projects actually end up
  const workspaceJson = readJson(host, getWorkspacePath(host));

  const appProjectRoot = workspaceJson.newProjectRoot
    ? `${workspaceJson.newProjectRoot}/${options.name}`
    : options.name;
  const e2eProjectRoot = workspaceJson.newProjectRoot
    ? `${workspaceJson.newProjectRoot}/${options.e2eProjectName}`
    : `${options.name}/e2e`;

  await init(host, {
    ...options,
    skipFormat: true,
  });

  const angularAppSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'application'
  );
  await angularAppSchematic(host, {
    name: options.name,
    inlineStyle: options.inlineStyle,
    inlineTemplate: options.inlineTemplate,
    prefix: options.prefix,
    skipTests: options.skipTests,
    style: options.style,
    viewEncapsulation: options.viewEncapsulation,
    routing: false,
    skipInstall: true,
    skipPackageJson: false,
  });

  createFiles(host, options, appProjectRoot);

  moveFilesToNewDirectory(host, appProjectRoot, options.appProjectRoot);
  updateConfigFiles(host, options);
  updateComponentTemplate(host, options);
  updateComponentStyles(host, options);

  if (options.unitTestRunner !== UnitTestRunner.None) {
    updateComponentSpec(host, options);
  }

  if (options.routing) {
    addRouterRootConfiguration(host, options);
  }

  addLinting(host, options);
  await addUnitTestRunner(host, options);
  await addE2e(host, options, e2eProjectRoot);
  updateEditorTsConfig(host, options);

  if (options.backendProject) {
    addProxyConfig(host, options);
  }

  if (options.strict) {
    enableStrictTypeChecking(host, options);
  } else {
    setApplicationStrictDefault(host, false);
  }

  if (options.standaloneConfig) {
    await convertToNxProjectGenerator(host, {
      project: options.name,
      all: false,
    });
  }

  if (options.mfe) {
    await addMfe(host, options);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return () => {
    installPackagesTask(host);
  };
}

export default applicationGenerator;
