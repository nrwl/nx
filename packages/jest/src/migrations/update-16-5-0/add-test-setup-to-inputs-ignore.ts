import {
  NxJsonConfiguration,
  Tree,
  formatFiles,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';

export async function addTestSetupToIgnoredInputs(tree: Tree) {
  const nxJson: NxJsonConfiguration = readNxJson(tree);

  if (!nxJson) {
    return;
  }
  if (
    nxJson.namedInputs?.production &&
    !nxJson.namedInputs.production.includes(
      '!{projectRoot}/src/test-setup.[jt]s'
    )
  ) {
    nxJson.namedInputs.production.push('!{projectRoot}/src/test-setup.[jt]s');
    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
}

export default addTestSetupToIgnoredInputs;
