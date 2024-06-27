import type { Meta } from '@storybook/react';
import { ProjectDetails } from './project-details';
import { ExpandedTargetsProvider } from '@nx/graph/shared';

const meta: Meta<typeof ProjectDetails> = {
  component: ProjectDetails,
  title: 'ProjectDetails',
  decorators: [
    (story) => <ExpandedTargetsProvider>{story()}</ExpandedTargetsProvider>,
  ],
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

export const Gradle = {
  args: {
    project: {
      name: 'utilities',
      type: 'lib',
      data: {
        root: 'utilities',
        name: 'utilities',
        metadata: {
          targetGroups: {
            Build: [
              'assemble',
              'build',
              'buildDependents',
              'buildKotlinToolingMetadata',
              'buildNeeded',
              'classes',
              'clean',
              'jar',
              'kotlinSourcesJar',
              'testClasses',
            ],
            Documentation: ['javadoc'],
            Help: [
              'buildEnvironment',
              'dependencies',
              'dependencyInsight',
              'help',
              'javaToolchains',
              'kotlinDslAccessorsReport',
              'outgoingVariants',
              'projects',
              'properties',
              'resolvableConfigurations',
              'tasks',
            ],
            Reporting: ['projectReport'],
            Verification: [
              'check',
              'checkKotlinGradlePluginConfigurationErrors',
              'test',
            ],
          },
          technologies: ['gradle'],
        },
        targets: {
          assemble: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew assemble',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          build: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew build',
            },
            cache: true,
            inputs: ['default', '^default'],
            outputs: ['{workspaceRoot}/utilities/build'],
            dependsOn: ['^build', 'classes'],
            executor: 'nx:run-commands',
            configurations: {},
          },
          buildDependents: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew buildDependents',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          buildKotlinToolingMetadata: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew buildKotlinToolingMetadata',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          buildNeeded: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew buildNeeded',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          classes: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew classes',
            },
            cache: true,
            inputs: ['default', '^default'],
            outputs: ['{workspaceRoot}/utilities/build/classes'],
            dependsOn: ['^classes'],
            executor: 'nx:run-commands',
            configurations: {},
          },
          clean: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew clean',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          jar: {
            options: {
              cwd: 'utilities',
              command: '/Users/emily/code/tmp/gradle-plugin-test3/gradlew jar',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          kotlinSourcesJar: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew kotlinSourcesJar',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          testClasses: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew testClasses',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          javadoc: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew javadoc',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          buildEnvironment: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew buildEnvironment',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          dependencies: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew dependencies',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          dependencyInsight: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew dependencyInsight',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          help: {
            options: {
              cwd: 'utilities',
              command: '/Users/emily/code/tmp/gradle-plugin-test3/gradlew help',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          javaToolchains: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew javaToolchains',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          kotlinDslAccessorsReport: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew kotlinDslAccessorsReport',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          outgoingVariants: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew outgoingVariants',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          projects: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew projects',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          properties: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew properties',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          resolvableConfigurations: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew resolvableConfigurations',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          tasks: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew tasks',
            },
            cache: false,
            executor: 'nx:run-commands',
            configurations: {},
          },
          projectReport: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew projectReport',
            },
            cache: false,
            outputs: ['{workspaceRoot}/utilities/build/reports/project'],
            executor: 'nx:run-commands',
            configurations: {},
          },
          check: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew check',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          checkKotlinGradlePluginConfigurationErrors: {
            options: {
              cwd: 'utilities',
              command:
                '/Users/emily/code/tmp/gradle-plugin-test3/gradlew checkKotlinGradlePluginConfigurationErrors',
            },
            cache: true,
            executor: 'nx:run-commands',
            configurations: {},
          },
          test: {
            options: {
              cwd: 'utilities',
              command: '/Users/emily/code/tmp/gradle-plugin-test3/gradlew test',
            },
            cache: true,
            inputs: ['default', '^default'],
            dependsOn: ['classes'],
            executor: 'nx:run-commands',
            configurations: {},
          },
        },
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

