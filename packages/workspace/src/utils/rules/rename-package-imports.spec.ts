import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic, runExternalSchematic } from '../testing';
import { renamePackageImports } from './rename-package-imports';

describe('renamePackageImports Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-rename': '1.2.3',
        },
      })
    );
  });

  it('should rename package imports', async () => {
    tree = await runSchematic('lib', { name: 'library-1' }, tree);

    const moduleThatImports = 'libs/library-1/src/importer.ts';
    tree.create(
      moduleThatImports,
      `import { something } from 'package-to-rename';

      export const doSomething = (...args) => something(...args);
      `
    );

    tree = (await callRule(
      renamePackageImports({ 'package-to-rename': '@package/renamed' }),
      tree
    )) as UnitTestTree;

    expect(tree.read(moduleThatImports).toString()).toContain(
      `import { something } from '@package/renamed'`
    );
  });

  it('should be able to rename multiple package imports to the new packageName', async () => {
    tree = await runSchematic('lib', { name: 'library-1' }, tree);
    tree = await runSchematic('lib', { name: 'library-2' }, tree);
    tree = await runSchematic('lib', { name: 'dont-include-me' }, tree);
    tree = await runExternalSchematic(
      '@nrwl/angular',
      'application',
      { name: 'app-one' },
      tree
    );

    const lib1ImportFile = 'libs/library-1/src/importer.ts';
    tree.create(
      lib1ImportFile,
      `import { something } from 'package-to-rename';
       import { anotherThing } from '@old/packageName';
       
       export const doSomething = (...args) => something(...args);
       export const doSomethingElse = (...args) => anotherThing(...args);
      `
    );
    const lib2ImportFile = 'libs/library-2/src/importer.ts';
    tree.create(
      lib2ImportFile,
      `import { something } from 'package-to-rename';

      export const doSomething = (...args) => something(...args);
      `
    );
    const lib2ImportFile2 = 'libs/library-2/src/lib/second-importer.ts';
    tree.create(
      lib2ImportFile2,
      `import { something } from '@old/packageName';

      export const doSomething = (...args) => something(...args);
      `
    );

    const appImportFile = 'apps/app-one/src/importer.ts';
    tree.create(
      appImportFile,
      `import { something } from 'package-to-rename';

      export const doSomething = (...args) => something(...args);
      `
    );

    tree = (await callRule(
      renamePackageImports({
        'package-to-rename': '@package/renamed',
        '@old/packageName': 'new-improved-pacakge',
      }),
      tree
    )) as UnitTestTree;

    // Lib1 (one file with multiple import name changes)
    expect(tree.read(lib1ImportFile).toString()).toContain(
      `import { anotherThing } from 'new-improved-pacakge'`
    );
    expect(tree.read(lib1ImportFile).toString()).toContain(
      `import { something } from '@package/renamed'`
    );

    // Lib2 (one lib with multiple files with import changes)
    expect(tree.read(lib2ImportFile).toString()).toContain(
      `import { something } from '@package/renamed'`
    );
    expect(tree.read(lib2ImportFile2).toString()).toContain(
      `import { something } from 'new-improved-pacakge'`
    );

    // App (make sure it's changed in apps too)
    expect(tree.read(appImportFile).toString()).toContain(
      `import { something } from '@package/renamed'`
    );
  });

  it('should NOT modify anything BUT the module import', async () => {
    tree = await runSchematic('lib', { name: 'library-1' }, tree);

    const moduleThatImports = 'libs/library-1/src/importer.ts';
    tree.create(
      moduleThatImports,
      `// a comment about package-to-rename
      import { something } from 'package-to-rename';

      // a comment about package-to-rename
      export const objectThingy = {
        'package-to-rename': something
      };
      `
    );

    tree = (await callRule(
      renamePackageImports({ 'package-to-rename': '@package/renamed' }),
      tree
    )) as UnitTestTree;

    const fileContents = tree.read(moduleThatImports).toString();

    expect(fileContents).toContain(
      `import { something } from '@package/renamed'`
    );
    // Leave comment alone
    expect(tree.read(moduleThatImports).toString()).toContain(
      `// a comment about package-to-rename`
    );
    // Leave object key alone
    expect(tree.read(moduleThatImports).toString()).toContain(
      `'package-to-rename': something`
    );
  });
});
