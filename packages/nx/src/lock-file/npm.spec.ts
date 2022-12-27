import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
} from './npm';
import {
  lockFileV1,
  lockFileV1JustTypescript,
  lockFileV1YargsAndDevkitOnly,
  lockFileV2,
  lockFileV2JustTypescript,
  lockFileV2YargsAndDevkitOnly,
  lockFileV3,
  lockFileV3JustTypescript,
  lockFileV3YargsAndDevkitOnly,
  rxjsTslibLockFileV1,
  rxjsTslibLockFileV2,
  rxjsTslibLockFileV3,
  ssh2LockFileV1,
  ssh2LockFileV2,
  ssh2LockFileV3,
} from './__fixtures__/npm.lock';
import { vol } from 'memfs';
import { npmLockFileWithWorkspaces } from './__fixtures__/workspaces.lock';
import { joinPathFragments } from '../utils/path';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

const TypeScriptOnlyPackage = {
  name: 'test',
  version: '0.0.0',
  license: 'MIT',
  dependencies: { typescript: '4.8.4' },
};
const YargsAndDevkitPackage = {
  name: 'test',
  version: '0.0.0',
  license: 'MIT',
  dependencies: { '@nrwl/devkit': '15.0.13', yargs: '17.6.2' },
};
const Ssh2Package = {
  name: 'test',
  version: '0.0.0',
  license: 'ISC',
  dependencies: {
    ssh2: '1.11.0',
  },
};
const RxjsTslibPackage = {
  name: 'test',
  version: '0.0.0',
  license: 'MIT',
  dependencies: {
    rxjs: '^7.8.0',
    tslib: '^2.4.1',
  },
};

