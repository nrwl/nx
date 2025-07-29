import { vol } from 'memfs';
import type { ProjectGraph } from '../../../config/project-graph';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import type { NormalizedPackageJson } from './utils/package-json';
import { aliasDependenciesBunLock } from './__fixtures__/bun/alias-dependencies.bun.lock';
import { auxiliaryPackagesBunLock } from './__fixtures__/bun/auxiliary-packages.bun.lock';
import { basicDependenciesBunLock } from './__fixtures__/bun/basic-dependencies.bun.lock';
import { complexScenariosLockFile } from './__fixtures__/bun/complex-scenarios.bun.lock';
import { enhancedFeaturesBunLock } from './__fixtures__/bun/enhanced-features.bun.lock';
import { fileDependenciesLockFile } from './__fixtures__/bun/file-dependencies.bun.lock';
import { gitDependenciesLockFile } from './__fixtures__/bun/git-dependencies.bun.lock';
import { hoistedAndNestedBunLock } from './__fixtures__/bun/hoisted-and-nested.bun.lock';
import { largeProjectBunLock } from './__fixtures__/bun/large-project.bun.lock';
import { nextjsAppBunLock } from './__fixtures__/bun/nextjs-app.bun.lock';
import { peerDependenciesMetaLockFile } from './__fixtures__/bun/peer-dependencies-meta.bun.lock';
import { scopedPackagesBunLock } from './__fixtures__/bun/scoped-packages.bun.lock';
import { tarballDependenciesLockFile } from './__fixtures__/bun/tarball-dependencies.bun.lock';
import { versionResolutionLockFile } from './__fixtures__/bun/version-resolution.bun.lock';
import { workspaceDependenciesBunLock } from './__fixtures__/bun/workspace-dependencies.bun.lock';
import {
  clearCache,
  getBunTextLockfileDependencies,
  getBunTextLockfileNodes,
  stringifyBunLockfile,
} from './bun-parser';

jest.mock('node:fs', () => {
  const memFs = require('memfs').fs;
  return {
    ...memFs,
    existsSync: (p) => (p.endsWith('.node') ? true : memFs.existsSync(p)),
  };
});

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

jest.mock('../../../hasher/file-hasher', () => ({
  hashArray: (values: string[]) => values.join('|'),
}));

const BASIC_LOCK_FILE_HASH = 'hash123';
const VERSION_LOCK_FILE_HASH = 'version-hash';
const PEER_LOCK_FILE_HASH = 'peer-hash';
const ENHANCED_LOCK_FILE_HASH = 'enhanced-hash';
const ALIAS_LOCK_FILE_HASH = 'alias-hash';
const HOISTED_NESTED_LOCK_FILE_HASH = 'hoisted-nested-hash';

