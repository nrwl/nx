import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import type { StorybookConfig } from '@storybook/types';
import { join } from 'node:path';
import { createNodes } from './plugin';

describe('@nx/storybook/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('storybook-plugin');
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
    tempFs.cleanup();
    tempFs = null;
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

  it('should create angular nodes', async () => {
    tempFs.createFileSync('my-ng-app/.storybook/main.ts', '');
    mockStorybookMainConfig('my-ng-app/.storybook/main.ts', {
      stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
      framework: {
        name: '@storybook/angular',
        options: {},
      },
    });

    const nodes = await createNodesFunction(
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
