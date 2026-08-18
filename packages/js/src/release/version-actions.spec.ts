import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
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
    },
    dependencies: {},
  } as any;
}
