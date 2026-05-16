import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';
import {
  normalizeTargetDefaults,
  upsertTargetDefault,
} from '@nx/devkit/internal';

export function addMfEnvToTargetDefaultInputs(
  tree: Tree,
  bundler: 'rspack' | 'webpack'
) {
  const nxJson = readNxJson(tree) ?? {};
  const executor =
    bundler === 'rspack' ? '@nx/rspack:rspack' : '@nx/webpack:webpack';
  const mfEnvVar = 'NX_MF_DEV_REMOTES';

  const existing = normalizeTargetDefaults(nxJson.targetDefaults).find(
    (e) =>
      e.executor === executor &&
      e.target === undefined &&
      e.projects === undefined &&
      e.plugin === undefined
  );

  const inputs = [...(existing?.inputs ?? ['production', '^production'])];
  let mfEnvVarExists = false;
  for (const input of inputs) {
    if (typeof input === 'object' && input['env'] === mfEnvVar) {
      mfEnvVarExists = true;
      break;
    }
  }
  if (!mfEnvVarExists) {
    inputs.push({ env: mfEnvVar });
  }

  upsertTargetDefault(tree, nxJson, {
    executor,
    cache: true,
    inputs,
    dependsOn: existing?.dependsOn ?? ['^build'],
  });
  updateNxJson(tree, nxJson);
}
