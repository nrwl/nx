import {
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  offsetFromRoot,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { angularInitGenerator } from '../init/init';
import { setupSsr } from '../setup-ssr/setup-ssr';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import { ensureAngularDependencies } from '../utils/ensure-angular-dependencies';
import {
  addE2e,
  addLinting,
  addProxyConfig,
  addServeStaticTarget,
  addUnitTestRunner,
  createFiles,
  createProject,
  enableStrictTypeChecking,
  normalizeOptions,
  setApplicationStrictDefault,
  setGeneratorDefaults,
  updateEditorTsConfig,
} from './lib';
import type { Schema } from './schema';

export async function applicationGenerator(
  tree: Tree,
  schema: Partial<Schema>
): Promise<GeneratorCallback> {
  assertNotUsingTsSolutionSetup(tree, 'angular', 'application');

  const options = await normalizeOptions(tree, schema);
  const rootOffset = offsetFromRoot(options.appProjectRoot);

  await jsInitGenerator(tree, {
    ...options,
    tsConfigName: options.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    js: false,
    skipFormat: true,
  });
  await angularInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });

  if (!options.skipPackageJson) {
    ensureAngularDependencies(tree);
  }

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
  const e2ePort = await addE2e(tree, options);
  addServeStaticTarget(
    tree,
    options,
    options.e2eTestRunner !== 'none' ? e2ePort : options.port
  );
  updateEditorTsConfig(tree, options);
  setGeneratorDefaults(tree, options);

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

  if (options.ssr) {
    await setupSsr(tree, {
      project: options.name,
      standalone: options.standalone,
      skipPackageJson: options.skipPackageJson,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
    logShowProjectCommand(options.name);
  };
}

export default applicationGenerator;