describe('Bun Parser', () => {
  beforeEach(() => {
    clearCache();
    vol.fromJSON({
      '/root/bun.lock': 'fake lockfile content',
      '/root/packages/app/bun.lock': 'fake lockfile content',
      '/root/packages/shared/bun.lock': 'fake lockfile content',
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('getBunLockfileNodes', () => {
    it('should handle workspace packages with 1-element tuples', () => {
      const lockFileContent = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            name: 'test-workspace',
            dependencies: {
              'workspace-pkg': 'workspace:apps/workspace-pkg',
            },
          },
        },
        packages: {
          'workspace-pkg': ['workspace-pkg@workspace:apps/workspace-pkg'],
        },
      });

      const nodes = getBunTextLockfileNodes(lockFileContent, 'test-hash');

      // Workspace packages should be filtered out, so nodes should be empty
      expect(Object.keys(nodes)).toHaveLength(0);
    });

    it('should handle file packages with 2-element tuples', () => {
      const lockFileContent = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            name: 'test-workspace',
            dependencies: {
              'local-pkg': 'file:./local-package',
            },
          },
        },
        packages: {
          'local-pkg': [
            'local-pkg@file:./local-package',
            { dependencies: { lodash: '^4.17.21' } },
          ],
        },
      });

      const nodes = getBunTextLockfileNodes(lockFileContent, 'test-hash');

      // File dependencies should be filtered out as they represent workspace packages
      expect(Object.keys(nodes)).toHaveLength(0);
    });

    it('should handle git packages with 3-element tuples', () => {
      const lockFileContent = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            name: 'test-workspace',
            dependencies: {
              'git-pkg': 'git:https://github.com/user/repo.git#abc123',
            },
          },
        },
        packages: {
          'git-pkg': [
            'git-pkg@git:https://github.com/user/repo.git#abc123',
            { dependencies: { lodash: '^4.17.21' } },
            'abc123',
          ],
        },
      });

      const nodes = getBunTextLockfileNodes(lockFileContent, 'test-hash');

      expect(
        nodes['npm:git-pkg@git:https://github.com/user/repo.git#abc123']
      ).toBeDefined();
      expect(
        nodes['npm:git-pkg@git:https://github.com/user/repo.git#abc123'].data
          .version
      ).toBe('git:https://github.com/user/repo.git#abc123');
    });

    it('should handle npm packages with 4-element tuples', () => {
      const lockFileContent = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            name: 'test-workspace',
            dependencies: {
              'npm-pkg': '^1.0.0',
            },
          },
        },
        packages: {
          'npm-pkg': [
            'npm-pkg@npm:1.0.0',
            'https://registry.npmjs.org/npm-pkg/-/npm-pkg-1.0.0.tgz',
            { dependencies: { lodash: '^4.17.21' } },
            'sha512-abcdef123456',
          ],
        },
      });

      const nodes = getBunTextLockfileNodes(lockFileContent, 'test-hash');

      expect(nodes['npm:npm-pkg@1.0.0']).toBeDefined();
      expect(nodes['npm:npm-pkg@1.0.0'].data.version).toBe('1.0.0');
      expect(nodes['npm:npm-pkg@1.0.0'].data.hash).toBe('sha512-abcdef123456');
    });

    it('should handle mixed tuple lengths in same lockfile', () => {
      const lockFileContent = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            name: 'test-workspace',
            dependencies: {
              'workspace-pkg': 'workspace:apps/workspace-pkg',
              'file-pkg': 'file:./local-package',
              'git-pkg': 'git:https://github.com/user/repo.git#abc123',
              'npm-pkg': '^1.0.0',
            },
          },
        },
        packages: {
          'workspace-pkg': ['workspace-pkg@workspace:apps/workspace-pkg'],
          'file-pkg': [
            'file-pkg@file:./local-package',
            { dependencies: { lodash: '^4.17.21' } },
          ],
          'git-pkg': [
            'git-pkg@git:https://github.com/user/repo.git#abc123',
            { dependencies: { lodash: '^4.17.21' } },
            'abc123',
          ],
          'npm-pkg': [
            'npm-pkg@npm:1.0.0',
            'https://registry.npmjs.org/npm-pkg/-/npm-pkg-1.0.0.tgz',
            { dependencies: { lodash: '^4.17.21' } },
            'sha512-abcdef123456',
          ],
        },
      });

      const nodes = getBunTextLockfileNodes(lockFileContent, 'test-hash');

      // Should only have non-workspace packages (file dependencies are filtered out)
      // Now includes hoisted nodes for packages that appear in workspace dependencies
      expect(Object.keys(nodes)).toHaveLength(4);
      expect(
        nodes['npm:git-pkg@git:https://github.com/user/repo.git#abc123']
      ).toBeDefined();
      expect(nodes['npm:npm-pkg@1.0.0']).toBeDefined();
      // Should also have hoisted nodes
      expect(nodes['npm:git-pkg']).toBeDefined();
      expect(nodes['npm:npm-pkg']).toBeDefined();
    });

    it('should parse basic dependencies', () => {
      const result = getBunTextLockfileNodes(
        basicDependenciesBunLock,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({
        'npm:js-tokens@4.0.0': {
          type: 'npm',
          name: 'npm:js-tokens@4.0.0',
          data: {
            version: '4.0.0',
            packageName: 'js-tokens',
            hash: 'sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==',
          },
        },
        'npm:lodash@4.17.21': {
          type: 'npm',
          name: 'npm:lodash@4.17.21',
          data: {
            version: '4.17.21',
            packageName: 'lodash',
            hash: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
          },
        },
        'npm:loose-envify@1.4.0': {
          type: 'npm',
          name: 'npm:loose-envify@1.4.0',
          data: {
            version: '1.4.0',
            packageName: 'loose-envify',
            hash: 'sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q==',
          },
        },
        'npm:react@18.2.0': {
          type: 'npm',
          name: 'npm:react@18.2.0',
          data: {
            version: '18.2.0',
            packageName: 'react',
            hash: 'sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ==',
          },
        },
        'npm:typescript@5.0.2': {
          type: 'npm',
          name: 'npm:typescript@5.0.2',
          data: {
            version: '5.0.2',
            packageName: 'typescript',
            hash: 'sha512-wVORMBGO/FAs/++blGNeAVdbNKtIh1rbBL2EyQ1+J9lClJ93KiiKe8PmFIVdXhHcyv44SL9oglmfeSsndo0jRw==',
          },
        },
        // Hoisted nodes for packages with direct entries or workspace dependencies
        'npm:js-tokens': {
          type: 'npm',
          name: 'npm:js-tokens',
          data: {
            version: '4.0.0',
            packageName: 'js-tokens',
            hash: 'sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==',
          },
        },
        'npm:lodash': {
          type: 'npm',
          name: 'npm:lodash',
          data: {
            version: '4.17.21',
            packageName: 'lodash',
            hash: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
          },
        },
        'npm:loose-envify': {
          type: 'npm',
          name: 'npm:loose-envify',
          data: {
            version: '1.4.0',
            packageName: 'loose-envify',
            hash: 'sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q==',
          },
        },
        'npm:react': {
          type: 'npm',
          name: 'npm:react',
          data: {
            version: '18.2.0',
            packageName: 'react',
            hash: 'sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ==',
          },
        },
        'npm:typescript': {
          type: 'npm',
          name: 'npm:typescript',
          data: {
            version: '5.0.2',
            packageName: 'typescript',
            hash: 'sha512-wVORMBGO/FAs/++blGNeAVdbNKtIh1rbBL2EyQ1+J9lClJ93KiiKe8PmFIVdXhHcyv44SL9oglmfeSsndo0jRw==',
          },
        },
      });
    });

    it('should handle scoped packages', () => {
      const result = getBunTextLockfileNodes(
        scopedPackagesBunLock,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({
        'npm:@types/node@20.19.8': {
          type: 'npm',
          name: 'npm:@types/node@20.19.8',
          data: {
            version: '20.19.8',
            packageName: '@types/node',
            hash: 'sha512-HzbgCY53T6bfu4tT7Aq3TvViJyHjLjPNaAS3HOuMc9pw97KHsUtXNX4L+wu59g1WnjsZSko35MbEqnO58rihhw==',
          },
        },
        'npm:@humanwhocodes/config-array@0.11.14': {
          type: 'npm',
          name: 'npm:@humanwhocodes/config-array@0.11.14',
          data: {
            version: '0.11.14',
            packageName: '@humanwhocodes/config-array',
            hash: 'sha512-3T8LkOmg45BV5FICb15QQMsyUSWrQ8AygVfC7ZG32zOalnqrilm018ZVCw0eapXux8FtA33q8PSRSstjee3jSg==',
          },
        },
        'npm:@sindresorhus/is@4.6.0': {
          type: 'npm',
          name: 'npm:@sindresorhus/is@4.6.0',
          data: {
            version: '4.6.0',
            packageName: '@sindresorhus/is',
            hash: 'sha512-t09vSN3MdfsyCHoFcTRCH/iUtG7OJ0CsjzB8cjAmKc/va/kIgeDI/TxsigdncE/4be734m0cvIYwNaV4i2XqAw==',
          },
        },
        'npm:@humanwhocodes/object-schema@2.0.3': {
          type: 'npm',
          name: 'npm:@humanwhocodes/object-schema@2.0.3',
          data: {
            version: '2.0.3',
            packageName: '@humanwhocodes/object-schema',
            hash: 'sha512-93zYdMES/c1D69yZiKDBj0V24vqNzB/koF26KPaagAfd3P/4gUlh3Dys5ogAK+Exi9QyzlD8x/08Zt7wIKcDcA==',
          },
        },
        'npm:undici-types@6.21.0': {
          type: 'npm',
          name: 'npm:undici-types@6.21.0',
          data: {
            version: '6.21.0',
            packageName: 'undici-types',
            hash: 'sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==',
          },
        },
        'npm:debug@4.4.1': {
          type: 'npm',
          name: 'npm:debug@4.4.1',
          data: {
            version: '4.4.1',
            packageName: 'debug',
            hash: 'sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==',
          },
        },
        'npm:minimatch@3.1.2': {
          type: 'npm',
          name: 'npm:minimatch@3.1.2',
          data: {
            version: '3.1.2',
            packageName: 'minimatch',
            hash: 'sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==',
          },
        },
        'npm:ms@2.1.3': {
          type: 'npm',
          name: 'npm:ms@2.1.3',
          data: {
            version: '2.1.3',
            packageName: 'ms',
            hash: 'sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==',
          },
        },
        'npm:balanced-match@1.0.2': {
          type: 'npm',
          name: 'npm:balanced-match@1.0.2',
          data: {
            version: '1.0.2',
            packageName: 'balanced-match',
            hash: 'sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==',
          },
        },
        'npm:brace-expansion@1.1.12': {
          type: 'npm',
          name: 'npm:brace-expansion@1.1.12',
          data: {
            version: '1.1.12',
            packageName: 'brace-expansion',
            hash: 'sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==',
          },
        },
        'npm:concat-map@0.0.1': {
          type: 'npm',
          name: 'npm:concat-map@0.0.1',
          data: {
            version: '0.0.1',
            packageName: 'concat-map',
            hash: 'sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==',
          },
        },
        // Hoisted nodes for packages that appear in workspace dependencies
        'npm:@types/node': {
          type: 'npm',
          name: 'npm:@types/node',
          data: {
            version: '20.19.8',
            packageName: '@types/node',
            hash: 'sha512-HzbgCY53T6bfu4tT7Aq3TvViJyHjLjPNaAS3HOuMc9pw97KHsUtXNX4L+wu59g1WnjsZSko35MbEqnO58rihhw==',
          },
        },
        'npm:@humanwhocodes/config-array': {
          type: 'npm',
          name: 'npm:@humanwhocodes/config-array',
          data: {
            version: '0.11.14',
            packageName: '@humanwhocodes/config-array',
            hash: 'sha512-3T8LkOmg45BV5FICb15QQMsyUSWrQ8AygVfC7ZG32zOalnqrilm018ZVCw0eapXux8FtA33q8PSRSstjee3jSg==',
          },
        },
        'npm:@sindresorhus/is': {
          type: 'npm',
          name: 'npm:@sindresorhus/is',
          data: {
            version: '4.6.0',
            packageName: '@sindresorhus/is',
            hash: 'sha512-t09vSN3MdfsyCHoFcTRCH/iUtG7OJ0CsjzB8cjAmKc/va/kIgeDI/TxsigdncE/4be734m0cvIYwNaV4i2XqAw==',
          },
        },
        // Additional hoisted nodes for packages with direct entries
        'npm:@humanwhocodes/object-schema': {
          type: 'npm',
          name: 'npm:@humanwhocodes/object-schema',
          data: {
            version: '2.0.3',
            packageName: '@humanwhocodes/object-schema',
            hash: 'sha512-93zYdMES/c1D69yZiKDBj0V24vqNzB/koF26KPaagAfd3P/4gUlh3Dys5ogAK+Exi9QyzlD8x/08Zt7wIKcDcA==',
          },
        },
        'npm:balanced-match': {
          type: 'npm',
          name: 'npm:balanced-match',
          data: {
            version: '1.0.2',
            packageName: 'balanced-match',
            hash: 'sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==',
          },
        },
        'npm:brace-expansion': {
          type: 'npm',
          name: 'npm:brace-expansion',
          data: {
            version: '1.1.12',
            packageName: 'brace-expansion',
            hash: 'sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==',
          },
        },
        'npm:concat-map': {
          type: 'npm',
          name: 'npm:concat-map',
          data: {
            version: '0.0.1',
            packageName: 'concat-map',
            hash: 'sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==',
          },
        },
        'npm:debug': {
          type: 'npm',
          name: 'npm:debug',
          data: {
            version: '4.4.1',
            packageName: 'debug',
            hash: 'sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==',
          },
        },
        'npm:minimatch': {
          type: 'npm',
          name: 'npm:minimatch',
          data: {
            version: '3.1.2',
            packageName: 'minimatch',
            hash: 'sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==',
          },
        },
        'npm:ms': {
          type: 'npm',
          name: 'npm:ms',
          data: {
            version: '2.1.3',
            packageName: 'ms',
            hash: 'sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==',
          },
        },
        'npm:undici-types': {
          type: 'npm',
          name: 'npm:undici-types',
          data: {
            version: '6.21.0',
            packageName: 'undici-types',
            hash: 'sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==',
          },
        },
      });
    });

    it('should handle JSONC format with trailing commas', () => {
      const lockFileContentWithTrailingCommas = `{
        "lockfileVersion": 1,
        "workspaces": {
          "": {
            "dependencies": {
              "lodash": "^4.17.21",
            }
          }
        },
        "packages": {
          "lodash": [
            "lodash@4.17.21",
            "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
            {
              "resolution": "lodash@npm:4.17.21",
            },
            "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="
          ],
        }
      }`;

      const result = getBunTextLockfileNodes(
        lockFileContentWithTrailingCommas,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({
        'npm:lodash@4.17.21': {
          type: 'npm',
          name: 'npm:lodash@4.17.21',
          data: {
            version: '4.17.21',
            packageName: 'lodash',
            hash: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
          },
        },
        // Hoisted node for lodash which appears in workspace dependencies
        'npm:lodash': {
          type: 'npm',
          name: 'npm:lodash',
          data: {
            version: '4.17.21',
            packageName: 'lodash',
            hash: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
          },
        },
      });
    });

    it('should handle Git dependencies', () => {
      const result = getBunTextLockfileNodes(
        gitDependenciesLockFile,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual(
        expect.objectContaining({
          'npm:chalk@github:chalk/chalk#bfbc492': {
            type: 'npm',
            name: 'npm:chalk@github:chalk/chalk#bfbc492',
            data: {
              version: 'github:chalk/chalk#bfbc492',
              packageName: 'chalk',
              hash: expect.any(String),
            },
          },
          'npm:debug@github:debug-js/debug#6add244': {
            type: 'npm',
            name: 'npm:debug@github:debug-js/debug#6add244',
            data: {
              version: 'github:debug-js/debug#6add244',
              packageName: 'debug',
              hash: expect.any(String),
            },
          },
          'npm:glob@github:isaacs/node-glob#af5e337': {
            type: 'npm',
            name: 'npm:glob@github:isaacs/node-glob#af5e337',
            data: {
              version: 'github:isaacs/node-glob#af5e337',
              packageName: 'glob',
              hash: expect.any(String),
            },
          },
        })
      );
    });

    it('should handle file dependencies', () => {
      const result = getBunTextLockfileNodes(
        fileDependenciesLockFile,
        BASIC_LOCK_FILE_HASH
      );

      // File dependencies are treated as workspace packages and filtered out
      // Only their transitive dependencies (from npm registry) should be included
      expect(result).toEqual(
        expect.objectContaining({
          'npm:uuid@9.0.1': {
            type: 'npm',
            name: 'npm:uuid@9.0.1',
            data: {
              version: '9.0.1',
              packageName: 'uuid',
              hash: expect.any(String),
            },
          },
        })
      );

      // Verify file dependencies are correctly filtered out
      expect(result['npm:local-lib@file:packages/local-lib']).toBeUndefined();
      expect(result['npm:shared-utils@file:shared-utils']).toBeUndefined();
      expect(result['npm:test-utils@file:test-utils']).toBeUndefined();
    });

    it('should handle tarball dependencies', () => {
      const result = getBunTextLockfileNodes(
        tarballDependenciesLockFile,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual(
        expect.objectContaining({
          'npm:chalk@https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz': {
            type: 'npm',
            name: 'npm:chalk@https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz',
            data: {
              version: 'https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz',
              packageName: 'chalk',
              hash: expect.any(String),
            },
          },
          'npm:is-even@https://registry.npmjs.org/is-even/-/is-even-1.0.0.tgz':
            {
              type: 'npm',
              name: 'npm:is-even@https://registry.npmjs.org/is-even/-/is-even-1.0.0.tgz',
              data: {
                version:
                  'https://registry.npmjs.org/is-even/-/is-even-1.0.0.tgz',
                packageName: 'is-even',
                hash: expect.any(String),
              },
            },
          'npm:lodash@https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz': {
            type: 'npm',
            name: 'npm:lodash@https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
            data: {
              version: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
              packageName: 'lodash',
              hash: expect.any(String),
            },
          },
          'npm:rimraf@https://registry.npmjs.org/rimraf/-/rimraf-3.0.2.tgz': {
            type: 'npm',
            name: 'npm:rimraf@https://registry.npmjs.org/rimraf/-/rimraf-3.0.2.tgz',
            data: {
              version: 'https://registry.npmjs.org/rimraf/-/rimraf-3.0.2.tgz',
              packageName: 'rimraf',
              hash: expect.any(String),
            },
          },
        })
      );
    });

    it('should handle complex scenarios with mixed dependency types', () => {
      const result = getBunTextLockfileNodes(
        complexScenariosLockFile,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual(
        expect.objectContaining({
          'npm:react@18.3.1': {
            type: 'npm',
            name: 'npm:react@18.3.1',
            data: {
              version: '18.3.1',
              packageName: 'react',
              hash: expect.any(String),
            },
          },
          'npm:@types/node@18.19.119': {
            type: 'npm',
            name: 'npm:@types/node@18.19.119',
            data: {
              version: '18.19.119',
              packageName: '@types/node',
              hash: expect.any(String),
            },
          },
          'npm:debug@github:debug-js/debug#6add244': {
            type: 'npm',
            name: 'npm:debug@github:debug-js/debug#6add244',
            data: {
              version: 'github:debug-js/debug#6add244',
              packageName: 'debug',
              hash: expect.any(String),
            },
          },
          'npm:lodash@4.17.21': {
            type: 'npm',
            name: 'npm:lodash@4.17.21',
            data: {
              version: '4.17.21',
              packageName: 'lodash',
              hash: expect.any(String),
            },
          },
          'npm:@jest/types@29.6.3': {
            type: 'npm',
            name: 'npm:@jest/types@29.6.3',
            data: {
              version: '29.6.3',
              packageName: '@jest/types',
              hash: expect.any(String),
            },
          },
        })
      );
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedLockFile = '{ invalid json }';

      expect(() => {
        getBunTextLockfileNodes(malformedLockFile, BASIC_LOCK_FILE_HASH);
      }).toThrow(/Failed to parse Bun lockfile/);
    });

    it('should handle missing packages section gracefully', () => {
      const lockFileWithoutPackages = `{
          "lockfileVersion": 0,
          "workspaces": {
            "": {
              "dependencies": {
                "lodash": "^4.17.21"
              }
            }
          }
        }`;

      expect(() => {
        getBunTextLockfileNodes(lockFileWithoutPackages, BASIC_LOCK_FILE_HASH);
      }).toThrow(/Lockfile packages section must be an object/);
    });

    it('should handle missing workspaces section gracefully', () => {
      const lockFileWithoutWorkspaces = `{
          "lockfileVersion": 0,
          "packages": {
            "lodash": [
              "lodash@npm:4.17.21",
              {"resolution": "lodash@npm:4.17.21"},
              "hash123"
            ]
          }
        }`;

      expect(() => {
        getBunTextLockfileNodes(
          lockFileWithoutWorkspaces,
          BASIC_LOCK_FILE_HASH
        );
      }).toThrow(/Lockfile workspaces section must be an object/);
    });

    it('should handle invalid package data format gracefully', () => {
      const lockFileWithInvalidPackage = `{
          "lockfileVersion": 0,
          "workspaces": {
            "": {
              "dependencies": {
                "lodash": "^4.17.21"
              }
            }
          },
          "packages": {
            "lodash": "invalid-format"
          }
        }`;

      // Should not throw but log warnings and skip invalid packages
      const result = getBunTextLockfileNodes(
        lockFileWithInvalidPackage,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({});
    });

    it('should handle invalid resolved spec gracefully', () => {
      const lockFileWithInvalidResolvedSpec = `{
          "lockfileVersion": 0,
          "workspaces": {
            "": {
              "dependencies": {
                "lodash": "^4.17.21"
              }
            }
          },
          "packages": {
            "lodash": [
              123,
              {"resolution": "lodash@npm:4.17.21"},
              "hash123"
            ]
          }
        }`;

      // Should not throw but log warnings and skip invalid packages
      const result = getBunTextLockfileNodes(
        lockFileWithInvalidResolvedSpec,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({});
    });

    it('should handle packages with special characters in names', () => {
      const lockFileContent = `{
          "lockfileVersion": 1,
          "workspaces": {
            "": {
              "dependencies": {
                "@scope/package-name": "^1.0.0",
                "package.with.dots": "^2.0.0",
                "package-with-dashes": "^3.0.0"
              }
            }
          },
          "packages": {
            "@scope/package-name": [
              "@scope/package-name@npm:1.0.0",
              "https://registry.npmjs.org/scope/package-name/-/scope-package-name-1.0.0.tgz",
              {"resolution": "@scope/package-name@npm:1.0.0"},
              "hash1"
            ],
            "package.with.dots": [
              "package.with.dots@npm:2.0.0",
              "https://registry.npmjs.org/package.with.dots/-/package.with.dots-2.0.0.tgz",
              {"resolution": "package.with.dots@npm:2.0.0"},
              "hash2"
            ],
            "package-with-dashes": [
              "package-with-dashes@npm:3.0.0",
              "https://registry.npmjs.org/package-with-dashes/-/package-with-dashes-3.0.0.tgz",
              {"resolution": "package-with-dashes@npm:3.0.0"},
              "hash3"
            ]
          }
        }`;

      const result = getBunTextLockfileNodes(
        lockFileContent,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({
        'npm:@scope/package-name@1.0.0': {
          type: 'npm',
          name: 'npm:@scope/package-name@1.0.0',
          data: {
            version: '1.0.0',
            packageName: '@scope/package-name',
            hash: expect.any(String),
          },
        },
        'npm:package.with.dots@2.0.0': {
          type: 'npm',
          name: 'npm:package.with.dots@2.0.0',
          data: {
            version: '2.0.0',
            packageName: 'package.with.dots',
            hash: expect.any(String),
          },
        },
        'npm:package-with-dashes@3.0.0': {
          type: 'npm',
          name: 'npm:package-with-dashes@3.0.0',
          data: {
            version: '3.0.0',
            packageName: 'package-with-dashes',
            hash: expect.any(String),
          },
        },
        // Hoisted nodes for packages that appear in workspace dependencies
        'npm:@scope/package-name': {
          type: 'npm',
          name: 'npm:@scope/package-name',
          data: {
            version: '1.0.0',
            packageName: '@scope/package-name',
            hash: expect.any(String),
          },
        },
        'npm:package.with.dots': {
          type: 'npm',
          name: 'npm:package.with.dots',
          data: {
            version: '2.0.0',
            packageName: 'package.with.dots',
            hash: expect.any(String),
          },
        },
        'npm:package-with-dashes': {
          type: 'npm',
          name: 'npm:package-with-dashes',
          data: {
            version: '3.0.0',
            packageName: 'package-with-dashes',
            hash: expect.any(String),
          },
        },
      });
    });

    it('should handle empty lockfile gracefully', () => {
      const emptyLockFile = `{
          "lockfileVersion": 0,
          "workspaces": {},
          "packages": {}
        }`;

      const result = getBunTextLockfileNodes(emptyLockFile, 'hash123');

      expect(result).toEqual({});
    });

    it('should handle packages with missing metadata gracefully', () => {
      const lockFileContent = `{
          "lockfileVersion": 1,
          "workspaces": {
            "": {
              "dependencies": {
                "lodash": "^4.17.21"
              }
            }
          },
          "packages": {
            "lodash": [
              "lodash@npm:4.17.21",
              "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
              null,
              "hash123"
            ]
          }
        }`;

      const result = getBunTextLockfileNodes(
        lockFileContent,
        BASIC_LOCK_FILE_HASH
      );

      expect(result).toEqual({
        'npm:lodash@4.17.21': {
          type: 'npm',
          name: 'npm:lodash@4.17.21',
          data: {
            version: '4.17.21',
            packageName: 'lodash',
            hash: 'hash123',
          },
        },
        // Hoisted node for lodash which appears in workspace dependencies
        'npm:lodash': {
          type: 'npm',
          name: 'npm:lodash',
          data: {
            version: '4.17.21',
            packageName: 'lodash',
            hash: 'hash123',
          },
        },
      });
    });

    it('should handle complex version ranges correctly', () => {
      const result = getBunTextLockfileNodes(
        versionResolutionLockFile,
        VERSION_LOCK_FILE_HASH
      );

      // Should resolve to the highest satisfying version for each package
      expect(result).toEqual(
        expect.objectContaining({
          'npm:ansi-styles@4.3.0': expect.objectContaining({
            type: 'npm',
            name: 'npm:ansi-styles@4.3.0',
            data: expect.objectContaining({
              version: '4.3.0',
              packageName: 'ansi-styles',
            }),
          }),
          'npm:balanced-match@1.0.2': expect.objectContaining({
            type: 'npm',
            name: 'npm:balanced-match@1.0.2',
            data: expect.objectContaining({
              version: '1.0.2',
              packageName: 'balanced-match',
            }),
          }),
          'npm:brace-expansion@1.1.12': expect.objectContaining({
            type: 'npm',
            name: 'npm:brace-expansion@1.1.12',
            data: expect.objectContaining({
              version: '1.1.12',
              packageName: 'brace-expansion',
            }),
          }),
          'npm:chalk@4.1.2': expect.objectContaining({
            type: 'npm',
            name: 'npm:chalk@4.1.2',
            data: expect.objectContaining({
              version: '4.1.2',
              packageName: 'chalk',
            }),
          }),
          'npm:color-convert@2.0.1': expect.objectContaining({
            type: 'npm',
            name: 'npm:color-convert@2.0.1',
            data: expect.objectContaining({
              version: '2.0.1',
              packageName: 'color-convert',
            }),
          }),
          'npm:color-name@1.1.4': expect.objectContaining({
            type: 'npm',
            name: 'npm:color-name@1.1.4',
            data: expect.objectContaining({
              version: '1.1.4',
              packageName: 'color-name',
            }),
          }),
          'npm:concat-map@0.0.1': expect.objectContaining({
            type: 'npm',
            name: 'npm:concat-map@0.0.1',
            data: expect.objectContaining({
              version: '0.0.1',
              packageName: 'concat-map',
            }),
          }),
          'npm:debug@4.3.4': expect.objectContaining({
            type: 'npm',
            name: 'npm:debug@4.3.4',
            data: expect.objectContaining({
              version: '4.3.4',
              packageName: 'debug',
            }),
          }),
          'npm:has-flag@4.0.0': expect.objectContaining({
            type: 'npm',
            name: 'npm:has-flag@4.0.0',
            data: expect.objectContaining({
              version: '4.0.0',
              packageName: 'has-flag',
            }),
          }),
          'npm:lodash@4.17.21': expect.objectContaining({
            type: 'npm',
            name: 'npm:lodash@4.17.21',
            data: expect.objectContaining({
              version: '4.17.21',
              packageName: 'lodash',
            }),
          }),
          'npm:minimatch@3.1.2': expect.objectContaining({
            type: 'npm',
            name: 'npm:minimatch@3.1.2',
            data: expect.objectContaining({
              version: '3.1.2',
              packageName: 'minimatch',
            }),
          }),
          'npm:ms@2.1.3': expect.objectContaining({
            type: 'npm',
            name: 'npm:ms@2.1.3',
            data: expect.objectContaining({
              version: '2.1.3',
              packageName: 'ms',
            }),
          }),
          'npm:semver@7.7.2': expect.objectContaining({
            type: 'npm',
            name: 'npm:semver@7.7.2',
            data: expect.objectContaining({
              version: '7.7.2',
              packageName: 'semver',
            }),
          }),
          'npm:supports-color@7.2.0': expect.objectContaining({
            type: 'npm',
            name: 'npm:supports-color@7.2.0',
            data: expect.objectContaining({
              version: '7.2.0',
              packageName: 'supports-color',
            }),
          }),
          'npm:ms@2.1.2': expect.objectContaining({
            type: 'npm',
            name: 'npm:ms@2.1.2',
            data: expect.objectContaining({
              version: '2.1.2',
              packageName: 'ms',
            }),
          }),
        })
      );
    });

    it('should handle peerDependenciesMeta correctly', () => {
      const result = getBunTextLockfileNodes(
        peerDependenciesMetaLockFile,
        PEER_LOCK_FILE_HASH
      );

      // Should include all packages from lockfile
      expect(result).toEqual(
        expect.objectContaining({
          'npm:@types/prop-types@15.7.15': expect.objectContaining({
            type: 'npm',
            name: 'npm:@types/prop-types@15.7.15',
          }),
          'npm:@types/react@18.3.23': expect.objectContaining({
            type: 'npm',
            name: 'npm:@types/react@18.3.23',
          }),
          'npm:csstype@3.1.3': expect.objectContaining({
            type: 'npm',
            name: 'npm:csstype@3.1.3',
          }),
          'npm:js-tokens@4.0.0': expect.objectContaining({
            type: 'npm',
            name: 'npm:js-tokens@4.0.0',
          }),
          'npm:loose-envify@1.4.0': expect.objectContaining({
            type: 'npm',
            name: 'npm:loose-envify@1.4.0',
          }),
          'npm:react@18.3.1': expect.objectContaining({
            type: 'npm',
            name: 'npm:react@18.3.1',
          }),
          'npm:react-dom@18.3.1': expect.objectContaining({
            type: 'npm',
            name: 'npm:react-dom@18.3.1',
          }),
          'npm:scheduler@0.23.2': expect.objectContaining({
            type: 'npm',
            name: 'npm:scheduler@0.23.2',
          }),
        })
      );
    });

    it('should handle patched dependencies by skipping them', () => {
      const result = getBunTextLockfileNodes(
        enhancedFeaturesBunLock,
        ENHANCED_LOCK_FILE_HASH
      );

      // Patched packages should be skipped and not appear in external nodes
      expect(result['patched-package@1.0.0']).toBeUndefined();

      // Non-patched packages should still be present
      expect(result).toEqual(
        expect.objectContaining({
          'npm:lodash@4.17.21': expect.objectContaining({
            type: 'npm',
            name: 'npm:lodash@4.17.21',
            data: expect.objectContaining({
              version: '4.17.21',
              packageName: 'lodash',
            }),
          }),
        })
      );
    });

    it('should use manifests for better hash information', () => {
      const result = getBunTextLockfileNodes(
        enhancedFeaturesBunLock,
        ENHANCED_LOCK_FILE_HASH
      );

      // Should use SHA hash from lockfile package entry
      expect(result['npm:lodash@4.17.21'].data.hash).toBe(
        'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
      );
      expect(result['npm:react@18.3.1'].data.hash).toBe(
        'sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ=='
      );
    });

    it('should identify workspace packages using workspacePackages field', () => {
      const result = getBunTextLockfileNodes(
        enhancedFeaturesBunLock,
        ENHANCED_LOCK_FILE_HASH
      );

      // Workspace packages should be skipped and not appear in external nodes
      expect(result['workspace-lib@1.0.0']).toBeUndefined();
    });

    it('should validate enhanced lockfile structure', () => {
      // Test that invalid patches structure throws error
      const invalidPatchesLockFile = `{
          "lockfileVersion": 0,
          "workspaces": { "": {} },
          "packages": {},
          "patches": {
            "test-package": {
              "path": null
            }
          }
        }`;

      expect(() => {
        getBunTextLockfileNodes(
          invalidPatchesLockFile,
          ENHANCED_LOCK_FILE_HASH
        );
      }).toThrow(
        'Invalid patch entry for package "test-package": path must be a string'
      );
    });

    it('should validate workspacePackages structure', () => {
      // Test that invalid workspacePackages structure throws error
      const invalidWorkspacePackagesLockFile = `{
          "lockfileVersion": 0,
          "workspaces": { "": {} },
          "packages": {},
          "workspacePackages": {
            "test-package": {
              "name": "test-package",
              "version": null
            }
          }
        }`;

      expect(() => {
        getBunTextLockfileNodes(
          invalidWorkspacePackagesLockFile,
          ENHANCED_LOCK_FILE_HASH
        );
      }).toThrow(
        'Invalid workspace package entry for "test-package": version must be a string'
      );
    });

    it('should validate lockfile version', () => {
      // Test supported versions (0 and 1)
      const version0LockFile = `{
          "lockfileVersion": 0,
          "workspaces": { "": {} },
          "packages": {}
        }`;

      const version1LockFile = `{
          "lockfileVersion": 1,
          "workspaces": { "": {} },
          "packages": {}
        }`;

      expect(() => {
        getBunTextLockfileNodes(version0LockFile, 'version0-hash');
      }).not.toThrow();

      expect(() => {
        getBunTextLockfileNodes(version1LockFile, 'version1-hash');
      }).not.toThrow();

      // Test unsupported version
      const unsupportedVersionLockFile = `{
          "lockfileVersion": 2,
          "workspaces": { "": {} },
          "packages": {}
        }`;

      expect(() => {
        getBunTextLockfileNodes(unsupportedVersionLockFile, 'unsupported-hash');
      }).toThrow('Unsupported lockfile version 2');

      // Test invalid version type
      const invalidVersionLockFile = `{
          "lockfileVersion": "invalid",
          "workspaces": { "": {} },
          "packages": {}
        }`;

      expect(() => {
        getBunTextLockfileNodes(invalidVersionLockFile, 'invalid-hash');
      }).toThrow('Lockfile version must be a number');
    });

    it('should handle alias dependencies', () => {
      const result = getBunTextLockfileNodes(
        aliasDependenciesBunLock,
        ALIAS_LOCK_FILE_HASH
      );

      // Should create both alias and target nodes
      expect(result).toEqual(
        expect.objectContaining({
          // Alias node (without version in name)
          'npm:eslint-plugin-disable-autofix': {
            type: 'npm',
            name: 'npm:eslint-plugin-disable-autofix',
            data: {
              version: 'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0',
              packageName: 'eslint-plugin-disable-autofix',
              hash: expect.any(String),
            },
          },
          // Target node (with version in name)
          'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0': {
            type: 'npm',
            name: 'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0',
            data: {
              version: '3.0.0',
              packageName: '@mattlewis92/eslint-plugin-disable-autofix',
              hash: expect.any(String),
            },
          },
        })
      );
    });

    it('should handle scoped package aliases', () => {
      const result = getBunTextLockfileNodes(
        aliasDependenciesBunLock,
        ALIAS_LOCK_FILE_HASH
      );

      // Should create both alias and target nodes for scoped packages
      expect(result).toEqual(
        expect.objectContaining({
          // Alias node
          'npm:scoped-alias': {
            type: 'npm',
            name: 'npm:scoped-alias',
            data: {
              version: 'npm:@types/node@18.15.0',
              packageName: 'scoped-alias',
              hash: expect.any(String),
            },
          },
          // Target node
          'npm:@types/node@18.15.0': {
            type: 'npm',
            name: 'npm:@types/node@18.15.0',
            data: {
              version: '18.15.0',
              packageName: '@types/node',
              hash: expect.any(String),
            },
          },
        })
      );
    });

    it('should handle multiple alias dependencies', () => {
      const result = getBunTextLockfileNodes(
        aliasDependenciesBunLock,
        ALIAS_LOCK_FILE_HASH
      );

      // Should create all alias and target nodes
      const nodeKeys = Object.keys(result);
      expect(nodeKeys).toContain('npm:eslint-plugin-disable-autofix');
      expect(nodeKeys).toContain(
        'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0'
      );
      // pretty-format is not an alias since it maps to the same package name
      expect(nodeKeys).toContain('npm:pretty-format@29.7.0');
      expect(nodeKeys).toContain('npm:scoped-alias');
      expect(nodeKeys).toContain('npm:@types/node@18.15.0');
      expect(nodeKeys).toContain('npm:alias-dev');
      expect(nodeKeys).toContain('npm:typescript@5.0.4');
    });

    it('should handle Next.js generated lockfile', () => {
      const result = getBunTextLockfileNodes(nextjsAppBunLock, 'nextjs-hash');

      // Should parse a large number of external nodes from real Next.js app
      expect(Object.keys(result).length).toEqual(962);

      // Should contain typical Next.js dependencies
      expect(result).toEqual(
        expect.objectContaining({
          'npm:next@14.0.0': expect.objectContaining({
            type: 'npm',
            name: 'npm:next@14.0.0',
            data: expect.objectContaining({
              version: '14.0.0',
              packageName: 'next',
            }),
          }),
          'npm:react@18.3.1': expect.objectContaining({
            type: 'npm',
            name: 'npm:react@18.3.1',
            data: expect.objectContaining({
              version: '18.3.1',
              packageName: 'react',
            }),
          }),
          'npm:typescript@5.8.3': expect.objectContaining({
            type: 'npm',
            name: 'npm:typescript@5.8.3',
            data: expect.objectContaining({
              version: '5.8.3',
              packageName: 'typescript',
            }),
          }),
        })
      );
    });

    it('should handle large project lockfile', () => {
      const result = getBunTextLockfileNodes(
        largeProjectBunLock,
        'large-project-hash'
      );

      // Should parse a very large number of external nodes
      expect(Object.keys(result).length).toBeGreaterThan(2300);

      // Should contain various framework dependencies
      expect(result).toEqual(
        expect.objectContaining({
          'npm:react@18.3.1': expect.objectContaining({
            type: 'npm',
            data: expect.objectContaining({
              packageName: 'react',
            }),
          }),
          'npm:webpack@5.100.2': expect.objectContaining({
            type: 'npm',
            data: expect.objectContaining({
              packageName: 'webpack',
            }),
          }),
          'npm:axios@1.10.0': expect.objectContaining({
            type: 'npm',
            data: expect.objectContaining({
              packageName: 'axios',
            }),
          }),
        })
      );
    });

    it('should handle auxiliary packages with peer dependencies', () => {
      const result = getBunTextLockfileNodes(
        auxiliaryPackagesBunLock,
        'auxiliary-hash'
      );

      // Should parse auxiliary packages correctly
      expect(Object.keys(result).length).toBeGreaterThan(800);

      // Should contain packages with peer dependencies
      expect(result).toEqual(
        expect.objectContaining({
          'npm:@nrwl/devkit@15.0.13': expect.objectContaining({
            type: 'npm',
            data: expect.objectContaining({
              packageName: '@nrwl/devkit',
              version: '15.0.13',
            }),
          }),
          'npm:jest@29.7.0': expect.objectContaining({
            type: 'npm',
            data: expect.objectContaining({
              packageName: 'jest',
            }),
          }),
          'npm:typescript@4.8.4': expect.objectContaining({
            type: 'npm',
            data: expect.objectContaining({
              packageName: 'typescript',
            }),
          }),
        })
      );
    });

    it('should handle real-world example with hoisted and nested dependencies', () => {
      const result = getBunTextLockfileNodes(
        hoistedAndNestedBunLock,
        HOISTED_NESTED_LOCK_FILE_HASH
      );

      // Should contain all hoisted packages: packages in lockfile not nested
      // inside workspace packages or other dependencies
      expect(result['npm:ansi-styles']).toBeDefined();
      expect(result['npm:ansi-styles'].data.version).toBe('5.1.0');
      expect(result['npm:is-buffer']).toBeDefined();
      expect(result['npm:is-buffer'].data.version).toBe('1.1.6');
      expect(result['npm:is-even']).toBeDefined();
      expect(result['npm:is-even'].data.version).toBe('1.0.0');
      expect(result['npm:is-number']).toBeDefined();
      expect(result['npm:is-number'].data.version).toBe('1.1.2');
      expect(result['npm:is-odd']).toBeDefined();
      expect(result['npm:is-odd'].data.version).toBe('3.0.1');
      expect(result['npm:kind-of']).toBeDefined();
      expect(result['npm:kind-of'].data.version).toBe('3.2.2');
      expect(result['npm:lodash']).toBeDefined();
      expect(result['npm:lodash'].data.version).toBe('4.14.2');

      // Should contain workspace-specific versions
      expect(result['npm:lodash@4.13.1']).toBeDefined();
      expect(result['npm:ansi-styles@6.2.1']).toBeDefined();
      expect(result['npm:is-even@0.1.1']).toBeDefined();
      expect(result['npm:lodash@4.17.21']).toBeDefined();
      expect(result['npm:is-odd@0.1.2']).toBeDefined();
      expect(result['npm:is-number@3.0.0']).toBeDefined();
      expect(result['npm:is-number@6.0.0']).toBeDefined();

      // ensure nested entries are not created as nodes, as they are only used
      // to resolve different versions of the same package (the nodes in the
      // previous expectations' section)
      expect(result['npm:@quz/pkg1/lodash']).toBeUndefined();
      expect(result['npm:@quz/pkg2/ansi-styles']).toBeUndefined();
      expect(result['npm:@quz/pkg2/is-even']).toBeUndefined();
      expect(result['npm:@quz/pkg2/lodash']).toBeUndefined();
      expect(result['npm:is-even/is-odd']).toBeUndefined();
      expect(result['npm:is-odd/is-number']).toBeUndefined();
      expect(result['npm:@quz/pkg2/is-even/is-odd']).toBeUndefined();
      expect(result['npm:is-even/is-odd/is-number']).toBeUndefined();
      expect(result['npm:@quz/pkg2/is-even/is-odd/is-number']).toBeUndefined();
    });
  });

  describe('getBunLockfileDependencies', () => {
    it('should parse basic dependencies', () => {
      // Generate external nodes from the lockfile to ensure consistency
      const externalNodes = getBunTextLockfileNodes(
        basicDependenciesBunLock,
        BASIC_LOCK_FILE_HASH
      );

      const context: CreateDependenciesContext = {
        externalNodes,
        projects: {
          '': {
            root: '',
            name: '',
          },
        },
        workspaceRoot: '/root',
        nxJsonConfiguration: {},
        fileMap: {
          projectFileMap: {
            '': [
              {
                file: 'bun.lock',
                hash: BASIC_LOCK_FILE_HASH,
              },
            ],
          },
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        filesToProcess: {
          projectFileMap: {},
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
      };

      const result = getBunTextLockfileDependencies(
        basicDependenciesBunLock,
        BASIC_LOCK_FILE_HASH,
        context
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "source": "npm:loose-envify@1.4.0",
            "target": "npm:js-tokens@4.0.0",
            "type": "static",
          },
          {
            "source": "npm:react@18.2.0",
            "target": "npm:loose-envify@1.4.0",
            "type": "static",
          },
        ]
      `);
    });

    it('should handle dependencies from workspaces', () => {
      // Generate external nodes from the workspace dependencies lockfile
      const externalNodes = getBunTextLockfileNodes(
        workspaceDependenciesBunLock,
        BASIC_LOCK_FILE_HASH
      );

      const context: CreateDependenciesContext = {
        externalNodes,
        projects: {
          '': {
            root: '',
            name: '',
          },
          'packages/app': {
            root: 'packages/app',
            name: 'packages/app',
          },
          'packages/shared': {
            root: 'packages/shared',
            name: 'packages/shared',
          },
        },
        workspaceRoot: '/root',
        nxJsonConfiguration: {},
        fileMap: {
          projectFileMap: {
            '': [
              {
                file: 'bun.lock',
                hash: BASIC_LOCK_FILE_HASH,
              },
            ],
          },
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        filesToProcess: {
          projectFileMap: {},
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
      };

      const result = getBunTextLockfileDependencies(
        workspaceDependenciesBunLock,
        BASIC_LOCK_FILE_HASH,
        context
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "source": "npm:axios@1.10.0",
            "target": "npm:follow-redirects@1.15.9",
            "type": "static",
          },
          {
            "source": "npm:axios@1.10.0",
            "target": "npm:form-data@4.0.4",
            "type": "static",
          },
          {
            "source": "npm:axios@1.10.0",
            "target": "npm:proxy-from-env@1.1.0",
            "type": "static",
          },
          {
            "source": "npm:call-bind-apply-helpers@1.0.2",
            "target": "npm:es-errors@1.3.0",
            "type": "static",
          },
          {
            "source": "npm:call-bind-apply-helpers@1.0.2",
            "target": "npm:function-bind@1.1.2",
            "type": "static",
          },
          {
            "source": "npm:combined-stream@1.0.8",
            "target": "npm:delayed-stream@1.0.0",
            "type": "static",
          },
          {
            "source": "npm:dunder-proto@1.0.1",
            "target": "npm:call-bind-apply-helpers@1.0.2",
            "type": "static",
          },
          {
            "source": "npm:dunder-proto@1.0.1",
            "target": "npm:es-errors@1.3.0",
            "type": "static",
          },
          {
            "source": "npm:dunder-proto@1.0.1",
            "target": "npm:gopd@1.2.0",
            "type": "static",
          },
          {
            "source": "npm:es-object-atoms@1.1.1",
            "target": "npm:es-errors@1.3.0",
            "type": "static",
          },
          {
            "source": "npm:es-set-tostringtag@2.1.0",
            "target": "npm:es-errors@1.3.0",
            "type": "static",
          },
          {
            "source": "npm:es-set-tostringtag@2.1.0",
            "target": "npm:get-intrinsic@1.3.0",
            "type": "static",
          },
          {
            "source": "npm:es-set-tostringtag@2.1.0",
            "target": "npm:has-tostringtag@1.0.2",
            "type": "static",
          },
          {
            "source": "npm:es-set-tostringtag@2.1.0",
            "target": "npm:hasown@2.0.2",
            "type": "static",
          },
          {
            "source": "npm:form-data@4.0.4",
            "target": "npm:asynckit@0.4.0",
            "type": "static",
          },
          {
            "source": "npm:form-data@4.0.4",
            "target": "npm:combined-stream@1.0.8",
            "type": "static",
          },
          {
            "source": "npm:form-data@4.0.4",
            "target": "npm:es-set-tostringtag@2.1.0",
            "type": "static",
          },
          {
            "source": "npm:form-data@4.0.4",
            "target": "npm:hasown@2.0.2",
            "type": "static",
          },
          {
            "source": "npm:form-data@4.0.4",
            "target": "npm:mime-types@2.1.35",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:call-bind-apply-helpers@1.0.2",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:es-define-property@1.0.1",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:es-errors@1.3.0",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:es-object-atoms@1.1.1",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:function-bind@1.1.2",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:get-proto@1.0.1",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:gopd@1.2.0",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:has-symbols@1.1.0",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:hasown@2.0.2",
            "type": "static",
          },
          {
            "source": "npm:get-intrinsic@1.3.0",
            "target": "npm:math-intrinsics@1.1.0",
            "type": "static",
          },
          {
            "source": "npm:get-proto@1.0.1",
            "target": "npm:dunder-proto@1.0.1",
            "type": "static",
          },
          {
            "source": "npm:get-proto@1.0.1",
            "target": "npm:es-object-atoms@1.1.1",
            "type": "static",
          },
          {
            "source": "npm:has-tostringtag@1.0.2",
            "target": "npm:has-symbols@1.1.0",
            "type": "static",
          },
          {
            "source": "npm:hasown@2.0.2",
            "target": "npm:function-bind@1.1.2",
            "type": "static",
          },
          {
            "source": "npm:loose-envify@1.4.0",
            "target": "npm:js-tokens@4.0.0",
            "type": "static",
          },
          {
            "source": "npm:mime-types@2.1.35",
            "target": "npm:mime-db@1.52.0",
            "type": "static",
          },
          {
            "source": "npm:react@18.3.1",
            "target": "npm:loose-envify@1.4.0",
            "type": "static",
          },
        ]
      `);
    });

    it('should handle version resolution with complex ranges', () => {
      // Generate external nodes from version resolution lockfile
      const externalNodes = getBunTextLockfileNodes(
        versionResolutionLockFile,
        VERSION_LOCK_FILE_HASH
      );

      const ctx: CreateDependenciesContext = {
        projects: {
          '': {
            name: '',
            root: '',
          },
        },
        externalNodes,
        fileMap: {
          projectFileMap: {
            '': [
              {
                file: 'bun.lock',
                hash: VERSION_LOCK_FILE_HASH,
              },
            ],
          },
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        filesToProcess: {
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
          projectFileMap: {},
        },
        nxJsonConfiguration: {},
        workspaceRoot: '/root',
      };

      const result = getBunTextLockfileDependencies(
        versionResolutionLockFile,
        VERSION_LOCK_FILE_HASH,
        ctx
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "source": "npm:ansi-styles@4.3.0",
            "target": "npm:color-convert@2.0.1",
            "type": "static",
          },
          {
            "source": "npm:brace-expansion@1.1.12",
            "target": "npm:balanced-match@1.0.2",
            "type": "static",
          },
          {
            "source": "npm:brace-expansion@1.1.12",
            "target": "npm:concat-map@0.0.1",
            "type": "static",
          },
          {
            "source": "npm:chalk@4.1.2",
            "target": "npm:ansi-styles@4.3.0",
            "type": "static",
          },
          {
            "source": "npm:chalk@4.1.2",
            "target": "npm:supports-color@7.2.0",
            "type": "static",
          },
          {
            "source": "npm:color-convert@2.0.1",
            "target": "npm:color-name@1.1.4",
            "type": "static",
          },
          {
            "source": "npm:debug@4.3.4",
            "target": "npm:ms@2.1.2",
            "type": "static",
          },
          {
            "source": "npm:minimatch@3.1.2",
            "target": "npm:brace-expansion@1.1.12",
            "type": "static",
          },
          {
            "source": "npm:supports-color@7.2.0",
            "target": "npm:has-flag@4.0.0",
            "type": "static",
          },
        ]
      `);
    });

    it('should skip optional peer dependencies when not in external nodes', () => {
      // Generate all external nodes from peer dependencies lockfile
      const allExternalNodes = getBunTextLockfileNodes(
        peerDependenciesMetaLockFile,
        PEER_LOCK_FILE_HASH
      );

      // Create a filtered set excluding some optional peer dependencies
      const externalNodes = { ...allExternalNodes };
      // Remove some optional peers to simulate them not being installed
      delete externalNodes['npm:optional-peer'];
      delete externalNodes['npm:another-optional'];

      const ctx: CreateDependenciesContext = {
        projects: {
          '': {
            name: '',
            root: '',
          },
        },
        externalNodes,
        fileMap: {
          projectFileMap: {
            '': [
              {
                file: 'bun.lock',
                hash: PEER_LOCK_FILE_HASH,
              },
            ],
          },
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        filesToProcess: {
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
          projectFileMap: {},
        },
        nxJsonConfiguration: {},
        workspaceRoot: '/root',
      };

      const result = getBunTextLockfileDependencies(
        peerDependenciesMetaLockFile,
        PEER_LOCK_FILE_HASH,
        ctx
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "source": "npm:loose-envify@1.4.0",
            "target": "npm:js-tokens@4.0.0",
            "type": "static",
          },
          {
            "source": "npm:react@18.3.1",
            "target": "npm:loose-envify@1.4.0",
            "type": "static",
          },
          {
            "source": "npm:react-dom@18.3.1",
            "target": "npm:loose-envify@1.4.0",
            "type": "static",
          },
          {
            "source": "npm:react-dom@18.3.1",
            "target": "npm:scheduler@0.23.2",
            "type": "static",
          },
          {
            "source": "npm:react-dom@18.3.1",
            "target": "npm:react@18.3.1",
            "type": "static",
          },
          {
            "source": "npm:scheduler@0.23.2",
            "target": "npm:loose-envify@1.4.0",
            "type": "static",
          },
        ]
      `);
    });

    it('should handle alias dependencies in dependency resolution', () => {
      // Generate external nodes from alias dependencies lockfile
      const externalNodes = getBunTextLockfileNodes(
        aliasDependenciesBunLock,
        ALIAS_LOCK_FILE_HASH
      );

      const ctx: CreateDependenciesContext = {
        projects: {
          '': {
            name: '',
            root: '',
          },
        },
        externalNodes,
        fileMap: {
          projectFileMap: {
            '': [
              {
                file: 'bun.lock',
                hash: ALIAS_LOCK_FILE_HASH,
              },
            ],
          },
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        filesToProcess: {
          projectFileMap: {},
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        nxJsonConfiguration: {},
        workspaceRoot: '/root',
      };

      const result = getBunTextLockfileDependencies(
        aliasDependenciesBunLock,
        ALIAS_LOCK_FILE_HASH,
        ctx
      );

      expect(result).toEqual([
        {
          source: 'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0',
          target: 'npm:@types/node@18.15.0',
          type: 'static',
        },
        {
          source: 'npm:pretty-format@29.7.0',
          target: 'npm:typescript@5.0.4',
          type: 'static',
        },
        {
          source: 'npm:@types/node@18.15.0',
          target: 'npm:pretty-format@29.7.0',
          type: 'static',
        },
        {
          source: 'npm:typescript@5.0.4',
          target: 'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0',
          type: 'static',
        },
      ]);
    });

    it('should handle dependencies with hoisted and nested packages', () => {
      // Generate external nodes from hoisted and nested lockfile
      const externalNodes = getBunTextLockfileNodes(
        hoistedAndNestedBunLock,
        HOISTED_NESTED_LOCK_FILE_HASH
      );

      const ctx: CreateDependenciesContext = {
        projects: {
          '': {
            name: 'quz',
            root: '',
          },
          'packages/pkg1': {
            name: '@quz/pkg1',
            root: 'packages/pkg1',
          },
          'packages/pkg2': {
            name: '@quz/pkg2',
            root: 'packages/pkg2',
          },
        },
        externalNodes,
        fileMap: {
          projectFileMap: {
            '': [
              {
                file: 'bun.lock',
                hash: HOISTED_NESTED_LOCK_FILE_HASH,
              },
            ],
          },
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
        },
        filesToProcess: {
          nonProjectFiles: [
            {
              file: 'bun.lock',
              hash: BASIC_LOCK_FILE_HASH,
            },
          ],
          projectFileMap: {},
        },
        nxJsonConfiguration: {},
        workspaceRoot: '/root',
      };

      const result = getBunTextLockfileDependencies(
        hoistedAndNestedBunLock,
        HOISTED_NESTED_LOCK_FILE_HASH,
        ctx
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "source": "npm:is-even@1.0.0",
            "target": "npm:is-odd@0.1.2",
            "type": "static",
          },
          {
            "source": "npm:is-odd@3.0.1",
            "target": "npm:is-number@6.0.0",
            "type": "static",
          },
          {
            "source": "npm:kind-of@3.2.2",
            "target": "npm:is-buffer@1.1.6",
            "type": "static",
          },
        ]
      `);
    });
  });

  describe('stringifyBunLockfile', () => {
    it('should serialize a basic Bun lockfile correctly', () => {
      const graph: ProjectGraph = {
        nodes: {},
        externalNodes: {
          'npm:lodash@4.17.21': {
            type: 'npm',
            name: 'npm:lodash@4.17.21',
            data: {
              version: '4.17.21',
              packageName: 'lodash',
              hash: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
            },
          },
          'npm:react@18.2.0': {
            type: 'npm',
            name: 'npm:react@18.2.0',
            data: {
              version: '18.2.0',
              packageName: 'react',
              hash: 'sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ==',
            },
          },
        },
        dependencies: {},
      };

      const packageJson: NormalizedPackageJson = {
        name: 'test-app',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
          react: '^18.2.0',
        },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      };

      const existingLockfile = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            dependencies: {
              lodash: '^4.17.21',
            },
          },
        },
        packages: {
          lodash: [
            'lodash@npm:4.17.21',
            'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
            {},
            'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
          ],
        },
      });

      const result = stringifyBunLockfile(graph, existingLockfile, packageJson);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual(
        expect.objectContaining({
          lockfileVersion: 1,
          workspaces: {
            '': expect.objectContaining({
              dependencies: {
                lodash: '^4.17.21',
                react: '^18.2.0',
              },
            }),
          },
          packages: expect.objectContaining({
            lodash: [
              'lodash@npm:4.17.21',
              'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
              {},
              'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
            ],
            'react@18.2.0': [
              'react@npm:18.2.0',
              'https://registry.npmjs.org/react/-/react-18.2.0.tgz',
              {},
              'sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ==',
            ],
          }),
        })
      );
    });

    it('should preserve existing lockfile metadata', () => {
      const graph: ProjectGraph = {
        nodes: {},
        externalNodes: {
          'npm:typescript@5.0.2': {
            type: 'npm',
            name: 'npm:typescript@5.0.2',
            data: {
              version: '5.0.2',
              packageName: 'typescript',
              hash: 'sha512-wVORMBGO/FAs/++blGNeAVdbNKtIh1rbBL2EyQ1+J9lClJ93KiiKe8PmFIVdXhHcyv44SL9oglmfeSsndo0jRw==',
            },
          },
        },
        dependencies: {},
      };

      const packageJson: NormalizedPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {
          typescript: '^5.0.2',
        },
        peerDependencies: {},
        optionalDependencies: {},
      };

      const existingLockfile = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            name: 'test-package',
            version: '1.0.0',
          },
        },
        packages: {},
        patches: {
          'some-package': {
            path: 'patches/some-package@1.0.0.patch',
          },
        },
        manifests: {
          'typescript@5.0.2': {
            version: '5.0.2',
            dist: {
              shasum: 'some-manifest-hash',
            },
          },
        },
        workspacePackages: {
          'test-package': {
            name: 'test-package',
            version: '1.0.0',
            path: '.',
          },
        },
      });

      const result = stringifyBunLockfile(graph, existingLockfile, packageJson);
      const parsed = JSON.parse(result);

      // Should preserve all optional sections
      expect(parsed.patches).toEqual({
        'some-package': {
          path: 'patches/some-package@1.0.0.patch',
        },
      });
      expect(parsed.manifests).toEqual({
        'typescript@5.0.2': {
          version: '5.0.2',
          dist: {
            shasum: 'some-manifest-hash',
          },
        },
      });
      expect(parsed.workspacePackages).toEqual({
        'test-package': {
          name: 'test-package',
          version: '1.0.0',
          path: '.',
        },
      });
    });

    it('should skip workspace packages from external nodes', () => {
      const graph: ProjectGraph = {
        nodes: {},
        externalNodes: {
          'npm:lodash@4.17.21': {
            type: 'npm',
            name: 'npm:lodash@4.17.21',
            data: {
              version: '4.17.21',
              packageName: 'lodash',
              hash: 'test-hash',
            },
          },
          'npm:workspace-lib@1.0.0': {
            type: 'npm',
            name: 'npm:workspace-lib@1.0.0',
            data: {
              version: '1.0.0',
              packageName: 'workspace-lib',
              hash: 'workspace-hash',
            },
          },
        },
        dependencies: {},
      };

      const packageJson: NormalizedPackageJson = {
        name: 'test-app',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
          'workspace-lib': 'workspace:*',
        },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      };

      const existingLockfile = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
          '': {
            dependencies: {
              lodash: '^4.17.21',
              'workspace-lib': 'workspace:*',
            },
          },
        },
        packages: {},
        workspacePackages: {
          'workspace-lib': {
            name: 'workspace-lib',
            version: '1.0.0',
            path: 'packages/workspace-lib',
          },
        },
      });

      const result = stringifyBunLockfile(graph, existingLockfile, packageJson);
      const parsed = JSON.parse(result);

      // Should include external package but skip workspace package
      expect(parsed.packages).toEqual(
        expect.objectContaining({
          'lodash@4.17.21': expect.any(Array),
        })
      );
      expect(parsed.packages['workspace-lib@1.0.0']).toBeUndefined();
      expect(parsed.packages['workspace-lib']).toBeUndefined();
    });

    it('should handle empty lockfile gracefully', () => {
      const graph: ProjectGraph = {
        nodes: {},
        externalNodes: {},
        dependencies: {},
      };

      const packageJson: NormalizedPackageJson = {
        name: 'empty-package',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      };

      const existingLockfile = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {},
        packages: {},
      });

      const result = stringifyBunLockfile(graph, existingLockfile, packageJson);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        lockfileVersion: 1,
        workspaces: {
          '': {}, // Empty workspace since no dependencies exist
        },
        packages: {},
      });
    });

    it('should sort packages for consistent output', () => {
      const graph: ProjectGraph = {
        nodes: {},
        externalNodes: {
          'npm:zebra@1.0.0': {
            type: 'npm',
            name: 'npm:zebra@1.0.0',
            data: {
              version: '1.0.0',
              packageName: 'zebra',
              hash: 'zebra-hash',
            },
          },
          'npm:alpha@1.0.0': {
            type: 'npm',
            name: 'npm:alpha@1.0.0',
            data: {
              version: '1.0.0',
              packageName: 'alpha',
              hash: 'alpha-hash',
            },
          },
          'npm:beta@1.0.0': {
            type: 'npm',
            name: 'npm:beta@1.0.0',
            data: {
              version: '1.0.0',
              packageName: 'beta',
              hash: 'beta-hash',
            },
          },
        },
        dependencies: {},
      };

      const packageJson: NormalizedPackageJson = {
        name: 'sort-test',
        version: '1.0.0',
        dependencies: {
          zebra: '^1.0.0',
          alpha: '^1.0.0',
          beta: '^1.0.0',
        },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      };

      const existingLockfile = JSON.stringify({
        lockfileVersion: 1,
        workspaces: {},
        packages: {},
      });

      const result = stringifyBunLockfile(graph, existingLockfile, packageJson);
      const parsed = JSON.parse(result);

      // Packages should be sorted alphabetically
      const packageKeys = Object.keys(parsed.packages);
      expect(packageKeys).toEqual(['alpha@1.0.0', 'beta@1.0.0', 'zebra@1.0.0']);
    });
  });
});
