import {
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

// Add @nx/webpack as needed.
// See: https://github.com/nrwl/nx/issues/14455
export default async function update(tree: Tree) {
  const projects = getProjects(tree);
  const reactPlugin = '@nrwl/react/plugins/storybook';
  let shouldInstall = false;

  for (const [, config] of projects) {
    let sbConfigPath = joinPathFragments(config.root, '.storybook/main.ts');

    if (!tree.exists(sbConfigPath)) {
      sbConfigPath = joinPathFragments(config.root, '.storybook/main.js');
    }

    if (!tree.exists(sbConfigPath)) {
      continue;
    }

    const sbConfig = tree.read(sbConfigPath, 'utf-8');
    if (sbConfig.includes(reactPlugin)) {
      shouldInstall = true;
      break;
    }
  }

  if (shouldInstall) {
    return addDependenciesToPackageJson(
      tree,
      {},
      { '@nrwl/webpack': nxVersion }
    );
  }
}
