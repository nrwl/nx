import * as ngSchematics from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('NxPlugin schematic', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    appTree = createEmptyWorkspace(ngSchematics.Tree.empty());
    appTree = await runSchematic(
      'plugin',
      { name: projectName, importPath: '@proj/my-plugin' },
      appTree
    );
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'generator',
      {
        project: projectName,
        name: 'my-generator',
      },
      appTree
    );

    expect(
      tree.exists('libs/my-plugin/src/generators/my-generator/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-generator/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-generator/generator.ts')
    ).toBeTruthy();
    expect(
      tree.exists(
        'libs/my-plugin/src/generators/my-generator/generator.spec.ts'
      )
    ).toBeTruthy();
  });

  it('should update collection.json', async () => {
    const tree = await runSchematic(
      'generator',
      {
        project: projectName,
        name: 'my-generator',
        description: 'my-generator description',
      },
      appTree
    );

    const generatorJson = readJsonInTree(
      tree,
      'libs/my-plugin/generators.json'
    );

    expect(generatorJson.generators['my-generator'].factory).toEqual(
      './src/generators/my-generator/generator'
    );
    expect(generatorJson.generators['my-generator'].schema).toEqual(
      './src/generators/my-generator/schema.json'
    );
    expect(generatorJson.generators['my-generator'].description).toEqual(
      'my-generator description'
    );
  });

  it('should generate default description', async () => {
    const tree = await runSchematic(
      'generator',
      {
        project: projectName,
        name: 'my-generator',
      },
      appTree
    );

    const generatorJson = readJsonInTree(
      tree,
      'libs/my-plugin/generators.json'
    );

    expect(generatorJson.generators['my-generator'].description).toEqual(
      'my-generator generator'
    );
  });

  it('should generate custom description', async () => {
    const tree = await runSchematic(
      'generator',
      {
        project: projectName,
        name: 'my-generator',
        description: 'my-generator custom description',
      },
      appTree
    );

    const generatorJson = readJsonInTree(
      tree,
      'libs/my-plugin/generators.json'
    );

    expect(generatorJson.generators['my-generator'].description).toEqual(
      'my-generator custom description'
    );
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate files', async () => {
        const tree = await runSchematic(
          'generator',
          {
            project: projectName,
            name: 'my-generator',
            unitTestRunner: 'none',
          },
          appTree
        );

        expect(
          tree.exists('libs/my-plugin/src/generators/my-generator/generator.ts')
        ).toBeTruthy();
        expect(
          tree.exists(
            'libs/my-plugin/src/generators/my-generator/generator.spec.ts'
          )
        ).toBeFalsy();
      });
    });
  });
});
