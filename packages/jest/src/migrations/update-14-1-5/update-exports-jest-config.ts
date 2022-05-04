import type { Tree } from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { BinaryExpression } from 'typescript';
import type { JestExecutorOptions } from '../../executors/jest/schema';

export function updateExportsJestConfig(tree: Tree) {
  const { didUpdateRootPreset } = updateRootFiles(tree);
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options) => {
      if (options.jestConfig && tree.exists(options.jestConfig)) {
        if (options.jestConfig.endsWith('.ts')) {
          updateToDefaultExport(tree, options.jestConfig);
        }

        const updatedImport = updateNxPresetImport(
          tree.read(options.jestConfig, 'utf-8')
        );
        tree.write(options.jestConfig, updatedImport);

        // jest.preset.ts => jest.preset.js
        if (didUpdateRootPreset) {
          const projectConfig = tree.read(options.jestConfig, 'utf-8');
          const updatedConfig = projectConfig.replace(
            /(preset:\s*['"][.\/]*)(jest\.preset\.ts)(['"])/g,
            '$1jest.preset.js$3'
          );
          tree.write(options.jestConfig, updatedConfig);
        }
      }
    }
  );
}

export function updateRootFiles(tree: Tree): { didUpdateRootPreset: boolean } {
  let didUpdateRootPreset = false;
  if (tree.exists('jest.config.ts')) {
    updateToDefaultExport(tree, 'jest.config.ts');
  }

  if (tree.exists('jest.preset.ts')) {
    // fix those who ran v14 migration where this was renamed.
    tree.rename('jest.preset.ts', 'jest.preset.js');
    didUpdateRootPreset = true;
  }

  if (tree.exists('jest.preset.js')) {
    const newContents = updateNxPresetImport(
      tree.read('jest.preset.js', 'utf-8')
    );
    tree.write('jest.preset.js', newContents);
  }

  return {
    didUpdateRootPreset,
  };
}

function updateNxPresetImport(fileContents: string): string {
  return fileContents.replace(
    /require\(['"]@nrwl\/jest\/preset['"]\)[;\s]*?[\n\r]/g,
    `require('@nrwl/jest/preset').default;
`
  );
}

export function updateToDefaultExport(tree: Tree, filePath: string) {
  const newConfig = tsquery.replace(
    tree.read(filePath, 'utf-8'),
    'ExpressionStatement BinaryExpression',
    (node: BinaryExpression) => {
      if (node.left.getText() === 'module.exports') {
        return `export default ${node.right.getText()}`;
      }

      return node.getText();
    }
  );

  tree.write(filePath, newConfig);
}

export default updateExportsJestConfig;
