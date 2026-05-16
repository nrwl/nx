import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';
import {
  normalizeTargetDefaults,
  upsertTargetDefault,
} from '@nx/devkit/internal';

export function addMfEnvToTargetDefaultInputs(tree: Tree) {
  const nxJson = readNxJson(tree) ?? {};
  const webpackExecutor = '@nx/angular:webpack-browser';
  const mfEnvVar = 'NX_MF_DEV_REMOTES';

  const defaultInputs = [
    ...(nxJson.namedInputs && 'production' in nxJson.namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
  ];

  const existing = normalizeTargetDefaults(nxJson.targetDefaults).find(
    (e) =>
      e.executor === webpackExecutor &&
      e.target === undefined &&
      e.projects === undefined &&
      e.plugin === undefined
  );

  const inputs = [...(existing?.inputs ?? defaultInputs)];
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
    executor: webpackExecutor,
    cache: true,
    inputs,
    dependsOn: existing?.dependsOn ?? ['^build'],
  });
  updateNxJson(tree, nxJson);
}
