import {
  addProjectConfiguration,
  output,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as allProjects from './test-configs/all-projects.json';
import {
  addViteConfigFilePathInFrameworkOptions,
  changeCoreCommonImportToFramework,
  getAllStorybookInfo,
  logResult,
  onlyShowGuide,
  removePathResolvesFromNextConfig,
  removeTypecastFromMainTs,
  removeUiFrameworkFromProjectJson,
  removeViteTsConfigPathsPlugin,
} from './helper-functions';

describe('Helper functions for the Storybook 7 migration generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addAllProjectsToWorkspace(tree);
  });

  describe('removePathResolvesFromNextConfig', () => {
    it(`should remove path from nextConfigPath in main.js`, async () => {
      const { content: content1 } = removePathResolvesFromNextConfig(
        tree,
        `apps/nextapp/.storybook/main.js`
      );
      const { content: content2 } = removePathResolvesFromNextConfig(
        tree,
        `apps/nextapp-ts/.storybook/main.ts`
      );

      expect(content1).toMatchSnapshot();

      expect(content2).toMatchSnapshot();
    });
  });

  describe('removeTypecastFromMainTs', () => {
    it(`should remove typecast from TypeScript files`, async () => {
      const { content: content1 } = removeTypecastFromMainTs(
        tree,
        `apps/rv2-ts/.storybook/main.ts`
      );
      const { content: content2 } = removeTypecastFromMainTs(
        tree,
        `apps/nextapp-ts/.storybook/main.ts`
      );

      expect(content1).toMatchSnapshot();

      expect(content2).toMatchSnapshot();
    });
  });

  describe('getAllStorybookInfo and onlyShowGuide', () => {
    let allStorybookInfo;
    beforeEach(() => {
      allStorybookInfo = getAllStorybookInfo(tree);
    });
    it('should return all info for all projects with Storybook', () => {
      expect(allStorybookInfo).toMatchSnapshot();
    });

    it('should onlyShowGuide and the correct instructions', () => {
      const outputSpy = jest.spyOn(output, 'log').mockImplementation();
      onlyShowGuide(allStorybookInfo);
      expect(outputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: [
            'You can run the following commands manually to upgrade your Storybook projects to Storybook 7:',
            '',
            '1. Call the Storybook upgrade script:',
            'npx storybook@latest upgrade',
            '',
            '2. Call the Nx generator to prepare your files for migration:',
            'nx g @nx/storybook:migrate-7 --onlyPrepare',
            '',
            '3. Call the Storybook automigrate scripts:',
            'Run the following commands for each Storybook project:',
            'npx storybook@latest automigrate --config-dir apps/nextapp/.storybook --renderer @storybook/react',
            'npx storybook@latest automigrate --config-dir apps/nextapp-ts/.storybook --renderer @storybook/react',
            'npx storybook@latest automigrate --config-dir apps/rv1/.storybook --renderer @storybook/react',
            'npx storybook@latest automigrate --config-dir apps/rv2-ts/.storybook --renderer @storybook/react',
            'npx storybook@latest automigrate --config-dir apps/rw1/.storybook --renderer @storybook/react',
            'npx storybook@latest automigrate --config-dir apps/wv1/.storybook --renderer @storybook/web-components',
            'npx storybook@latest automigrate --config-dir apps/ww1/.storybook --renderer @storybook/web-components',
            'npx storybook@latest automigrate --config-dir apps/ngapp/.storybook --renderer @storybook/angular',
            'npx storybook@latest automigrate --config-dir apps/ngapp-ts/.storybook --renderer @storybook/angular',
            '',
            '4. Call the Nx generator to finish the migration:',
            'nx g @nx/storybook:migrate-7 --afterMigration',
          ],
          title: 'Storybook 7 Migration Guide',
        })
      );
    });
  });

  describe('removeViteTsConfigPathsPlugin', () => {
    it(`should remove ViteTsConfigPathsPlugin from main.js and the whole plugin array if empty`, () => {
      removeViteTsConfigPathsPlugin(tree, `apps/rv1/.storybook/main.js`);

      expect(
        tree.read('apps/rv1/.storybook/main.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it(`should remove ViteTsConfigPathsPlugin from main.ts and the whole plugin array if empty`, () => {
      removeViteTsConfigPathsPlugin(tree, `apps/rv1/.storybook/main.js`);
      removeViteTsConfigPathsPlugin(tree, `apps/rv2-ts/.storybook/main.ts`);

      expect(
        tree.read('apps/rv2-ts/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('addViteConfigFilePathInFrameworkOptions', () => {
    it(`should add viteConfigFilePath in frameworkOptions in main.js`, () => {
      writeNewMainJs(tree);
      tree.write('apps/rv1/vite.config.js', '');
      addViteConfigFilePathInFrameworkOptions(
        tree,
        'apps/rv1/.storybook/main.js',
        'apps/rv1/vite.config.js'
      );

      expect(
        tree.read('apps/rv1/.storybook/main.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it(`should add viteConfigFilePath in frameworkOptions in main.js if no options present`, () => {
      writeNewMainJs(tree);
      tree.write('apps/wv1/vite.config.js', '');
      addViteConfigFilePathInFrameworkOptions(
        tree,
        'apps/wv1/.storybook/main.js',
        'apps/wv1/vite.config.js'
      );

      expect(
        tree.read('apps/wv1/.storybook/main.js', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('changeCoreCommonImportToFramework', () => {
    it(`should change imports`, async () => {
      writeNewMainTs(tree);
      changeCoreCommonImportToFramework(tree, `apps/rv2-ts/.storybook/main.ts`);
      changeCoreCommonImportToFramework(
        tree,
        `apps/ngapp-ts/.storybook/main.ts`
      );

      expect(
        tree.read('apps/rv2-ts/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('apps/ngapp-ts/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('removeUiFrameworkFromProjectJson', () => {
    it('should remove uiFramework from project.json', () => {
      expect(
        readProjectConfiguration(tree, 'rv1').targets['storybook']['options'][
          'uiFramework'
        ]
      ).toBeDefined();
      expect(
        readProjectConfiguration(tree, 'rv2-ts').targets['storybook'][
          'options'
        ]['uiFramework']
      ).toBeDefined();

      removeUiFrameworkFromProjectJson(tree);

      expect(
        readProjectConfiguration(tree, 'rv1').targets['storybook']['options'][
          'uiFramework'
        ]
      ).toBeUndefined();

      expect(
        readProjectConfiguration(tree, 'rv2-ts').targets['storybook'][
          'options'
        ]['uiFramework']
      ).toBeUndefined();
    });
  });

  describe('logResult', () => {
    it('should create the summary file with the correct content', () => {
      logResult(tree, {
        successfulProjects: {
          nextapp:
            'npx storybook@latest automigrate --config-dir apps/nextapp/.storybook --renderer @storybook/react',
          rv1: 'npx storybook@latest automigrate --config-dir apps/rv1/.storybook --renderer @storybook/react',
        },
        failedProjects: {
          'rv2-ts': `npx storybook@latest automigrate --config-dir apps/rv2-ts/.storybook --renderer @storybook/react`,
          rw1: 'npx storybook@latest automigrate --config-dir apps/rw1/.storybook --renderer @storybook/react',
        },
      });
      expect(
        tree.read('storybook-migration-summary.md', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});

export function addAllProjectsToWorkspace(tree: Tree) {
  for (const [name, project] of Object.entries(allProjects)) {
    addProjectConfiguration(tree, name, project as ProjectConfiguration);
  }
  writeMainJs(tree);
  writeViteConfig(tree);
}

function writeViteConfig(tree: Tree) {
  tree.write(
    `apps/rv1/vite.config.js`,
    `const { defineConfig } = require('vite');`
  );

  tree.write(
    `apps/rv2-ts/vite.config.ts`,
    `const { defineConfig } = require('vite');`
  );

  tree.write(
    `apps/wv1/vite.config.ts`,
    `const { defineConfig } = require('vite');`
  );
}

function writeMainJs(tree: Tree) {
  tree.write(
    `apps/rv1/.storybook/main.js`,
    `
    const { mergeConfig } = require('vite');
    const viteTsConfigPaths = require('vite-tsconfig-paths').default;

    module.exports = {
      core: { builder: '@storybook/builder-vite' },
      stories: [
        '../src/app/**/*.stories.mdx',
        '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
      ],
      addons: ['@storybook/addon-essentials'],
      async viteFinal(config, { configType }) {
        return mergeConfig(config, {
          plugins: [
            viteTsConfigPaths({
              root: '../../../',
            }),
          ],
        });
      },
    };
`
  );

  tree.write(
    `apps/rv2-ts/.storybook/main.ts`,
    `
    import type { StorybookConfig } from '@storybook/core-common';

    import { mergeConfig } from 'vite';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    const config: StorybookConfig = {
      core: { builder: '@storybook/builder-vite' },
      stories: [
        '../src/app/**/*.stories.mdx',
        '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
      ],
      addons: ['@storybook/addon-essentials'],
      async viteFinal(config: any) {
        return mergeConfig(config, {
          plugins: [
            viteTsConfigPaths({
              root: '../../../',
            }),
          ],
        });
      },
    } as StorybookConfig;

    module.exports = config;
  `
  );

  tree.write(
    `apps/nextapp/.storybook/main.js`,
    `
    const path = require('path');

    module.exports = {
      core: { builder: 'webpack5' },
      stories: [
        '../components/**/*.stories.mdx',
        '../components/**/*.stories.@(js|jsx|ts|tsx)',
      ],
      addons: [
        '@storybook/addon-essentials',
        '@nx/react/plugins/storybook',
        'storybook-addon-swc',
        {
          name: 'storybook-addon-next',
          options: {
            nextConfigPath: path.resolve(__dirname, '../next.config.js'),
          },
        },
      ],
    };
  `
  );

  tree.write(
    `apps/nextapp-ts/.storybook/main.ts`,
    `
    import type { StorybookConfig } from '@storybook/core-common';
    import path from 'path';

    const config: StorybookConfig = {
      core: { builder: 'webpack5' },
      stories: [
        '../components/**/*.stories.mdx',
        '../components/**/*.stories.@(js|jsx|ts|tsx)',
      ],
      addons: [
        '@storybook/addon-essentials',
        '@nx/react/plugins/storybook',
        'storybook-addon-swc',
        {
          name: 'storybook-addon-next',
          options: {
            nextConfigPath: path.resolve(__dirname, '../next.config.js'),
          },
        },
      ],
    } as StorybookConfig;

    module.exports = config;
  `
  );
}

function writeNewMainJs(tree: Tree) {
  tree.write(
    `apps/rv1/.storybook/main.js`,
    `
    const { mergeConfig } = require('vite');

    module.exports = {
      stories: [
        '../src/app/**/*.stories.mdx',
        '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
      ],
      addons: ['@storybook/addon-essentials'],
      async viteFinal(config, { configType }) {
        return mergeConfig(config, {});
      },
      framework: {
        name: '@storybook/react-vite',
        options: {},
      },
    };
    `
  );

  tree.write(
    `apps/wv1/.storybook/main.js`,
    `
    const { mergeConfig } = require('vite');

    module.exports = {
      stories: [
        '../src/app/**/*.stories.mdx',
        '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
      ],
      addons: ['@storybook/addon-essentials'],
      async viteFinal(config, { configType }) {
        return mergeConfig(config, {});
      },
      framework: {
        name: '@storybook/web-components-vite',
      },
    };
    `
  );
}

function writeNewMainTs(tree: Tree) {
  tree.write(
    `apps/rv2-ts/.storybook/main.ts`,
    `
    import type { StorybookConfig } from '@storybook/core-common';
    import { mergeConfig } from 'vite';
    const config: StorybookConfig = {
      core: {},
      stories: ['../src/app/**/*.stories.mdx', '../src/app/**/*.stories.@(js|jsx|ts|tsx)'],
      addons: ['@storybook/addon-essentials'],
      async viteFinal(config: any) {
        return mergeConfig(config, {});
      },
      framework: {
        name: '@storybook/react-vite',
        options: {}
      }
    };
    module.exports = config;
    `
  );

  tree.write(
    `apps/ngapp-ts/.storybook/main.ts`,
    `
    import type { StorybookConfig } from '@storybook/core-common';
    const config: StorybookConfig = {
      core: {},
      stories: ['../src/app/**/*.stories.mdx', '../src/app/**/*.stories.@(js|jsx|ts|tsx)'],
      addons: ['@storybook/addon-essentials'],
      framework: {
        name: '@storybook/angular',
        options: {}
      }
    };
    module.exports = config;
    `
  );
}
