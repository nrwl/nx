import {
  formatFiles,
  getWorkspacePath,
  installPackagesTask,
  moveFilesToNewDirectory,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { convertToNxProjectGenerator } from '@nrwl/workspace';
import { UnitTestRunner } from '../../utils/test-runners';
import { angularInitGenerator } from '../init/init';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import {
  addE2e,
  addLinting,
  addMfe,
  addProxyConfig,
  addRouterRootConfiguration,
  addUnitTestRunner,
  createFiles,
  enableStrictTypeChecking,
  normalizeOptions,
  setApplicationStrictDefault,
  updateAppComponentTemplate,
  updateComponentSpec,
  updateConfigFiles,
  updateEditorTsConfig,
  updateNxComponentTemplate,
} from './lib';
import type { Schema } from './schema';

export async function applicationGenerator(
  host: Tree,
  schema: Partial<Schema>
) {
  const options = normalizeOptions(host, schema);

  // Determine the roots where @schematics/angular will place the projects
  // This is not where the projects actually end up
  const workspaceJsonPath = getWorkspacePath(host);
  let newProjectRoot = null;
  if (workspaceJsonPath) {
    ({ newProjectRoot } = readJson(host, workspaceJsonPath));
  }
  const appProjectRoot = newProjectRoot
    ? `${newProjectRoot}/${options.name}`
    : options.name;
  const e2eProjectRoot = newProjectRoot
    ? `${newProjectRoot}/${options.e2eProjectName}`
    : `${options.name}/e2e`;

  await angularInitGenerator(host, {
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
  updateAppComponentTemplate(host, options);

  // Create the NxWelcomeComponent
  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(host, {
    name: 'NxWelcome',
    inlineTemplate: true,
    prefix: options.prefix,
    skipTests: true,
    style: 'none',
    flat: true,
    viewEncapsulation: 'None',
    project: options.name,
  });
  updateNxComponentTemplate(host, options);

  if (options.addTailwind) {
    await setupTailwindGenerator(host, {
      project: options.name,
      skipFormat: true,
    });
  }

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
