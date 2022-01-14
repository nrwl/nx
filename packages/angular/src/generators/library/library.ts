import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  moveFilesToNewDirectory,
  Tree,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { jestProjectGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';
import { convertToNxProjectGenerator } from '@nrwl/workspace';
import init from '../../generators/init/init';
import { postcssVersion } from '../../utils/versions';
import addLintingGenerator from '../add-linting/add-linting';
import karmaProjectGenerator from '../karma-project/karma-project';
import setupTailwindGenerator from '../setup-tailwind/setup-tailwind';
import { addModule } from './lib/add-module';
import {
  enableStrictTypeChecking,
  setLibraryStrictDefault,
} from './lib/enable-strict-type-checking';
import { normalizeOptions } from './lib/normalize-options';
import { NormalizedSchema } from './lib/normalized-schema';
import { updateLibPackageNpmScope } from './lib/update-lib-package-npm-scope';
import { updateProject } from './lib/update-project';
import { updateTsConfig } from './lib/update-tsconfig';
import { Schema } from './schema';

export async function libraryGenerator(host: Tree, schema: Partial<Schema>) {
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

  const options = normalizeOptions(host, schema);

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

  if (options.addTailwind) {
    await setupTailwindGenerator(host, {
      project: options.name,
      skipFormat: true,
    });
  }

  if (options.buildable || options.publishable) {
    addDependenciesToPackageJson(
      host,
      {},
      {
        postcss: postcssVersion,
        'postcss-import': '^14.0.2',
        'postcss-preset-env': '^6.7.0',
        'postcss-url': '^10.1.1',
      }
    );
  }

  if (options.standaloneConfig) {
    await convertToNxProjectGenerator(host, {
      project: options.name,
      all: false,
      skipFormat: true,
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
      skipFormat: true,
    });
  } else if (options.unitTestRunner === 'karma') {
    await karmaProjectGenerator(host, {
      project: options.name,
      skipFormat: true,
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
    setParserOptionsProject: options.setParserOptionsProject,
    skipFormat: true,
  });
}

export default libraryGenerator;
