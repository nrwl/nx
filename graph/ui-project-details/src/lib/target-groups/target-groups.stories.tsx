import type { Meta, StoryObj } from '@storybook/react';
import { TargetGroupsComponent, TargetGroupsProps } from './target-groups';

const meta: Meta<typeof TargetGroupsComponent> = {
  component: TargetGroupsComponent,
  title: 'TargetGroupsComponent',
};
export default meta;

type Story = StoryObj<typeof TargetGroupsComponent>;

export const BuildBaseSelected: Story = {
  args: {
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
              ],
            },
            configurations: {},
          },
        },
      },
    },
    selectedTargetGroup: 'build-base',
    selectTargetGroup(targetGroup) {
      console.log(targetGroup);
    },
  } as TargetGroupsProps,
};

export const TestSelected: Story = {
  args: {
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
              ],
            },
            configurations: {},
          },
        },
      },
    },
    selectedTargetGroup: 'test',
    selectTargetGroup(targetGroup) {
      console.log(targetGroup);
    },
  } as TargetGroupsProps,
};
