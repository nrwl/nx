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
      '@nx/vitest': nxVersion,
    },
    undefined,
    // Don't overwrite a user's installed versions (e.g. React 19 from @nx/react).
    // Remix v2's fresh-install defaults are React 18 / Vite 6, but an existing
    // pin is respected.
    true
  );
}
