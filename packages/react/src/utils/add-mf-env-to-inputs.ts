import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';

export function addMfEnvToTargetDefaultInputs(tree: Tree) {
  const nxJson = readNxJson(tree);
  const webpackExecutor = '@nx/webpack:webpack';
  const mfEnvVar = 'NX_MF_DEV_REMOTES';

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[webpackExecutor] ??= {};
  nxJson.targetDefaults[webpackExecutor].inputs ??= [
    'production',
    '^production',
  ];
  nxJson.targetDefaults[webpackExecutor].dependsOn ??= ['^build'];

  let mfEnvVarExists = false;
  for (const input of nxJson.targetDefaults[webpackExecutor].inputs) {
    if (typeof input === 'object' && input['env'] === mfEnvVar) {
      mfEnvVarExists = true;
      break;
    }
  }
  if (!mfEnvVarExists) {
    nxJson.targetDefaults[webpackExecutor].inputs.push({ env: mfEnvVar });
  }
  nxJson.targetDefaults[webpackExecutor].cache = true;
  updateNxJson(tree, nxJson);
}
