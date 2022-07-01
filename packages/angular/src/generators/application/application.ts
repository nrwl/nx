import {
  formatFiles,
  installPackagesTask,
  moveFilesToNewDirectory,
  Tree,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { UnitTestRunner } from '../../utils/test-runners';
import { angularInitGenerator } from '../init/init';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import {
  addE2e,
  addLinting,
  addMf,
  addProxyConfig,
  addRouterRootConfiguration,
  addUnitTestRunner,
  createFiles,
  enableStrictTypeChecking,
  normalizeOptions,
  setApplicationStrictDefault,
  setDefaultProject,
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
    skipPackageJson: options.skipPackageJson,
  });

  if (options.ngCliSchematicAppRoot !== options.appProjectRoot) {
    moveFilesToNewDirectory(
      host,
      options.ngCliSchematicAppRoot,
      options.appProjectRoot
    );
  }

  createFiles(host, options);
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
    inlineStyle: true,
    prefix: options.prefix,
    skipTests: true,
    style: options.style,
    flat: true,
    viewEncapsulation: 'None',
    project: options.name,
  });
  updateNxComponentTemplate(host, options);

  if (options.addTailwind) {
    await setupTailwindGenerator(host, {
      project: options.name,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
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
  await addE2e(host, options);
  updateEditorTsConfig(host, options);
  setDefaultProject(host, options);

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

  if (options.mf) {
    await addMf(host, options);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return () => {
    installPackagesTask(host);
  };
}

export default applicationGenerator;
