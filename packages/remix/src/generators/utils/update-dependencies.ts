import { type Tree, addDependenciesToPackageJson } from '@nx/devkit';
import {
  eslintVersion,
  isbotVersion,
  reactDomVersion,
  reactVersion,
  remixVersion,
  typescriptVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';

export function updateDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {
      '@remix-run/node': remixVersion,
      '@remix-run/react': remixVersion,
      isbot: isbotVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
    {
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      eslint: eslintVersion,
      typescript: typescriptVersion,
    }
  );
}
