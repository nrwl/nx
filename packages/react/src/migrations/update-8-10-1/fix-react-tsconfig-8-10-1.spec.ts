import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { join } from 'path';

describe('Update 8-10-0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );

    schematicRunner.registerCollection(
      '@nrwl/cypress',
      join(__dirname, '../../../../cypress/generators.json')
    );
  });

  it('should remove @nwrl/react/typings/svg.d.ts from tsconfig', async () => {
    const reactRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../generators.json')
    );

    reactRunner.registerCollection(
      '@nrwl/jest',
      join(__dirname, '../../../../jest/generators.json')
    );

    reactRunner.registerCollection(
      '@nrwl/cypress',
      join(__dirname, '../../../../cypress/generators.json')
    );

    tree = await reactRunner
      .runSchematicAsync('app', { name: 'demo' }, tree)
      .toPromise();

    let tsConfig = JSON.parse(tree.read(`apps/demo/tsconfig.json`).toString());

    tree.overwrite(
      `apps/demo/tsconfig.json`,
      JSON.stringify({
        ...tsConfig,
        files: [
          '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
          '../../node_modules/@nrwl/react/typings/image.d.ts',
          '../../node_modules/@nrwl/react/typings/svg.d.ts',
        ],
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('fix-react-tsconfig-8.10.1', {}, tree)
      .toPromise();

    tsConfig = JSON.parse(tree.read(`apps/demo/tsconfig.json`).toString());

    expect(tsConfig.files).toEqual([
      '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
      '../../node_modules/@nrwl/react/typings/image.d.ts',
    ]);
  });
});
