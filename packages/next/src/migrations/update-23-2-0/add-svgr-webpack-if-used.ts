import {
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';
import { svgrWebpackVersion } from '../../utils/versions';

// The Nx 22 `add-svgr-to-next-config` migration inlined a `withSvgr` helper
// that resolves `@svgr/webpack` into user next configs, but never added the
// package to the workspace - it only resolved transitively through `@nx/next`.
// Now that `@nx/next` no longer depends on it, backfill it where a next config
// actually references it.
const nextConfigFileNames = [
  'next.config.js',
  'next.config.cjs',
  'next.config.mjs',
  'next.config.ts',
];

export default async function addSvgrWebpackIfUsed(tree: Tree) {
  let needsSvgr = false;

  for (const [, project] of getProjects(tree)) {
    for (const fileName of nextConfigFileNames) {
      const path = joinPathFragments(project.root, fileName);
      needsSvgr ||=
        tree.exists(path) && tree.read(path, 'utf-8').includes('@svgr/webpack');
    }

    if (needsSvgr) {
      break;
    }
  }

  if (!needsSvgr) {
    return;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { '@svgr/webpack': svgrWebpackVersion },
    undefined,
    true
  );
}
