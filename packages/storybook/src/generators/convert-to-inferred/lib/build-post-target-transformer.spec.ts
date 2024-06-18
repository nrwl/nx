import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { buildPostTargetTransformer } from './build-post-target-transformer';

describe('buildPostTargetTransformer', () => {
  it('should migrate docsMode and staticDir to storybook config correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const targetConfiguration = {
      outputs: ['{options.outputDir}'],
      options: {
        outputDir: 'dist/storybook/myapp',
        configDir: 'apps/myapp/.storybook',
        docsMode: true,
        staticDir: ['assets'],
      },
    };

    const inferredTargetConfiguration = {
      outputs: ['{projectRoot}/{options.outputDir}'],
    };

    const migrationLogs = new AggregatedLog();

    tree.write('apps/myapp/.storybook/main.ts', storybookConfigFileV17);

    // ACT
    const target = buildPostTargetTransformer(migrationLogs)(
      targetConfiguration,
      tree,
      { projectName: 'myapp', root: 'apps/myapp' },
      inferredTargetConfiguration
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/.storybook/main.ts', 'utf-8');
    expect(configFile).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';
        
        // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
        const configValues = {"default":{"docsMode":true,"staticDir":["assets"]}};
        
        // Determine the correct configValue to use based on the configuration
        const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
        
        const options = {
          ...configValues.default,
          ...(configValues[nxConfiguration] ?? {})
        }
        

      const config: StorybookConfig = {staticDirs: options.staticDir,docs: { docsMode: options.docsMode },
        stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
        framework: {
          name: '@storybook/react-vite',
          options: {
            builder: {
              viteConfigPath: 'apps/myapp/vite.config.ts',
            },
          },
        },
      };

      export default config;"
    `);
    expect(target).toMatchInlineSnapshot(`
      {
        "options": {
          "configDir": ".storybook",
          "outputDir": "../../dist/storybook/myapp",
        },
      }
    `);
  });

  it('should handle configurations correctly and migrate docsMode and staticDir to storybook config correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const targetConfiguration = {
      outputs: ['{options.outputDir}'],
      options: {
        outputDir: 'dist/storybook/myapp',
        configDir: 'apps/myapp/.storybook',
        docsMode: true,
        staticDir: ['assets'],
      },
      configurations: {
        dev: {
          outputDir: 'dist/storybook/myapp/dev',
          configDir: 'apps/myapp/dev/.storybook',
          docsMode: false,
          staticDir: ['dev/assets'],
        },
      },
    };

    const inferredTargetConfiguration = {
      outputs: ['{projectRoot}/{options.outputDir}'],
    };

    const migrationLogs = new AggregatedLog();

    tree.write('apps/myapp/.storybook/main.ts', storybookConfigFileV17);
    tree.write('apps/myapp/dev/.storybook/main.ts', storybookConfigFileV17);

    // ACT
    const target = buildPostTargetTransformer(migrationLogs)(
      targetConfiguration,
      tree,
      { projectName: 'myapp', root: 'apps/myapp' },
      inferredTargetConfiguration
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/.storybook/main.ts', 'utf-8');
    expect(configFile).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';
        
        // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
        const configValues = {"default":{"docsMode":true,"staticDir":["assets"]},"dev":{"docsMode":false,"staticDir":["dev/assets"]}};
        
        // Determine the correct configValue to use based on the configuration
        const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
        
        const options = {
          ...configValues.default,
          ...(configValues[nxConfiguration] ?? {})
        }
        

      const config: StorybookConfig = {staticDirs: options.staticDir,docs: { docsMode: options.docsMode },
        stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
        framework: {
          name: '@storybook/react-vite',
          options: {
            builder: {
              viteConfigPath: 'apps/myapp/vite.config.ts',
            },
          },
        },
      };

      export default config;"
    `);
    expect(target).toMatchInlineSnapshot(`
      {
        "configurations": {
          "dev": {
            "configDir": "./dev/.storybook",
            "outputDir": "../../dist/storybook/myapp/dev",
          },
        },
        "options": {
          "configDir": ".storybook",
          "outputDir": "../../dist/storybook/myapp",
        },
      }
    `);
    const devConfigFile = tree.read(
      'apps/myapp/dev/.storybook/main.ts',
      'utf-8'
    );
    expect(devConfigFile).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';
        
        // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
        const configValues = {"default":{"docsMode":true,"staticDir":["assets"]},"dev":{"docsMode":false,"staticDir":["dev/assets"]}};
        
        // Determine the correct configValue to use based on the configuration
        const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
        
        const options = {
          ...configValues.default,
          ...(configValues[nxConfiguration] ?? {})
        }
        

      const config: StorybookConfig = {staticDirs: options.staticDir,docs: { docsMode: options.docsMode },
        stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
        framework: {
          name: '@storybook/react-vite',
          options: {
            builder: {
              viteConfigPath: 'apps/myapp/vite.config.ts',
            },
          },
        },
      };

      export default config;"
    `);
  });
});

const storybookConfigFileV17 = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/myapp/vite.config.ts',
      },
    },
  },
};

export default config;`;
