import type { Plugin } from 'vite';
import type { AssetGlob } from '@nx/js/internal';
import { warnNxCopyAssetsPluginDeprecation } from '../src/utils/deprecation';

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function nxCopyAssetsPlugin(_assets: (string | AssetGlob)[]): Plugin {
  warnNxCopyAssetsPluginDeprecation();
  return { name: 'nx-copy-assets-plugin' };
}
