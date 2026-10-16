// Apart from ./config so reading a config does not load what composing needs
import type { AsyncNxComposableWebpackPlugin } from './config';

export const nxWebpackComposablePlugin = 'nxWebpackComposablePlugin';

export function isNxWebpackComposablePlugin(
  a: unknown
): a is AsyncNxComposableWebpackPlugin {
  return a?.[nxWebpackComposablePlugin] === true;
}
