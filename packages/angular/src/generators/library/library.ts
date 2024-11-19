import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { addTsConfigPath, initGenerator as jsInitGenerator } from '@nx/js';
import init from '../../generators/init/init';
import addLintingGenerator from '../add-linting/add-linting';
import setupTailwindGenerator from '../setup-tailwind/setup-tailwind';
import { versions } from '../utils/version-utils';
import { addBuildableLibrariesPostCssDependencies } from '../utils/dependencies';
import { addModule } from './lib/add-module';
import { addStandaloneComponent } from './lib/add-standalone-component';
import {
  enableStrictTypeChecking,
  setLibraryStrictDefault,
} from './lib/enable-strict-type-checking';
import { normalizeOptions } from './lib/normalize-options';
import { NormalizedSchema } from './lib/normalized-schema';
import { updateLibPackageNpmScope } from './lib/update-lib-package-npm-scope';
import { updateTsConfig } from './lib/update-tsconfig';
import { Schema } from './schema';
import { createFiles } from './lib/create-files';
import { addProject } from './lib/add-project';
import { addJest } from '../utils/add-jest';
import { setGeneratorDefaults } from './lib/set-generator-defaults';
import { ensureAngularDependencies } from '../utils/ensure-angular-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { UnitTestRunner } from '../../utils/test-runners';
import { addVitest } from '../utils/add-vitest';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

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

  const project = addProject(tree, libraryOptions);

  createFiles(tree, options, project);
  updateTsConfig(tree, libraryOptions);
  await addUnitTestRunner(tree, libraryOptions);
  updateNpmScopeIfBuildableOrPublishable(tree, libraryOptions);
  setGeneratorDefaults(tree, options);

  if (!libraryOptions.standalone) {
    addModule(tree, libraryOptions);
  } else {
    await addStandaloneComponent(tree, options);
  }

  setStrictMode(tree, libraryOptions);
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

  addTsConfigPath(tree, libraryOptions.importPath, [
    joinPathFragments(libraryOptions.projectRoot, './src', 'index.ts'),
  ]);

  if (!libraryOptions.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
    logShowProjectCommand(libraryOptions.name);
  };
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

function setStrictMode(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.strict) {
    enableStrictTypeChecking(host, options);
  } else {
    setLibraryStrictDefault(host, options.strict);
  }
}

async function addLinting(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.linter === Linter.None) {
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
