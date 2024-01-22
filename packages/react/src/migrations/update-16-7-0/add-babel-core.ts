import {
  Tree,
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
} from '@nx/devkit';
import { babelCoreVersion } from '../../utils/versions';

export default async function addBabelCore(tree: Tree): Promise<void> {
  const packageJson = readJson(tree, 'package.json');
  if (packageJson?.devDependencies['@babel/preset-react']) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@babel/core': babelCoreVersion,
      }
    );
    await formatFiles(tree);
  }
}
