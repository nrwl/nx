import { type Tree, joinPathFragments } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

export const REMIX_PROPERTY_MAPPINGS = {
  sourcemap: 'sourcemap',
  devServerPort: 'port',
  command: 'command',
  manual: 'manual',
  tlsKey: 'tls-key',
  tlsCert: 'tls-cert',
};

export function getConfigFilePath(tree: Tree, root: string) {
  return [
    joinPathFragments(root, `remix.config.js`),
    joinPathFragments(root, `remix.config.cjs`),
    joinPathFragments(root, `remix.config.mjs`),
  ].find((f) => tree.exists(f));
}
