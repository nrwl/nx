import { formatFiles, globAsync, type Tree } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import { SearchSource } from 'jest';
import { readConfig } from 'jest-config';
import Runtime from 'jest-runtime';
import { join, posix, relative } from 'path';
import type { Identifier } from 'typescript';

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
    const testFileContent = tree.read(testFilePath, 'utf-8');
    const updatedContent = replaceMatcherAliases(testFileContent);
    if (updatedContent !== testFileContent) {
      tree.write(testFilePath, updatedContent);
    }
  }

  await formatFiles(tree);
}

function replaceMatcherAliases(fileContent: string): string {
  // Build a selector that matches any of the deprecated matcher aliases
  const aliasNames = Array.from(matcherAliasesMap.keys());
  const aliasPattern = aliasNames.join('|');

  // Quick check to avoid parsing files that don't contain any aliases
  const hasAnyAlias = aliasNames.some((alias) => fileContent.includes(alias));
  if (!hasAnyAlias) {
    return fileContent;
  }

  const sourceFile = ast(fileContent);
  const updates: Array<{ start: number; end: number; text: string }> = [];

  // Query for all deprecated matcher identifiers in expect() chains
  // The selector matches: expect(...).toBeCalled(), expect(...).not.toBeCalled(), etc.
  const selector = `CallExpression PropertyAccessExpression:has(CallExpression Identifier[name=expect]) Identifier[name=/^(${aliasPattern})$/]`;
  const matchedNodes = query<Identifier>(sourceFile, selector);

  for (const node of matchedNodes) {
    const alias = node.text;
    const replacement = matcherAliasesMap.get(alias);
    if (replacement) {
      updates.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: replacement,
      });
    }
  }

  if (!updates.length) {
    return fileContent;
  }

  // Apply updates in reverse order to preserve positions
  let updatedContent = fileContent;
  for (const update of updates.sort((a, b) => b.start - a.start)) {
    updatedContent =
      updatedContent.slice(0, update.start) +
      update.text +
      updatedContent.slice(update.end);
  }

  return updatedContent;
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
      testFilePaths.add(posix.normalize(relative(tree.root, testPath.path)));
    }
  }

  return Array.from(testFilePaths);
}
