import { CreateNodesContext } from '@nx/devkit';

import { createNodes } from './plugin';
import { TempFs } from '@nx/devkit/internal-testing-utils';

describe('@nx/storybook/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs = new TempFs('test');

  beforeEach(async () => {
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };
    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync(
      'my-ng-app/project.json',
      JSON.stringify({ name: 'my-ng-app' })
    );
    tempFs.createFileSync(
      'my-react-lib/project.json',
      JSON.stringify({ name: 'my-react-lib' })
    );
  });

  afterEach(() => {
    jest.resetModules();
    tempFs = new TempFs('test');
  });

  it('should create nodes', () => {
    tempFs.createFileSync(
      'my-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/react-vite';

      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { mergeConfig } from 'vite';
      
      const config: StorybookConfig = {
        stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
        framework: {
          name: '@storybook/react-vite',
          options: {},
        },
      
        viteFinal: async (config) =>
          mergeConfig(config, {
            plugins: [nxViteTsPaths()],
          }),
      };
      
      export default config;`
    );
    const nodes = createNodesFunction(
      'my-app/.storybook/main.ts',
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
      },
      context
    );

    expect(nodes?.['projects']?.['my-app']?.targets).toBeDefined();
    expect(
      nodes?.['projects']?.['my-app']?.targets?.['build-storybook']
    ).toMatchObject({
      command: 'storybook build',
      options: {
        cwd: 'my-app',
      },
      cache: true,
      outputs: [
        '{workspaceRoot}/{projectRoot}/storybook-static',
        '{options.output-dir}',
        '{options.outputDir}',
        '{options.o}',
      ],
      inputs: [
        'production',
        '^production',
        { externalDependencies: ['storybook', '@storybook/test-runner'] },
      ],
    });

    expect(
      nodes?.['projects']?.['my-app']?.targets?.['storybook']
    ).toMatchObject({
      command: 'storybook dev',
    });
    expect(
      nodes?.['projects']?.['my-app']?.targets?.['test-storybook']
    ).toMatchObject({
      command: 'test-storybook',
    });
  });

  it('should create angular nodes', () => {
    tempFs.createFileSync(
      'my-ng-app/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/angular';

      const config: StorybookConfig = {
        stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
        framework: {
          name: '@storybook/angular',
          options: {},
        },
      };
      
      export default config;`
    );
    const nodes = createNodesFunction(
      'my-ng-app/.storybook/main.ts',
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
      },
      context
    );

    expect(nodes?.['projects']?.['my-ng-app']?.targets).toBeDefined();
    expect(
      nodes?.['projects']?.['my-ng-app']?.targets?.['build-storybook']
    ).toMatchObject({
      executor: '@storybook/angular:build-storybook',
      options: {
        outputDir: 'my-ng-app/storybook-static',
        configDir: 'my-ng-app/.storybook',
        browserTarget: 'my-ng-app:build-storybook',
        compodoc: false,
      },
      cache: true,
      outputs: [
        '{workspaceRoot}/{projectRoot}/storybook-static',
        '{options.output-dir}',
        '{options.outputDir}',
        '{options.o}',
      ],
      inputs: [
        'production',
        '^production',
        {
          externalDependencies: [
            'storybook',
            '@storybook/angular',
            '@storybook/test-runner',
          ],
        },
      ],
    });

    expect(
      nodes?.['projects']?.['my-ng-app']?.targets?.['storybook']
    ).toMatchObject({
      executor: '@storybook/angular:start-storybook',
      options: {
        browserTarget: 'my-ng-app:build-storybook',
        configDir: 'my-ng-app/.storybook',
        compodoc: false,
      },
    });
    expect(
      nodes?.['projects']?.['my-ng-app']?.targets?.['test-storybook']
    ).toMatchObject({
      command: 'test-storybook',
    });
  });

  it('should support main.js', () => {
    tempFs.createFileSync(
      'my-react-lib/.storybook/main.js',
      `const config = {
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
      };
      export default config;`
    );
    const nodes = createNodesFunction(
      'my-react-lib/.storybook/main.js',
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
      },
      context
    );

    expect(nodes?.['projects']?.['my-react-lib']?.targets).toBeDefined();
    expect(
      nodes?.['projects']?.['my-react-lib']?.targets?.['build-storybook']
    ).toMatchObject({
      command: 'storybook build',
      options: {
        cwd: 'my-react-lib',
      },
      cache: true,
      outputs: [
        '{workspaceRoot}/{projectRoot}/storybook-static',
        '{options.output-dir}',
        '{options.outputDir}',
        '{options.o}',
      ],
      inputs: [
        'production',
        '^production',
        { externalDependencies: ['storybook', '@storybook/test-runner'] },
      ],
    });

    expect(
      nodes?.['projects']?.['my-react-lib']?.targets?.['storybook']
    ).toMatchObject({
      command: 'storybook dev',
    });
    expect(
      nodes?.['projects']?.['my-react-lib']?.targets?.['test-storybook']
    ).toMatchObject({
      command: 'test-storybook',
    });
  });
});
