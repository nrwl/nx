import type { Plugin } from 'vite';
import type { AssetGlob } from '@nx/js/internal';
import { warnNxCopyAssetsPluginDeprecation } from '../src/utils/deprecation';

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use Vite's `publicDir` option or
 * `vite-plugin-static-copy`.
 * This inert stub will be removed in Nx v25.
 */
export function nxCopyAssetsPlugin(_assets: (string | AssetGlob)[]): Plugin {
  warnNxCopyAssetsPluginDeprecation();
  return { name: 'nx-copy-assets-plugin' };
}
