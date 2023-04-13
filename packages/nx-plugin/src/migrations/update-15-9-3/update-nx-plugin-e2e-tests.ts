import {
  createProjectGraphAsync,
  formatFiles,
  logger,
  ProjectGraph,
  readJson,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import { TEST_FILE_PATTERN } from '@nrwl/jest/src/utils/ast-utils';
import { forEachExecutorOptionsInGraph } from '@nrwl/devkit/src/generators/executor-options-utils';
import {
  createProjectRootMappings,
  findProjectForPath,
  ProjectRootMappings,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { tsquery } from '@phenomnomnominal/tsquery';
import { CallExpression, Node, StringLiteral, SyntaxKind } from 'typescript';

export async function updateNxPluginE2eTests(tree: Tree) {
  const graph = await createProjectGraphAsync();
  const fileMappings = createProjectRootMappings(graph.nodes);

  forEachExecutorOptionsInGraph<JestExecutorOptions>(
    graph,
    '@nrwl/nx-plugin:e2e',
    (options, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      visitNotIgnoredFiles(tree, projectConfig.root, (file) => {
        if (!TEST_FILE_PATTERN.test(file)) {
          return;
        }
        updateEnsureNxProject(tree, graph, fileMappings, file);
      });
    }
  );
  await formatFiles(tree);
}

export function updateEnsureNxProject(
  tree: Tree,
  graph: ProjectGraph,
  fileMappings: ProjectRootMappings,
  filePath: string
) {
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

      const npmPackage = (node.arguments[0] as StringLiteral).text;
      if (graph.nodes[npmPackage] != null) {
        return; // Call already migrated to a project
      }

      const project = getProjectForNpmPackage(tree, fileMappings, npmPackage);
      if (project == null) {
        return; // Could not resolve the project
      }

      if (node.parent.kind === SyntaxKind.AwaitExpression) {
        return `ensureNxProject('${project}')`;
      }
      return `await ensureNxProject('${project}')`;
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

function getProjectForNpmPackage(
  tree: Tree,
  fileMappings: ProjectRootMappings,
  npmPackageName: string
): string | undefined {
  const compilerOptions = readJson(tree, 'tsconfig.base.json').compilerOptions;
  const paths: Record<string, string[]> = compilerOptions.paths ?? {};
  const srcPath = paths[npmPackageName];

  if (srcPath == null || srcPath.length === 0) {
    logger.warn(`Could not find mapping to package: "${npmPackageName}"`);
    return;
  }

  return findProjectForPath(srcPath[0], fileMappings);
}

export default updateNxPluginE2eTests;
