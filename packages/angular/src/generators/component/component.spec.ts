import { addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import componentGenerator from './component';

describe('component Generator', () => {
  it('should create the component correctly and export it', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchSnapshot();
  });
});
