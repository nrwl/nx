import {
  ExecutorsJson,
  GeneratorsJson,
  joinPathFragments,
  MigrationsJson,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { assertRunsAgainstNxRepo } from '@nx/devkit/internal-testing-utils';
import { PackageJson } from 'nx/src/utils/package-json';
import executorGenerator from '../../generators/executor/executor';
import generatorGenerator from '../../generators/generator/generator';
import pluginGenerator from '../../generators/plugin/plugin';
import { updateCliPropsForPlugins } from './cli-in-schema-json';

describe('updateCliPropsForPlugins', () => {
  it('should move non-nx generators to schematics for migrations.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root } = await createPlugin(tree);
    updatePluginPackageJson(tree, {
      'nx-migrations': 'migrations.json',
    });
    writeJson<MigrationsJson>(
      tree,
      joinPathFragments(root, 'migrations.json'),
      {
        version: '1.0.0',
        generators: {
          'migration-1': {
            version: '1.0.0',
            description: 'My Plugin 1',
            factory: './migrations/my-plugin-1',
          },
        },
      }
    );
    await updateCliPropsForPlugins(tree);
    const updated = readJson<MigrationsJson>(
      tree,
      joinPathFragments(root, 'migrations.json')
    );
    expect(updated.generators).not.toHaveProperty('migration-1');
    expect(updated.schematics).toHaveProperty('migration-1');
  });

  it('should move nx generators to generators for migrations.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root } = await createPlugin(tree);
    updatePluginPackageJson(tree, {
      'nx-migrations': 'migrations.json',
    });
    writeJson<MigrationsJson>(
      tree,
      joinPathFragments(root, 'migrations.json'),
      {
        version: '1.0.0',
        schematics: {
          'migration-1': {
            version: '1.0.0',
            description: 'My Plugin 1',
            factory: './migrations/my-plugin-1',
            cli: 'nx',
          },
        },
      }
    );
    await updateCliPropsForPlugins(tree);
    const updated = readJson<MigrationsJson>(
      tree,
      joinPathFragments(root, 'migrations.json')
    );
    expect(updated.schematics).not.toHaveProperty('migration-1');
    expect(updated.generators).toHaveProperty('migration-1');
  });

  it('should move both nx generators to generators and non-nx schematics to schematics for migrations.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root } = await createPlugin(tree);
    updatePluginPackageJson(tree, {
      'nx-migrations': 'migrations.json',
    });
    writeJson<MigrationsJson>(
      tree,
      joinPathFragments(root, 'migrations.json'),
      {
        version: '1.0.0',
        schematics: {
          'migration-1': {
            version: '1.0.0',
            description: 'My Plugin 1',
            factory: './migrations/my-plugin-1',
            cli: 'nx',
          },
          'migration-2': {
            version: '1.0.0',
            description: 'My Plugin 2',
            factory: './migrations/my-plugin-2',
          },
        },
        generators: {
          'migration-3': {
            version: '1.0.0',
            description: 'My Plugin 3',
            factory: './migrations/my-plugin-3',
            cli: 'nx',
          },
          'migration-4': {
            version: '1.0.0',
            description: 'My Plugin 4',
            factory: './migrations/my-plugin-4',
          },
        },
      }
    );
    await updateCliPropsForPlugins(tree);
    const updated = readJson<MigrationsJson>(
      tree,
      joinPathFragments(root, 'migrations.json')
    );
    expect(updated.schematics).not.toHaveProperty('migration-1');
    expect(updated.generators).toHaveProperty('migration-1');
    expect(updated.schematics).toHaveProperty('migration-2');
    expect(updated.generators).not.toHaveProperty('migration-2');
    expect(updated.schematics).not.toHaveProperty('migration-3');
    expect(updated.generators).toHaveProperty('migration-3');
    expect(updated.schematics).toHaveProperty('migration-4');
    expect(updated.generators).not.toHaveProperty('migration-4');
  });

  it('should remove cli property from executors', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root, name } = await createPlugin(tree);
    await executorGenerator(tree, {
      name: 'my-executor',
      project: name,
      unitTestRunner: 'jest',
      includeHasher: false,
    });
    const schemaPath = joinPathFragments(
      root,
      'src/executors/my-executor/schema.json'
    );
    updateJson(tree, schemaPath, (schema) => {
      schema.cli = 'nx';
      return schema;
    });
    await updateCliPropsForPlugins(tree);
    const updated = readJson(tree, schemaPath);
    expect(updated).not.toHaveProperty('cli');
  });

  it('should remove cli property from builders', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root, name } = await createPlugin(tree);
    await executorGenerator(tree, {
      name: 'my-executor',
      project: name,
      unitTestRunner: 'jest',
      includeHasher: false,
    });
    updateJson<ExecutorsJson>(
      tree,
      joinPathFragments(root, 'executors.json'),
      (json) => {
        json.builders = json.executors;
        delete json.builders;
        return json;
      }
    );
    const schemaPath = joinPathFragments(
      root,
      'src/executors/my-executor/schema.json'
    );
    updateJson(tree, schemaPath, (schema) => {
      schema.cli = 'nx';
      return schema;
    });
    await updateCliPropsForPlugins(tree);
    const updated = readJson(tree, schemaPath);
    expect(updated).not.toHaveProperty('cli');
  });

  it('should remove cli property from generators', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root, name } = await createPlugin(tree);
    await generatorGenerator(tree, {
      name: 'my-generator',
      project: name,
      unitTestRunner: 'jest',
    });
    const schemaPath = joinPathFragments(
      root,
      'src/generators/my-generator/schema.json'
    );
    updateJson(tree, schemaPath, (schema) => {
      schema.cli = 'nx';
      return schema;
    });
    await updateCliPropsForPlugins(tree);
    const updated = readJson(tree, schemaPath);
    expect(updated).not.toHaveProperty('cli');
  });

  it('should remove cli property from schematics', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const { root, name } = await createPlugin(tree);
    await generatorGenerator(tree, {
      name: 'my-schematic',
      project: name,
      unitTestRunner: 'jest',
    });
    updateJson<GeneratorsJson>(
      tree,
      joinPathFragments(root, 'generators.json'),
      (json) => {
        json.schematics = json.generators;
        delete json.generators;
        return json;
      }
    );
    const schemaPath = joinPathFragments(
      root,
      'src/generators/my-schematic/schema.json'
    );
    updateJson(tree, schemaPath, (schema) => {
      schema.cli = 'nx';
      return schema;
    });
    await updateCliPropsForPlugins(tree);
    const updated = readJson(tree, schemaPath);
    expect(updated).not.toHaveProperty('cli');
  });

  assertRunsAgainstNxRepo(updateCliPropsForPlugins);
});

async function createPlugin(tree: Tree) {
  await pluginGenerator(tree, {
    name: 'my-plugin',
    compiler: 'tsc',
    linter: Linter.EsLint,
    unitTestRunner: 'jest',
    skipFormat: true,
    skipLintChecks: false,
    skipTsConfig: false,
  });
  return readProjectConfiguration(tree, 'my-plugin');
}

function updatePluginPackageJson(
  tree: Tree,
  packageJsonProps: Partial<PackageJson>
) {
  const { root } = readProjectConfiguration(tree, 'my-plugin');
  updateJson(tree, root + '/package.json', (json) => {
    const base = { json, ...packageJsonProps };
    for (const prop in base) {
      if (base[prop] === null || base[prop] === undefined) {
        delete json[prop];
      }
    }
    return base;
  });
}
