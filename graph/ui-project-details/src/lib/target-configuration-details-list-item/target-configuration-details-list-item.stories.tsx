import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsListItem,
  TargetConfigurationDetailsListItemProps,
} from './target-configuration-details-list-item';

const meta: Meta<typeof TargetConfigurationDetailsListItem> = {
  component: TargetConfigurationDetailsListItem,
  title: 'TargetConfigurationDetailsListItem',
};
export default meta;

type Story = StoryObj<typeof TargetConfigurationDetailsListItem>;

export const Simple: Story = {
  args: {
    isCollasped: true,
    toggleCollapse: () => {},
    collapsable: false,
    isCompact: true,
    targetConfiguration: {},
    projectName: 'jest',
    targetName: 'test',
    sourceMap: {},
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
    project: {
      name: 'jest',
      type: 'lib',
      data: {
        root: 'packages/jest',
        name: 'jest',
        targets: {
          'nx-release-publish': {
            dependsOn: ['^nx-release-publish'],
            executor: '@nx/js:release-publish',
            options: { packageRoot: 'build/packages/jest' },
            configurations: {},
          },
          test: {
            dependsOn: ['test-native', 'build-native', '^build-native'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
            executor: '@nx/jest:jest',
            outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
            cache: true,
            options: {
              jestConfig: 'packages/jest/jest.config.ts',
              passWithNoTests: true,
            },
            configurations: {},
          },
          'build-base': {
            dependsOn: ['^build-base', 'build-native'],
            inputs: ['production', '^production'],
            executor: '@nx/js:tsc',
            outputs: ['{options.outputPath}'],
            cache: true,
            options: {
              outputPath: 'build/packages/jest',
              tsConfig: 'packages/jest/tsconfig.lib.json',
              main: 'packages/jest/index.ts',
              assets: [
                {
                  input: 'packages/jest',
                  glob: '**/@(files|files-angular)/**',
                  output: '/',
                },
                {
                  input: 'packages/jest',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/jest',
                  glob: '**/*.json',
                  ignore: [
                    '**/tsconfig*.json',
                    'project.json',
                    '.eslintrc.json',
                  ],
                  output: '/',
                },
                {
                  input: 'packages/jest',
                  glob: '**/*.js',
                  ignore: ['**/jest.config.js'],
                  output: '/',
                },
                { input: 'packages/jest', glob: '**/*.d.ts', output: '/' },
                { input: '', glob: 'LICENSE', output: '/' },
              ],
            },
            configurations: {},
          },
          build: {
            dependsOn: ['build-base', 'build-native'],
            inputs: ['production', '^production'],
            cache: true,
            executor: 'nx:run-commands',
            outputs: ['{workspaceRoot}/build/packages/jest'],
            options: { command: 'node ./scripts/copy-readme.js jest' },
            configurations: {},
          },
          lint: {
            dependsOn: ['build-native', '^build-native'],
            inputs: [
              'default',
              '{workspaceRoot}/.eslintrc.json',
              '{workspaceRoot}/tools/eslint-rules/**/*',
            ],
            executor: '@nx/eslint:lint',
            outputs: ['{options.outputFile}'],
            cache: true,
            options: { lintFilePatterns: ['packages/jest'] },
            configurations: {},
          },
        },
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: 'packages/jest',
        projectType: 'library',
        implicitDependencies: [],
        tags: [],
      },
    },
  } as TargetConfigurationDetailsListItemProps,
};
