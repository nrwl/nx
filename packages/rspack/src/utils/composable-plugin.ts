// Apart from ./config so reading a config does not load what composing needs
import type { AsyncNxComposableRspackPlugin } from './config';

export const nxRspackComposablePlugin = 'nxRspackComposablePlugin';

export function isNxRspackComposablePlugin(
  a: unknown
): a is AsyncNxComposableRspackPlugin {
  return a?.[nxRspackComposablePlugin] === true;
}
