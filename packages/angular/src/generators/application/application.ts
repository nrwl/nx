import {
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  offsetFromRoot,
  readNxJson,
  stripIndents,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { angularInitGenerator } from '../init/init';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import {
  addE2e,
  addLinting,
  addProxyConfig,
  addUnitTestRunner,
  createFiles,
  createProject,
  enableStrictTypeChecking,
  normalizeOptions,
  setApplicationStrictDefault,
  updateEditorTsConfig,
} from './lib';
import type { Schema } from './schema';
import { gte, lt } from 'semver';
import { prompt } from 'enquirer';

export async function applicationGenerator(
  tree: Tree,
  schema: Partial<Schema>
): Promise<GeneratorCallback> {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

  if (lt(installedAngularVersionInfo.version, '14.1.0') && schema.standalone) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }

  if (
    gte(installedAngularVersionInfo.version, '14.1.0') &&
    schema.standalone === undefined &&
    process.env.NX_INTERACTIVE === 'true'
  ) {
    schema.standalone = await prompt({
      name: 'standalone-components',
      message: 'Would you like to use Standalone Components?',
      type: 'confirm',
    }).then((a) => a['standalone-components']);
  }

  const options = normalizeOptions(tree, schema);
  const rootOffset = offsetFromRoot(options.appProjectRoot);

  await angularInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });

  createProject(tree, options);

  await createFiles(tree, options, rootOffset);

  if (options.addTailwind) {
    await setupTailwindGenerator(tree, {
      project: options.name,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
    });
  }

  await addLinting(tree, options);
  await addUnitTestRunner(tree, options);
  await addE2e(tree, options);
  updateEditorTsConfig(tree, options);

  if (options.rootProject) {
    const nxJson = readNxJson(tree);
    nxJson.defaultProject = options.name;
    updateNxJson(tree, nxJson);
  }

  if (options.backendProject) {
    addProxyConfig(tree, options);
  }

  if (options.strict) {
    enableStrictTypeChecking(tree, options);
  } else {
    setApplicationStrictDefault(tree, false);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}

export default applicationGenerator;
