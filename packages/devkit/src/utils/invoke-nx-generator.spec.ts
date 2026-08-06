import type { Tree } from 'nx/src/generators/tree';
import { convertNxGenerator } from './invoke-nx-generator';
import { lastValueFrom } from 'rxjs';

describe('Convert Nx Generator', () => {
  it('should convert an nx generator to angular schematic correctly', async () => {
    // ARRANGE
    const {
      SchematicTestRunner,
      UnitTestTree,
    } = require('@angular-devkit/schematics/testing');
    const ngSchematicRunner = new SchematicTestRunner(
      '@schematics/angular',
      require.resolve('@schematics/angular/collection.json')
    );

    const appTree = await ngSchematicRunner.runSchematic('workspace', {
      name: 'workspace',
      newProjectRoot: 'projects',
      version: '6.0.0',
    });

    // ACT
    const convertedGenerator = convertNxGenerator(newFileGenerator);
    const tree: typeof UnitTestTree = await lastValueFrom(
      ngSchematicRunner.callRule(convertedGenerator, appTree)
    );

    // ASSERT
    expect(tree.files).toContain(`/my-file.ts`);
  });

  it('should return null from read() for a missing file rather than throwing', async () => {
    // ARRANGE
    const {
      SchematicTestRunner,
    } = require('@angular-devkit/schematics/testing');
    const ngSchematicRunner = new SchematicTestRunner(
      '@schematics/angular',
      require.resolve('@schematics/angular/collection.json')
    );
    const appTree = await ngSchematicRunner.runSchematic('workspace', {
      name: 'workspace',
      newProjectRoot: 'projects',
      version: '6.0.0',
    });

    // ACT
    const convertedGenerator = convertNxGenerator(readsAMissingFileGenerator);
    await lastValueFrom(
      ngSchematicRunner.callRule(convertedGenerator, appTree)
    );

    // ASSERT
    expect(results.encoded).toBeNull();
    expect(results.raw).toBeNull();
    expect(results.present).toEqual('const hello = "hello world";');
  });
});

async function newFileGenerator(tree: Tree, options: {}) {
  tree.write('my-file.ts', `const hello = "hello world";`);
}

async function readsAMissingFileGenerator(tree: Tree, options: {}) {
  // The schematics tree returns null here; the adapter must not dereference it.
  // `visitNotIgnoredFiles` and `formatFiles` both probe for ignore files that
  // are usually absent, so this is the path every converted generator takes.
  results.encoded = tree.read('.nxignore', 'utf-8');
  results.raw = tree.read('.nxignore');
  // A present file must still come back decoded, so the null path is not just
  // swallowing everything.
  tree.write('present.ts', 'const hello = "hello world";');
  results.present = tree.read('present.ts', 'utf-8');
}

const results: Record<string, unknown> = {};
