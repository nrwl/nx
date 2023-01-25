import {
  addProjectConfiguration,
  getProjects,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Linter } from '@nrwl/linter';
import { libraryGenerator } from '@nrwl/workspace/generators';
import { TsConfig } from '../../utils/utilities';
import { storybook7Version } from '../../utils/versions';
import configurationGenerator from './configuration';
import * as variousProjects from './test-configs/various-projects.json';

describe('@nrwl/storybook:configuration for Storybook v7', () => {
  describe('basic functionalities', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs = {
          production: ['default'],
        };
        return json;
      });
      await libraryGenerator(tree, {
        name: 'test-ui-lib',
        standaloneConfig: false,
      });
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/addon-essentials': storybook7Version,
          '@storybook/react': storybook7Version,
        },
      });
    });

    it('should generate TypeScript Configuration files', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        tsConfiguration: true,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/angular',
      });
      const project = readProjectConfiguration(tree, 'test-ui-lib');
      expect(project).toMatchSnapshot();

      expect(tree.read('.storybook/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/test-ui-lib/.storybook/tsconfig.json', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/test-ui-lib/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.exists('libs/test-ui-lib/.storybook/preview.ts')
      ).toBeTruthy();
    });

    it('should not update root files after generating them once', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/angular',
      });

      const newContents = `module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials', 'new-addon'],
        };
      `;
      await libraryGenerator(tree, {
        name: 'test-ui-lib-2',
        standaloneConfig: false,
      });

      tree.write('.storybook/main.js', newContents);
      await configurationGenerator(tree, {
        name: 'test-ui-lib-2',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
      });

      expect(tree.read('.storybook/main.js', 'utf-8')).toEqual(newContents);
    });

    it('should update `tsconfig.lib.json` file', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'libs/test-ui-lib/tsconfig.lib.json'
      ) as Required<TsConfig>;

      expect(tsconfigJson.exclude).toContain('**/*.stories.ts');
      expect(tsconfigJson.exclude).toContain('**/*.stories.js');
      expect(tsconfigJson.exclude).toContain('**/*.stories.jsx');
      expect(tsconfigJson.exclude).toContain('**/*.stories.tsx');
    });

    it('should update `tsconfig.json` file', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'libs/test-ui-lib/tsconfig.json'
      );

      expect(tsconfigJson.references).toMatchInlineSnapshot(`
      Array [
        Object {
          "path": "./tsconfig.lib.json",
        },
        Object {
          "path": "./tsconfig.spec.json",
        },
        Object {
          "path": "./.storybook/tsconfig.json",
        },
      ]
    `);
    });

    it("should update the project's .eslintrc.json if config exists", async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
        standaloneConfig: false,
      });

      updateJson(tree, 'libs/test-ui-lib2/.eslintrc.json', (json) => {
        json.parserOptions = {
          project: [],
        };
        return json;
      });

      await configurationGenerator(tree, {
        name: 'test-ui-lib2',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      expect(readJson(tree, 'libs/test-ui-lib2/.eslintrc.json').parserOptions)
        .toMatchInlineSnapshot(`
      Object {
        "project": Array [
          "libs/test-ui-lib2/.storybook/tsconfig.json",
        ],
      }
    `);
    });

    it('should have the proper typings', async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
        standaloneConfig: false,
      });

      await configurationGenerator(tree, {
        name: 'test-ui-lib2',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      expect(
        tree.read('libs/test-ui-lib2/.storybook/tsconfig.json', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate TS config for project if root config is TS', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        tsConfiguration: true,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/angular',
      });

      const newContents = `module.exports = {
        stories: [],
        addons: ['@storybook/addon-essentials', 'new-addon'],
      };
      `;
      // Setup a new lib
      await libraryGenerator(tree, {
        name: 'test-ui-lib-2',
        standaloneConfig: false,
      });

      tree.write('.storybook/main.ts', newContents);
      await configurationGenerator(tree, {
        name: 'test-ui-lib-2',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/angular',
      });

      expect(tree.read('.storybook/main.ts', 'utf-8')).toEqual(newContents);
      expect(
        tree.read('libs/test-ui-lib-2/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.exists('libs/test-ui-lib-2/.storybook/preview.ts')
      ).toBeTruthy();
      expect(tree.exists('libs/test-ui-lib-2/.storybook/main.js')).toBeFalsy();
      expect(
        tree.exists('libs/test-ui-lib-2/.storybook/preview.js')
      ).toBeFalsy();
    });

    it('should add test-storybook target', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/react',
        configureTestRunner: true,
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/test-runner']
      ).toBeTruthy();

      const project = readProjectConfiguration(tree, 'test-ui-lib');
      expect(project.targets['test-storybook']).toEqual({
        executor: 'nx:run-commands',
        options: {
          command:
            'test-storybook -c libs/test-ui-lib/.storybook --url=http://localhost:4400',
        },
      });
    });
  });

  describe('generate Storybook configuration for all types of projects', () => {
    let tree: Tree;
    let testCases: string[][] = [];

    for (const [name, project] of Object.entries(variousProjects)) {
      testCases.push([
        `${
          project.projectType === 'application' ? 'apps' : 'libs'
        }/${name}/.storybook/`,
      ]);
    }

    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      for (const [name, project] of Object.entries(variousProjects)) {
        addProjectConfiguration(tree, name, project as ProjectConfiguration);
        writeJson(
          tree,
          `${
            project.projectType === 'application' ? 'apps' : 'libs'
          }/${name}/tsconfig.json`,
          {}
        );
      }

      await configurationGenerator(tree, {
        name: 'main-vite',
        tsConfiguration: false,
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-vite',
      });
      await configurationGenerator(tree, {
        name: 'main-vite-ts',
        tsConfiguration: true,
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-vite',
      });
      await configurationGenerator(tree, {
        name: 'main-webpack',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      await configurationGenerator(tree, {
        name: 'react-rollup',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      await configurationGenerator(tree, {
        name: 'react-vite',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-vite',
      });

      await configurationGenerator(tree, {
        name: 'nextapp',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/nextjs',
      });

      await configurationGenerator(tree, {
        name: 'react-swc',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      await configurationGenerator(tree, {
        name: 'wv1',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/web-components-vite',
      });

      await configurationGenerator(tree, {
        name: 'ww1',
        uiFramework: '@storybook/react',
        storybook7betaConfiguration: true,
        storybook7UiFramework: '@storybook/web-components-webpack5',
      });
    });

    it('should have updated all their target configurations correctly', async () => {
      const projects = getProjects(tree);
      expect(projects).toMatchSnapshot();
    });

    test.each(testCases)(
      'should contain the correct configuration in %p',
      (storybookConfigPath) => {
        if (tree.exists(storybookConfigPath)) {
          if (tree.exists(`${storybookConfigPath}main.ts`)) {
            expect(
              tree.read(`${storybookConfigPath}main.ts`, 'utf-8')
            ).toMatchSnapshot();
          }
          if (tree.exists(`${storybookConfigPath}main.js`)) {
            expect(
              tree.read(`${storybookConfigPath}main.js`, 'utf-8')
            ).toMatchSnapshot();
          }
          expect(
            tree.read(`${storybookConfigPath}tsconfig.json`, 'utf-8')
          ).toMatchSnapshot();
        }
      }
    );
  });
});
