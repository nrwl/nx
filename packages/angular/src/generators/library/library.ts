import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  logger,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { releaseTasks } from '@nx/js/src/generators/library/utils/add-release-config';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import init from '../../generators/init/init';
import { UnitTestRunner } from '../../utils/test-runners';
import addLintingGenerator from '../add-linting/add-linting';
import setupTailwindGenerator from '../setup-tailwind/setup-tailwind';
import { addJest } from '../utils/add-jest';
import { addVitest } from '../utils/add-vitest';
import { addBuildableLibrariesPostCssDependencies } from '../utils/dependencies';
import { ensureAngularDependencies } from '../utils/ensure-angular-dependencies';
import { versions } from '../utils/version-utils';
import { addModule } from './lib/add-module';
import { addProject } from './lib/add-project';
import { addStandaloneComponent } from './lib/add-standalone-component';
import { createFiles } from './lib/create-files';
import { normalizeOptions } from './lib/normalize-options';
import { NormalizedSchema } from './lib/normalized-schema';
import { setGeneratorDefaults } from './lib/set-generator-defaults';
import { updateLibPackageNpmScope } from './lib/update-lib-package-npm-scope';
import { updateTsConfigFiles } from './lib/update-tsconfig-files';
import { Schema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  assertNotUsingTsSolutionSetup(tree, 'angular', 'library');

  // Do some validation checks
  if (!schema.routing && schema.lazy) {
    throw new Error(`To use "--lazy" option, "--routing" must also be set.`);
  }

  if (schema.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  if (schema.addTailwind && !schema.buildable && !schema.publishable) {
    throw new Error(
      `To use "--addTailwind" option, you have to set either "--buildable" or "--publishable".`
    );
  }

  const options = await normalizeOptions(tree, schema);
  const { libraryOptions } = options;

  const pkgVersions = versions(tree);

  await jsInitGenerator(tree, {
    ...libraryOptions,
    js: false,
    skipFormat: true,
  });
  await init(tree, { ...libraryOptions, skipFormat: true });

  if (!libraryOptions.skipPackageJson) {
    ensureAngularDependencies(tree);
  }

  const project = await addProject(tree, libraryOptions);

  createFiles(tree, options, project);
  await addUnitTestRunner(tree, libraryOptions);
  updateTsConfigFiles(tree, libraryOptions);
  updateNpmScopeIfBuildableOrPublishable(tree, libraryOptions);
  setGeneratorDefaults(tree, options);

  if (!libraryOptions.standalone) {
    addModule(tree, libraryOptions);
  } else {
    await addStandaloneComponent(tree, options);
  }

  await addLinting(tree, libraryOptions);

  if (libraryOptions.addTailwind) {
    await setupTailwindGenerator(tree, {
      project: libraryOptions.name,
      skipFormat: true,
      skipPackageJson: libraryOptions.skipPackageJson,
    });
  }

  if (
    (libraryOptions.buildable || libraryOptions.publishable) &&
    !libraryOptions.skipPackageJson
  ) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        'ng-packagr': pkgVersions.ngPackagrVersion,
      },
      undefined,
      true
    );
    addBuildableLibrariesPostCssDependencies(tree);
  }

  if (!libraryOptions.skipFormat) {
    await formatFiles(tree);
  }

  const tasks: GeneratorCallback[] = [() => installPackagesTask(tree)];
  if (libraryOptions.publishable) {
    tasks.push(await releaseTasks(tree));
  }
  tasks.push(() => logShowProjectCommand(libraryOptions.name));

  return runTasksInSerial(...tasks);
}

async function addUnitTestRunner(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Jest:
      await addJest(host, {
        name: options.name,
        projectRoot: options.projectRoot,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
      });
      break;
    case UnitTestRunner.Vitest:
      await addVitest(host, {
        name: options.name,
        projectRoot: options.projectRoot,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
      });
      break;
  }
}

function updateNpmScopeIfBuildableOrPublishable(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.buildable || options.publishable) {
    updateLibPackageNpmScope(host, options);
  }
}

async function addLinting(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.linter === 'none') {
    return;
  }
  await addLintingGenerator(host, {
    projectName: options.name,
    projectRoot: options.projectRoot,
    prefix: options.prefix,
    unitTestRunner: options.unitTestRunner,
    setParserOptionsProject: options.setParserOptionsProject,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });
}

export default libraryGenerator;
