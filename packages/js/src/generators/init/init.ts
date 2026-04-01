import { addPlugin } from '@nx/devkit/internal';
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
import { join } from 'path';
import { createNodesV2 } from '../../plugins/typescript/plugin';
import { assertSupportedTypescriptVersion } from '../../utils/assert-supported-typescript-version';
import { generateOxfmtSetup } from '../../utils/oxfmt';
import { generatePrettierSetup } from '../../utils/prettier';
import { getTsConfigBaseOptions } from '../../utils/typescript/create-ts-config';
import { getRootTsConfigFileName } from '../../utils/typescript/ts-config';
import {
  getCustomConditionName,
  isUsingTsSolutionSetup,
} from '../../utils/typescript/ts-solution-setup';
import {
  nxVersion,
  prettierVersion,
  swcHelpersVersion,
  tsLibVersion,
  typescriptVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

export async function initGenerator(
  tree: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  schema.addTsPlugin ??= false;
  const isUsingNewTsSetup = schema.addTsPlugin || isUsingTsSolutionSetup(tree);
  schema.formatter ??= isUsingNewTsSetup ? 'none' : 'oxfmt';

  return initGeneratorInternal(tree, {
    addTsConfigBase: true,
    ...schema,
  });
}

export async function initGeneratorInternal(
  tree: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  assertSupportedTypescriptVersion(tree);

  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  schema.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addTsPlugin ??= schema.addPlugin;

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
          {
            targetName: 'build',
            configName: 'tsconfig.lib.json',
            buildDepsName: 'build-deps',
            watchDepsName: 'watch-deps',
          },
          {
            targetName: 'tsc:build',
            configName: 'tsconfig.lib.json',
            buildDepsName: 'tsc:build-deps',
            watchDepsName: 'tsc:watch-deps',
          },
          {
            targetName: 'tsc-build',
            configName: 'tsconfig.lib.json',
            buildDepsName: 'tsc-build-deps',
            watchDepsName: 'tsc-watch-deps',
          },
        ],
      },
      schema.updatePackageScripts
    );
  }

  if (schema.addTsConfigBase && !getRootTsConfigFileName(tree)) {
    if (schema.addTsPlugin) {
      const platform = schema.platform ?? 'node';
      const customCondition = getCustomConditionName(tree);
      generateFiles(tree, join(__dirname, './files/ts-solution'), '.', {
        platform,
        customCondition,
        tmpl: '',
      });
    } else {
      generateFiles(tree, join(__dirname, './files/non-ts-solution'), '.', {
        fileName: schema.tsConfigName ?? 'tsconfig.base.json',
        moduleResolution: getTsConfigBaseOptions(tree).moduleResolution,
      });
    }
  }

  const devDependencies: Record<string, string> = {
    '@nx/js': nxVersion,
    // Required by SWC-compiled output (decorators -> @swc/helpers/_/_ts_decorate
    // imports). The default @nx/jest setup transforms with @swc/jest, so any
    // workspace using decorators (NestJS, Angular, etc.) needs @swc/helpers
    // resolvable at test time. Cheap to ship and avoids per-generator install.
    '@swc/helpers': swcHelpersVersion,
  };
  // @swc-node/register and @swc/core are no longer installed by init - native
  // Node.js type stripping handles .ts config loading on Node 23+ (or 22.6+
  // with --experimental-strip-types). loadTsFile registers swc/ts-node lazily
  // when a config uses syntax native strip can't handle.

  if (!schema.js) {
    devDependencies['typescript'] = typescriptVersion;
  }

  if (schema.formatter === 'prettier') {
    const prettierTask = generatePrettierSetup(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(prettierTask);
  } else if (schema.formatter === 'oxfmt') {
    const oxfmtTask = generateOxfmtSetup(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(oxfmtTask);
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
        schema.keepExistingVersions ?? true
      )
    : () => {};
  tasks.push(installTask);

  if (!schema.skipPackageJson && schema.formatter === 'prettier') {
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
