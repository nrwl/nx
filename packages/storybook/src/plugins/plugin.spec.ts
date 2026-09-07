import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import type { StorybookConfig } from 'storybook/internal/types';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createNodesV2 } from './plugin';

// Outside the repo tree: an in-workspace path would be an undeclared task output.
jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: require('node:path').join(
    require('node:os').tmpdir(),
    'nx-storybook-plugin-cache'
  ),
}));

describe('@nx/storybook/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    rmSync(join(tmpdir(), 'nx-storybook-plugin-cache'), {
      recursive: true,
      force: true,
    });
    tempFs = new TempFs('storybook-plugin');
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };
    tempFs.createFileSync('package.json', JSON.stringify({ name: 'repo' }));
    tempFs.createFileSync('package-lock.json', '{}');
    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync(
      'my-ng-app/project.json',
      JSON.stringify({
        name: 'my-ng-app',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:application',
          },
        },
      })
    );
    tempFs.createFileSync(
      'my-ng-esbuild-app/project.json',
      JSON.stringify({
        name: 'my-ng-esbuild-app',
        targets: {
          build: { executor: '@angular/build:application' },
        },
      })
    );
    tempFs.createFileSync(
      'my-ng-lib/project.json',
      JSON.stringify({
        name: 'my-ng-lib',
        targets: {
          build: { executor: '@nx/angular:ng-packagr-lite' },
        },
      })
    );
    tempFs.createFileSync(
      'my-ng-pkg-named/project.json',
      JSON.stringify({ targets: {} })
    );
    tempFs.createFileSync(
      'my-ng-pkg-named/package.json',
      JSON.stringify({
        name: 'my-ng-pkg-named',
        nx: { targets: { build: { executor: '@angular/build:application' } } },
      })
    );
    tempFs.createFileSync(
      'my-ng-unnamed/project.json',
      JSON.stringify({ targets: {} })
    );
    tempFs.createFileSync(
      'my-react-lib/project.json',
      JSON.stringify({ name: 'my-react-lib' })
    );
    tempFs.createFileSync(
      'my-vitest-app/project.json',
      JSON.stringify({ name: 'my-vitest-app' })
    );
    tempFs.createFileSync(
      'my-webpack-app/project.json',
      JSON.stringify({ name: 'my-webpack-app' })
    );
    // Distinct root: targets are cached per project hash, and node_modules is not
    // part of that hash, so reusing a root returns the previous case's answer.
    tempFs.createFileSync(
      'my-mixed-app/project.json',
      JSON.stringify({ name: 'my-mixed-app' })
    );
    tempFs.createFileSync(
      'my-mixed-lib/project.json',
      JSON.stringify({ name: 'my-mixed-lib' })
    );
    tempFs.createFileSync(
      'my-svelte-app/project.json',
      JSON.stringify({ name: 'my-svelte-app' })
    );
    tempFs.createFileSync(
      'my-comment-app/project.json',
      JSON.stringify({ name: 'my-comment-app' })
    );
    tempFs.createFileSync(
      'my-object-app/project.json',
      JSON.stringify({ name: 'my-object-app' })
    );
    tempFs.createFileSync(
      'my-inherited-app/project.json',
      JSON.stringify({ name: 'my-inherited-app' })
    );
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  it('should create nodes', async () => {
    tempFs.createFileSync('my-app/.storybook/main.ts', '');
    mockStorybookMainConfig('my-app/.storybook/main.ts', {
      stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
      framework: {
        name: '@storybook/react-vite',
        options: {},
      },
    });

    const nodes = await createNodesFunction(
      ['my-app/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-app/.storybook/main.ts",
          {
            "projects": {
              "my-app": {
                "root": "my-app",
                "targets": {
                  "build-deps": {
                    "dependsOn": [
                      "^build",
                    ],
                  },
                  "build-storybook": {
                    "cache": true,
                    "command": "storybook build",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "storybook",
                        ],
                      },
                    ],
                    "options": {
                      "cwd": "my-app",
                    },
                    "outputs": [
                      "{projectRoot}/storybook-static",
                      "{options.output-dir}",
                      "{options.outputDir}",
                      "{options.o}",
                    ],
                  },
                  "serve-storybook": {
                    "command": "storybook dev",
                    "continuous": true,
                    "options": {
                      "cwd": "my-app",
                    },
                  },
                  "static-storybook": {
                    "continuous": true,
                    "dependsOn": [
                      "build-storybook",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-storybook",
                      "staticFilePath": "my-app/storybook-static",
                    },
                  },
                  "watch-deps": {
                    "command": "npx nx watch --projects my-app --includeDependencies -- npx nx build-deps my-app",
                    "continuous": true,
                    "dependsOn": [
                      "build-deps",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should create angular nodes', async () => {
    tempFs.createFileSync(
      'my-ng-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
};

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-ng-app/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-ng-app/.storybook/main.ts",
          {
            "projects": {
              "my-ng-app": {
                "root": "my-ng-app",
                "targets": {
                  "build-deps": {
                    "dependsOn": [
                      "^build",
                    ],
                  },
                  "build-storybook": {
                    "cache": true,
                    "executor": "@storybook/angular:build-storybook",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "storybook",
                          "@storybook/angular",
                        ],
                      },
                    ],
                    "options": {
                      "browserTarget": "my-ng-app:build",
                      "compodoc": false,
                      "configDir": "my-ng-app/.storybook",
                      "outputDir": "my-ng-app/storybook-static",
                    },
                    "outputs": [
                      "{projectRoot}/storybook-static",
                      "{options.output-dir}",
                      "{options.outputDir}",
                      "{options.o}",
                    ],
                  },
                  "serve-storybook": {
                    "continuous": true,
                    "executor": "@storybook/angular:start-storybook",
                    "options": {
                      "browserTarget": "my-ng-app:build",
                      "compodoc": false,
                      "configDir": "my-ng-app/.storybook",
                      "port": 6006,
                    },
                  },
                  "static-storybook": {
                    "continuous": true,
                    "dependsOn": [
                      "build-storybook",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-storybook",
                      "staticFilePath": "my-ng-app/storybook-static",
                    },
                  },
                  "watch-deps": {
                    "command": "npx nx watch --projects my-ng-app --includeDependencies -- npx nx build-deps my-ng-app",
                    "continuous": true,
                    "dependsOn": [
                      "build-deps",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it.each`
    project                          | root                   | expectedBrowserTarget
    ${'esbuild app'}                 | ${'my-ng-esbuild-app'} | ${'my-ng-esbuild-app:build'}
    ${'lib without a browser build'} | ${'my-ng-lib'}         | ${'my-ng-lib:build-storybook'}
  `(
    'should point browserTarget at the angular build target for an $project',
    async ({ root, expectedBrowserTarget }) => {
      tempFs.createFileSync(
        `${root}/.storybook/main.ts`,
        `import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
};

export default config;
`
      );

      const nodes = await createNodesFunction(
        [`${root}/.storybook/main.ts`],
        {
          buildStorybookTargetName: 'build-storybook',
          staticStorybookTargetName: 'static-storybook',
          serveStorybookTargetName: 'serve-storybook',
          testStorybookTargetName: 'test-storybook',
          buildDepsTargetName: 'build-deps',
          watchDepsTargetName: 'watch-deps',
        },
        context
      );

      const targets = (nodes[0][1] as any).projects[root].targets;
      expect(targets['build-storybook'].options.browserTarget).toBe(
        expectedBrowserTarget
      );
      expect(targets['serve-storybook'].options.browserTarget).toBe(
        expectedBrowserTarget
      );
      // The angular builder defaults to 9009; test-storybook looks for 6006.
      expect(targets['serve-storybook'].options.port).toBe(6006);
    }
  );

  it('should name an angular project from package.json and read its targets when project.json omits them', async () => {
    tempFs.createFileSync(
      'my-ng-pkg-named/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
};

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-ng-pkg-named/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    const targets = (nodes[0][1] as any).projects['my-ng-pkg-named'].targets;
    expect(targets['build-storybook'].options.browserTarget).toBe(
      'my-ng-pkg-named:build'
    );
  });

  it('should fall back to the configured storybook build target name', async () => {
    tempFs.createFileSync(
      'my-ng-custom-name/project.json',
      JSON.stringify({ name: 'my-ng-custom-name' })
    );
    tempFs.createFileSync(
      'my-ng-custom-name/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
};

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-ng-custom-name/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'storybook-build',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    // The fallback must name the target that was actually created, not the default.
    const targets = (nodes[0][1] as any).projects['my-ng-custom-name'].targets;
    expect(targets['storybook-build'].options.browserTarget).toBe(
      'my-ng-custom-name:storybook-build'
    );
    expect(targets['serve-storybook'].options.browserTarget).toBe(
      'my-ng-custom-name:storybook-build'
    );
  });

  it('should fall back to the directory name when neither config file names the project', async () => {
    tempFs.createFileSync(
      'my-ng-unnamed/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
};

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-ng-unnamed/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    const targets = (nodes[0][1] as any).projects['my-ng-unnamed'].targets;
    expect(targets['build-storybook'].options.browserTarget).toBe(
      'my-ng-unnamed:build-storybook'
    );
  });

  it('should support main.js', async () => {
    tempFs.createFileSync('my-react-lib/.storybook/main.js', '');
    mockStorybookMainConfig('my-react-lib/.storybook/main.js', {
      stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-essentials'],
      framework: {
        name: '@storybook/react-vite',
        options: {
          builder: {
            viteConfigPath: 'vite.config.js',
          },
        },
      },
    });

    const nodes = await createNodesFunction(
      ['my-react-lib/.storybook/main.js'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-react-lib/.storybook/main.js",
          {
            "projects": {
              "my-react-lib": {
                "root": "my-react-lib",
                "targets": {
                  "build-deps": {
                    "dependsOn": [
                      "^build",
                    ],
                  },
                  "build-storybook": {
                    "cache": true,
                    "command": "storybook build",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "storybook",
                        ],
                      },
                    ],
                    "options": {
                      "cwd": "my-react-lib",
                    },
                    "outputs": [
                      "{projectRoot}/storybook-static",
                      "{options.output-dir}",
                      "{options.outputDir}",
                      "{options.o}",
                    ],
                  },
                  "serve-storybook": {
                    "command": "storybook dev",
                    "continuous": true,
                    "options": {
                      "cwd": "my-react-lib",
                    },
                  },
                  "static-storybook": {
                    "continuous": true,
                    "dependsOn": [
                      "build-storybook",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-storybook",
                      "staticFilePath": "my-react-lib/storybook-static",
                    },
                  },
                  "watch-deps": {
                    "command": "npx nx watch --projects my-react-lib --includeDependencies -- npx nx build-deps my-react-lib",
                    "continuous": true,
                    "dependsOn": [
                      "build-deps",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should infer test-storybook from a generated Vite config with addon-vitest', async () => {
    tempFs.createFileSync(
      'my-vitest-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/react-vite';
import { dirname } from 'node:path';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [getAbsolutePath('@storybook/addon-vitest')],
};

function getAbsolutePath(value: string): string {
  return dirname(require.resolve(value + '/package.json'));
}

export default config;
`
    );
    installPackage('my-vitest-app', '@storybook/addon-vitest');

    const nodes = await createNodesFunction(
      ['my-vitest-app/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
        buildDepsTargetName: 'build-deps',
        watchDepsTargetName: 'watch-deps',
      },
      context
    );

    expect(nodes[0][1].projects['my-vitest-app'].targets['test-storybook'])
      .toMatchInlineSnapshot(`
      {
        "command": "vitest run --project=storybook --passWithNoTests",
        "inputs": [
          {
            "externalDependencies": [
              "storybook",
              "@storybook/addon-vitest",
              "vitest",
            ],
          },
        ],
        "options": {
          "cwd": "my-vitest-app",
        },
      }
    `);
  });

  it('should infer the test runner target when only it is installed', async () => {
    tempFs.createFileSync('my-webpack-app/.storybook/main.ts', '');
    installPackage('my-webpack-app', '@storybook/test-runner');
    mockStorybookMainConfig('my-webpack-app/.storybook/main.ts', {
      stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: [],
      framework: { name: '@storybook/react-webpack5', options: {} },
    });

    const nodes = await createNodesFunction(
      ['my-webpack-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-webpack-app'].targets['test-storybook'].command
    ).toBe('test-storybook');
  });

  it('should ignore addon-vitest references in comments', async () => {
    installPackage('.', '@storybook/addon-vitest');
    installPackage('.', '@storybook/test-runner');
    tempFs.createFileSync(
      'my-comment-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/react-vite';

// @storybook/addon-vitest disabled
const config: StorybookConfig = { addons: [] };

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-comment-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-comment-app'].targets['test-storybook'].command
    ).toBe('test-storybook');
  });

  it('should infer test-storybook from an addon object entry', async () => {
    installPackage('.', '@storybook/addon-vitest');
    tempFs.createFileSync(
      'my-object-app/.storybook/main.ts',
      `export default {
  framework: '@storybook/react-vite',
  addons: [{ name: '@storybook/addon-vitest', options: {} }],
};
`
    );

    const nodes = await createNodesFunction(
      ['my-object-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-object-app'].targets['test-storybook'].command
    ).toBe('vitest run --project=storybook --passWithNoTests');
  });

  it('should infer test-storybook from an inherited addon entry', async () => {
    installPackage('.', '@storybook/addon-vitest');
    tempFs.createFileSync(
      'my-inherited-app/.storybook/base.ts',
      `export default { addons: ['@storybook/addon-vitest'] };`
    );
    tempFs.createFileSync(
      'my-inherited-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/react-vite';
import base from './base';

const config: StorybookConfig = { ...base };

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-inherited-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-inherited-app'].targets['test-storybook'].command
    ).toBe('vitest run --project=storybook --passWithNoTests');
  });

  it('should infer test-storybook when the framework resolves to an absolute path', async () => {
    installPackage('.', '@storybook/addon-vitest');
    // A shared base config spreads in a `getAbsolutePath()` framework, so the
    // slow path reports a resolved path rather than the bare specifier.
    tempFs.createFileSync(
      'my-inherited-app/.storybook/base.ts',
      `export default {
  addons: ['@storybook/addon-vitest'],
  framework: {
    name: '/repo/node_modules/@storybook/react-vite',
    options: {},
  },
};
`
    );
    tempFs.createFileSync(
      'my-inherited-app/.storybook/main.ts',
      `import base from './base';

const config = { ...base };

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-inherited-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-inherited-app'].targets['test-storybook'].command
    ).toBe('vitest run --project=storybook --passWithNoTests');
  });

  it('should only give the vitest command to the vite framework when the addon is at the root', async () => {
    // The addon lands in the root package.json, so it resolves for every project.
    // Only the Vite-builder frameworks can actually run it.
    installPackage('.', '@storybook/addon-vitest');
    installPackage('.', '@storybook/test-runner');

    tempFs.createFileSync(
      'my-mixed-lib/.storybook/main.ts',
      `export default { addons: ['@storybook/addon-vitest'] };`
    );
    mockStorybookMainConfig('my-mixed-lib/.storybook/main.ts', {
      stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-vitest'],
      framework: { name: '@storybook/react-vite', options: {} },
    });
    tempFs.createFileSync('my-mixed-app/.storybook/main.ts', '');
    mockStorybookMainConfig('my-mixed-app/.storybook/main.ts', {
      stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-vitest'],
      framework: { name: '@storybook/react-webpack5', options: {} },
    });

    const [viteNodes, webpackNodes] = await Promise.all([
      createNodesFunction(
        ['my-mixed-lib/.storybook/main.ts'],
        targetNames,
        context
      ),
      createNodesFunction(
        ['my-mixed-app/.storybook/main.ts'],
        targetNames,
        context
      ),
    ]);

    // Guards the assertion below: without this the addon may simply not resolve,
    // and the webpack expectation would hold for the wrong reason.
    expect(
      viteNodes[0][1].projects['my-mixed-lib'].targets['test-storybook'].command
    ).toBe('vitest run --project=storybook --passWithNoTests');
    expect(
      webpackNodes[0][1].projects['my-mixed-app'].targets['test-storybook']
        .command
    ).toBe('test-storybook');
  });

  it('should not give the vitest command to a vite project that has not registered the addon', async () => {
    installPackage('.', '@storybook/addon-vitest');
    installPackage('.', '@storybook/test-runner');
    tempFs.createFileSync('my-react-lib/.storybook/main.ts', '');
    mockStorybookMainConfig('my-react-lib/.storybook/main.ts', {
      stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: [],
      framework: { name: '@storybook/react-vite', options: {} },
    });

    const nodes = await createNodesFunction(
      ['my-react-lib/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-react-lib'].targets['test-storybook'].command
    ).toBe('test-storybook');
  });

  it('should treat sveltekit as a vite framework', async () => {
    installPackage('.', '@storybook/addon-vitest');
    tempFs.createFileSync(
      'my-svelte-app/.storybook/main.ts',
      `export default { addons: ['@storybook/addon-vitest'] };`
    );
    mockStorybookMainConfig('my-svelte-app/.storybook/main.ts', {
      stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-vitest'],
      framework: { name: '@storybook/sveltekit', options: {} },
    });

    const nodes = await createNodesFunction(
      ['my-svelte-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-svelte-app'].targets['test-storybook'].command
    ).toBe('vitest run --project=storybook --passWithNoTests');
  });

  it('should treat angular-vite as a vite framework', async () => {
    installPackage('.', '@storybook/addon-vitest');
    tempFs.createFileSync(
      'my-ng-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  addons: ['@storybook/addon-vitest'],
};

export default config;
`
    );

    const nodes = await createNodesFunction(
      ['my-ng-app/.storybook/main.ts'],
      targetNames,
      context
    );

    expect(
      nodes[0][1].projects['my-ng-app'].targets['test-storybook'].command
    ).toBe('vitest run --project=storybook --passWithNoTests');
  });

  function installPackage(projectRoot: string, packageName: string) {
    const base = projectRoot === '.' ? '' : `${projectRoot}/`;
    tempFs.createFileSync(
      `${base}node_modules/${packageName}/package.json`,
      JSON.stringify({ name: packageName, main: 'index.js' })
    );
    tempFs.createFileSync(`${base}node_modules/${packageName}/index.js`, '');
  }

  const targetNames = {
    buildStorybookTargetName: 'build-storybook',
    staticStorybookTargetName: 'static-storybook',
    serveStorybookTargetName: 'serve-storybook',
    testStorybookTargetName: 'test-storybook',
    buildDepsTargetName: 'build-deps',
    watchDepsTargetName: 'watch-deps',
  };

  function mockStorybookMainConfig(
    mainTsPath: string,
    mainTsConfig: StorybookConfig
  ) {
    jest.mock(
      join(tempFs.tempDir, mainTsPath),
      () => ({ default: mainTsConfig }),
      { virtual: true }
    );
  }
});
