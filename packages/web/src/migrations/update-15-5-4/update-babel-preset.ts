import {
  readJson,
  writeJson,
  Tree,
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

/* Updates @nrwl/web/babel to @nrwl/js/babel because web package is no longer necessary to use webpack/rollup + babel. */
export default async function update(tree: Tree) {
  // Add `@nrwl/js` in case it was missing before.
  addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nrwl/js': nxVersion,
    }
  );

  const projects = getProjects(tree);

  projects.forEach((config, name) => {
    const babelrcPath = joinPathFragments(config.root, '.babelrc');

    if (!tree.exists(babelrcPath)) return;

    const babelrc = readJson(tree, babelrcPath);
    const idx = babelrc?.presets?.findIndex((p) =>
      typeof p === 'string'
        ? p === '@nrwl/web/babel'
        : p[0] === '@nrwl/web/babel'
    );

    if (idx === -1) return;

    const preset = babelrc.presets[idx];
    if (typeof preset === 'string') {
      babelrc.presets.splice(idx, 1, '@nrwl/js/babel');
    } else if (Array.isArray(preset)) {
      babelrc.presets.splice(idx, 1, ['@nrwl/js/babel', preset[1]]);
    }

    writeJson(tree, babelrcPath, babelrc);
  });
}
