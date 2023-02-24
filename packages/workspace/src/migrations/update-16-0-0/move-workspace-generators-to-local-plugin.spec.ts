import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readJson,
  joinPathFragments,
  GeneratorsJson,
  ProjectConfiguration,
  stripIndents,
} from '@nrwl/devkit';

import generator from './move-workspace-generators-to-local-plugin';

describe('local-plugin-from-tools generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should find single workspace generator successfully', async () => {
    await workspaceGeneratorGenerator(tree, {
      name: 'my-generator',
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
      });
    }

    await generator(tree);

    const moreGenerators = [...new Array(5)].map((x) => uniq('generator'));
    for (const name of moreGenerators) {
      await workspaceGeneratorGenerator(tree, {
        name,
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

async function workspaceGeneratorGenerator(
  host: Tree,
  schema: { name: string }
) {
  const outputDirectory = joinPathFragments('tools/generators', schema.name);

  host.write(
    joinPathFragments(outputDirectory, 'index.ts'),
    stripIndents`import { Tree, formatFiles, installPackagesTask } from '@nrwl/devkit';
  import { libraryGenerator } from '@nrwl/workspace/generators';
  
  export default async function(tree: Tree, schema: any) {
    await libraryGenerator(tree, {name: schema.name});
    await formatFiles(tree);
    return () => {
      installPackagesTask(tree)
    }
  }`
  );

  host.write(
    joinPathFragments(outputDirectory, 'schema.json'),
    stripIndents`{
    "$schema": "http://json-schema.org/schema",
    "cli": "nx",
    "$id": "<%= name %>",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Library name",
        "$default": {
          "$source": "argv",
          "index": 0
        }
      }
    },
    "required": ["name"]
  }
  `
  );
}
