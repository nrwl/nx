import type { Tree } from 'nx/src/generators/tree';
import { convertNxGenerator } from './invoke-nx-generator';
import { visitNotIgnoredFiles } from '../generators/visit-not-ignored-files';
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
    expect(results.presentRaw).toEqual(
      Buffer.from('const hello = "hello world";')
    );
    expect(results.emptyEncoded).toEqual('');
    expect(results.emptyRaw).toEqual(Buffer.alloc(0));
  });

  it('should let visitNotIgnoredFiles walk the adapter tree', async () => {
    // The walker probes for ignore files in every directory and most are
    // absent, so it is the consumer that notices if the adapter throws rather
    // than returning null for a missing file.
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

    const convertedGenerator = convertNxGenerator(walksTheTreeGenerator);
    await lastValueFrom(
      ngSchematicRunner.callRule(convertedGenerator, appTree)
    );

    expect(visited).toContain('src/a.ts');
    expect(visited).not.toContain('dist/out.js');
  });
});

async function newFileGenerator(tree: Tree, options: {}) {
  tree.write('my-file.ts', `const hello = "hello world";`);
}

async function readsAMissingFileGenerator(tree: Tree, options: {}) {
  // The schematics tree returns null here; the adapter must not dereference it.
  // `visitNotIgnoredFiles` and `formatFiles` both probe for ignore files that
  // are usually absent, so this is the path any converted generator that walks
  // or formats takes.
  results.encoded = tree.read('.nxignore', 'utf-8');
  results.raw = tree.read('.nxignore');
  // A present file must still come back decoded, so the null path is not just
  // swallowing everything.
  tree.write('present.ts', 'const hello = "hello world";');
  results.present = tree.read('present.ts', 'utf-8');
  results.presentRaw = tree.read('present.ts');
  // Empty is not missing. A falsy check here would collapse the two.
  tree.write('empty.ts', '');
  results.emptyEncoded = tree.read('empty.ts', 'utf-8');
  results.emptyRaw = tree.read('empty.ts');
}

async function walksTheTreeGenerator(tree: Tree, options: {}) {
  tree.write('src/a.ts', '');
  tree.write('dist/out.js', '');
  tree.write('.gitignore', 'dist\n');
  visitNotIgnoredFiles(tree, '', (p) => visited.push(p));
}

const results: Record<string, unknown> = {};
const visited: string[] = [];
