import {
  joinPathFragments,
  Tree,
  writeJson,
  offsetFromRoot,
  applyChangesToString,
  ChangeType,
} from '@nx/devkit';
import { ObjectLiteralExpression } from 'typescript';

export function setupJestProject(tree: Tree, projectRoot: string) {
  updateJestConfigTsFile(tree, projectRoot);
  writeBabelRcFile(tree, projectRoot);
}

export function writeBabelRcFile(tree: Tree, projectRoot: string) {
  writeJson(tree, joinPathFragments(projectRoot, '.babelrc'), {
    presets: [
      [
        '@nx/js/babel',
        {
          runtime: 'automatic',
        },
      ],
    ],
    plugins: [],
  });
}

export function updateJestConfigTsFile(tree: Tree, projectRoot: string) {
  const jestConfigTs = joinPathFragments(projectRoot, 'jest.config.ts');
  if (tree.exists(jestConfigTs)) {
    const { tsquery } = require('@phenomnomnominal/tsquery');
    let fileContent = tree.read(jestConfigTs, 'utf-8');
    const sourceFile = tsquery.ast(fileContent);

    const settingsObject = tsquery.query(
      sourceFile,
      'ObjectLiteralExpression'
    )?.[0] as ObjectLiteralExpression;

    if (settingsObject) {
      const moduleFileExtensions = tsquery.query(
        sourceFile,
        `PropertyAssignment:has(Identifier:has([name="moduleFileExtensions"]))`
      )?.[0];

      if (moduleFileExtensions) {
        fileContent = applyChangesToString(fileContent, [
          {
            type: ChangeType.Delete,
            start: moduleFileExtensions.getStart(),
            length:
              moduleFileExtensions.getEnd() -
              moduleFileExtensions.getStart() +
              1,
          },
        ]);
      }

      const transformProperty = tsquery.query(
        sourceFile,
        `PropertyAssignment:has(Identifier:has([name="transform"]))`
      )?.[0];

      if (transformProperty) {
        fileContent = applyChangesToString(fileContent, [
          {
            type: ChangeType.Delete,
            start: transformProperty.getStart(),
            length:
              transformProperty.getEnd() - transformProperty.getStart() + 1,
          },
        ]);
      }

      const settingsObjectUpdated = tsquery.query(
        fileContent,
        'ObjectLiteralExpression'
      )?.[0] as ObjectLiteralExpression;

      fileContent = applyChangesToString(fileContent, [
        {
          type: ChangeType.Insert,
          index: settingsObjectUpdated.getEnd() - 1,
          text: `,
            moduleFileExtensions: ['js', 'ts', 'json', 'vue'],
            transform: {
              '^.+\\.[tj]sx?$': ['babel-jest'],
              '^.+\\.vue$': [
                '@vue/vue3-jest',
                {
                  tsConfig: './tsconfig.spec.json',
                },
              ],
            },
            testEnvironment: 'jsdom',
            testMatch: ['**/__tests__/**/*.spec.ts?(x)', '**/__tests__/*.ts?(x)'],
            `,
        },
      ]);
      tree.write(jestConfigTs, fileContent);
    } else {
      writeNewJestConfig(tree, projectRoot);
    }
  } else {
    writeNewJestConfig(tree, projectRoot);
  }
}

function writeNewJestConfig(tree: Tree, projectRoot: string) {
  tree.write(
    joinPathFragments(projectRoot, 'jest.config.js'),
    `
          module.exports = {
              preset: '${offsetFromRoot}/jest.preset.js',
              moduleFileExtensions: ['js', 'ts', 'json', 'vue'],
              transform: {
                '^.+\\.[tj]sx?$': ['babel-jest'],
                '^.+\\.vue$': [
                  '@vue/vue3-jest',
                  {
                    tsConfig: './tsconfig.spec.json',
                  },
                ],
              },
              testEnvironment: 'jsdom',
              testMatch: ['**/__tests__/**/*.spec.ts?(x)', '**/__tests__/*.ts?(x)'],
            };
          `
  );
}
