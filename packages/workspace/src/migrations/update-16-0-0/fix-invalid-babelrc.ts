import {
  getProjects,
  joinPathFragments,
  readJson,
  Tree,
  writeJson,
} from '@nx/devkit';

export default function update(tree: Tree) {
  const projects = getProjects(tree);
  const packageJson = readJson(tree, 'package.json');

  // In case user installed as prod dep.
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // If web package is installed, skip update.
  if (deps['@nrwl/web'] || deps['@nx/web']) {
    return;
  }

  projects.forEach((config, name) => {
    const babelRcPath = joinPathFragments(config.root, '.babelrc');
    if (!tree.exists(babelRcPath)) return;

    const babelRc = readJson(tree, babelRcPath);
    const nrwlWebBabelPresetIdx = babelRc.presets?.findIndex((p) =>
      // Babel preset could be specified as a string or a tuple with options.
      // Account for rescope migration running before or after this one.
      Array.isArray(p)
        ? p[0] === '@nrwl/web/babel' || p[0] === '@nx/web/babel'
        : p === '@nrwl/web/babel' || p === '@nx/web/babel'
    );

    if (nrwlWebBabelPresetIdx === undefined || nrwlWebBabelPresetIdx === -1) {
      return;
    }

    if (deps['@nrwl/js'] || deps['@nx/js']) {
      // If JS plugin is installed, then rename to @nx/js/babel.
      const found = babelRc.presets[nrwlWebBabelPresetIdx];
      babelRc.presets[nrwlWebBabelPresetIdx] = Array.isArray(found)
        ? ['@nx/js/babel', found[1]]
        : '@nx/js/babel';
    } else {
      // Otherwise, remove from config.
      babelRc.presets.splice(nrwlWebBabelPresetIdx, 1);
    }

    writeJson(tree, babelRcPath, babelRc);
  });
}
