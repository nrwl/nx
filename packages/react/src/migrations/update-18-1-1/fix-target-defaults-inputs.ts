import {
  getProjects,
  type Tree,
  type ProjectConfiguration,
  joinPathFragments,
  formatFiles,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';

export default async function (tree: Tree) {
  if (!hasModuleFederationProject(tree)) {
    return;
  }
  ensureTargetDefaultsContainProductionInputs(tree);

  await formatFiles(tree);
}

function ensureTargetDefaultsContainProductionInputs(tree: Tree) {
  const nxJson = readNxJson(tree);
  const webpackExecutor = '@nx/webpack:webpack';
  const mfEnvVar = 'NX_MF_DEV_SERVER_STATIC_REMOTES';

  nxJson.targetDefaults[webpackExecutor] ??= {};

  nxJson.targetDefaults[webpackExecutor].inputs ??= [
    'production',
    '^production',
    { env: mfEnvVar },
  ];

  if (!nxJson.targetDefaults[webpackExecutor].inputs.includes('production')) {
    nxJson.targetDefaults[webpackExecutor].inputs.push('production');
  }

  if (!nxJson.targetDefaults[webpackExecutor].inputs.includes('^production')) {
    nxJson.targetDefaults[webpackExecutor].inputs.push('^production');
  }

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

  updateNxJson(tree, nxJson);
}

function hasModuleFederationProject(tree: Tree) {
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    const targets = project.targets || {};
    for (const [_, target] of Object.entries(targets)) {
      if (
        target.executor === '@nx/webpack:webpack' &&
        (tree.exists(
          joinPathFragments(project.root, 'module-federation.config.ts')
        ) ||
          tree.exists(
            joinPathFragments(project.root, 'module-federation.config.js')
          ))
      ) {
        return true;
      }
    }
  }
  return false;
}
