import {
  findClosePackageNames,
  findInvalidWorkspaceAliases,
} from './validate-workspace-aliases';

describe('findInvalidWorkspaceAliases', () => {
  const workspacePackageNames = new Set([
    '@acme/missing-lib',
    '@acme/other-lib',
    'lib-a',
  ]);

  it('should return no issues for valid specifiers', () => {
    expect(
      findInvalidWorkspaceAliases(
        {
          name: 'app',
          version: '1.0.0',
          dependencies: {
            'lib-a': '^1.0.0',
            'alias-a': 'workspace:lib-a@*',
            'alias-b': 'workspace:@acme/missing-lib@^1.0.0',
            external: '^5.0.0',
            'registry-alias': 'npm:@acme/ghost@*',
            'bare-workspace': 'workspace:*',
            'not-a-string': 42 as unknown as string,
          },
        },
        workspacePackageNames
      )
    ).toEqual([]);
  });

  it('should report a target-bearing alias whose package is not a workspace package, with a suggestion and repair hint', () => {
    const issues = findInvalidWorkspaceAliases(
      {
        name: 'app',
        version: '1.0.0',
        dependencies: {
          'alias-name': 'workspace:@acme/mssing-lib@*',
        },
      },
      workspacePackageNames
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchInlineSnapshot(`
      "Invalid workspace dependency alias "alias-name": "workspace:@acme/mssing-lib@*".
      The requested package "@acme/mssing-lib" was not found among this repository's package-manager workspaces.
      Did you mean "@acme/missing-lib"?
      Fix the package name or add "@acme/mssing-lib" to the package-manager workspace configuration. If "alias-name" should resolve from the registry instead, replace "workspace:@acme/mssing-lib@*" with "npm:@acme/mssing-lib@*"."
    `);
  });

  it('should omit the suggestion line when no close candidate exists', () => {
    const issues = findInvalidWorkspaceAliases(
      {
        name: 'app',
        version: '1.0.0',
        devDependencies: {
          'alias-name': 'workspace:completely-unrelated@*',
        },
      },
      workspacePackageNames
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).not.toContain('Did you mean');
  });

  it('should report each invalid alias across collections', () => {
    const issues = findInvalidWorkspaceAliases(
      {
        name: 'app',
        version: '1.0.0',
        dependencies: { a: 'workspace:ghost-a@*' },
        optionalDependencies: { b: 'workspace:ghost-b@^1.0.0' },
        peerDependencies: { c: 'workspace:lib-a@*' },
      },
      workspacePackageNames
    );

    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('"a": "workspace:ghost-a@*"');
    expect(issues[1]).toContain('"b": "workspace:ghost-b@^1.0.0"');
  });

  it('should not report the malformed no-separator scoped form', () => {
    // workspace:@scope/pkg without @<range> is rejected by package managers
    // as malformed; it is not a missing-target alias, so it is not reported
    // here
    expect(
      findInvalidWorkspaceAliases(
        {
          name: 'app',
          version: '1.0.0',
          dependencies: { 'alias-name': 'workspace:@acme/ghost' },
        },
        workspacePackageNames
      )
    ).toEqual([]);
  });
});

describe('findClosePackageNames', () => {
  it('should return close candidates sorted by distance, scope preference, then lexically', () => {
    expect(
      findClosePackageNames(
        '@acme/utils',
        new Set(['@acme/utils2', '@other/utils', '@acme/util'])
      )
    ).toEqual(['@acme/util', '@acme/utils2']);
    // distance tie: the same-scope candidate ranks first
    expect(
      findClosePackageNames(
        '@acme/utils',
        new Set(['@bcme/utils', '@acme/utuls'])
      )
    ).toEqual(['@acme/utuls', '@bcme/utils']);
  });

  it('should cap results at three and honor the distance threshold', () => {
    const candidates = new Set(['aaa1', 'aaa2', 'aaa3', 'aaa4', 'zzzzz']);
    const result = findClosePackageNames('aaa0', candidates);
    expect(result).toHaveLength(3);
    expect(result).not.toContain('zzzzz');
  });
});
