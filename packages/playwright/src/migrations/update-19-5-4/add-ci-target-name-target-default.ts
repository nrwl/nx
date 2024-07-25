import {
  type ExpandedPluginConfiguration,
  type Tree,
  readNxJson,
} from '@nx/devkit';
import { addTargetDefault } from '@nx/devkit/src/generators/target-defaults-utils';
import type { PlaywrightPluginOptions } from '../../plugins/plugin';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins) {
    return;
  }

  const playwrightPlugin = nxJson.plugins.find((p) =>
    typeof p === 'string'
      ? p === '@nx/playwright/plugin'
      : p.plugin === '@nx/playwright/plugin'
  );

  if (!playwrightPlugin) {
    return;
  }

  const ciTargetName =
    typeof playwrightPlugin === 'string'
      ? 'e2e-ci'
      : (
          playwrightPlugin as ExpandedPluginConfiguration<PlaywrightPluginOptions>
        ).options?.ciTargetName
      ? (
          playwrightPlugin as ExpandedPluginConfiguration<PlaywrightPluginOptions>
        ).options.ciTargetName
      : 'e2e-ci';

  const ciTargetNameGlob = `${ciTargetName}--**/*`;
  addTargetDefault(tree, ciTargetNameGlob, {
    dependsOn: ['^build'],
  });
}
