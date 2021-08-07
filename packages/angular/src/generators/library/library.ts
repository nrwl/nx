import {
  formatFiles,
  getWorkspaceLayout,
  installPackagesTask,
  moveFilesToNewDirectory,
  Tree,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { jestProjectGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';

import init from '../../generators/init/init';
import addLintingGenerator from '../add-linting/add-linting';
import karmaProjectGenerator from '../karma-project/karma-project';

import { addModule } from './lib/add-module';
import { normalizeOptions } from './lib/normalize-options';
import { updateLibPackageNpmScope } from './lib/update-lib-package-npm-scope';
import { updateProject } from './lib/update-project';
import { updateTsConfig } from './lib/update-tsconfig';
import {
  enableStrictTypeChecking,
  setLibraryStrictDefault,
} from './lib/enable-strict-type-checking';
import { NormalizedSchema } from './lib/normalized-schema';
import { Schema } from './schema';
import { convertToNxProjectGenerator } from '@nrwl/workspace';

export async function libraryGenerator(host: Tree, schema: Partial<Schema>) {
  // Do some validation checks
  const options = normalizeOptions(host, schema);
  if (!options.routing && options.lazy) {
    throw new Error(`To use --lazy option, --routing must also be set.`);
  }

  if (options.enableIvy === true && !options.buildable) {
    throw new Error('enableIvy must only be used with buildable.');
  }

  if (options.publishable === true && !options.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  await init(host, {
    ...options,
    skipFormat: true,
  });

  const runAngularLibrarySchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'library'
  );
  await runAngularLibrarySchematic(host, {
    name: options.name,
    prefix: options.prefix,
    entryFile: 'index',
    skipPackageJson: !(options.publishable || options.buildable),
    skipTsConfig: true,
  });

  moveFilesToNewDirectory(host, options.name, options.projectRoot);
  await updateProject(host, options);
  updateTsConfig(host, options);
  await addUnitTestRunner(host, options);
  updateNpmScopeIfBuildableOrPublishable(host, options);
  addModule(host, options);
  setStrictMode(host, options);
  await addLinting(host, options);

  if (options.standaloneConfig) {
    await convertToNxProjectGenerator(host, {
      project: options.name,
      all: false,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return () => {
    installPackagesTask(host);
  };
}

async function addUnitTestRunner(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === 'jest') {
    await jestProjectGenerator(host, {
      project: options.name,
      setupFile: 'angular',
      supportTsx: false,
      skipSerializers: false,
    });
  } else if (options.unitTestRunner === 'karma') {
    await karmaProjectGenerator(host, {
      project: options.name,
    });
  }
}

function updateNpmScopeIfBuildableOrPublishable(
  host: Tree,
  options: NormalizedSchema
) {
  if (options.buildable || options.publishable) {
    updateLibPackageNpmScope(host, options);
  }
}

function setStrictMode(host: Tree, options: NormalizedSchema) {
  if (options.strict) {
    enableStrictTypeChecking(host, options);
  } else {
    setLibraryStrictDefault(host, options.strict);
  }
}

async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.None) {
    return;
  }
  await addLintingGenerator(host, {
    projectName: options.name,
    projectRoot: options.projectRoot,
    prefix: options.prefix,
  });
}

export default libraryGenerator;
