import { join } from 'path';
import { Tree, addDependenciesToPackageJson } from '@nx/devkit';
import { ESLint } from 'eslint';
import { load } from 'js-yaml';
import { convertJsonConfigToFlatConfig } from './config-converter';
import { eslintrcVersion } from '../../../utils/versions';

/**
 * Converts an ESLint JSON config to a flat config.
 * Deletes the original file along with .eslintignore if it exists.
 */
export function convertEslintYamlToFlatConfig(
  tree: Tree,
  root: string,
  sourceFile: string,
  destinationFile: string,
  ignorePaths: string[]
) {
  // read original config
  const originalContent = tree.read(`${root}/${sourceFile}`, 'utf-8');
  const config = load(originalContent, {
    json: true,
    filename: sourceFile,
  }) as ESLint.ConfigData;

  // convert to flat config
  const { content, addESLintRC } = convertJsonConfigToFlatConfig(
    tree,
    root,
    config,
    ignorePaths
  );

  // handle file deletion and creation
  tree.delete(join(root, sourceFile));
  tree.write(join(root, destinationFile), content);

  if (addESLintRC) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@eslint/eslintrc': eslintrcVersion,
      }
    );
  }
}
