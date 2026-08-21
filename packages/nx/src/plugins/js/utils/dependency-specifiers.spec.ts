import {
  getWorkspacePackageDependencies,
  matchDependencyToWorkspacePackage,
  parseDependencySpecifier,
} from './dependency-specifiers';

describe('parseDependencySpecifier', () => {
  it.each`
    rawSpecifier                          | protocol       | requestedPackageName | range
    ${'1.2.3'}                            | ${'plain'}     | ${null}              | ${'1.2.3'}
    ${'^1.2.3'}                           | ${'plain'}     | ${null}              | ${'^1.2.3'}
    ${'~1.2.3'}                           | ${'plain'}     | ${null}              | ${'~1.2.3'}
    ${'*'}                                | ${'plain'}     | ${null}              | ${'*'}
    ${'>=1.0.0 <2.0.0'}                   | ${'plain'}     | ${null}              | ${'>=1.0.0 <2.0.0'}
    ${'1.0.0-beta.1'}                     | ${'plain'}     | ${null}              | ${'1.0.0-beta.1'}
    ${'latest'}                           | ${'plain'}     | ${null}              | ${'latest'}
    ${''}                                 | ${'plain'}     | ${null}              | ${''}
    ${'workspace:*'}                      | ${'workspace'} | ${null}              | ${'*'}
    ${'workspace:^'}                      | ${'workspace'} | ${null}              | ${'^'}
    ${'workspace:~'}                      | ${'workspace'} | ${null}              | ${'~'}
    ${'workspace:1.2.3'}                  | ${'workspace'} | ${null}              | ${'1.2.3'}
    ${'workspace:^1.2.3'}                 | ${'workspace'} | ${null}              | ${'^1.2.3'}
    ${'workspace:foo@*'}                  | ${'workspace'} | ${'foo'}             | ${'*'}
    ${'workspace:foo@^1.2.3'}             | ${'workspace'} | ${'foo'}             | ${'^1.2.3'}
    ${'workspace:@scope/foo@*'}           | ${'workspace'} | ${'@scope/foo'}      | ${'*'}
    ${'workspace:@scope/foo@~2.0.0'}      | ${'workspace'} | ${'@scope/foo'}      | ${'~2.0.0'}
    ${'workspace:@scope/foo'}             | ${'workspace'} | ${'@scope/foo'}      | ${null}
    ${'workspace:@scope/foo@'}            | ${'workspace'} | ${'@scope/foo'}      | ${''}
    ${'workspace:foo@'}                   | ${'workspace'} | ${'foo'}             | ${''}
    ${'workspace:foo'}                    | ${'workspace'} | ${null}              | ${'foo'}
    ${'npm:foo'}                          | ${'npm'}       | ${'foo'}             | ${null}
    ${'npm:foo@1.2.3'}                    | ${'npm'}       | ${'foo'}             | ${'1.2.3'}
    ${'npm:foo@^1.2.3'}                   | ${'npm'}       | ${'foo'}             | ${'^1.2.3'}
    ${'npm:@scope/foo'}                   | ${'npm'}       | ${'@scope/foo'}      | ${null}
    ${'npm:@scope/foo@~2.0.0'}            | ${'npm'}       | ${'@scope/foo'}      | ${'~2.0.0'}
    ${'npm:@scope/foo@1.0.0-rc.1'}        | ${'npm'}       | ${'@scope/foo'}      | ${'1.0.0-rc.1'}
    ${'npm:foo@'}                         | ${'npm'}       | ${'foo'}             | ${''}
    ${' npm:foo@1.0.0'}                   | ${'plain'}     | ${null}              | ${' npm:foo@1.0.0'}
    ${'file:../foo'}                      | ${'file'}      | ${null}              | ${null}
    ${'file:./libs/foo'}                  | ${'file'}      | ${null}              | ${null}
    ${'catalog:'}                         | ${'other'}     | ${null}              | ${null}
    ${'catalog:react'}                    | ${'other'}     | ${null}              | ${null}
    ${'link:../foo'}                      | ${'other'}     | ${null}              | ${null}
    ${'portal:../foo'}                    | ${'other'}     | ${null}              | ${null}
    ${'patch:foo@1.2.3#patch.diff'}       | ${'other'}     | ${null}              | ${null}
    ${'git+ssh://git@github.com/u/r.git'} | ${'other'}     | ${null}              | ${null}
    ${'github:user/repo'}                 | ${'other'}     | ${null}              | ${null}
    ${'https://example.com/foo.tgz'}      | ${'other'}     | ${null}              | ${null}
  `(
    'should parse "$rawSpecifier" as $protocol / $requestedPackageName / $range',
    ({ rawSpecifier, protocol, requestedPackageName, range }) => {
      expect(parseDependencySpecifier(rawSpecifier)).toEqual({
        protocol,
        requestedPackageName,
        range,
      });
    }
  );
});

