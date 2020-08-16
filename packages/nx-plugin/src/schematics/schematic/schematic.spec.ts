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
      'schematic',
      {
        project: projectName,
        name: 'my-schematic',
      },
      appTree
    );

    expect(
      tree.exists('libs/my-plugin/src/schematics/my-schematic/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-schematic/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-schematic/schematic.ts')
    ).toBeTruthy();
    expect(
      tree.exists(
        'libs/my-plugin/src/schematics/my-schematic/schematic.spec.ts'
      )
    ).toBeTruthy();
  });

  it('should update collection.json', async () => {
    const tree = await runSchematic(
      'schematic',
      {
        project: projectName,
        name: 'my-schematic',
        description: 'my-schematic description',
      },
      appTree
    );

    const collectionJson = readJsonInTree(
      tree,
      'libs/my-plugin/collection.json'
    );

    expect(collectionJson.schematics['my-schematic'].factory).toEqual(
      './src/schematics/my-schematic/schematic'
    );
    expect(collectionJson.schematics['my-schematic'].schema).toEqual(
      './src/schematics/my-schematic/schema.json'
    );
    expect(collectionJson.schematics['my-schematic'].description).toEqual(
      'my-schematic description'
    );
  });

  it('should generate default description', async () => {
    const tree = await runSchematic(
      'schematic',
      {
        project: projectName,
        name: 'my-schematic',
      },
      appTree
    );

    const collectionJson = readJsonInTree(
      tree,
      'libs/my-plugin/collection.json'
    );

    expect(collectionJson.schematics['my-schematic'].description).toEqual(
      'my-schematic schematic'
    );
  });

  it('should generate custom description', async () => {
    const tree = await runSchematic(
      'schematic',
      {
        project: projectName,
        name: 'my-schematic',
        description: 'my-schematic custom description',
      },
      appTree
    );

    const collectionJson = readJsonInTree(
      tree,
      'libs/my-plugin/collection.json'
    );

    expect(collectionJson.schematics['my-schematic'].description).toEqual(
      'my-schematic custom description'
    );
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate files', async () => {
        const tree = await runSchematic(
          'schematic',
          {
            project: projectName,
            name: 'my-schematic',
            unitTestRunner: 'none',
          },
          appTree
        );

        expect(
          tree.exists('libs/my-plugin/src/schematics/my-schematic/schematic.ts')
        ).toBeTruthy();
        expect(
          tree.exists(
            'libs/my-plugin/src/schematics/my-schematic/schematic.spec.ts'
          )
        ).toBeFalsy();
      });
    });
  });
});
