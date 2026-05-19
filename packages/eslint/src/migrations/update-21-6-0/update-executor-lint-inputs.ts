import { type Tree, formatFiles, readNxJson, updateNxJson } from '@nx/devkit';
import {
  normalizeTargetDefaults,
  upsertTargetDefault,
} from '@nx/devkit/internal';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree) ?? {};
  const executor = '@nx/eslint:lint';

  const existing = normalizeTargetDefaults(nxJson.targetDefaults).find(
    (e) =>
      e.executor === executor &&
      e.target === undefined &&
      e.projects === undefined &&
      e.plugin === undefined
  );

  if (!existing?.inputs) {
    return;
  }

  const inputs = [...existing.inputs];

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

  upsertTargetDefault(tree, nxJson, { executor, inputs });
  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
