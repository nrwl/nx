import {
  type ExpandedPluginConfiguration,
  type Tree,
  readNxJson,
  formatFiles,
} from '@nx/devkit';
import { addTargetDefault } from '@nx/devkit/src/generators/target-defaults-utils';
import type { CypressPluginOptions } from '../../plugins/plugin';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins) {
    return;
  }

  const cypressPlugin = nxJson.plugins.find((p) =>
    typeof p === 'string'
      ? p === '@nx/cypress/plugin'
      : p.plugin === '@nx/cypress/plugin'
  );

  if (!cypressPlugin) {
    return;
  }

  const ciTargetName =
    typeof cypressPlugin === 'string'
      ? 'e2e-ci'
      : (cypressPlugin as ExpandedPluginConfiguration<CypressPluginOptions>)
          .options?.ciTargetName
      ? (cypressPlugin as ExpandedPluginConfiguration<CypressPluginOptions>)
          .options.ciTargetName
      : 'e2e-ci';

  const ciTargetNameGlob = `${ciTargetName}--**/*`;
  addTargetDefault(tree, ciTargetNameGlob, {
    dependsOn: ['^build'],
  });

  await formatFiles(tree);
}
