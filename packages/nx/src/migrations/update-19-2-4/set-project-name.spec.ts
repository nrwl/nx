import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { readJson } from '../../generators/utils/json';
import migrate from './set-project-name';

describe('set project name', () => {
  it('should not update packageJson projects', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'libs/proj/package.json',
      JSON.stringify({
        name: '@scoped/package',
      })
    );
    await migrate(tree);
    expect(tree.exists('libs/proj/project.json')).toBe(false);
  });

  it('should not update projectJson if name specified', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'libs/proj/project.json',
      JSON.stringify({
        name: 'foo',
      })
    );
    await migrate(tree);
    const project = readJson(tree, 'libs/proj/project.json');
    expect(project.name).toBe('foo');
  });

  it('should not update projectJson if name is not specified but no sibling package json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('libs/proj/project.json', JSON.stringify({}));
    await migrate(tree);
    const project = readJson(tree, 'libs/proj/project.json');
    expect(project.name).not.toBeDefined();
  });

  it('should not update projectJson if name is identical to package name', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'libs/proj/package.json',
      JSON.stringify({
        name: 'proj',
      })
    );
    tree.write('libs/proj/project.json', JSON.stringify({}));
    await migrate(tree);
    const project = readJson(tree, 'libs/proj/project.json');
    expect(project.name).not.toBeDefined();
  });

  it('should not update projectJson if name is identical to name in nx field', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'libs/proj/package.json',
      JSON.stringify({
        name: '@scoped/proj',
        nx: {
          name: 'proj',
        },
      })
    );
    tree.write('libs/proj/project.json', JSON.stringify({}));
    await migrate(tree);
    const project = readJson(tree, 'libs/proj/project.json');
    expect(project.name).not.toBeDefined();
  });

  it('should update projectJson if name is not specified and package name is different', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'libs/proj/package.json',
      JSON.stringify({
        name: '@scoped/proj',
      })
    );
    tree.write('libs/proj/project.json', JSON.stringify({}));
    await migrate(tree);
    const project = readJson(tree, 'libs/proj/project.json');
    expect(project.name).toBe('proj');
  });

  it('should update projectJson if name is not specified and name in nx field is different', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'libs/foo/package.json',
      JSON.stringify({
        name: '@scoped/proj',
        nx: {
          name: 'proj',
        },
      })
    );
    tree.write('libs/foo/project.json', JSON.stringify({}));
    await migrate(tree);
    const project = readJson(tree, 'libs/foo/project.json');
    expect(project.name).toBe('foo');
  });
});
