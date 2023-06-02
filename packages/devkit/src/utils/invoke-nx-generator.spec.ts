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
});

async function newFileGenerator(tree: Tree, options: {}) {
  tree.write('my-file.ts', `const hello = "hello world";`);
}
