import { Tree, joinPathFragments, logger } from '@nx/devkit';
import { getExpoAppRoots } from './lib/expo-apps';

const REPLACEMENTS: Array<[from: string, to: string]> = [
  [
    "const { getDefaultConfig } = require('@expo/metro-config');",
    "const { getDefaultConfig } = require('expo/metro-config');",
  ],
  [
    "const { mergeConfig } = require('metro-config');",
    "const { mergeConfig } = require('@expo/metro/metro-config');",
  ],
];

/**
 * Expo SDK 55+ ships Metro via the `@expo/metro` package family. Update the
 * generated `metro.config.js` to source `getDefaultConfig`/`mergeConfig` from
 * `expo/metro-config` and `@expo/metro/metro-config` instead of the standalone
 * `metro-config`. Only files matching the generated form are rewritten;
 * customized configs are left untouched.
 */
export default function update(tree: Tree) {
  for (const projectRoot of getExpoAppRoots(tree)) {
    const metroConfigPath = joinPathFragments(projectRoot, 'metro.config.js');
    if (!tree.exists(metroConfigPath)) {
      continue;
    }

    let content = tree.read(metroConfigPath, 'utf-8');
    if (!content) {
      continue;
    }

    const original = content;
    for (const [from, to] of REPLACEMENTS) {
      if (content.includes(from)) {
        content = content.replace(from, to);
      }
    }

    if (content !== original) {
      tree.write(metroConfigPath, content);
      logger.info(
        `Updated ${metroConfigPath} to use @expo/metro for Expo SDK 56.`
      );
    }
  }
}
