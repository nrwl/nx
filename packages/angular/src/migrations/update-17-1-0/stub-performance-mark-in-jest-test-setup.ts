import { createProjectGraphAsync, formatFiles, type Tree } from '@nx/devkit';
import { forEachExecutorOptionsInGraph } from '@nx/devkit/src/generators/executor-options-utils';
import type { JestExecutorOptions } from '@nx/jest/src/executors/jest/schema';
import { tsquery } from '@phenomnomnominal/tsquery';
import { dirname } from 'path';
import * as ts from 'typescript';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree): Promise<void> {
  const angularProjects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/core',
  ]);
  const jestConfigFiles = new Set<string>();

  const projectGraph = await createProjectGraphAsync();
  forEachExecutorOptionsInGraph<JestExecutorOptions>(
    projectGraph,
    '@nx/jest:jest',
    (options, projectName) => {
      const projectConfig = angularProjects.find(
        ({ project }) => projectName === project.name
      );
      if (!projectConfig) {
        return;
      }

      if (options.jestConfig && tree.exists(options.jestConfig)) {
        jestConfigFiles.add(options.jestConfig);
      }
    }
  );

  const setupFilePaths: string[] = [];
  for (const jestConfigFile of jestConfigFiles) {
    const projectSetupFilePaths = getSetupFilePaths(tree, jestConfigFile);
    setupFilePaths.push(...projectSetupFilePaths);
  }

  for (const setupFilePath of setupFilePaths) {
    if (!tree.exists(setupFilePath)) {
      continue;
    }

    updateSetupFileWithPerformanceMarkStub(tree, setupFilePath);
  }

  await formatFiles(tree);
}

function getSetupFilePaths(tree: Tree, jestConfigFile: string): string[] {
  const config = tree.read(jestConfigFile, 'utf-8');
  const TS_QUERY_JEST_CONFIG_PREFIX =
    ':matches(ExportAssignment, BinaryExpression:has(Identifier[name="module"]):has(Identifier[name="exports"]))';
  const setupFilePathNodes = tsquery.query<ts.StringLiteral>(
    config,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="setupFilesAfterEnv"]) > ArrayLiteralExpression StringLiteral`
  );

  const rootDir = dirname(jestConfigFile);
  const setupFilePaths = setupFilePathNodes.map((node) =>
    node.text.replace('<rootDir>', rootDir)
  );

  return setupFilePaths;
}

function updateSetupFileWithPerformanceMarkStub(
  tree: Tree,
  setupFilePath: string
) {
  const setupFile = tree.read(setupFilePath, 'utf-8');
  const setupFileSource = ts.createSourceFile(
    setupFilePath,
    setupFile,
    ts.ScriptTarget.Latest
  );

  const TS_QUERY_PERFORMANCE_MARK_ACCESS =
    'PropertyAccessExpression:has(Identifier[name=performance]):has(Identifier[name=mark])';
  const TS_QUERY_PERFORMANCE_MARK_ASSIGNMENT =
    'PropertyAccessExpression:has(Identifier[name=performance]) + EqualsToken + ObjectLiteralExpression:has(PropertyAssignment Identifier[name=mark])';

  const performanceMarkNodes = tsquery.query(
    setupFileSource,
    `:matches(${TS_QUERY_PERFORMANCE_MARK_ACCESS}, ${TS_QUERY_PERFORMANCE_MARK_ASSIGNMENT})`
  );

  // there is already some access to performance.mark, so we assume it was handled already
  if (performanceMarkNodes.length) {
    return;
  }

  tree.write(
    setupFilePath,
    `${setupFile}
/**
 * Angular uses performance.mark() which is not supported by jsdom. Stub it out
 * to avoid errors.
 */
global.performance.mark = jest.fn();
`
  );
}
