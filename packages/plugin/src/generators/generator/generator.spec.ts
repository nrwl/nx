import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  GeneratorsJson,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { pluginGenerator } from '../plugin/plugin';
import { generatorGenerator } from './generator';
import { Linter } from '@nx/eslint';
import { setCwd } from '@nx/devkit/internal-testing-utils';

describe('NxPlugin Generator Generator', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    tree = createTreeWithEmptyWorkspace();
    setCwd('');
    await pluginGenerator(tree, {
      directory: projectName,
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      compiler: 'tsc',
    });
  });

  it('should generate files', async () => {
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/generators/my-generator/generator',
      unitTestRunner: 'jest',
    });

    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/generator.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/generator.spec.ts')
    ).toBeTruthy();
  });

  it('should handle path with file extension', async () => {
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/generators/my-generator/generator.ts',
      unitTestRunner: 'jest',
    });

    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/generator.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/generator.spec.ts')
    ).toBeTruthy();
  });

  it('should generate files relative to cwd', async () => {
    setCwd('my-plugin/src/nx-integrations/generators/my-generator');
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/nx-integrations/generators/my-generator/generator',
      unitTestRunner: 'jest',
    });

    expect(
      tree.exists(
        'my-plugin/src/nx-integrations/generators/my-generator/schema.d.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'my-plugin/src/nx-integrations/generators/my-generator/schema.json'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'my-plugin/src/nx-integrations/generators/my-generator/generator.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'my-plugin/src/nx-integrations/generators/my-generator/generator.spec.ts'
      )
    ).toBeTruthy();
  });

  it('should generate files for derived', async () => {
    await generatorGenerator(tree, {
      path: `${projectName}/src/generators/my-generator/generator`,
      name: 'my-generator',
      unitTestRunner: 'jest',
    });

    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/generator.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/generator.spec.ts')
    ).toBeTruthy();
  });

  it('should update generators.json', async () => {
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/generators/my-generator/generator',
      unitTestRunner: 'jest',
    });

    const generatorJson = readJson(tree, 'my-plugin/generators.json');

    expect(generatorJson.generators['my-generator'].factory).toEqual(
      './src/generators/my-generator/generator'
    );
    expect(generatorJson.generators['my-generator'].schema).toEqual(
      './src/generators/my-generator/schema.json'
    );
    expect(generatorJson.generators['my-generator'].description).toEqual(
      'my-generator generator'
    );
  });

  it('should update generators.json for derived', async () => {
    await generatorGenerator(tree, {
      path: 'my-plugin/src/generators/my-generator/generator',
      name: 'my-generator',
      unitTestRunner: 'jest',
    });

    const generatorJson = readJson(tree, 'my-plugin/generators.json');

    expect(generatorJson.generators['my-generator'].factory).toEqual(
      './src/generators/my-generator/generator'
    );
    expect(generatorJson.generators['my-generator'].schema).toEqual(
      './src/generators/my-generator/schema.json'
    );
    expect(generatorJson.generators['my-generator'].description).toEqual(
      'my-generator generator'
    );
  });

  it('should throw if recreating an existing generator', async () => {
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/generators/my-generator/generator',
      unitTestRunner: 'jest',
    });
    expect(
      generatorGenerator(tree, {
        path: 'my-plugin/src/generators/my-generator/generator',
        name: 'my-generator',
        unitTestRunner: 'jest',
      })
    ).rejects.toThrow('Generator my-generator already exists');
  });

  it('should update generators.json with the same path as where the generator files folder is located', async () => {
    const generatorName = 'myGenerator';
    const generatorFileName = 'my-generator';

    await generatorGenerator(tree, {
      name: generatorName,
      path: 'my-plugin/src/generators/my-generator/generator',
      unitTestRunner: 'jest',
      description: 'my-generator description',
    });

    const generatorJson = readJson(tree, 'my-plugin/generators.json');

    expect(
      tree.exists(`my-plugin/src/generators/${generatorFileName}/schema.d.ts`)
    ).toBeTruthy();

    expect(generatorJson.generators[generatorName].factory).toEqual(
      `./src/generators/${generatorFileName}/generator`
    );
    expect(generatorJson.generators[generatorName].schema).toEqual(
      `./src/generators/${generatorFileName}/schema.json`
    );
    expect(generatorJson.generators[generatorName].description).toEqual(
      `${generatorFileName} description`
    );
  });

  it('should create generators.json if it is not present', async () => {
    await jsLibraryGenerator(tree, {
      directory: 'test-js-lib',
      bundler: 'tsc',
    });
    const libConfig = readProjectConfiguration(tree, 'test-js-lib');
    await generatorGenerator(tree, {
      name: 'test-generator',
      path: 'test-js-lib/src/generators/test-generator/generator',
      unitTestRunner: 'jest',
    });

    expect(() =>
      tree.exists(`${libConfig.root}/generators.json`)
    ).not.toThrow();
    expect(readJson(tree, `${libConfig.root}/package.json`).generators).toBe(
      './generators.json'
    );
  });

  it('should generate custom description', async () => {
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/generators/my-generator/generator',
      description: 'my-generator custom description',
      unitTestRunner: 'jest',
    });

    const generatorJson = readJson(tree, 'my-plugin/generators.json');

    expect(generatorJson.generators['my-generator'].description).toEqual(
      'my-generator custom description'
    );
  });

  it('should support custom generator file name', async () => {
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'my-plugin/src/generators/my-generator/my-custom-generator',
      unitTestRunner: 'jest',
    });

    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/generators/my-generator/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists(
        'my-plugin/src/generators/my-generator/my-custom-generator.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'my-plugin/src/generators/my-generator/my-custom-generator.spec.ts'
      )
    ).toBeTruthy();
    expect(tree.read('my-plugin/generators.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "generators": {
          "my-generator": {
            "factory": "./src/generators/my-generator/my-custom-generator",
            "schema": "./src/generators/my-generator/schema.json",
            "description": "my-generator generator"
          }
        }
      }
      "
    `);
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate files', async () => {
        await generatorGenerator(tree, {
          name: 'my-generator',
          path: 'my-plugin/src/generators/my-generator/generator',
          unitTestRunner: 'none',
        });

        expect(
          tree.exists('my-plugin/src/generators/my-generator/generator.ts')
        ).toBeTruthy();
        expect(
          tree.exists('my-plugin/src/generators/my-generator/generator.spec.ts')
        ).toBeFalsy();
      });
    });
  });

  describe('preset generator', () => {
    it('should default to standalone layout: true', async () => {
      await generatorGenerator(tree, {
        path: 'my-plugin/src/generators/preset/generator',
        name: 'preset',
        unitTestRunner: 'none',
      });

      const generatorJson = readJson<GeneratorsJson>(
        tree,
        'my-plugin/generators.json'
      );

      expect(
        generatorJson.generators['preset']['x-use-standalone-layout']
      ).toEqual(true);
    });
  });
});
