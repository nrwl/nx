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

import generator from './move-workspace-generators-to-local-plugin';
import workspaceGeneratorGenerator from '@nrwl/workspace/src/generators/workspace-generator/workspace-generator';

describe('local-plugin-from-tools generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should find single workspace generator successfully', async () => {
    await workspaceGeneratorGenerator(tree, {
      name: 'my-generator',
      skipFormat: false,
    });
    await generator(tree);
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

    await generator(tree);

    const config = readProjectConfiguration(tree, 'workspace-plugin');
    expect(config.root).toEqual('tools/workspace-plugin');

    for (const generator of generators) {
      assertValidGenerator(tree, config, generator);
    }
  });

  it('should be idempotent', async () => {
    const generators = [...new Array(10)].map((x) => uniq('generator'));
    for (const name of generators) {
      await workspaceGeneratorGenerator(tree, {
        name,
        skipFormat: false,
      });
    }

    await generator(tree);

    const generatorsJson = readJson(
      tree,
      'tools/workspace-plugin/generators.json'
    );

    await generator(tree);
    expect(readJson(tree, 'tools/workspace-plugin/generators.json')).toEqual(
      generatorsJson
    );

    const config = readProjectConfiguration(tree, 'workspace-plugin');

    for (const generator of generators) {
      assertValidGenerator(tree, config, generator);
    }
  });

  it('should merge new generators into existing plugin', async () => {
    const generators = [...new Array(10)].map((x) => uniq('generator'));
    for (const name of generators) {
      await workspaceGeneratorGenerator(tree, {
        name,
        skipFormat: false,
      });
    }

    await generator(tree);

    const moreGenerators = [...new Array(5)].map((x) => uniq('generator'));
    for (const name of moreGenerators) {
      await workspaceGeneratorGenerator(tree, {
        name,
        skipFormat: false,
      });
    }

    await generator(tree);

    const config = readProjectConfiguration(tree, 'workspace-plugin');

    for (const generator of generators.concat(moreGenerators)) {
      assertValidGenerator(tree, config, generator);
    }
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