describe('matchDependencyToWorkspacePackage', () => {
  const versions: Record<string, string | null> = {
    foo: '1.2.3',
    '@scope/foo': '2.0.0',
    'no-version': null,
  };
  const getPackageVersion = (name: string) => versions[name];

  it.each`
    dependencyKey   | rawSpecifier                     | expected
    ${'foo'}        | ${'*'}                           | ${'foo'}
    ${'foo'}        | ${'1.2.3'}                       | ${'foo'}
    ${'foo'}        | ${'^1.0.0'}                      | ${'foo'}
    ${'foo'}        | ${'^2.0.0'}                      | ${null}
    ${'missing'}    | ${'*'}                           | ${null}
    ${'no-version'} | ${'*'}                           | ${'no-version'}
    ${'no-version'} | ${'^1.0.0'}                      | ${null}
    ${'foo'}        | ${'workspace:*'}                 | ${'foo'}
    ${'foo'}        | ${'workspace:^'}                 | ${'foo'}
    ${'foo'}        | ${'workspace:^9.0.0'}            | ${'foo'}
    ${'missing'}    | ${'workspace:*'}                 | ${null}
    ${'anything'}   | ${'workspace:foo@*'}             | ${'foo'}
    ${'anything'}   | ${'workspace:foo@^9.0.0'}        | ${'foo'}
    ${'anything'}   | ${'workspace:foo@'}              | ${'foo'}
    ${'anything'}   | ${'workspace:@scope/foo@~2.0.0'} | ${'@scope/foo'}
    ${'anything'}   | ${'workspace:@scope/foo@'}       | ${'@scope/foo'}
    ${'anything'}   | ${'workspace:@scope/foo'}        | ${null}
    ${'anything'}   | ${'workspace:ghost@*'}           | ${null}
    ${'anything'}   | ${'npm:foo'}                     | ${'foo'}
    ${'anything'}   | ${'npm:foo@*'}                   | ${'foo'}
    ${'anything'}   | ${'npm:foo@1.2.3'}               | ${'foo'}
    ${'anything'}   | ${'npm:foo@^1.0.0'}              | ${'foo'}
    ${'anything'}   | ${'npm:foo@^9.0.0'}              | ${null}
    ${'anything'}   | ${'npm:@scope/foo@^2.0.0'}       | ${'@scope/foo'}
    ${'anything'}   | ${'npm:ghost@*'}                 | ${null}
    ${'anything'}   | ${'npm:no-version@^1.0.0'}       | ${null}
    ${'anything'}   | ${'npm:no-version'}              | ${'no-version'}
    ${'foo'}        | ${'file:../foo'}                 | ${null}
    ${'foo'}        | ${'catalog:'}                    | ${null}
    ${'foo'}        | ${'1.0.0-beta.1 || ^1.2.0'}      | ${'foo'}
  `(
    'should resolve key=$dependencyKey specifier=$rawSpecifier to $expected',
    ({ dependencyKey, rawSpecifier, expected }) => {
      const result = matchDependencyToWorkspacePackage(
        dependencyKey,
        rawSpecifier,
        getPackageVersion
      );
      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toEqual({ requestedPackageName: expected });
      }
    }
  );
});

describe('getWorkspacePackageDependencies', () => {
  const versions: Record<string, string | null> = {
    'lib-a': '1.0.0',
    'lib-b': '2.0.0',
  };
  const getPackageVersion = (name: string) => versions[name];

  it('should collect matching entries across all dependency collections', () => {
    expect(
      getWorkspacePackageDependencies(
        {
          name: 'app',
          version: '1.0.0',
          dependencies: { 'lib-a': '^1.0.0' },
          devDependencies: { 'alias-b': 'workspace:lib-b@*' },
          optionalDependencies: { 'lib-b': 'workspace:*' },
          peerDependencies: { 'lib-a': 'npm:lib-b@^2.0.0' },
        },
        getPackageVersion
      )
    ).toEqual({
      dependencies: {
        'lib-a': { rawSpecifier: '^1.0.0', requestedPackageName: 'lib-a' },
      },
      devDependencies: {
        'alias-b': {
          rawSpecifier: 'workspace:lib-b@*',
          requestedPackageName: 'lib-b',
        },
      },
      optionalDependencies: {
        'lib-b': { rawSpecifier: 'workspace:*', requestedPackageName: 'lib-b' },
      },
      peerDependencies: {
        'lib-a': {
          rawSpecifier: 'npm:lib-b@^2.0.0',
          requestedPackageName: 'lib-b',
        },
      },
    });
  });

  it('should skip self references, non-string specifiers, and non-matching entries', () => {
    expect(
      getWorkspacePackageDependencies(
        {
          name: 'lib-a',
          version: '1.0.0',
          dependencies: {
            'lib-a': '^1.0.0',
            'self-alias': 'workspace:lib-a@*',
            'not-a-string': 42 as unknown as string,
            external: '^5.0.0',
            'lib-b': 'file:../lib-b',
          },
        },
        getPackageVersion
      )
    ).toBeUndefined();
  });
});
