import {
  addProjectConfiguration,
  getPackageManagerCommand,
  output,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as allProjects from './test-configs/all-projects.json';
import {
  getAllStorybookInfo,
  logResult,
  onlyShowGuide,
} from './helper-functions';

describe('Helper functions for the Storybook 8 migration generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addAllProjectsToWorkspace(tree);
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
      const pm = getPackageManagerCommand();
      expect(outputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: [
            'You can run the following commands manually to upgrade your Storybook projects to Storybook 8:',
            '',
            '1. Call the Storybook upgrade script:',
            `${pm.exec} storybook@latest upgrade`,
            '',
            '2. Call the Storybook automigrate scripts:',
            'Run the following commands for each Storybook project:',
            `${pm.exec} storybook@latest automigrate --config-dir apps/nextapp/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/nextapp-ts/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/ngapp/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/ngapp-ts/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/rv1/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/rv2-ts/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/rw1/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/wv1/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir apps/ww1/.storybook`,
            `${pm.exec} storybook@latest automigrate --config-dir plugin-apps/plugin/.storybook`,
            '',
          ],
          title: 'Storybook 8 Migration Guide',
        })
      );
    });
  });

  describe('logResult', () => {
    it('should create the summary file with the correct content', () => {
      logResult(tree, {
        successfulProjects: {
          nextapp:
            'npx storybook@latest automigrate --config-dir apps/nextapp/.storybook',
          rv1: 'npx storybook@latest automigrate --config-dir apps/rv1/.storybook',
        },
        failedProjects: {
          'rv2-ts': `npx storybook@latest automigrate --config-dir apps/rv2-ts/.storybook`,
          rw1: 'npx storybook@latest automigrate --config-dir apps/rw1/.storybook',
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

  addPluginProjects(tree);
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

  tree.write(
    `apps/rw1/.storybook/main.js`,
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
    `apps/wv1/.storybook/main.js`,
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
    `apps/ww1/.storybook/main.js`,
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
    `apps/ngapp/.storybook/main.js`,
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
    `apps/ngapp-ts/.storybook/main.ts`,
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
}

function addPluginProjects(tree: Tree) {
  tree.write(
    `plugin-apps/plugin/.storybook/main.ts`,
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
  tree.write(
    `plugin-apps/plugin/project.json`,
    JSON.stringify({
      name: 'plugin-app',
      root: 'plugin-apps/plugin',
      sourceRoot: 'plugin-apps/plugin/src',
      type: 'application',
      targets: {},
    })
  );
}
