import {
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { jestProjectGenerator } from '@nx/jest';
import { Linter } from '@nx/linter';
import { addTsConfigPath } from '@nx/js';
import { lt } from 'semver';
import init from '../../generators/init/init';
import { E2eTestRunner } from '../../utils/test-runners';
import addLintingGenerator from '../add-linting/add-linting';
import setupTailwindGenerator from '../setup-tailwind/setup-tailwind';
import {
  addDependenciesToPackageJsonIfDontExist,
  getInstalledAngularVersionInfo,
  versions,
} from '../utils/version-utils';
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

export async function libraryGenerator(
  tree: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
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

  const userInstalledAngularVersion = getInstalledAngularVersionInfo(tree);
  if (lt(userInstalledAngularVersion.version, '14.1.0') && schema.standalone) {
    throw new Error(
      `The "--standalone" option is not supported in Angular versions < 14.1.0.`
    );
  }

  const options = normalizeOptions(tree, schema);
  const { libraryOptions } = options;

  const pkgVersions = versions(tree);

  await init(tree, {
    ...libraryOptions,
    skipFormat: true,
    e2eTestRunner: E2eTestRunner.None,
  });

  const project = addProject(tree, libraryOptions);

  createFiles(tree, options, project);
  updateTsConfig(tree, libraryOptions);
  await addUnitTestRunner(tree, libraryOptions);
  updateNpmScopeIfBuildableOrPublishable(tree, libraryOptions);

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
    });
  }

  if (libraryOptions.buildable || libraryOptions.publishable) {
    addDependenciesToPackageJsonIfDontExist(
      tree,
      {},
      {
        'ng-packagr': pkgVersions.ngPackagrVersion,
      }
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
  };
}

async function addUnitTestRunner(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.unitTestRunner === 'jest') {
    await jestProjectGenerator(host, {
      project: options.name,
      setupFile: 'angular',
      supportTsx: false,
      skipSerializers: false,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
    });
    const setupFile = joinPathFragments(
      options.projectRoot,
      'src',
      'test-setup.ts'
    );
    if (options.strict && host.exists(setupFile)) {
      const contents = host.read(setupFile, 'utf-8');
      host.write(
        setupFile,
        `// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
  testEnvironmentOptions: {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  },
};
${contents}`
      );
    }
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
