import { formatFiles, readNxJson, Tree, updateNxJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.generators) {
    return;
  }

  if (nxJson.generators['@nrwl/angular:library']) {
    delete nxJson.generators['@nrwl/angular:library'].style;
    updateNxJson(tree, nxJson);
  } else if (nxJson.generators['@nrwl/angular']?.library) {
    delete nxJson.generators['@nrwl/angular'].library.style;
    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
}
