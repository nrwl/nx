import {
  createProjectGraphAsync,
  formatFiles,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import { TEST_FILE_PATTERN } from '@nrwl/jest/src/utils/ast-utils';
import { forEachExecutorOptionsInGraph } from '@nrwl/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { CallExpression, Node, StringLiteral, SyntaxKind } from 'typescript';

export async function updateNxPluginE2eTests(tree: Tree) {
  const graph = await createProjectGraphAsync();
  forEachExecutorOptionsInGraph<JestExecutorOptions>(
    graph,
    '@nrwl/nx-plugin:e2e',
    (options, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      visitNotIgnoredFiles(tree, projectConfig.root, (file) => {
        if (!TEST_FILE_PATTERN.test(file)) {
          return;
        }
        updateEnsureNxProject(tree, file);
      });
    }
  );
  await formatFiles(tree);
}

export function updateEnsureNxProject(tree: Tree, filePath: string) {
  let contents = tree.read(filePath, 'utf-8');

  if (!contents.includes('ensureNxProject')) {
    return;
  }

  const ensureNodes = tsquery.query(
    contents,
    ':matches(ImportDeclaration):has(Identifier[name="ensureNxProject"]):has(StringLiteral[value="@nrwl/devkit"])'
  );

  if (ensureNodes.length === 0) {
    return;
  }

  // Replace calls to ensureNxProject to use a library
  contents = tsquery.replace(
    contents,
    'CallExpression:has(Identifier[name="ensureNxProject"])',
    (node: CallExpression) => {
      const text = node.getText();
      if (node.arguments.length !== 2 || !text.startsWith('ensureNxProject(')) {
        return;
      }
      //TODO: resolve packages to libraries
      const npmPackage = (node.arguments[0] as StringLiteral).text;
      if (npmPackage !== '@lib/my-lib') {
        return;
      }

      if (node.parent.kind === SyntaxKind.AwaitExpression) {
        return `ensureNxProject('my-lib')`;
      }
      return `await ensureNxProject('my-lib')`;
    }
  );

  // The new signature for ensureNxProject is a promise that needs to be awaited
  // Update wrapping function to be async
  tsquery.query(contents, 'AwaitExpression').forEach((node: Node) => {
    let wrappingArrowFunction = node.parent;
    while (
      wrappingArrowFunction != null &&
      wrappingArrowFunction.kind !== SyntaxKind.ArrowFunction
    ) {
      wrappingArrowFunction = wrappingArrowFunction.parent;
    }

    if (wrappingArrowFunction == null) {
      return;
    }

    const text = wrappingArrowFunction.getText();
    if (!text.startsWith('async ()')) {
      contents = contents.replace(text, `async ${text}`);
    }
  });

  tree.write(filePath, contents);
}

export default updateNxPluginE2eTests;
