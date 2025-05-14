import { type Tree, ensurePackage } from '@nx/devkit';
import { nxVersion } from '../../../../utils/versions';
import { Schema, NormalizedSchema } from '../../schema';

export async function initWebpack(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  const { webpackInitGenerator } = ensurePackage<typeof import('@nx/webpack')>(
    '@nx/webpack',
    nxVersion
  );
  const webpackInitTask = await webpackInitGenerator(tree, {
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    addPlugin: options.addPlugin,
  });
  tasks.push(webpackInitTask);
  if (!options.skipPackageJson) {
    const { ensureDependencies } = await import(
      '@nx/webpack/src/utils/ensure-dependencies'
    );
    tasks.push(ensureDependencies(tree, { uiFramework: 'react' }));
  }
}
