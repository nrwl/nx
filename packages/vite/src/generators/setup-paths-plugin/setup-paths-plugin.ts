import {
  addDependenciesToPackageJson,
  formatFiles,
  globAsync,
  Tree,
} from '@nx/devkit';
import { getInstalledViteMajorVersion } from '../../utils/version-utils';
import { viteTsconfigPathsVersion } from '../../utils/versions';
import { assertSupportedViteVersion } from '../../utils/assert-supported-vite-version';
import {
  addTsconfigPathsResolution,
  addTsconfigPathsPlugin,
} from '../../utils/vite-config-edit-utils';

export async function setupPathsPlugin(
  tree: Tree,
  schema: { skipFormat?: boolean }
) {
  assertSupportedViteVersion(tree);

  const files = await globAsync(tree, [
    '**/vite.config.{js,ts,mjs,mts,cjs,cts}',
  ]);

  const useNativePaths = (getInstalledViteMajorVersion(tree) ?? 8) >= 8;
  let addedPlugin = false;
  for (const file of files) {
    const content = tree.read(file, 'utf-8');
    const updated = useNativePaths
      ? addTsconfigPathsResolution(content)
      : addTsconfigPathsPlugin(content, /\.c[jt]s$/.test(file));
    if (updated !== content) {
      tree.write(file, updated);
      addedPlugin ||= !useNativePaths;
    }
  }

  if (addedPlugin) {
    addDependenciesToPackageJson(
      tree,
      {},
      { 'vite-tsconfig-paths': viteTsconfigPathsVersion },
      undefined,
      true
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default setupPathsPlugin;