export const Cart = {
  args: {
    project: {
      name: 'cart-e2e',
      type: 'e2e',
      data: {
        root: 'apps/cart-e2e',
        targets: {
          lint: {
            cache: true,
            options: {
              cwd: 'apps/cart-e2e',
              command: 'eslint .',
            },
            inputs: [
              'default',
              '^default',
              '{workspaceRoot}/.eslintrc.json',
              '{projectRoot}/.eslintrc.json',
              '{workspaceRoot}/tools/eslint-rules/**/*',
              {
                externalDependencies: ['eslint'],
              },
            ],
            executor: 'nx:run-commands',
            configurations: {},
          },
          e2e: {
            cache: true,
            inputs: ['default', '^production'],
            outputs: [
              '{workspaceRoot}/dist/cypress/apps/cart-e2e/videos',
              '{workspaceRoot}/dist/cypress/apps/cart-e2e/screenshots',
            ],
            metadata: {
              technologies: ['cypress'],
              description: 'Runs Cypress Tests',
            },
            executor: 'nx:run-commands',
            options: {
              cwd: 'apps/cart-e2e',
              command: 'cypress run',
            },
            configurations: {},
          },
          'e2e-ci--src/e2e/app.cy.ts': {
            outputs: [
              '{workspaceRoot}/dist/cypress/apps/cart-e2e/videos',
              '{workspaceRoot}/dist/cypress/apps/cart-e2e/screenshots',
            ],
            inputs: [
              'default',
              '^production',
              {
                externalDependencies: ['cypress'],
              },
            ],
            cache: true,
            options: {
              cwd: 'apps/cart-e2e',
              command:
                'cypress run --env webServerCommand="nx run cart:serve" --spec src/e2e/app.cy.ts',
            },
            metadata: {
              technologies: ['cypress'],
              description: 'Runs Cypress Tests in src/e2e/app.cy.ts in CI',
            },
            executor: 'nx:run-commands',
            configurations: {},
          },
          'e2e-ci': {
            executor: 'nx:noop',
            cache: true,
            inputs: [
              'default',
              '^production',
              {
                externalDependencies: ['cypress'],
              },
            ],
            outputs: [
              '{workspaceRoot}/dist/cypress/apps/cart-e2e/videos',
              '{workspaceRoot}/dist/cypress/apps/cart-e2e/screenshots',
            ],
            dependsOn: [
              {
                target: 'e2e-ci--src/e2e/app.cy.ts',
                projects: 'self',
                params: 'forward',
              },
            ],
            metadata: {
              technologies: ['cypress'],
              description: 'Runs Cypress Tests in CI',
            },
            options: {},
            configurations: {},
          },
          'open-cypress': {
            options: {
              cwd: 'apps/cart-e2e',
              command: 'cypress open',
            },
            metadata: {
              technologies: ['cypress'],
              description: 'Opens Cypress',
            },
            executor: 'nx:run-commands',
            configurations: {},
          },
        },
        projectType: 'application',
        metadata: {
          targetGroups: {
            'E2E (CI)': ['e2e-ci--src/e2e/app.cy.ts', 'e2e-ci'],
          },
        },
        name: 'cart-e2e',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: 'apps/cart-e2e/src',
        tags: ['scope:cart', 'type:e2e'],
        implicitDependencies: ['cart'],
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

// We're normalizing `type` from `projectType`, so if projectType is missing we'll fallback to `type`.
// See: packages/nx/src/project-graph/utils/normalize-project-nodes.ts
export const FallbackType = {
  args: {
    project: {
      name: 'mypkg',
      type: 'lib',
      data: {
        root: '.',
        name: 'mypkg',
        targets: {
          echo: {
            executor: 'nx:run-script',
            metadata: {
              scriptContent: 'echo 1',
              runCommand: 'npm run echo',
            },
            options: {
              script: 'echo',
            },
            configurations: {},
          },
        },
        sourceRoot: '.',
        implicitDependencies: [],
        tags: [],
      },
    },
    sourceMap: {
      root: ['nx/core/project-json', 'project.json'],
      name: ['nx/core/project-json', 'project.json'],
      targets: ['nx/core/package-json', 'project.json'],
      'targets.echo': ['nx/core/package-json-workspaces', 'package.json'],
      'targets.echo.executor': [
        'nx/core/package-json-workspaces',
        'package.json',
      ],
      'targets.echo.options': [
        'nx/core/package-json-workspaces',
        'package.json',
      ],
      'targets.echo.metadata': [
        'nx/core/package-json-workspaces',
        'package.json',
      ],
      'targets.echo.options.script': [
        'nx/core/package-json-workspaces',
        'package.json',
      ],
      'targets.echo.metadata.scriptContent': [
        'nx/core/package-json-workspaces',
        'package.json',
      ],
      'targets.echo.metadata.runCommand': [
        'nx/core/package-json-workspaces',
        'package.json',
      ],
    },
  },
};
