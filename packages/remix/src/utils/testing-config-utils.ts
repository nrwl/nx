import { stripIndents, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export function updateVitestTestSetup(
  tree: Tree,
  pathToVitestConfig: string,
  pathToTestSetup: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const fileContents = tree.read(pathToVitestConfig, 'utf-8');

  const ast = tsquery.ast(fileContents);

  const TEST_SETUPFILES_SELECTOR =
    'PropertyAssignment:has(Identifier[name=test]) PropertyAssignment:has(Identifier[name=setupFiles])';

  const nodes = tsquery(ast, TEST_SETUPFILES_SELECTOR, {
    visitAllChildren: true,
  });

  let updatedFileContents = fileContents;
  if (nodes.length === 0) {
    const TEST_CONFIG_SELECTOR =
      'PropertyAssignment:has(Identifier[name=test]) > ObjectLiteralExpression';
    const testConfigNodes = tsquery(ast, TEST_CONFIG_SELECTOR, {
      visitAllChildren: true,
    });
    updatedFileContents = stripIndents`${fileContents.slice(
      0,
      testConfigNodes[0].getStart() + 1
    )}setupFiles: ['${pathToTestSetup}'],${fileContents.slice(
      testConfigNodes[0].getStart() + 1
    )}`;
  } else {
    const arrayNodes = tsquery(nodes[0], 'ArrayLiteralExpression', {
      visitAllChildren: true,
    });
    if (arrayNodes.length !== 0) {
      updatedFileContents = stripIndents`${fileContents.slice(
        0,
        arrayNodes[0].getStart() + 1
      )}'${pathToTestSetup}',${fileContents.slice(
        arrayNodes[0].getStart() + 1
      )}`;
    }
  }

  tree.write(pathToVitestConfig, updatedFileContents);
}

export function updateJestTestSetup(
  tree: Tree,
  pathToJestConfig: string,
  pathToTestSetup: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const fileContents = tree.read(pathToJestConfig, 'utf-8');

  const ast = tsquery.ast(fileContents);

  const TEST_SETUPFILES_SELECTOR =
    'PropertyAssignment:has(Identifier[name=setupFilesAfterEnv])';
  const nodes = tsquery(ast, TEST_SETUPFILES_SELECTOR, {
    visitAllChildren: true,
  });

  if (nodes.length === 0) {
    const CONFIG_SELECTOR = 'ObjectLiteralExpression';
    const nodes = tsquery(ast, CONFIG_SELECTOR, { visitAllChildren: true });

    const updatedFileContents = stripIndents`${fileContents.slice(
      0,
      nodes[0].getStart() + 1
    )}setupFilesAfterEnv: ['${pathToTestSetup}'],${fileContents.slice(
      nodes[0].getStart() + 1
    )}`;
    tree.write(pathToJestConfig, updatedFileContents);
  } else {
    const arrayNodes = tsquery(nodes[0], 'ArrayLiteralExpression', {
      visitAllChildren: true,
    });
    if (arrayNodes.length !== 0) {
      const updatedFileContents = stripIndents`${fileContents.slice(
        0,
        arrayNodes[0].getStart() + 1
      )}'${pathToTestSetup}',${fileContents.slice(
        arrayNodes[0].getStart() + 1
      )}`;

      tree.write(pathToJestConfig, updatedFileContents);
    }
  }
}

export function updateJestTestMatch(
  tree: Tree,
  pathToJestConfig: string,
  includesString: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const fileContents = tree.read(pathToJestConfig, 'utf-8');

  const ast = tsquery.ast(fileContents);

  const TEST_MATCH_SELECTOR =
    'PropertyAssignment:has(Identifier[name=testMatch])';
  const nodes = tsquery(ast, TEST_MATCH_SELECTOR, { visitAllChildren: true });

  if (nodes.length !== 0) {
    const updatedFileContents = stripIndents`${fileContents.slice(
      0,
      nodes[0].getStart()
    )}testMatch: ["${includesString}"]${fileContents.slice(nodes[0].getEnd())}`;

    tree.write(pathToJestConfig, updatedFileContents);
  }
}

export function updateVitestTestIncludes(
  tree: Tree,
  pathToVitestConfig: string,
  includesString: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const fileContents = tree.read(pathToVitestConfig, 'utf-8');

  const ast = tsquery.ast(fileContents);

  const TEST_INCLUDE_SELECTOR =
    'PropertyAssignment:has(Identifier[name=test]) PropertyAssignment:has(Identifier[name=include])';
  const nodes = tsquery(ast, TEST_INCLUDE_SELECTOR, { visitAllChildren: true });

  if (nodes.length !== 0) {
    const updatedFileContents = stripIndents`${fileContents.slice(
      0,
      nodes[0].getStart()
    )}include: ["${includesString}"]${fileContents.slice(nodes[0].getEnd())}`;

    tree.write(pathToVitestConfig, updatedFileContents);
  }
}
