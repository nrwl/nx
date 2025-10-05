import { type Tree, addDependenciesToPackageJson } from '@nx/devkit';
import {
  eslintVersion,
  isbotVersion,
  nxVersion,
  reactDomVersion,
  reactVersion,
  remixVersion,
  typescriptVersion,
  typesReactDomVersion,
  typesReactVersion,
  viteVersion,
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
      vite: viteVersion,
      '@nx/vite': nxVersion,
    }
  );
}
