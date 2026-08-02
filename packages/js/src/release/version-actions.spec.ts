import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import JsVersionActions from './version-actions';

describe('JsVersionActions', () => {
  it('preserves package.json formatting when updating versions and dependencies', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'packages/my-lib/package.json',
      `{
    "name": "my-lib",
    "version": "1.0.0",
    "files": [
        "dist"
    ],
    "dependencies": {
        "dependency": "^1.0.0"
    }
}
`
    );

    const versionActions = new JsVersionActions(
      {
        name: 'release-group',
        projects: ['my-lib'],
        projectsRelationship: 'independent',
      } as any,
      {
        name: 'my-lib',
        type: 'lib',
        data: { root: 'packages/my-lib' },
      },
      {
        manifestRootsToUpdate: [],
        preserveLocalDependencyProtocols: false,
        preserveMatchingDependencyRanges: false,
      } as any
    );
    await versionActions.init(tree);

    await versionActions.updateProjectVersion(tree, '1.1.0');
    await versionActions.updateProjectDependencies(
      tree,
      {
        nodes: {
          dependency: {
            name: 'dependency',
            type: 'lib',
            data: {
              root: 'packages/dependency',
              metadata: { js: { packageName: 'dependency' } },
            },
          },
        },
        dependencies: {},
      },
      { dependency: '^2.0.0' }
    );

    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(`{
    "name": "my-lib",
    "version": "1.1.0",
    "files": [
        "dist"
    ],
    "dependencies": {
        "dependency": "^2.0.0"
    }
}
`);
  });
});
