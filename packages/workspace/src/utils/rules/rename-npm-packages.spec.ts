import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '../ast-utils';
import {
  callRule,
  runSchematic,
  runExternalSchematic,
} from '../../utils/testing';
import { createEmptyWorkspace } from '../../../testing';

import { renameNpmPackages, PackageRenameMapping } from './rename-npm-packages';

describe('renameNpmPackages Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should rename an npm package in both package.json and any file that imports it', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-rename': '1.2.3',
        },
      })
    );
    tree = await runSchematic('lib', { name: 'library-1' }, tree);

    const moduleThatImports = 'libs/library-1/src/importer.ts';
    tree.create(
      moduleThatImports,
      `import { something } from 'package-to-rename';

      export const doSomething = (...args) => something(...args);
      `
    );

    tree = (await callRule(
      renameNpmPackages({ 'package-to-rename': '@package/renamed' }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        '@package/renamed': '1.2.3',
      },
    });

    expect(tree.read(moduleThatImports).toString()).toContain(
      `import { something } from '@package/renamed'`
    );
  });

  it('should accept a new version that will also be updated in the package.json when renamed', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-rename': '1.2.3',
        },
      })
    );

    tree = (await callRule(
      renameNpmPackages({ 'package-to-rename': ['@package/renamed', '9.9.9'] }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        '@package/renamed': '9.9.9',
      },
    });
  });

  it('should rename multiple npm packages if more are passed in the PackageRenameMapping', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-rename': '1.2.3',
        },
        devDependencies: {
          '@old/packageName': '0.0.1',
        },
      })
    );

    tree = await runSchematic('lib', { name: 'library-1' }, tree);
    tree = await runSchematic('lib', { name: 'library-2' }, tree);
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
      renameNpmPackages({
        'package-to-rename': '@package/renamed',
        '@old/packageName': 'new-improved-pacakge',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        '@package/renamed': '1.2.3',
      },
      devDependencies: {
        'new-improved-pacakge': '0.0.1',
      },
    });

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
  }, 60000);

  it('should only update libs / apps that import the npm package as a dep', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-rename': '1.2.3',
        },
      })
    );

    tree = await runSchematic('lib', { name: 'library-1' }, tree);
    tree = await runSchematic('lib', { name: 'library-2' }, tree);

    const lib1ImportFile = 'libs/library-1/src/importer.ts';
    tree.create(
      lib1ImportFile,
      `import { something } from 'package-to-rename';
       
       export const doSomething = (...args) => something(...args);
      `
    );
    const lib2ImportFile = 'libs/library-2/src/non-importer.ts';
    tree.create(
      lib2ImportFile,
      `// just a comment about import { something } from 'package-to-rename'`
    );

    tree = (await callRule(
      renameNpmPackages({
        'package-to-rename': '@package/renamed',
      }),
      tree
    )) as UnitTestTree;

    expect(tree.read(lib1ImportFile).toString()).toContain(
      `import { something } from '@package/renamed'`
    );

    expect(tree.read(lib2ImportFile).toString()).toContain(
      `// just a comment about import { something } from 'package-to-rename'`
    );
  });

  it('should do nothing if the packages are not found in the package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'not-me': '1.0.0',
        },
        devDependencies: {
          'nor-me': '0.0.2',
        },
      })
    );

    tree = (await callRule(
      renameNpmPackages({
        'package-to-rename': '@package/renamed',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'not-me': '1.0.0',
      },
      devDependencies: {
        'nor-me': '0.0.2',
      },
    });
  });
});
