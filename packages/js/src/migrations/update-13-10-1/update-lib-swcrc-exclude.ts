import { readProjectConfiguration, Tree, updateJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { join } from 'path';
import { SwcExecutorOptions } from '../../utils/schema';
import { defaultExclude } from '../../utils/swc/add-swc-config';

export default function updateSwcRcExclude(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/js:swc',
    (config: SwcExecutorOptions, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);
      const libSwcPath = join(projectConfig.root, '.lib.swcrc');

      if (!tree.exists(libSwcPath)) return;

      updateJson(
        tree,
        libSwcPath,
        (json) => {
          if (json.exclude) {
            const excludePatterns = new Set([
              ...defaultExclude,
              ...json.exclude,
            ]);
            // remove old patterns that are duplicate for new patterns
            // defined in defaultExclude
            excludePatterns.delete('./**/.*.spec.ts$');
            excludePatterns.delete('./src/**/.*.spec.ts$');
            excludePatterns.delete('./**/.*.js$');
            excludePatterns.delete('./src/**/jest-setup.ts$');

            json.exclude = [...excludePatterns];
          }
          return json;
        },
        { expectComments: true }
      );
    }
  );
}
