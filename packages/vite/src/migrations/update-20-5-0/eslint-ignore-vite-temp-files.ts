import {
  ensurePackage,
  formatFiles,
  getProjects,
  globAsync,
  type Tree,
} from '@nx/devkit';
import { isEslintInstalled } from '../../utils/ignore-vite-temp-files';
import { nxVersion } from '../../utils/versions';

export default async function (tree: Tree) {
  if (!isEslintInstalled(tree)) {
    return;
  }

  ensurePackage('@nx/eslint', nxVersion);
  // CommonJS `require` instead of dynamic ESM `import` — `ensurePackage`
  // exposes the temp install via `Module._initPaths`, which ESM ignores.
  const {
    addIgnoresToLintConfig,
    isEslintConfigSupported,
    useFlatConfig,
  }: typeof import('@nx/eslint/internal') = require('@nx/eslint/internal');
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const isUsingFlatConfig = useFlatConfig(tree);

  if (isUsingFlatConfig) {
    // using flat config, so we update the root eslint config
    addIgnoresToLintConfig(tree, '', [
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ]);
  } else {
    // not using flat config, so we update each project's eslint config
    const projects = getProjects(tree);

    for (const [, { root: projectRoot }] of projects) {
      const viteConfigFiles = await globAsync(tree, [
        `${projectRoot}/**/{vite,vitest}.config.{js,ts,mjs,mts,cjs,cts}`,
      ]);
      if (!viteConfigFiles.length) {
        // the project doesn't use vite or vitest, so we skip it
        continue;
      }

      addIgnoresToLintConfig(tree, projectRoot, [
        '**/vite.config.*.timestamp*',
        '**/vitest.config.*.timestamp*',
      ]);
    }
  }

  await formatFiles(tree);
}
