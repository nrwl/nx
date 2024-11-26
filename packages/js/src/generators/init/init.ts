import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  readJson,
  readNxJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import { satisfies, valid } from 'semver';
import { createNodesV2 } from '../../plugins/typescript/plugin';
import { generatePrettierSetup } from '../../utils/prettier';
import { getRootTsConfigFileName } from '../../utils/typescript/ts-config';
import { isUsingTsSolutionSetup } from '../../utils/typescript/ts-solution-setup';
import {
  nxVersion,
  prettierVersion,
  supportedTypescriptVersions,
  swcCoreVersion,
  swcHelpersVersion,
  swcNodeVersion,
  tsLibVersion,
  typescriptVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

async function getInstalledTypescriptVersion(
  tree: Tree
): Promise<string | null> {
  const rootPackageJson = readJson(tree, 'package.json');
  const tsVersionInRootPackageJson =
    rootPackageJson.devDependencies?.['typescript'] ??
    rootPackageJson.dependencies?.['typescript'];

  if (!tsVersionInRootPackageJson) {
    return null;
  }
  if (valid(tsVersionInRootPackageJson)) {
    // it's a pinned version, return it
    return tsVersionInRootPackageJson;
  }

  // it's a version range, check whether the installed version matches it
  try {
    const tsPackageJson = readModulePackageJson('typescript').packageJson;
    const installedTsVersion =
      tsPackageJson.devDependencies?.['typescript'] ??
      tsPackageJson.dependencies?.['typescript'];
    // the installed version matches the package.json version range
    if (
      installedTsVersion &&
      satisfies(installedTsVersion, tsVersionInRootPackageJson)
    ) {
      return installedTsVersion;
    }
  } finally {
    return checkAndCleanWithSemver('typescript', tsVersionInRootPackageJson);
  }
}

export async function initGenerator(
  tree: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  schema.addTsPlugin ??= false;
  const isUsingNewTsSetup = schema.addTsPlugin || isUsingTsSolutionSetup(tree);
  schema.formatter ??= isUsingNewTsSetup ? 'none' : 'prettier';

  return initGeneratorInternal(tree, {
    addTsConfigBase: true,
    ...schema,
  });
}

export async function initGeneratorInternal(
  tree: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  schema.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addTsPlugin ??=
    schema.addPlugin && process.env.NX_ADD_TS_PLUGIN !== 'false';

  if (schema.addTsPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/js/typescript',
      createNodesV2,
      {
        typecheck: [
          { targetName: 'typecheck' },
          { targetName: 'tsc:typecheck' },
          { targetName: 'tsc-typecheck' },
        ],
        build: [
          { targetName: 'build', configName: 'tsconfig.lib.json' },
          { targetName: 'tsc:build', configName: 'tsconfig.lib.json' },
          { targetName: 'tsc-build', configName: 'tsconfig.lib.json' },
        ],
      },
      schema.updatePackageScripts
    );
  }

  if (schema.addTsConfigBase && !getRootTsConfigFileName(tree)) {
    if (schema.addTsPlugin) {
      generateFiles(tree, join(__dirname, './files/ts-solution'), '.', {
        tmpl: '',
      });
    } else {
      generateFiles(tree, join(__dirname, './files/non-ts-solution'), '.', {
        fileName: schema.tsConfigName ?? 'tsconfig.base.json',
      });
    }
  }

  const devDependencies = {
    '@nx/js': nxVersion,
    // When loading .ts config files (e.g. webpack.config.ts, jest.config.ts, etc.)
    // we prefer to use SWC, and fallback to ts-node for workspaces that don't use SWC.
    '@swc-node/register': swcNodeVersion,
    '@swc/core': swcCoreVersion,
    '@swc/helpers': swcHelpersVersion,
  };

  if (!schema.js && !schema.keepExistingVersions) {
    const installedTsVersion = await getInstalledTypescriptVersion(tree);

    if (
      !installedTsVersion ||
      !satisfies(installedTsVersion, supportedTypescriptVersions, {
        includePrerelease: true,
      })
    ) {
      devDependencies['typescript'] = typescriptVersion;
    }
  }

  if (schema.formatter === 'prettier') {
    const prettierTask = generatePrettierSetup(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(prettierTask);
  }

  const rootTsConfigFileName = getRootTsConfigFileName(tree);
  // If the root tsconfig file uses `importHelpers` then we must install tslib
  // in order to run tsc for build and typecheck.
  if (rootTsConfigFileName) {
    const rootTsConfig = readJson(tree, rootTsConfigFileName);
    if (rootTsConfig.compilerOptions?.importHelpers) {
      devDependencies['tslib'] = tsLibVersion;
    }
  }

  const installTask = !schema.skipPackageJson
    ? addDependenciesToPackageJson(
        tree,
        {},
        devDependencies,
        undefined,
        schema.keepExistingVersions
      )
    : () => {};
  tasks.push(installTask);

  if (
    !schema.skipPackageJson &&
    // For `create-nx-workspace` or `nx g @nx/js:init`, we want to make sure users didn't set formatter to none.
    // For programmatic usage, the formatter is normally undefined, and we want prettier to continue to be ensured, even if not ultimately installed.
    schema.formatter !== 'none'
  ) {
    ensurePackage('prettier', prettierVersion);
  }

  if (!schema.skipFormat) {
    // even if skipPackageJson === true, we can safely run formatFiles, prettier might
    // have been installed earlier and if not, the formatFiles function still handles it
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
