import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { resolveWorkspaceDependencyTarget } from './get-workspace-packages-from-graph';

describe('resolveWorkspaceDependencyTarget', () => {
  function makeWorkspacePackages(
    packages: Array<{ packageName: string; version?: string }>
  ): Map<string, ProjectGraphProjectNode> {
    const map = new Map<string, ProjectGraphProjectNode>();
    for (const { packageName, version } of packages) {
      map.set(packageName, {
        name: packageName,
        type: 'lib',
        data: {
          root: `libs/${packageName}`,
          metadata: {
            js: {
              packageName,
              ...(version ? { packageVersion: version } : {}),
            },
          },
        },
      } as ProjectGraphProjectNode);
    }
    return map;
  }

  it('should resolve a plain entry keyed by a workspace package name', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'lib-a', version: '1.0.0' },
    ]);

    expect(resolveWorkspaceDependencyTarget('lib-a', '^1.0.0', packages)).toBe(
      'lib-a'
    );
    expect(
      resolveWorkspaceDependencyTarget('lib-a', 'workspace:*', packages)
    ).toBe('lib-a');
    expect(resolveWorkspaceDependencyTarget('lib-a', undefined, packages)).toBe(
      'lib-a'
    );
  });

  it('should resolve a workspace alias entry to the requested target', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'lib-a', version: '1.0.0' },
    ]);

    expect(
      resolveWorkspaceDependencyTarget(
        'custom-lib',
        'workspace:lib-a@*',
        packages
      )
    ).toBe('lib-a');
  });

  it('should prefer the aliased target over a workspace package matching the key', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'lib-a', version: '1.0.0' },
      { packageName: 'lib-b', version: '1.0.0' },
    ]);

    // the key names a workspace package, but the value aliases another one
    expect(
      resolveWorkspaceDependencyTarget('lib-a', 'workspace:lib-b@*', packages)
    ).toBe('lib-b');
  });

  it('should resolve an npm alias entry when the range matches the workspace package version', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'lib-a', version: '1.0.0' },
    ]);

    expect(
      resolveWorkspaceDependencyTarget(
        'custom-lib',
        'npm:lib-a@1.0.0',
        packages
      )
    ).toBe('lib-a');
    expect(
      resolveWorkspaceDependencyTarget('custom-lib', 'npm:lib-a', packages)
    ).toBe('lib-a');
  });

  it('should not resolve an npm alias entry when the range does not match the workspace package version', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'lib-a', version: '1.0.0' },
    ]);

    expect(
      resolveWorkspaceDependencyTarget(
        'custom-lib',
        'npm:lib-a@^9.0.0',
        packages
      )
    ).toBeNull();
  });

  it('should not fall back to the key for an alias entry targeting a non-workspace package', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'custom-lib', version: '1.0.0' },
    ]);

    // the key names a workspace package, but the value targets a registry
    // package, so the entry does not reference a workspace package
    expect(
      resolveWorkspaceDependencyTarget(
        'custom-lib',
        'npm:lodash@^4.17.21',
        packages
      )
    ).toBeNull();
  });

  it('should return null for entries that do not reference a workspace package', () => {
    const packages = makeWorkspacePackages([
      { packageName: 'lib-a', version: '1.0.0' },
    ]);

    expect(
      resolveWorkspaceDependencyTarget('lodash', '^4.17.21', packages)
    ).toBeNull();
    expect(
      resolveWorkspaceDependencyTarget('lodash', undefined, packages)
    ).toBeNull();
  });
});
