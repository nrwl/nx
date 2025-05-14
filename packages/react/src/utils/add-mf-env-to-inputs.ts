import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';

export function addMfEnvToTargetDefaultInputs(
  tree: Tree,
  bundler: 'rspack' | 'webpack'
) {
  const nxJson = readNxJson(tree);
  const executor =
    bundler === 'rspack' ? '@nx/rspack:rspack' : '@nx/webpack:webpack';
  const mfEnvVar = 'NX_MF_DEV_REMOTES';

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[executor] ??= {};
  nxJson.targetDefaults[executor].inputs ??= ['production', '^production'];
  nxJson.targetDefaults[executor].dependsOn ??= ['^build'];

  let mfEnvVarExists = false;
  for (const input of nxJson.targetDefaults[executor].inputs) {
    if (typeof input === 'object' && input['env'] === mfEnvVar) {
      mfEnvVarExists = true;
      break;
    }
  }
  if (!mfEnvVarExists) {
    nxJson.targetDefaults[executor].inputs.push({ env: mfEnvVar });
  }
  nxJson.targetDefaults[executor].cache = true;
  updateNxJson(tree, nxJson);
}
