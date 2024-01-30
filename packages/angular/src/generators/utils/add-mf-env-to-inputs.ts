import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';

export function addMfEnvToTargetDefaultInputs(tree: Tree) {
  const nxJson = readNxJson(tree);
  const webpackExecutor = '@nx/angular:webpack-browser';
  const mfEnvVar = 'NX_MF_DEV_SERVER_STATIC_REMOTES';

  let mfEnvVarExists = false;
  if (nxJson.targetDefaults && webpackExecutor in nxJson.targetDefaults) {
    const webpackExecutorTargetDefaults =
      nxJson.targetDefaults[webpackExecutor];

    if (webpackExecutorTargetDefaults.inputs) {
      for (const webpackExecutorTargetDefaultsInput of webpackExecutorTargetDefaults.inputs) {
        if (typeof webpackExecutorTargetDefaultsInput === 'object') {
          const [key, value] = Object.entries(
            webpackExecutorTargetDefaultsInput
          )[0];

          if (key === 'env' && value === mfEnvVar) {
            mfEnvVarExists = true;
            break;
          }
        }
      }
    } else {
      nxJson.targetDefaults[webpackExecutor].inputs = [];
    }
  } else if (!nxJson.targetDefaults[webpackExecutor]) {
    nxJson.targetDefaults[webpackExecutor] = {
      inputs: [],
    };
  } else if (!nxJson.targetDefaults) {
    nxJson.targetDefaults = {
      [webpackExecutor]: {
        inputs: [],
      },
    };
  }

  if (!mfEnvVarExists) {
    nxJson.targetDefaults[webpackExecutor].inputs.push({ env: mfEnvVar });
  }

  updateNxJson(tree, nxJson);
}
