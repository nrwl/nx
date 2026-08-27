import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, writeJson, type Tree } from '@nx/devkit';
import JsVersionActions from './version-actions';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(() => 'pnpm'),
}));

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
    const versionActions = await createVersionActions(tree);

    await versionActions.updateProjectVersion(tree, '1.1.0');
    await versionActions.updateProjectDependencies(tree, createProjectGraph(), {
      dependency: '^2.0.0',
    });

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

  it.each([
    {
      name: 'spaces and LF endings',
      input: '{\n    "name": "my-lib",\n    "private": true\n}\n',
      expected:
        '{\n    "name": "my-lib",\n    "private": true,\n    "version": "1.1.0"\n}\n',
    },
    {
      name: 'tabs and CRLF endings',
      input: '{\r\n\t"name": "my-lib",\r\n\t"private": true\r\n}\r\n',
      expected:
        '{\r\n\t"name": "my-lib",\r\n\t"private": true,\r\n\t"version": "1.1.0"\r\n}\r\n',
    },
  ])('formats an inserted version using $name', async ({ input, expected }) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('packages/my-lib/package.json', input);
    const versionActions = await createVersionActions(tree);

    await versionActions.updateProjectVersion(tree, '1.1.0');

    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(expected);
  });

  it('rejects a malformed manifest without changing it', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const malformedManifest = `{
  "name": "my-lib",
  "version": "1.0.0"
`;
    tree.write('packages/my-lib/package.json', malformedManifest);
    const versionActions = await createVersionActions(tree);

    await expect(
      versionActions.updateProjectVersion(tree, '1.1.0')
    ).rejects.toThrow('Cannot parse packages/my-lib/package.json');
    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(
      malformedManifest
    );
  });

  it('preserves comments and trailing commas in a valid manifest', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'packages/my-lib/package.json',
      `{
  // This comment should be preserved.
  "name": "my-lib",
  "version": "1.0.0",
}
`
    );
    const versionActions = await createVersionActions(tree);

    await versionActions.updateProjectVersion(tree, '1.1.0');

    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(`{
  // This comment should be preserved.
  "name": "my-lib",
  "version": "1.1.0",
}
`);
  });

  it('rejects a version update shadowed by a duplicate key', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const manifest = `{
  "name": "my-lib",
  "version": "1.0.0",
  "version": "5.5.5"
}
`;
    tree.write('packages/my-lib/package.json', manifest);
    const versionActions = await createVersionActions(tree);

    await expect(
      versionActions.updateProjectVersion(tree, '1.1.0')
    ).rejects.toThrow(
      'Cannot update packages/my-lib/package.json: "version" resolves to "5.5.5" instead of "1.1.0"'
    );
    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(manifest);
  });

  it('rejects a dependency update shadowed by a duplicate key', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const manifest = `{
  "name": "my-lib",
  "version": "1.0.0",
  "dependencies": {
    "dependency": "^1.0.0"
  },
  "dependencies": {
    "dependency": "^5.0.0"
  }
}
`;
    tree.write('packages/my-lib/package.json', manifest);
    const versionActions = await createVersionActions(tree);

    await expect(
      versionActions.updateProjectDependencies(tree, createProjectGraph(), {
        dependency: '^2.0.0',
      })
    ).rejects.toThrow(
      'Cannot update packages/my-lib/package.json: "dependencies.dependency" resolves to "^5.0.0" instead of "^2.0.0"'
    );
    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(manifest);
  });

  it('preserves a dependency range that already contains the new version', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const manifest = `{
  "name": "my-lib",
  "version": "1.0.0",
  "dependencies": {
    "dependency": "^1.0.0"
  }
}
`;
    tree.write('packages/my-lib/package.json', manifest);
    const versionActions = await createVersionActions(tree, {
      preserveMatchingDependencyRanges: true,
    });

    await versionActions.updateProjectDependencies(tree, createProjectGraph(), {
      dependency: '1.1.0',
    });

    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(manifest);
  });

  it('rejects a dependency version outside a preserved range', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const manifest = `{
  "name": "my-lib",
  "version": "1.0.0",
  "dependencies": {
    "dependency": "^1.0.0"
  }
}
`;
    tree.write('packages/my-lib/package.json', manifest);
    const versionActions = await createVersionActions(tree, {
      preserveMatchingDependencyRanges: true,
    });

    await expect(
      versionActions.updateProjectDependencies(tree, createProjectGraph(), {
        dependency: '2.0.0',
      })
    ).rejects.toThrow('is outside the current range');
    expect(tree.read('packages/my-lib/package.json', 'utf-8')).toBe(manifest);
  });

  it('applies workspace ranges to dependency versions supplied by release core', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'packages/my-lib/package.json', {
      dependencies: { dependency: 'workspace:^' },
      peerDependencies: { 'other-dependency': 'workspace:~' },
      optionalDependencies: { dependency: 'workspace:*' },
    });
    const versionActions = await createVersionActions(tree);
    const resolveVersion = jest.fn();

    await versionActions.updateProjectDependencies(
      tree,
      createProjectGraph(),
      {
        dependency: '2.5.0',
        'other-dependency': '3.0.0',
      },
      resolveVersion
    );

    expect(readJson(tree, 'packages/my-lib/package.json')).toEqual({
      dependencies: { dependency: '^2.5.0' },
      peerDependencies: { 'other-dependency': '~3.0.0' },
      optionalDependencies: { dependency: '2.5.0' },
    });
    expect(resolveVersion).not.toHaveBeenCalled();
  });

  describe('local dependencies outside the release set', () => {
    it('handles protocol preservation independently for each manifest', async () => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'packages/my-lib/package.json', {
        dependencies: { dependency: 'workspace:*' },
      });
      writeJson(tree, 'dist/packages/my-lib/package.json', {
        dependencies: { dependency: 'workspace:*' },
      });
      const versionActions = await createVersionActions(tree, {
        manifestRootsToUpdate: [
          {
            path: 'packages/my-lib',
            preserveLocalDependencyProtocols: true,
          },
          {
            path: 'dist/packages/my-lib',
            preserveLocalDependencyProtocols: false,
          },
        ],
      });
      const resolveCurrentVersion = jest.fn().mockResolvedValue('2.5.0');

      const logs = await versionActions.updateProjectDependencies(
        tree,
        createProjectGraph(),
        {},
        resolveCurrentVersion
      );

      expect(readJson(tree, 'packages/my-lib/package.json')).toEqual({
        dependencies: { dependency: 'workspace:*' },
      });
      expect(readJson(tree, 'dist/packages/my-lib/package.json')).toEqual({
        dependencies: { dependency: '2.5.0' },
      });
      expect(resolveCurrentVersion).toHaveBeenCalledTimes(1);
      expect(logs).toEqual([
        '✍️  Updated 1 dependency in manifest: dist/packages/my-lib/package.json',
      ]);
    });

    it('preserves each workspace range and only resolves the target once', async () => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'packages/my-lib/package.json', {
        dependencies: { dependency: 'workspace:^' },
        peerDependencies: { dependency: 'workspace:~' },
      });
      const versionActions = await createVersionActions(tree);
      const resolveCurrentVersion = jest.fn().mockResolvedValue('2.5.0');

      await versionActions.updateProjectDependencies(
        tree,
        createProjectGraph(),
        {},
        resolveCurrentVersion
      );

      expect(readJson(tree, 'packages/my-lib/package.json')).toEqual({
        dependencies: { dependency: '^2.5.0' },
        peerDependencies: { dependency: '~2.5.0' },
      });
      expect(resolveCurrentVersion).toHaveBeenCalledTimes(1);
      expect(resolveCurrentVersion).toHaveBeenCalledWith('dependency');
    });

    it('honors an explicitly empty version prefix', async () => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'packages/my-lib/package.json', {
        dependencies: { dependency: 'workspace:^' },
      });
      const versionActions = await createVersionActions(tree, {
        versionPrefix: '',
      });

      await versionActions.updateProjectDependencies(
        tree,
        createProjectGraph(),
        {},
        async () => '2.5.0'
      );

      expect(readJson(tree, 'packages/my-lib/package.json')).toEqual({
        dependencies: { dependency: '2.5.0' },
      });
    });

    it('passes pinned workspace ranges through without resolving versions', async () => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'packages/my-lib/package.json', {
        dependencies: { dependency: 'workspace:^1.2.3' },
        peerDependencies: {
          'other-dependency': 'workspace:2.5.0',
        },
      });
      const versionActions = await createVersionActions(tree);
      const resolveCurrentVersion = jest.fn();

      await versionActions.updateProjectDependencies(
        tree,
        createProjectGraph(),
        {},
        resolveCurrentVersion
      );

      expect(readJson(tree, 'packages/my-lib/package.json')).toEqual({
        dependencies: { dependency: '^1.2.3' },
        peerDependencies: { 'other-dependency': '2.5.0' },
      });
      expect(resolveCurrentVersion).not.toHaveBeenCalled();
    });

    it.each([
      {
        description: 'a relative workspace path',
        manifestPath: 'packages/my-lib/package.json',
        dependencyName: 'dependency',
        specifier: 'workspace:../dependency',
        expected: '2.5.0',
      },
      {
        description: 'a file path',
        manifestPath: 'packages/my-lib/package.json',
        dependencyName: 'dependency',
        specifier: 'file:../dependency',
        expected: '2.5.0',
      },
      {
        description: 'a relative workspace path in an output manifest',
        manifestPath: 'dist/packages/my-lib/package.json',
        dependencyName: 'dependency',
        specifier: 'workspace:../dependency',
        expected: '2.5.0',
      },
    ])(
      'resolves $description using the referenced project',
      async ({ manifestPath, dependencyName, specifier, expected }) => {
        const tree = createTreeWithEmptyWorkspace();
        writeJson(tree, manifestPath, {
          dependencies: { [dependencyName]: specifier },
        });
        const versionActions = await createVersionActions(
          tree,
          manifestPath.startsWith('dist/')
            ? {
                manifestRootsToUpdate: [
                  {
                    path: 'dist/packages/my-lib',
                    preserveLocalDependencyProtocols: false,
                  },
                ],
              }
            : undefined
        );
        const resolveCurrentVersion = jest.fn().mockResolvedValue('2.5.0');

        await versionActions.updateProjectDependencies(
          tree,
          createProjectGraph(),
          {},
          resolveCurrentVersion
        );

        expect(readJson(tree, manifestPath)).toEqual({
          dependencies: { [dependencyName]: expected },
        });
        expect(resolveCurrentVersion).toHaveBeenCalledWith('dependency');
      }
    );

    it('leaves plain registry ranges unchanged', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const manifest = {
        dependencies: { dependency: '^2.0.0' },
      };
      writeJson(tree, 'packages/my-lib/package.json', manifest);
      const versionActions = await createVersionActions(tree);
      const resolveCurrentVersion = jest.fn();

      await versionActions.updateProjectDependencies(
        tree,
        createProjectGraph(),
        {},
        resolveCurrentVersion
      );

      expect(readJson(tree, 'packages/my-lib/package.json')).toEqual(manifest);
      expect(resolveCurrentVersion).not.toHaveBeenCalled();
    });

    it('does not modify any manifest when version resolution fails', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const sourceManifest = {
        dependencies: { dependency: 'workspace:*' },
      };
      const distManifest = {
        dependencies: { 'other-dependency': 'workspace:*' },
      };
      writeJson(tree, 'packages/my-lib/package.json', sourceManifest);
      writeJson(tree, 'dist/packages/my-lib/package.json', distManifest);
      const versionActions = await createVersionActions(tree, {
        manifestRootsToUpdate: [
          {
            path: 'packages/my-lib',
            preserveLocalDependencyProtocols: false,
          },
          {
            path: 'dist/packages/my-lib',
            preserveLocalDependencyProtocols: false,
          },
        ],
      });
      const resolveCurrentVersion = jest.fn(async (projectName: string) => {
        if (projectName === 'other-dependency') {
          throw new Error('no current version is available');
        }
        return '2.5.0';
      });

      await expect(
        versionActions.updateProjectDependencies(
          tree,
          createProjectGraph(),
          {},
          resolveCurrentVersion
        )
      ).rejects.toThrow(
        'Unable to replace local dependency protocol "workspace:*" for "other-dependency" in manifest "dist/packages/my-lib/package.json". no current version is available'
      );
      expect(readJson(tree, 'packages/my-lib/package.json')).toEqual(
        sourceManifest
      );
      expect(readJson(tree, 'dist/packages/my-lib/package.json')).toEqual(
        distManifest
      );
    });
  });
});

async function createVersionActions(
  tree: Tree,
  config: Record<string, unknown> = {}
): Promise<JsVersionActions> {
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
      versionPrefix: 'auto',
      ...config,
    } as any
  );
  await versionActions.init(tree);
  return versionActions;
}

function createProjectGraph() {
  return {
    nodes: {
      dependency: {
        name: 'dependency',
        type: 'lib',
        data: {
          root: 'packages/dependency',
          metadata: { js: { packageName: 'dependency' } },
        },
      },
      'other-dependency': {
        name: 'other-dependency',
        type: 'lib',
        data: {
          root: 'packages/other-dependency',
          metadata: { js: { packageName: 'other-dependency' } },
        },
      },
    },
    dependencies: {},
  } as any;
}
