import type { Tree } from '@nrwl/devkit';
import type { Node, PropertyAssignment } from 'typescript';
import { formatFiles, getProjects } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

type AngularProjectWithJestConfig = Record<string, [string, string]>; // Record<projectName, [jestConfigPath, jestConfigFileContents]

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  const angularProjects: AngularProjectWithJestConfig = {};

  for (const [projectName, project] of projects.entries()) {
    if (
      project.targets?.test &&
      project.targets?.test.executor === '@nrwl/jest:jest'
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

    await formatFiles(tree);
  }

  for (const [_, [jestConfigPath, jestFileContents]] of Object.entries(
    angularProjects
  )) {
    tree.write(
      jestConfigPath,
      replaceTransformAndAddIgnorePattern(jestFileContents)
    );
  }

  await formatFiles(tree);
}

export function replaceTransformAndAddIgnorePattern(fileContents: string) {
  let updatedFileContents = updateTransformProperty(fileContents);
  updatedFileContents = updateTransformIgnorePattern(updatedFileContents);

  if (fileContents === updatedFileContents) {
    return updatedFileContents;
  }

  return updatedFileContents;
}

function updateTransformProperty(fileContents: string) {
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

  if (!transformerExpressionNode) {
    return fileContents;
  }

  const transformerIndex = transformerExpressionNode.pos;
  const transformerEndIndex = transformerExpressionNode.end;

  return `${fileContents.slice(
    0,
    transformerIndex
  )}\n${TRANSFORMER_STRING}${fileContents.slice(transformerEndIndex)}`;
}

function updateTransformIgnorePattern(fileContents: string) {
  const TRANSFORM_OBJECT_AST_QUERY =
    'PropertyAssignment:has(Identifier[name=transform])';
  let TRANSFORM_IGNORE_PATTERN_STRING =
    "transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],";

  if (
    fileContents.includes(
      "transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)']"
    )
  ) {
    return fileContents;
  }

  const ast = tsquery.ast(fileContents);

  const transformObjectNode = tsquery(ast, TRANSFORM_OBJECT_AST_QUERY, {
    visitAllChildren: true,
  })[0] as PropertyAssignment;

  if (!transformObjectNode) {
    return fileContents;
  }

  let transformEndIndex = transformObjectNode.getEnd();
  if (fileContents.charAt(transformEndIndex) == ',') {
    transformEndIndex = transformObjectNode.getEnd() + 1;
    TRANSFORM_IGNORE_PATTERN_STRING = `\n${TRANSFORM_IGNORE_PATTERN_STRING}`;
  } else {
    TRANSFORM_IGNORE_PATTERN_STRING = `,\n${TRANSFORM_IGNORE_PATTERN_STRING}`;
  }

  return `${fileContents.slice(
    0,
    transformEndIndex
  )}${TRANSFORM_IGNORE_PATTERN_STRING}${fileContents.slice(transformEndIndex)}`;
}
