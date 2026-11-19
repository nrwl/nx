import type { Tree } from '@nx/devkit';
import {
  findRootJestConfig,
  type JestPresetExtension,
} from '../../../utils/config/config-file';
import type { NormalizedJestProjectSchema } from '../schema';

export function writeRootJestPreset(
  tree: Tree,
  presetExt: JestPresetExtension
) {
  if (!tree.exists(`jest.preset.${presetExt}`)) {
    if (presetExt === 'mjs') {
      tree.write(
        `jest.preset.${presetExt}`,
        `import { nxPreset } from '@nx/jest/preset.js';

export default { ...nxPreset };`
      );
    } else {
      // js or cjs
      tree.write(
        `jest.preset.${presetExt}`,
        `const nxPreset = require('@nx/jest/preset').default;

module.exports = { ...nxPreset };`
      );
    }
  }
}

export async function createJestConfig(
  tree: Tree,
  options: Partial<NormalizedJestProjectSchema>,
  presetExt: JestPresetExtension
) {
  writeRootJestPreset(tree, presetExt);
  if (options.rootProject) {
    // we don't want any config to be made because the `configurationGenerator` will do it.
    // will copy the template config file
    return;
  }
  if (!findRootJestConfig(tree)) {
    generateGlobalConfig(tree, options.js);
  }
}

function generateGlobalConfig(tree: Tree, isJS: boolean) {
  const contents = isJS
    ? `const { getJestProjectsAsync } = require('@nx/jest');

module.exports = async () => ({
  projects: await getJestProjectsAsync()
});`
    : `import type { Config } from 'jest';
import { getJestProjectsAsync } from '@nx/jest';

export default async (): Promise<Config> => ({
  projects: await getJestProjectsAsync()
});`;
  tree.write(`jest.config.${isJS ? 'js' : 'ts'}`, contents);
}