describe('npm LockFile utility', () => {
  xdescribe('npm repo pruning tests', () => {
    it('no args', () => {
      const packageJson = {
        name: 'test-npm-ls',
        version: '1.0.0',
        dependencies: {
          foo: '^1.0.0',
          chai: '^1.0.0',
        },
      };
      const lockFile = {
        lockfileVersion: 1,
        dependencies: {
          foo: {
            version: '1.0.0',
            requires: {
              dog: '^1.0.0',
            },
          },
          dog: {
            version: '1.0.0',
          },
          chai: {
            version: '1.0.0',
          },
        },
      };
      const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
      const result = pruneNpmLockFile(lockFileDate, packageJson);
      expect(JSON.parse(stringifyNpmLockFile(result))).toEqual({
        name: 'test-npm-ls',
        version: '1.0.0',
        lockfileVersion: 1,
        dependencies: {
          foo: {
            version: '1.0.0',
            overridden: false,
            dependencies: {
              dog: {
                version: '1.0.0',
                overridden: false,
              },
            },
          },
          chai: {
            version: '1.0.0',
            overridden: false,
          },
        },
      });
    });

    it('extraneous deps', () => {
      const packageJson = {
        name: 'test-npm-ls',
        version: '1.0.0',
        dependencies: {
          foo: '^1.0.0',
        },
      };
      const lockFile = {
        dependencies: {
          foo: {
            version: '1.0.0',
            requires: {
              dog: '^1.0.0',
            },
          },
          dog: {
            version: '1.0.0',
          },
          chai: {
            version: '1.0.0',
          },
        },
      };
      const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
      const result = pruneNpmLockFile(lockFileDate, packageJson);
      expect(JSON.parse(stringifyNpmLockFile(result))).toEqual({
        name: 'test-npm-ls',
        version: '1.0.0',
        dependencies: {
          foo: {
            version: '1.0.0',
            overridden: false,
            dependencies: {
              dog: {
                version: '1.0.0',
                overridden: false,
              },
            },
          },
        },
      });
    });

    it('missing deps --long', () => {
      // config.long = true
      const packageJson = {
        name: 'test-npm-ls',
        version: '1.0.0',
        dependencies: {
          foo: '^1.0.0',
          dog: '^1.0.0',
          chai: '^1.0.0',
          ipsum: '^1.0.0',
        },
      };
      const lockFile = {
        dependencies: {
          foo: {
            version: '1.0.0',
            requires: {
              dog: '^1.0.0',
            },
          },
          dog: {
            version: '1.0.0',
          },
          chai: {
            version: '1.0.0',
          },
          ipsum: {
            version: '1.0.0',
          },
        },
      };
      const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
      const result = pruneNpmLockFile(lockFileDate, packageJson);
      expect(JSON.parse(stringifyNpmLockFile(result))).toEqual({
        name: 'test-npm-ls',
        version: '1.0.0',
      });
      // config.long = false
    });

    // it('with filter arg', () => {
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //         ipsum: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //   })
    //   await ls.exec(['chai'])
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         chai: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //       },
    //     }
    //   )
    //   t.equal(process.exitCode, 0, 'should exit with error code 0')
    // })

    // it('with filter arg nested dep', () => {
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //         ipsum: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //   })
    //   await ls.exec(['dog'])
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           overridden: false,
    //           dependencies: {
    //             dog: {
    //               version: '1.0.0',
    //               overridden: false,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     'should output json contaning only occurrences of filtered by package'
    //   )
    // })

    // it('with multiple filter args', () => {
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //         ipsum: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //         ipsum: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //   })
    //   await ls.exec(['dog@*', 'chai@1.0.0'])
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       version: '1.0.0',
    //       name: 'test-npm-ls',
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           overridden: false,
    //           dependencies: {
    //             dog: {
    //               version: '1.0.0',
    //               overridden: false,
    //             },
    //           },
    //         },
    //         chai: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //       },
    //     },
    //     /* eslint-disable-next-line max-len */
    //     'should output json contaning only occurrences of multiple filtered packages and their ancestors'
    //   )
    // })

    // it('with missing filter arg', () => {
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //   })
    //   await ls.exec(['notadep'])
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //     },
    //     'should output json containing no dependencies info'
    //   )
    //   t.equal(process.exitCode, 1, 'should exit with error code 1')
    //   process.exitCode = 0
    // })

    // it('default --depth value should now be 0', () => {
    //   config.all = false
    //   config.depth = undefined
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //         const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
    // const result = pruneNpmLockFile(lockFileDate, packageJson);
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //         chai: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //       },
    //     },
    //     'should output json containing only top-level dependencies'
    //   )
    //   config.all = true
    //   config.depth = Infinity
    // })

    // it('--depth=0', () => {
    //   config.all = false
    //   config.depth = 0
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //         const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
    // const result = pruneNpmLockFile(lockFileDate, packageJson);
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //         chai: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //       },
    //     },
    //     'should output json containing only top-level dependencies'
    //   )
    //   config.all = true
    //   config.depth = Infinity
    // })

    // it('--depth=1', () => {
    //   config.all = false
    //   config.depth = 1
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^1.0.0',
    //         chai: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //         const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
    // const result = pruneNpmLockFile(lockFileDate, packageJson);
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           overridden: false,
    //           dependencies: {
    //             dog: {
    //               version: '1.0.0',
    //               overridden: false,
    //             },
    //           },
    //         },
    //         chai: {
    //           version: '1.0.0',
    //           overridden: false,
    //         },
    //       },
    //     },
    //     'should output json containing top-level deps and their deps only'
    //   )
    //   config.all = true
    //   config.depth = Infinity
    // })

    // it('missing/invalid/extraneous', () => {
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         foo: '^2.0.0',
    //         ipsum: '^1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           requires: {
    //             dog: '^1.0.0',
    //           },
    //         },
    //         dog: {
    //           version: '1.0.0',
    //         },
    //         chai: {
    //           version: '1.0.0',
    //         },
    //       },
    //     }),
    //   })
    //   await t.rejects(ls.exec([]), { code: 'ELSPROBLEMS' }, 'should list dep problems')
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       problems: [
    //         /* eslint-disable-next-line max-len */
    //         'invalid: foo@1.0.0 {CWD}/tap-testdir-ls-ls---package-lock-only-ls---package-lock-only---json-missing-invalid-extraneous/node_modules/foo',
    //         'missing: ipsum@^1.0.0, required by test-npm-ls@1.0.0',
    //       ],
    //       dependencies: {
    //         foo: {
    //           version: '1.0.0',
    //           overridden: false,
    //           invalid: '"^2.0.0" from the root project',
    //           problems: [
    //             /* eslint-disable-next-line max-len */
    //             'invalid: foo@1.0.0 {CWD}/tap-testdir-ls-ls---package-lock-only-ls---package-lock-only---json-missing-invalid-extraneous/node_modules/foo',
    //           ],
    //           dependencies: {
    //             dog: {
    //               version: '1.0.0',
    //               overridden: false,
    //             },
    //           },
    //         },
    //         ipsum: {
    //           required: '^1.0.0',
    //           missing: true,
    //           problems: ['missing: ipsum@^1.0.0, required by test-npm-ls@1.0.0'],
    //         },
    //       },
    //     },
    //     'should output json containing top-level deps and their deps only'
    //   )
    // })

    // it('from lockfile', () => {
    //   npm.prefix = t.testdir({
    //     'package-lock.json': JSON.stringify({
    //       name: 'dedupe-lockfile',
    //       version: '1.0.0',
    //       lockfileVersion: 2,
    //       requires: true,
    //       packages: {
    //         '': {
    //           name: 'dedupe-lockfile',
    //           version: '1.0.0',
    //           dependencies: {
    //             '@isaacs/dedupe-tests-a': '1.0.1',
    //             '@isaacs/dedupe-tests-b': '1||2',
    //           },
    //         },
    //         'node_modules/@isaacs/dedupe-tests-a': {
    //           name: '@isaacs/dedupe-tests-a',
    //           version: '1.0.1',
    //           /* eslint-disable-next-line max-len */
    //           resolved: 'https://registry.npmjs.org/@isaacs/dedupe-tests-a/-/dedupe-tests-a-1.0.1.tgz',
    //           /* eslint-disable-next-line max-len */
    //           integrity: 'sha512-8AN9lNCcBt5Xeje7fMEEpp5K3rgcAzIpTtAjYb/YMUYu8SbIVF6wz0WqACDVKvpQOUcSfNHZQNLNmue0QSwXOQ==',
    //           dependencies: {
    //             '@isaacs/dedupe-tests-b': '1',
    //           },
    //         },
    //         'node_modules/@isaacs/dedupe-tests-a/node_modules/@isaacs/dedupe-tests-b': {
    //           name: '@isaacs/dedupe-tests-b',
    //           version: '1.0.0',
    //           /* eslint-disable-next-line max-len */
    //           resolved: 'https://registry.npmjs.org/@isaacs/dedupe-tests-b/-/dedupe-tests-b-1.0.0.tgz',
    //           /* eslint-disable-next-line max-len */
    //           integrity: 'sha512-3nmvzIb8QL8OXODzipwoV3U8h9OQD9g9RwOPuSBQqjqSg9JZR1CCFOWNsDUtOfmwY8HFUJV9EAZ124uhqVxq+w==',
    //         },
    //         'node_modules/@isaacs/dedupe-tests-b': {
    //           name: '@isaacs/dedupe-tests-b',
    //           version: '2.0.0',
    //           /* eslint-disable-next-line max-len */
    //           resolved: 'https://registry.npmjs.org/@isaacs/dedupe-tests-b/-/dedupe-tests-b-2.0.0.tgz',
    //           /* eslint-disable-next-line max-len */
    //           integrity: 'sha512-KTYkpRv9EzlmCg4Gsm/jpclWmRYFCXow8GZKJXjK08sIZBlElTZEa5Bw/UQxIvEfcKmWXczSqItD49Kr8Ax4UA==',
    //         },
    //       },
    //       dependencies: {
    //         '@isaacs/dedupe-tests-a': {
    //           version: '1.0.1',
    //           /* eslint-disable-next-line max-len */
    //           resolved: 'https://registry.npmjs.org/@isaacs/dedupe-tests-a/-/dedupe-tests-a-1.0.1.tgz',
    //           /* eslint-disable-next-line max-len */
    //           integrity: 'sha512-8AN9lNCcBt5Xeje7fMEEpp5K3rgcAzIpTtAjYb/YMUYu8SbIVF6wz0WqACDVKvpQOUcSfNHZQNLNmue0QSwXOQ==',
    //           requires: {
    //             '@isaacs/dedupe-tests-b': '1',
    //           },
    //           dependencies: {
    //             '@isaacs/dedupe-tests-b': {
    //               version: '1.0.0',
    //               /* eslint-disable-next-line max-len */
    //               resolved: 'https://registry.npmjs.org/@isaacs/dedupe-tests-b/-/dedupe-tests-b-1.0.0.tgz',
    //               /* eslint-disable-next-line max-len */
    //               integrity: 'sha512-3nmvzIb8QL8OXODzipwoV3U8h9OQD9g9RwOPuSBQqjqSg9JZR1CCFOWNsDUtOfmwY8HFUJV9EAZ124uhqVxq+w==',
    //             },
    //           },
    //         },
    //         '@isaacs/dedupe-tests-b': {
    //           version: '2.0.0',
    //           /* eslint-disable-next-line max-len */
    //           resolved: 'https://registry.npmjs.org/@isaacs/dedupe-tests-b/-/dedupe-tests-b-2.0.0.tgz',
    //           /* eslint-disable-next-line max-len */
    //           integrity: 'sha512-KTYkpRv9EzlmCg4Gsm/jpclWmRYFCXow8GZKJXjK08sIZBlElTZEa5Bw/UQxIvEfcKmWXczSqItD49Kr8Ax4UA==',
    //         },
    //       },
    //     }),
    //     'package.json': JSON.stringify({
    //       name: 'dedupe-lockfile',
    //       version: '1.0.0',
    //       dependencies: {
    //         '@isaacs/dedupe-tests-a': '1.0.1',
    //         '@isaacs/dedupe-tests-b': '1||2',
    //       },
    //     }),
    //         const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
    // const result = pruneNpmLockFile(lockFileDate, packageJson);
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       version: '1.0.0',
    //       name: 'dedupe-lockfile',
    //       dependencies: {
    //         '@isaacs/dedupe-tests-a': {
    //           version: '1.0.1',
    //           overridden: false,
    //           resolved:
    //             'https://registry.npmjs.org/@isaacs/dedupe-tests-a/-/dedupe-tests-a-1.0.1.tgz',
    //           dependencies: {
    //             '@isaacs/dedupe-tests-b': {
    //               version: '1.0.0',
    //               overridden: false,
    //               resolved:
    //                 'https://registry.npmjs.org/@isaacs/dedupe-tests-b/-/dedupe-tests-b-1.0.0.tgz',
    //             },
    //           },
    //         },
    //         '@isaacs/dedupe-tests-b': {
    //           version: '2.0.0',
    //           overridden: false,
    //           resolved:
    //             'https://registry.npmjs.org/@isaacs/dedupe-tests-b/-/dedupe-tests-b-2.0.0.tgz',
    //         },
    //       },
    //     },
    //     'should output json containing only prod deps'
    //   )
    // })

    // it('using aliases', () => {
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         a: 'npm:b@1.0.0',
    //       },
    //     const lockFile = {
    //       dependencies: {
    //         a: {
    //           version: 'npm:b@1.0.0',
    //           resolved: 'https://localhost:8080/abbrev/-/abbrev-1.0.0.tgz',
    //         },
    //       },
    //     }),
    //         const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
    // const result = pruneNpmLockFile(lockFileDate, packageJson);
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         a: {
    //           version: '1.0.0',
    //           overridden: false,
    //           resolved: 'https://localhost:8080/abbrev/-/abbrev-1.0.0.tgz',
    //         },
    //       },
    //     },
    //     'should output json containing aliases'
    //   )
    // })

    // it('resolved points to git ref', () => {
    //   config.long = false
    //   const packageJson = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         abbrev: 'git+https://github.com/isaacs/abbrev-js.git',
    //       },
    //     const lockFile = {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       lockfileVersion: 2,
    //       requires: true,
    //       dependencies: {
    //         abbrev: {
    //           /* eslint-disable-next-line max-len */
    //           version: 'git+ssh://git@github.com/isaacs/abbrev-js.git#b8f3a2fc0c3bb8ffd8b0d0072cc6b5a3667e963c',
    //           from: 'abbrev@git+https://github.com/isaacs/abbrev-js.git',
    //         },
    //       },
    //     }),
    //         const lockFileDate = parseNpmLockFile(JSON.stringify(lockFile));
    // const result = pruneNpmLockFile(lockFileDate, packageJson);
    // expect(JSON.parse(stringifyNpmLockFile(result))).toEqual(
    //     {
    //       name: 'test-npm-ls',
    //       version: '1.0.0',
    //       dependencies: {
    //         abbrev: {
    //           /* eslint-disable-next-line max-len */
    //           resolved: 'git+ssh://git@github.com/isaacs/abbrev-js.git#b8f3a2fc0c3bb8ffd8b0d0072cc6b5a3667e963c',
    //           overridden: false,
    //         },
    //       },
    //     },
    //     'should output json containing git refs'
    //   )
    // })
  });

  describe('v3', () => {
    const parsedLockFile = parseNpmLockFile(lockFileV3);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        metadata: {
          lockfileVersion: 3,
          name: 'test',
          requires: true,
          version: '0.0.0',
        },
        rootPackage: {
          devDependencies: {
            '@nrwl/cli': '15.0.13',
            '@nrwl/workspace': '15.0.13',
            nx: '15.0.13',
            prettier: '^2.6.2',
            typescript: '~4.8.2',
          },
          license: 'MIT',
          name: 'test',
          version: '0.0.0',
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript']).toMatchSnapshot();
    });

    it('should map various versions of packages', () => {
      expect(
        Object.keys(parsedLockFile.dependencies['@jridgewell/gen-mapping'])
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ]
      ).toBeDefined();
      // This is opposite from yarn and pnpm
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ].rootVersion
      ).toBeTruthy();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ].rootVersion
      ).toBeFalsy();
    });

    it('should map various instances of the same version', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-resolve']['jest-resolve@28.1.3'];
      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).path).toEqual(
        'node_modules/jest-runner/node_modules/jest-resolve'
      );
      expect((jestResolveDependency.packageMeta[1] as any).path).toEqual(
        'node_modules/jest-runtime/node_modules/jest-resolve'
      );
    });

    it('should map optional field', () => {
      const tsDependency =
        parsedLockFile.dependencies['typescript']['typescript@4.8.4'];
      expect((tsDependency.packageMeta[0] as any).optional).toBeFalsy();
      const fsEventsDependency =
        parsedLockFile.dependencies['fsevents']['fsevents@2.3.2'];
      expect((fsEventsDependency.packageMeta[0] as any).optional).toBeTruthy();
    });

    it('should match the original file on stringification', () => {
      expect(JSON.parse(stringifyNpmLockFile(parsedLockFile))).toEqual(
        JSON.parse(lockFileV3)
      );
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        JSON.parse(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
          )
        )
      ).toEqual(JSON.parse(lockFileV3JustTypescript));
    });

    it('should correctly prune lockfile with multiple packages', () => {
      expect(
        JSON.parse(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage)
          )
        )
      ).toEqual(JSON.parse(lockFileV3YargsAndDevkitOnly));
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(parseNpmLockFile(ssh2LockFileV3), Ssh2Package)
        )
      ).toEqual(ssh2LockFileV3);
    });

    it('should correctly prune lockfile with packages in multiple versions', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(
            parseNpmLockFile(rxjsTslibLockFileV3),
            RxjsTslibPackage
          )
        )
      ).toEqual(rxjsTslibLockFileV3);
    });
  });

  describe('v2', () => {
    const parsedLockFile = parseNpmLockFile(lockFileV2);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        metadata: {
          lockfileVersion: 2,
          name: 'test',
          requires: true,
          version: '0.0.0',
        },
        rootPackage: {
          devDependencies: {
            '@nrwl/cli': '15.0.13',
            '@nrwl/workspace': '15.0.13',
            nx: '15.0.13',
            prettier: '^2.6.2',
            typescript: '~4.8.2',
          },
          license: 'MIT',
          name: 'test',
          version: '0.0.0',
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript']).toMatchSnapshot();
    });

    it('should parse lockfile with workspaces correctly', () => {
      const parsedWorkspaceLockFile = parseNpmLockFile(
        npmLockFileWithWorkspaces
      );
      expect(JSON.parse(stringifyNpmLockFile(parsedWorkspaceLockFile))).toEqual(
        JSON.parse(npmLockFileWithWorkspaces)
      );
    });

    it('should map various versions of packages', () => {
      expect(
        Object.keys(parsedLockFile.dependencies['@jridgewell/gen-mapping'])
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ]
      ).toBeDefined();
      // This is opposite from yarn and pnpm
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ].rootVersion
      ).toBeTruthy();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ].rootVersion
      ).toBeFalsy();
    });

    it('should map various instances of the same version', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-resolve']['jest-resolve@28.1.3'];
      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).path).toEqual(
        'node_modules/jest-runner/node_modules/jest-resolve'
      );
      expect((jestResolveDependency.packageMeta[1] as any).path).toEqual(
        'node_modules/jest-runtime/node_modules/jest-resolve'
      );
    });

    it('should map optional field', () => {
      const tsDependency =
        parsedLockFile.dependencies['typescript']['typescript@4.8.4'];
      expect((tsDependency.packageMeta[0] as any).optional).toBeFalsy();
      const fsEventsDependency =
        parsedLockFile.dependencies['fsevents']['fsevents@2.3.2'];
      expect((fsEventsDependency.packageMeta[0] as any).optional).toBeTruthy();
    });

    it('should match the original file on stringification', () => {
      expect(JSON.parse(stringifyNpmLockFile(parsedLockFile))).toEqual(
        JSON.parse(lockFileV2)
      );
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        JSON.parse(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
          )
        )
      ).toEqual(JSON.parse(lockFileV2JustTypescript));
    });

    it('should correctly prune lockfile with multiple packages', () => {
      const pruned = pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage);
      expect(JSON.parse(stringifyNpmLockFile(pruned))).toEqual(
        JSON.parse(lockFileV2YargsAndDevkitOnly)
      );
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(parseNpmLockFile(ssh2LockFileV2), Ssh2Package)
        )
      ).toEqual(ssh2LockFileV2);
    });

    it('should correctly prune lockfile with packages in multiple versions', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(
            parseNpmLockFile(rxjsTslibLockFileV2),
            RxjsTslibPackage
          )
        )
      ).toEqual(rxjsTslibLockFileV2);
    });
  });

  describe('v1', () => {
    const parsedLockFile = parseNpmLockFile(lockFileV1);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        metadata: {
          lockfileVersion: 1,
          name: 'test',
          requires: true,
          version: '0.0.0',
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript']).toMatchSnapshot();
    });

    it('should map various versions of packages', () => {
      expect(
        Object.keys(parsedLockFile.dependencies['@jridgewell/gen-mapping'])
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ]
      ).toBeDefined();
      // This is opposite from yarn and pnpm
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ].rootVersion
      ).toBeTruthy();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ].rootVersion
      ).toBeFalsy();
    });

    it('should map various instances of the same version', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-resolve']['jest-resolve@28.1.3'];
      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).path).toEqual(
        'node_modules/jest-runner/node_modules/jest-resolve'
      );
      expect((jestResolveDependency.packageMeta[1] as any).path).toEqual(
        'node_modules/jest-runtime/node_modules/jest-resolve'
      );
    });

    it('should map optional field', () => {
      const tsDependency =
        parsedLockFile.dependencies['typescript']['typescript@4.8.4'];
      expect((tsDependency.packageMeta[0] as any).optional).toBeFalsy();
      const fsEventsDependency =
        parsedLockFile.dependencies['fsevents']['fsevents@2.3.2'];
      expect((fsEventsDependency.packageMeta[0] as any).optional).toBeTruthy();
    });

    it('should match the original file on stringification', () => {
      expect(JSON.parse(stringifyNpmLockFile(parsedLockFile))).toEqual(
        JSON.parse(lockFileV1)
      );
    });

    describe('pruning', () => {
      beforeAll(() => {
        const v2packages = JSON.parse(lockFileV2).packages;
        const fileSys = {};
        // map all v2 packages to the file system
        Object.keys(v2packages).forEach((key) => {
          if (key) {
            fileSys[`/root/${key}/package.json`] = JSON.stringify(
              v2packages[key]
            );
          }
        });
        vol.fromJSON(fileSys, '/root');
      });

      it('should prune the lock file', () => {
        expect(
          Object.keys(
            pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
          ).length
        ).toEqual(1);
        expect(
          Object.keys(
            pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
          ).length
        ).toEqual(136);
      });

      it('should correctly prune lockfile with single package', () => {
        expect(
          JSON.parse(
            stringifyNpmLockFile(
              pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
            )
          )
        ).toEqual(JSON.parse(lockFileV1JustTypescript));
      });

      it('should correctly prune lockfile with multiple packages', () => {
        const pruned = pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage);
        expect(JSON.parse(stringifyNpmLockFile(pruned))).toEqual(
          JSON.parse(lockFileV1YargsAndDevkitOnly)
        );
      });

      it('should correctly prune lockfile with package that has optional dependencies', () => {
        expect(
          stringifyNpmLockFile(
            pruneNpmLockFile(parseNpmLockFile(ssh2LockFileV1), Ssh2Package)
          )
        ).toEqual(ssh2LockFileV1);
      });

      it('should correctly prune lockfile with packages in multiple versions', () => {
        expect(
          stringifyNpmLockFile(
            pruneNpmLockFile(
              parseNpmLockFile(rxjsTslibLockFileV1),
              RxjsTslibPackage
            )
          )
        ).toEqual(rxjsTslibLockFileV1);
      });
    });
  });

  xdescribe('next.js generated', () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package-lock.json'
    ));
    const projectPackageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/app/package.json'
    ));

    it('should prune the lockfile correctly', () => {
      const parsedLockFile = parseNpmLockFile(JSON.stringify(rootLockFile));
      const prunedLockFile = pruneNpmLockFile(
        parsedLockFile,
        projectPackageJson
      );
      const expectedLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/app/package-lock.json'
      ));
      expect(JSON.parse(stringifyNpmLockFile(prunedLockFile))).toEqual(
        expectedLockFile
      );
    });
  });
});
