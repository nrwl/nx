import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';

export async function changeNxJsonPresets(tree: Tree) {
  const nxJson = readNxJson(tree);
  const replacements = {
    '@nrwl/workspace/presets/npm.json': 'nx/presets/npm.json',
    '@nrwl/workspace/presets/core.json': 'nx/presets/core.json',
  };
  if (nxJson.extends && replacements[nxJson.extends]) {
    updateNxJson(tree, {
      ...nxJson,
      extends: replacements[nxJson.extends],
    });
  }

  await formatFiles(tree);
}

export default changeNxJsonPresets;
