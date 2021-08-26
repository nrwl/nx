import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { lintInitWorkspaceRulesGenerator } from './init-workspace-rules';

describe('@nrwl/linter:init-workspace-rules', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update implicitDependencies in nx.json', async () => {
    expect(
      readJson(tree, 'nx.json').implicitDependencies
    ).toMatchInlineSnapshot(`undefined`);

    await lintInitWorkspaceRulesGenerator(tree);

    expect(readJson(tree, 'nx.json').implicitDependencies)
      .toMatchInlineSnapshot(`
      Object {
        "tools/eslint-rules/**/*": "*",
      }
    `);
  });

  it('should generate the required files', async () => {
    await lintInitWorkspaceRulesGenerator(tree);

    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('tools/eslint-rules/tsconfig.json', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not update the required files if they already exist', async () => {
    const customIndexContents = `custom index contents`;
    tree.write('tools/eslint-rules/index.ts', customIndexContents);

    const customTsconfigContents = `custom tsconfig contents`;
    tree.write('tools/eslint-rules/tsconfig.json', customTsconfigContents);

    await lintInitWorkspaceRulesGenerator(tree);

    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8')).toEqual(
      customIndexContents
    );
    expect(tree.read('tools/eslint-rules/tsconfig.json', 'utf-8')).toEqual(
      customTsconfigContents
    );
  });
});
