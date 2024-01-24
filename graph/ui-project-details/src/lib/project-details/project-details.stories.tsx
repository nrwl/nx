import type { Meta } from '@storybook/react';
import { ProjectDetails } from './project-details';

const meta: Meta<typeof ProjectDetails> = {
  component: ProjectDetails,
  title: 'ProjectDetails',
};
export default meta;

export const Primary = {
  args: {
    project: {
      name: 'jest',
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
          'add-extra-dependencies': {
            executor: 'nx:run-commands',
            options: {
              command:
                'node ./scripts/add-dependency-to-build.js jest @nrwl/jest',
            },
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
    sourceMap: {
      root: ['packages/jest/project.json', 'nx-core-build-project-json-nodes'],
      name: ['packages/jest/project.json', 'nx-core-build-project-json-nodes'],
      targets: [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.nx-release-publish': [
        'packages/jest/project.json',
        'nx-core-build-package-json-nodes-next-to-project-json-nodes',
      ],
      'targets.nx-release-publish.dependsOn': [
        'packages/jest/project.json',
        'nx-core-build-package-json-nodes-next-to-project-json-nodes',
      ],
      'targets.nx-release-publish.executor': [
        'packages/jest/project.json',
        'nx-core-build-package-json-nodes-next-to-project-json-nodes',
      ],
      'targets.nx-release-publish.options': [
        'packages/jest/project.json',
        'nx-core-build-package-json-nodes-next-to-project-json-nodes',
      ],
      $schema: [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      sourceRoot: [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      projectType: [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.test': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build-base': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build-base.executor': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build-base.options': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build-base.options.assets': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build.executor': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build.outputs': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build.options': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.build.options.command': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.add-extra-dependencies': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.add-extra-dependencies.command': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
      'targets.lint': [
        'packages/jest/project.json',
        'nx-core-build-project-json-nodes',
      ],
    },
  },
};
