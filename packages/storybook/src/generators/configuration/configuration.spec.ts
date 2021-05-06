import {
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
import configurationGenerator from './configuration';

describe('@nrwl/storybook:configuration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      name: 'test-ui-lib',
    });
    writeJson(tree, 'package.json', {
      devDependencies: {
        '@storybook/addon-knobs': '^6.0.21',
        '@storybook/react': '^6.0.21',
      },
    });
  });

  it('should generate files', async () => {
    await configurationGenerator(tree, {
      name: 'test-ui-lib',
      uiFramework: '@storybook/angular',
    });

    // Root
    expect(tree.exists('.storybook/tsconfig.json')).toBeTruthy();
    expect(tree.exists('.storybook/main.js')).toBeTruthy();
    const rootStorybookTsconfigJson = readJson<TsConfig>(
      tree,
      '.storybook/tsconfig.json'
    );
    expect(rootStorybookTsconfigJson.exclude).toEqual([
      '../**/*.spec.js',
      '../**/*.spec.ts',
      '../**/*.spec.tsx',
      '../**/*.spec.jsx',
    ]);

    // Local
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(tree.exists('libs/test-ui-lib/.storybook/preview.js')).toBeTruthy();

    const storybookTsconfigJson = readJson<{ exclude: string[] }>(
      tree,
      'libs/test-ui-lib/.storybook/tsconfig.json'
    );

    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.ts')
    ).toBeTruthy();
    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.tsx')
    ).toBeFalsy();
    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.js')
    ).toBeFalsy();
    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.jsx')
    ).toBeFalsy();
  });

  it('should not update root files after generating them once', async () => {
    await configurationGenerator(tree, {
      name: 'test-ui-lib',
      uiFramework: '@storybook/angular',
    });

    const newContents = `module.exports = {
  stories: [],
  addons: ['@storybook/addon-knobs/register', 'new-addon'],
};
`;
    // Setup a new lib
    await libraryGenerator(tree, {
      name: 'test-ui-lib-2',
    });

    tree.write('.storybook/main.js', newContents);
    await configurationGenerator(tree, {
      name: 'test-ui-lib-2',
      uiFramework: '@storybook/angular',
    });

    expect(tree.read('.storybook/main.js').toString()).toEqual(newContents);
  });

  it('should update workspace file', async () => {
    await configurationGenerator(tree, {
      name: 'test-ui-lib',
      uiFramework: '@storybook/react',
    });
    const project = readProjectConfiguration(tree, 'test-ui-lib');

    expect(project.targets.storybook).toEqual({
      executor: '@nrwl/storybook:storybook',
      configurations: {
        ci: {
          quiet: true,
        },
      },
      options: {
        port: 4400,
        uiFramework: '@storybook/react',
        config: {
          configFolder: 'libs/test-ui-lib/.storybook',
        },
      },
    });

    expect(project.targets.lint).toEqual({
      executor: '@nrwl/linter:eslint',
      options: {
        lintFilePatterns: ['libs/test-ui-lib/**/*.ts'],
      },
    });
  });

  it('should update `tsconfig.lib.json` file', async () => {
    await configurationGenerator(tree, {
      name: 'test-ui-lib',
      uiFramework: '@storybook/react',
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
});
