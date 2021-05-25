import {
  formatFiles,
  installPackagesTask,
  moveFilesToNewDirectory,
  Tree,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { jestProjectGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/workspace';

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

export default async function (host: Tree, schema: Schema) {
  // Do some validation checks
  const options = normalizeOptions(host, schema);
  if (!options.routing && options.lazy) {
    throw new Error(`routing must be set`);
  }

  if (options.enableIvy === true && !options.buildable) {
    throw new Error('enableIvy must only be used with buildable.');
  }

  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  console.log('Initializing library generator');
  init(host, {
    ...options,
    skipFormat: true,
  });

  console.log('Scaffolding initial files');
  const runAngularLibrarySchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'library'
  );
  await runAngularLibrarySchematic(host, {
    name: options.name,
    prefix: options.prefix,
    entryFile: 'index',
    skipPackageJson: !(options.publishable || options.buildable),
    skipTsConfig: false,
  });

  console.log('Moving to correct directory');
  moveFilesToNewDirectory(host, options.name, options.projectRoot);

  console.log('Updating project configuration');
  await updateProject(host, options);

  console.log("Updating project's TS Config");
  updateTsConfig(host, options);

  console.log('Adding unit test runner');
  await addUnitTestRunner(host, options);

  console.log('If Buildable/Publishable, fix up npm scope');
  updateNpmScopeIfBuildableOrPublishable(host, options);

  console.log('Add Angular Module');
  addModule(host, options);

  console.log('Determine if strict mode should be set');
  setStrictMode(host, options);

  console.log('Add Linter');
  await addLinting(host, options);

  console.log('Formatting files');
  await formatFiles(host);

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
