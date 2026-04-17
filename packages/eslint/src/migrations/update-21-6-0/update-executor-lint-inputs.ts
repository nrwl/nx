import { type Tree, formatFiles, readNxJson, updateNxJson } from '@nx/devkit';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  const executor = '@nx/eslint:lint';

  if (!nxJson.targetDefaults?.[executor]?.inputs) {
    return;
  }

  const inputs = nxJson.targetDefaults[executor].inputs;

  if (!inputs.includes('^default')) {
    // Add after 'default' if present, otherwise at the beginning
    const defaultIndex = inputs.indexOf('default');
    if (defaultIndex !== -1) {
      inputs.splice(defaultIndex + 1, 0, '^default');
    } else {
      inputs.unshift('^default');
    }
  }

  if (!inputs.includes('{workspaceRoot}/tools/eslint-rules/**/*')) {
    inputs.push('{workspaceRoot}/tools/eslint-rules/**/*');
  }

  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
