import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { buildPostTargetTransformer } from './build-post-target-transformer';

describe('buildPostTargetTransformer', () => {
  describe('--react-vite', () => {
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

      tree.write(
        'apps/myapp/.storybook/main.ts',
        storybookConfigFileV17_ReactVite
      );

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
                viteConfigPath: './vite.config.ts',
              },
            },
          },
        };

        export default config;"
      `);
      expect(target).toMatchInlineSnapshot(`
        {
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/myapp",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/{options.outputDir}",
          ],
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

      tree.write(
        'apps/myapp/.storybook/main.ts',
        storybookConfigFileV17_ReactVite
      );
      tree.write(
        'apps/myapp/dev/.storybook/main.ts',
        storybookConfigFileV17_ReactVite
      );

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
                viteConfigPath: './vite.config.ts',
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
              "config-dir": "./dev/.storybook",
              "output-dir": "../../dist/storybook/myapp/dev",
            },
          },
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/myapp",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/{options.outputDir}",
          ],
        }
      `);
      const devConfigFile = tree.read(
        'apps/myapp/dev/.storybook/main.ts',
        'utf-8'
      );
      expect(devConfigFile).toMatchInlineSnapshot(`
              "import type { StorybookConfig } from '@storybook/react-vite';

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

  describe('--vue-vite', () => {
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

      tree.write(
        'apps/myapp/.storybook/main.ts',
        storybookConfigFileV17_VueVite
      );

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
        "import type { StorybookConfig } from '@storybook/vue3-vite';
          
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
            name: '@storybook/vue3-vite',
            options: {
              builder: {
                viteConfigPath: './vite.config.ts',
              },
            },
          },
        };

        export default config;"
      `);
      expect(target).toMatchInlineSnapshot(`
        {
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/myapp",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/{options.outputDir}",
          ],
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

      tree.write(
        'apps/myapp/.storybook/main.ts',
        storybookConfigFileV17_VueVite
      );
      tree.write(
        'apps/myapp/dev/.storybook/main.ts',
        storybookConfigFileV17_VueVite
      );

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
        "import type { StorybookConfig } from '@storybook/vue3-vite';
          
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
            name: '@storybook/vue3-vite',
            options: {
              builder: {
                viteConfigPath: './vite.config.ts',
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
              "config-dir": "./dev/.storybook",
              "output-dir": "../../dist/storybook/myapp/dev",
            },
          },
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/myapp",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/{options.outputDir}",
          ],
        }
      `);
      const devConfigFile = tree.read(
        'apps/myapp/dev/.storybook/main.ts',
        'utf-8'
      );
      expect(devConfigFile).toMatchInlineSnapshot(`
        "import type { StorybookConfig } from '@storybook/vue3-vite';

        const config: StorybookConfig = {staticDirs: options.staticDir,docs: { docsMode: options.docsMode },
          stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
          addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
          framework: {
            name: '@storybook/vue3-vite',
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

  describe('--react-webpack', () => {
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

      tree.write(
        'apps/myapp/.storybook/main.ts',
        storybookConfigFileV17_ReactWebpack
      );

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
        "import type { StorybookConfig } from '@storybook/react-webpack5';
          
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
          addons: [
            '@storybook/addon-essentials',
            '@storybook/addon-interactions',
            '@nx/react/plugins/storybook',
          ],
          framework: {
            name: '@storybook/react-webpack5',
            options: {},
          },
        };

        export default config;"
      `);
      expect(target).toMatchInlineSnapshot(`
        {
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/myapp",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/{options.outputDir}",
          ],
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

      tree.write(
        'apps/myapp/.storybook/main.ts',
        storybookConfigFileV17_ReactWebpack
      );
      tree.write(
        'apps/myapp/dev/.storybook/main.ts',
        storybookConfigFileV17_ReactWebpack
      );

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
        "import type { StorybookConfig } from '@storybook/react-webpack5';
          
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
          addons: [
            '@storybook/addon-essentials',
            '@storybook/addon-interactions',
            '@nx/react/plugins/storybook',
          ],
          framework: {
            name: '@storybook/react-webpack5',
            options: {},
          },
        };

        export default config;"
      `);
      expect(target).toMatchInlineSnapshot(`
        {
          "configurations": {
            "dev": {
              "config-dir": "./dev/.storybook",
              "output-dir": "../../dist/storybook/myapp/dev",
            },
          },
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/myapp",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/{options.outputDir}",
          ],
        }
      `);
      const devConfigFile = tree.read(
        'apps/myapp/dev/.storybook/main.ts',
        'utf-8'
      );
      expect(devConfigFile).toMatchInlineSnapshot(`
        "import type { StorybookConfig } from '@storybook/react-webpack5';

        const config: StorybookConfig = {staticDirs: options.staticDir,docs: { docsMode: options.docsMode },
          stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
          addons: [
            '@storybook/addon-essentials',
            '@storybook/addon-interactions',
            '@nx/react/plugins/storybook',
          ],
          framework: {
            name: '@storybook/react-webpack5',
            options: {},
          },
        };

        export default config;"
      `);
    });
  });
});

const storybookConfigFileV17_ReactVite = `import type { StorybookConfig } from '@storybook/react-vite';

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

const storybookConfigFileV17_ReactWebpack = `import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@nx/react/plugins/storybook',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
};

export default config;`;

const storybookConfigFileV17_VueVite = `import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/myapp/vite.config.ts',
      },
    },
  },
};

export default config;`;
