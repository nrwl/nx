import { acknowledgeBuildScripts, addPlugin } from '@nx/devkit/internal';
import {
  type Tree,
  type GeneratorCallback,
  readNxJson,
  createProjectGraphAsync,
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  runTasksInSerial,
} from '@nx/devkit';
import { InitGeneratorSchema } from './schema';
import { createNodes } from '../../plugins/plugin';
import { nxVersion } from '../../utils/versions';
import {
  getInstalledRsbuildMajorVersion,
  getRsbuildVersionsForInstalledMajor,
} from '../../utils/version-utils';
import { assertSupportedRsbuildVersion } from '../../utils/assert-supported-rsbuild-version';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  const rsbuildVersions = getRsbuildVersionsForInstalledMajor(tree);

  if (getInstalledRsbuildMajorVersion(tree) === 1) {
    // @rsbuild/core v1 depends on core-js, whose install script only prints a
    // funding message.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      'core-js': false,
    });
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/rsbuild': nxVersion,
      '@rsbuild/core': rsbuildVersions.rsbuildVersion,
    },
    undefined,
    schema.keepExistingVersions ?? true
  );
}

export function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function initGeneratorInternal(
  tree: Tree,
  schema: InitGeneratorSchema
) {
  assertSupportedRsbuildVersion(tree);

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/rsbuild',
      createNodes,
      {
        buildTargetName: ['build', 'rsbuild:build', 'rsbuild-build'],
        devTargetName: ['dev', 'rsbuild:dev', 'rsbuild-dev'],
        previewTargetName: ['preview', 'rsbuild:preview', 'rsbuild-preview'],
        inspectTargetName: ['inspect', 'rsbuild:inspect', 'rsbuild-inspect'],
        typecheckTargetName: [
          'typecheck',
          'rsbuild:typecheck',
          'rsbuild-typecheck',
        ],
        buildDepsTargetName: [
          'build-deps',
          'rsbuild:build-deps',
          'rsbuild-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'rsbuild:watch-deps',
          'rsbuild-watch-deps',
        ],
      },

      schema.updatePackageScripts
    );
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(updateDependencies(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
