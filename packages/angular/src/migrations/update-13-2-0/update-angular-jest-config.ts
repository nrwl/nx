import type { Tree } from '@nrwl/devkit';
import type {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
} from 'typescript';
import { getProjects } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

type AngularProjectWithJestConfig = Record<string, [string, string]>; // Record<projectName, [jestConfigPath, jestConfigFileContents]

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  const angularProjects: AngularProjectWithJestConfig = {};

  for (const [projectName, project] of projects.entries()) {
    if (
      project.targets.test &&
      project.targets.test.executor === '@nrwl/jest:jest'
    ) {
      const jestConfigPath =
        project.targets.test.options && project.targets.test.options.jestConfig;
      if (!jestConfigPath || !tree.exists(jestConfigPath)) {
        continue;
      }
      const jestConfig = tree.read(jestConfigPath, 'utf-8');
      if (jestConfig.includes('jest-preset-angular')) {
        angularProjects[projectName] = [jestConfigPath, jestConfig];
      }
    }
  }

  for (const [_, [jestConfigPath, jestFileContents]] of Object.entries(
    angularProjects
  )) {
    tree.write(
      jestConfigPath,
      replaceTransformAndAddIgnorePattern(jestFileContents)
    );
  }
}

export function replaceTransformAndAddIgnorePattern(fileContents: string) {
  const JEST_PRESET_ANGULAR_AST_QUERY =
    'Identifier[name=transform] ~ ObjectLiteralExpression > PropertyAssignment:has(StringLiteral[value=jest-preset-angular])';

  const TRANSFORMER_STRING = "'^.+\\.(ts|mjs|js|html)$': 'jest-preset-angular'";

  let ast = tsquery.ast(fileContents);
  const transformerExpressionNode = tsquery(
    ast,
    JEST_PRESET_ANGULAR_AST_QUERY,
    {
      visitAllChildren: true,
    }
  )[0] as Node;

  const transformerIndex = transformerExpressionNode.pos;
  const transformerEndIndex = transformerExpressionNode.end;

  let updatedFileContents = `${fileContents.slice(
    0,
    transformerIndex
  )}\n${TRANSFORMER_STRING}${fileContents.slice(transformerEndIndex)}`;

  const TRANSFORM_OBJECT_AST_QUERY =
    'PropertyAssignment:has(Identifier[name=transform])';
  let TRANSFORM_IGNORE_PATTERN_STRING =
    "transformIgnorePatterns: ['<rootDir>/node_modules/(?!@angular)'],";

  ast = tsquery.ast(updatedFileContents);

  const transformObjectNode = tsquery(ast, TRANSFORM_OBJECT_AST_QUERY, {
    visitAllChildren: true,
  })[0] as PropertyAssignment;

  let transformEndIndex = transformObjectNode.getEnd();
  if (updatedFileContents.charAt(transformEndIndex) == ',') {
    transformEndIndex = transformObjectNode.getEnd() + 1;
    TRANSFORM_IGNORE_PATTERN_STRING = `\n${TRANSFORM_IGNORE_PATTERN_STRING}`;
  } else {
    TRANSFORM_IGNORE_PATTERN_STRING = `,\n${TRANSFORM_IGNORE_PATTERN_STRING}`;
  }

  updatedFileContents = `${updatedFileContents.slice(
    0,
    transformEndIndex
  )}${TRANSFORM_IGNORE_PATTERN_STRING}${updatedFileContents.slice(
    transformEndIndex
  )}`;

  return updatedFileContents;
}
