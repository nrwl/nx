import { formatFiles, globAsync, type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { SearchSource } from 'jest';
import { readConfig } from 'jest-config';
import Runtime from 'jest-runtime';
import type { Identifier } from 'typescript';
import { join } from 'path';
import { relative } from 'node:path/posix';

const matcherAliasesMap = new Map<string, string>([
  ['toBeCalled', 'toHaveBeenCalled'],
  ['toBeCalledTimes', 'toHaveBeenCalledTimes'],
  ['toBeCalledWith', 'toHaveBeenCalledWith'],
  ['lastCalledWith', 'toHaveBeenLastCalledWith'],
  ['nthCalledWith', 'toHaveBeenNthCalledWith'],
  ['toReturn', 'toHaveReturned'],
  ['toReturnTimes', 'toHaveReturnedTimes'],
  ['toReturnWith', 'toHaveReturnedWith'],
  ['lastReturnedWith', 'toHaveLastReturnedWith'],
  ['nthReturnedWith', 'toHaveNthReturnedWith'],
  ['toThrowError', 'toThrow'],
]);

// migration for https://github.com/jestjs/jest/commit/eac241cf0bcb7a808e192e6fcf3afe67edbdbf8e
export default async function (tree: Tree) {
  const testFilePaths = await getTestFilePaths(tree);
  for (const testFilePath of testFilePaths) {
    let testFileContent = tree.read(testFilePath, 'utf-8');
    for (const [alias, matcher] of matcherAliasesMap) {
      testFileContent = tsquery.replace(
        testFileContent,
        `CallExpression PropertyAccessExpression:has(CallExpression Identifier[name=expect]) Identifier[name=${alias}]`,
        (_node: Identifier) => matcher
      );
    }
    tree.write(testFilePath, testFileContent);
  }

  await formatFiles(tree);
}

async function getTestFilePaths(tree: Tree): Promise<string[]> {
  const jestConfigFiles = await globAsync(tree, [
    '**/jest.config.{cjs,mjs,js,cts,mts,ts}',
  ]);

  if (!jestConfigFiles.length) {
    return [];
  }

  const testFilePaths = new Set<string>();
  for (const jestConfigFile of jestConfigFiles) {
    const jestConfigContent = tree.read(jestConfigFile, 'utf-8');
    if (jestConfigContent.includes('getJestProjectsAsync()')) {
      // skip the root jest config file which includes all projects
      continue;
    }

    const config = await readConfig(
      { _: [], $0: undefined },
      join(tree.root, jestConfigFile)
    );
    const jestContext = await Runtime.createContext(config.projectConfig, {
      maxWorkers: 1,
      watchman: false,
    });
    const source = new SearchSource(jestContext);
    const specs = await source.getTestPaths(
      config.globalConfig,
      config.projectConfig
    );
    for (const testPath of specs.tests) {
      testFilePaths.add(relative(tree.root, testPath.path));
    }
  }

  return Array.from(testFilePaths);
}
