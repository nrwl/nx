import { readProjectConfiguration, Tree, updateJson } from '@nrwl/devkit';
import { SwcExecutorOptions } from '../../utils/schema';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { join } from 'path';

export function excludeJestConfigSwcrc(tree: Tree) {
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
              'jest.config.js',
              ...json.exclude,
            ]);
            json.exclude = [...excludePatterns];
          }
          return json;
        },
        { expectComments: true }
      );
    }
  );
}

export default excludeJestConfigSwcrc;
