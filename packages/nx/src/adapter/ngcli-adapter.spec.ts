import {
  arrayBufferToString,
  wrapAngularDevkitSchematic,
} from './ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '../generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from '../generators/utils/project-configuration';

describe('ngcli-adapter', () => {
  it('arrayBufferToString should support large buffers', () => {
    const largeString = 'a'.repeat(1000000);

    const result = arrayBufferToString(Buffer.from(largeString));

    expect(result).toBe(largeString);
  });

  it('should correctly wrapAngularDevkitSchematics', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'test', { root: '', sourceRoot: 'src' });

    const wrappedSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'class'
    );

    // ACT
    await wrappedSchematic(tree, { name: 'test', project: 'test' });

    // ASSERT
    expect(tree.exists('src/lib/test.ts')).toBeTruthy();
  });
});
