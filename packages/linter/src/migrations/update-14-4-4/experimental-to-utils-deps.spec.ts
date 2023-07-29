import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { WORKSPACE_PLUGIN_DIR } from '../../generators/workspace-rules-project/workspace-rules-project';
import addTypescriptEslintUtilsIfNeeded from './experimental-to-utils-deps';

describe('addTypescriptEslintUtilsIfNeeded()', () => {
  it('should remove @typescript-eslint/experimental-utils from package.json devDependencies and add @typescript-eslint/utils', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@typescript-eslint/experimental-utils'] = '12.3.4';
      return json;
    });

    await addTypescriptEslintUtilsIfNeeded(tree);

    expect(tree.read(`package.json`).toString('utf-8')).toMatchSnapshot();
  });

  it('should remove @typescript-eslint/experimental-utils from package.json devDependencies and add @typescript-eslint/utils', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (json) => {
      json.dependencies['@typescript-eslint/experimental-utils'] = '12.3.4';
      return json;
    });

    await addTypescriptEslintUtilsIfNeeded(tree);

    expect(tree.read(`package.json`).toString('utf-8')).toMatchSnapshot();
  });

  it('should add @typescript-eslint/utils if plugins folder exists', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    tree.write(
      `${WORKSPACE_PLUGIN_DIR}/rules/my-rule.ts`,
      'console.log("not important");'
    );

    await addTypescriptEslintUtilsIfNeeded(tree);

    expect(tree.read(`package.json`).toString('utf-8')).toMatchSnapshot();
  });

  it('should not add @typescript-eslint/utils if plugins folder or experimental-utils dont exist', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await addTypescriptEslintUtilsIfNeeded(tree);

    expect(tree.read(`package.json`).toString('utf-8')).toMatchSnapshot();
  });
});
