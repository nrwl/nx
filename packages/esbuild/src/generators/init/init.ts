import {
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { esbuildVersion } from '@nx/js/internal';
import { assertSupportedEsbuildVersion } from '../../utils/assert-supported-esbuild-version';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

export async function esbuildInitGenerator(tree: Tree, schema: Schema) {
  assertSupportedEsbuildVersion(tree);

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    // esbuild's install script only validates the prebuilt binary shipped via
    // optional dependencies, so skip it.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      esbuild: false,
    });
    installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/esbuild': nxVersion,
        esbuild:
          getDependencyVersionFromPackageJson(tree, 'esbuild') ??
          esbuildVersion,
      },
      undefined,
      schema.keepExistingVersions ?? true
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default esbuildInitGenerator;
