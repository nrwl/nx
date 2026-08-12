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
import { detectFormatterInTree } from '@nx/devkit/internal';
import { join } from 'path';
import { createNodesV2 } from '../../plugins/typescript/plugin';
import { assertSupportedTypescriptVersion } from '../../utils/assert-supported-typescript-version';
import { getFormatterSetup } from '../../utils/formatter-setup';
import { assertNxSupportsFormatters } from '../../utils/nx-formatter-internals';
import { getTsConfigBaseOptions } from '../../utils/typescript/create-ts-config';
import { getRootTsConfigFileName } from '../../utils/typescript/ts-config';
import {
  getCustomConditionName,
  isUsingTsSolutionSetup,
} from '../../utils/typescript/ts-solution-setup';
import {
  nxVersion,
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
  assertNxSupportsFormatters();
  const isUsingNewTsSetup = schema.addTsPlugin || isUsingTsSolutionSetup(tree);
  // Defer to `detectFormatterInTree` rather than re-deriving: it encodes the
  // oxfmt-over-prettier precedence, which a prettier-first check gets backwards
  // for a workspace configured with both. Programmatic callers only -
  // `schema.json` defaults to "none", which the runner applies before this.
  schema.formatter ??=
    detectFormatterInTree(tree) ?? (isUsingNewTsSetup ? 'none' : 'oxfmt');

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

  // One table drives both halves of formatter setup - writing the config and
  // making the package resolvable further down. They were separate `if` chains
  // over the same union, forty lines apart, so a third formatter meant finding
  // both.
  const formatterSetup = getFormatterSetup(schema.formatter);

  if (formatterSetup) {
    tasks.push(
      formatterSetup.setUp(tree, { skipPackageJson: schema.skipPackageJson })
    );
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

  if (!schema.skipFormat) {
    // `installTask` is queued, not run, so the formatter just added to
    // package.json is not on disk yet; ensurePackage installs it out of band
    // and puts it on NODE_PATH. Skipped when the caller asked us not to manage
    // dependencies, when formatting is skipped anyway, or under --dry-run,
    // where ensurePackage throws on a package that is not yet resolvable.
    const isDryRun =
      !!process.env.NX_DRY_RUN && process.env.NX_DRY_RUN !== 'false';
    if (
      formatterSetup &&
      !schema.skipPackageJson &&
      !isDryRun &&
      process.env.NX_SKIP_FORMAT !== 'true'
    ) {
      // `schema.formatter` is the table key here, so it is also the npm
      // package name - it got past `getFormatterSetup` to produce
      // `formatterSetup`.
      ensurePackage(schema.formatter, formatterSetup.version);
    }
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
