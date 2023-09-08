import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { applicationGenerator } from './application';
import { Schema } from './schema';

describe('application generator', () => {
  let tree: Tree;
  const options: Schema = { name: 'test' } as Schema;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await applicationGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });

  it('should set up project correctly with given options', async () => {
    await applicationGenerator(tree, { ...options, unitTestRunner: 'vitest' });
    expect(tree.read('test/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/project.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/src/__tests__/App.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(listFiles(tree)).toMatchSnapshot();
  });
});

function listFiles(tree: Tree): string[] {
  const files = new Set<string>();
  tree.listChanges().forEach((change) => {
    if (change.type !== 'DELETE') {
      files.add(change.path);
    }
  });

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}
