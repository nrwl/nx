import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateImports } from './update-imports';
import { libraryGenerator } from '../../library/library';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('updateImports', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };
  });

  it('should update project refs', async () => {
    // this is a bit of a cheat - we expect to run this rule on an intermediate state
    // tree where the workspace hasn't been updated yet, so just create libs representing
    // source and destination to make sure that the workspace has libraries with those names.
    await libraryGenerator(tree, { name: 'my-destination' });
    await libraryGenerator(tree, { name: 'my-source' });

    await libraryGenerator(tree, { name: 'my-importer' });
    const importerFilePath = 'libs/my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { MyClass } from '@proj/my-source';

        export class MyExtendedClass extends MyClass {};
      `
    );

    const projectConfig = readProjectConfiguration(tree, 'my-source');
    updateImports(tree, schema, projectConfig);

    expect(tree.read(importerFilePath).toString()).toMatchSnapshot();
  });

  /**
   * Ensure that import paths are only updated if they are an exact match.
   * For example '@proj/table' contains '@proj/tab', however it should not
   * be updated.
   */
  it('should not update import paths when they contain a partial match', async () => {
    await libraryGenerator(tree, { name: 'table' });
    await libraryGenerator(tree, { name: 'tab' });

    await libraryGenerator(tree, { name: 'my-importer' });
    const importerFilePath = 'libs/my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { Table } from '@proj/table';
        import { Tab } from '@proj/tab';

        export class MyTable extends Table {};
        export class MyTab extends Tab {};
      `
    );

    const projectConfig = readProjectConfiguration(tree, 'tab');
    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: undefined,
        updateImportPath: true,
      },
      projectConfig
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import { Table } from '@proj/table';`
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import { Tab } from '@proj/tabs';`
    );

    expect(tree.read(importerFilePath).toString()).toMatchSnapshot();
  });

  it('should correctly update deep imports', async () => {
    await libraryGenerator(tree, { name: 'table' });
    await libraryGenerator(tree, { name: 'tab' });

    await libraryGenerator(tree, { name: 'my-importer' });
    const importerFilePath = 'libs/my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { Table } from '@proj/table/components';
        import { Tab } from '@proj/tab/components';

        export class MyTable extends Table {};
        export class MyTab extends Tab {};
      `
    );

    const projectConfig = readProjectConfiguration(tree, 'tab');
    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: undefined,
        updateImportPath: true,
      },
      projectConfig
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import { Table } from '@proj/table/components';`
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import { Tab } from '@proj/tabs/components';`
    );

    expect(tree.read(importerFilePath).toString()).toMatchSnapshot();
  });

  it('should update dynamic imports', async () => {
    await libraryGenerator(tree, { name: 'table' });
    await libraryGenerator(tree, { name: 'tab' });

    await libraryGenerator(tree, { name: 'my-importer' });
    const importerFilePath = 'libs/my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
      import('@proj/table').then(m => m.Table);
      import('@proj/table/components').then(m => m.Table);
      import('@proj/tab').then(m => m.Tab);
      import('@proj/tab/components').then(m => m.Tab);
      `
    );

    const projectConfig = readProjectConfiguration(tree, 'tab');
    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: undefined,
        updateImportPath: true,
      },
      projectConfig
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import('@proj/table').then(m => m.Table);`
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import('@proj/table/components').then(m => m.Table);`
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import('@proj/tabs').then(m => m.Tab);`
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import('@proj/tabs/components').then(m => m.Tab);`
    );

    expect(tree.read(importerFilePath).toString()).toMatchSnapshot();
  });
  //
  // it('should update require imports', async () => {
  //   tree = await runSchematic('lib', { name: 'table' }, tree);
  //   tree = await runSchematic('lib', { name: 'tab' }, tree);
  //
  //   tree = await runSchematic('lib', { name: 'my-importer' }, tree);
  //   const importerFilePath = 'libs/my-importer/src/importer.ts';
  //   tree.create(
  //     importerFilePath,
  //     `
  //     require('@proj/table');
  //     require('@proj/table/components');
  //     require('@proj/tab');
  //     require('@proj/tab/components');
  //     `
  //   );
  //
  //   tree = (await callRule(
  //     updateImports({
  //       projectName: 'tab',
  //       destination: 'tabs',
  //       importPath: undefined,
  //       updateImportPath: true,
  //     }),
  //     tree
  //   )) as UnitTestTree;
  //
  //   expect(tree.read(importerFilePath).toString()).toContain(
  //     `require('@proj/table');`
  //   );
  //
  //   expect(tree.read(importerFilePath).toString()).toContain(
  //     `require('@proj/table/components');`
  //   );
  //
  //   expect(tree.read(importerFilePath).toString()).toContain(
  //     `require('@proj/tabs');`
  //   );
  //
  //   expect(tree.read(importerFilePath).toString()).toContain(
  //     `require('@proj/tabs/components');`
  //   );
  // });
  //
  // it('should not update project refs when --updateImportPath=false', async () => {
  //   // this is a bit of a cheat - we expect to run this rule on an intermediate state
  //   // tree where the workspace hasn't been updated yet, so just create libs representing
  //   // source and destination to make sure that the workspace has libraries with those names.
  //   tree = await runSchematic('lib', { name: 'my-destination' }, tree);
  //   tree = await runSchematic('lib', { name: 'my-source' }, tree);
  //
  //   tree = await runSchematic('lib', { name: 'my-importer' }, tree);
  //   const importerFilePath = 'libs/my-importer/src/importer.ts';
  //   tree.create(
  //     importerFilePath,
  //     `
  //       import { MyClass } from '@proj/my-source';
  //
  //       export MyExtendedClass extends MyClass {};
  //     `
  //   );
  //
  //   schema.updateImportPath = false;
  //   tree = (await callRule(updateImports(schema), tree)) as UnitTestTree;
  //
  //   expect(tree.read(importerFilePath).toString()).toContain(
  //     `import { MyClass } from '@proj/my-source';`
  //   );
  // });
  //
  // it('should update project refs to --importPath when provided', async () => {
  //   // this is a bit of a cheat - we expect to run this rule on an intermediate state
  //   // tree where the workspace hasn't been updated yet, so just create libs representing
  //   // source and destination to make sure that the workspace has libraries with those names.
  //   tree = await runSchematic('lib', { name: 'my-destination' }, tree);
  //   tree = await runSchematic('lib', { name: 'my-source' }, tree);
  //
  //   tree = await runSchematic('lib', { name: 'my-importer' }, tree);
  //   const importerFilePath = 'libs/my-importer/src/importer.ts';
  //   tree.create(
  //     importerFilePath,
  //     `
  //       import { MyClass } from '@proj/my-source';
  //
  //       export class MyExtendedClass extends MyClass {};
  //     `
  //   );
  //
  //   schema.importPath = '@proj/wibble';
  //   tree = (await callRule(updateImports(schema), tree)) as UnitTestTree;
  //
  //   expect(tree.read(importerFilePath).toString()).toContain(
  //     `import { MyClass } from '${schema.importPath}';`
  //   );
  // });
  //
  // it('should update project ref in the tsconfig file', async () => {
  //   tree = await runSchematic('lib', { name: 'my-source' }, tree);
  //
  //   let tsConfig = readJsonInTree(tree, '/tsconfig.base.json');
  //   expect(tsConfig.compilerOptions.paths).toEqual({
  //     '@proj/my-source': ['libs/my-source/src/index.ts'],
  //   });
  //
  //   tree = (await callRule(updateImports(schema), tree)) as UnitTestTree;
  //
  //   tsConfig = readJsonInTree(tree, '/tsconfig.base.json');
  //   expect(tsConfig.compilerOptions.paths).toEqual({
  //     '@proj/my-destination': ['libs/my-destination/src/index.ts'],
  //   });
  // });
  //
  // it('should only update the project ref paths in the tsconfig file when --updateImportPath=false', async () => {
  //   tree = await runSchematic('lib', { name: 'my-source' }, tree);
  //
  //   let tsConfig = readJsonInTree(tree, '/tsconfig.base.json');
  //   expect(tsConfig.compilerOptions.paths).toEqual({
  //     '@proj/my-source': ['libs/my-source/src/index.ts'],
  //   });
  //
  //   schema.updateImportPath = false;
  //   tree = (await callRule(updateImports(schema), tree)) as UnitTestTree;
  //
  //   tsConfig = readJsonInTree(tree, '/tsconfig.base.json');
  //   expect(tsConfig.compilerOptions.paths).toEqual({
  //     '@proj/my-source': ['libs/my-destination/src/index.ts'],
  //   });
  // });
});
