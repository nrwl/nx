import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readJson,
  joinPathFragments,
  GeneratorsJson,
  ProjectConfiguration,
  getProjects,
} from '@nrwl/devkit';

import generator from './generator';
import workspaceGeneratorGenerator from '@nrwl/workspace/src/generators/workspace-generator/workspace-generator';
import { LocalPluginFromToolsGeneratorSchema } from './schema';

describe('local-plugin-from-tools generator', () => {
  let tree: Tree;

  const createOptions = (
    overrides?: Partial<LocalPluginFromToolsGeneratorSchema>
  ): Partial<LocalPluginFromToolsGeneratorSchema> => ({
    ...overrides,
  });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should find single workspace generator successfully', async () => {
    await workspaceGeneratorGenerator(tree, {
      name: 'my-generator',
      skipFormat: false,
    });
    await generator(tree, createOptions());
    const config = readProjectConfiguration(tree, 'workspace-plugin');
    expect(config.root).toEqual('tools/workspace-plugin');

    assertValidGenerator(tree, config, 'my-generator');
  });

  it('should convert multiple workspace generators successfully', async () => {
    const generators = [...new Array(10)].map((x) => uniq('generator'));
    for (const name of generators) {
      await workspaceGeneratorGenerator(tree, {
        name,
        skipFormat: false,
      });
    }

    await generator(tree, createOptions());

    const config = readProjectConfiguration(tree, 'workspace-plugin');
    expect(config.root).toEqual('tools/workspace-plugin');

    for (const generator of generators) {
      assertValidGenerator(tree, config, generator);
    }
  });

  describe('--plugin-name', () => {
    it('should obey project name', async () => {
      await workspaceGeneratorGenerator(tree, {
        name: 'my-generator',
        skipFormat: false,
      });
      await generator(
        tree,
        createOptions({
          pluginName: 'workspace-tools',
        })
      );

      const config = readProjectConfiguration(tree, 'workspace-tools');
      expect(config.root).toEqual('tools/workspace-tools');

      assertValidGenerator(tree, config, 'my-generator');
    });
  });

  describe('--tools-project-root', () => {
    it('should place plugin in specified root', async () => {
      await workspaceGeneratorGenerator(tree, {
        name: 'my-generator',
        skipFormat: false,
      });
      await generator(
        tree,
        createOptions({
          toolsProjectRoot: 'libs/workspace-plugin',
        })
      );
      const config = readProjectConfiguration(tree, 'workspace-plugin');
      expect(config.root).toEqual('libs/workspace-plugin');

      assertValidGenerator(tree, config, 'my-generator');
    });
  });

  describe('--import-path', () => {
    it('should support basic import paths', async () => {
      await workspaceGeneratorGenerator(tree, {
        name: 'my-generator',
        skipFormat: false,
      });
      await generator(
        tree,
        createOptions({
          importPath: 'workspace-tools',
        })
      );

      const config = readProjectConfiguration(tree, 'workspace-plugin');
      expect(config.root).toEqual('tools/workspace-plugin');
      expect(
        readJson(tree, 'tsconfig.base.json').compilerOptions.paths[
          'workspace-tools'
        ]
      ).toEqual(['tools/workspace-plugin/src/index.ts']);

      assertValidGenerator(tree, config, 'my-generator');
    });

    it('should support scoped import paths', async () => {
      await workspaceGeneratorGenerator(tree, {
        name: 'my-generator',
        skipFormat: false,
      });
      await generator(
        tree,
        createOptions({
          importPath: '@workspace/plugin',
        })
      );

      const config = readProjectConfiguration(tree, 'workspace-plugin');
      expect(config.root).toEqual('tools/workspace-plugin');
      expect(
        readJson(tree, 'tsconfig.base.json').compilerOptions.paths[
          '@workspace/plugin'
        ]
      ).toEqual(['tools/workspace-plugin/src/index.ts']);

      assertValidGenerator(tree, config, 'my-generator');
    });
  });
});

function assertValidGenerator(
  tree: Tree,
  config: ProjectConfiguration,
  generator: string
) {
  const generatorsJson = readJson<GeneratorsJson>(
    tree,
    joinPathFragments(config.root, 'generators.json')
  );
  expect(generatorsJson.generators).toHaveProperty(generator);
  const generatorImplPath = joinPathFragments(
    config.root,
    generatorsJson.generators[generator].implementation,
    'index.ts'
  );
  expect(tree.exists(generatorImplPath)).toBeTruthy();
  const generatorSchemaPath = joinPathFragments(
    config.root,
    generatorsJson.generators[generator].schema
  );
  expect(tree.exists(generatorSchemaPath)).toBeTruthy();
}

function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}
