import { readJson, type Tree, updateJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';
import update from './move-ensure-owners-rule';

describe('move-ensure-owners-rule migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setRules(rules: unknown) {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      conformance: { rules },
    }));
  }

  it('should rewrite both legacy ensure-owners specifiers and keep other rule fields', async () => {
    setRules([
      { rule: '@nx/conformance/enforce-project-boundaries' },
      {
        rule: '@nx/conformance/ensure-owners',
        projects: ['!e2e-*'],
        status: 'evaluated',
      },
      { rule: '@nx/powerpack-conformance/ensure-owners' },
    ]);

    const result = await update(tree);

    expect(readJson(tree, 'nx.json').conformance.rules).toEqual([
      { rule: '@nx/conformance/enforce-project-boundaries' },
      {
        rule: '@nx/owners/ensure-owners',
        projects: ['!e2e-*'],
        status: 'evaluated',
      },
      { rule: '@nx/owners/ensure-owners' },
    ]);
    expect(result?.skipAgentic).toBeFalsy();
  });

  it('should add @nx/owners when the workspace does not declare it', async () => {
    setRules([{ rule: '@nx/conformance/ensure-owners' }]);

    await update(tree);

    expect(readJson(tree, 'package.json').devDependencies['@nx/owners']).toBe(
      nxVersion
    );
  });

  it('should keep an existing @nx/owners declaration', async () => {
    setRules([{ rule: '@nx/conformance/ensure-owners' }]);
    writeJson(tree, 'package.json', {
      name: 'test',
      dependencies: { '@nx/owners': '24.0.0' },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/owners']).toBe('24.0.0');
    expect(packageJson.devDependencies?.['@nx/owners']).toBeUndefined();
  });

  it('should not change a workspace without the legacy rule', async () => {
    setRules([{ rule: '@nx/conformance/enforce-project-boundaries' }]);
    const nxJson = tree.read('nx.json', 'utf-8');
    const packageJson = tree.read('package.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(nxJson);
    expect(tree.read('package.json', 'utf-8')).toEqual(packageJson);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should skip conformance config that is not a rules array', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      conformance: { rules: '@nx/conformance/ensure-owners' },
    }));
    const nxJson = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(nxJson);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be a no-op when run twice', async () => {
    setRules([{ rule: '@nx/conformance/ensure-owners' }]);
    await update(tree);
    const nxJson = tree.read('nx.json', 'utf-8');
    const packageJson = tree.read('package.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(nxJson);
    expect(tree.read('package.json', 'utf-8')).toEqual(packageJson);
    expect(result).toEqual({ skipAgentic: true });
  });
});
