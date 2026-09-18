import { formatFiles, globAsync, Tree } from '@nx/devkit';
import { assertSupportedViteVersion } from '../../utils/assert-supported-vite-version';
import { addTsconfigPathsResolution } from '../../utils/vite-config-edit-utils';

export async function setupPathsPlugin(
  tree: Tree,
  schema: { skipFormat?: boolean }
) {
  assertSupportedViteVersion(tree);

  const files = await globAsync(tree, [
    '**/vite.config.{js,ts,mjs,mts,cjs,cts}',
  ]);

  for (const file of files) {
    const content = tree.read(file, 'utf-8');
    const updated = addTsconfigPathsResolution(content);
    if (updated !== content) {
      tree.write(file, updated);
    }
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default setupPathsPlugin;
