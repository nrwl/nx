import { joinPathFragments } from '../utils/path';
import { parseYarnLockFile } from './yarn-v2';
import { vol } from 'memfs';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('yarn LockFile utility', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('next.js generated', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@jest/reporters/package.json': '{"version": "28.1.1"}',
        'node_modules/@jest/test-result/package.json': '{"version": "28.1.3"}',
        'node_modules/@jridgewell/gen-mapping/package.json':
          '{"version": "0.3.2"}',
        'node_modules/@jridgewell/trace-mapping/package.json':
          '{"version": "0.3.17"}',
        'node_modules/@rollup/pluginutils/package.json': '{"version": "3.1.0"}',
        'node_modules/@swc/helpers/package.json': '{"version": "0.4.11"}',
        'node_modules/@types/estree/package.json': '{"version": "1.0.0"}',
        'node_modules/@types/node/package.json': '{"version": "18.11.9"}',
        'node_modules/@types/react/package.json': '{"version": "18.0.25"}',
        'node_modules/acorn-walk/package.json': '{"version": "8.2.0"}',
        'node_modules/acorn/package.json': '{"version": "8.8.1"}',
        'node_modules/ajv-keywords/package.json': '{"version": "3.5.2"}',
        'node_modules/ajv/package.json': '{"version": "6.12.6"}',
        'node_modules/ansi-styles/package.json': '{"version": "4.3.0"}',
        'node_modules/argparse/package.json': '{"version": "2.0.1"}',
        'node_modules/aria-query/package.json': '{"version": "4.2.2"}',
        'node_modules/array-flatten/package.json': '{"version": "1.1.1"}',
        'node_modules/array-union/package.json': '{"version": "2.1.0"}',
        'node_modules/async/package.json': '{"version": "3.2.4"}',
        'node_modules/babel-jest/package.json': '{"version": "28.1.1"}',
        'node_modules/bluebird/package.json': '{"version": "3.7.2"}',
        'node_modules/brace-expansion/package.json': '{"version": "1.1.11"}',
        'node_modules/bytes/package.json': '{"version": "3.1.2"}',
        'node_modules/camelcase/package.json': '{"version": "6.3.0"}',
        'node_modules/chalk/package.json': '{"version": "4.1.2"}',
        'node_modules/cliui/package.json': '{"version": "7.0.4"}',
        'node_modules/color-convert/package.json': '{"version": "2.0.1"}',
        'node_modules/color-name/package.json': '{"version": "1.1.4"}',
        'node_modules/colorette/package.json': '{"version": "2.0.19"}',
        'node_modules/commander/package.json': '{"version": "5.1.0"}',
        'node_modules/core-util-is/package.json': '{"version": "1.0.2"}',
        'node_modules/cosmiconfig/package.json': '{"version": "7.1.0"}',
        'node_modules/cssom/package.json': '{"version": "0.5.0"}',
        'node_modules/debug/package.json': '{"version": "4.3.4"}',
        'node_modules/depd/package.json': '{"version": "2.0.0"}',
        'node_modules/diff-sequences/package.json': '{"version": "28.1.1"}',
        'node_modules/doctrine/package.json': '{"version": "2.1.0"}',
        'node_modules/emoji-regex/package.json': '{"version": "9.2.2"}',
        'node_modules/entities/package.json': '{"version": "4.4.0"}',
        'node_modules/escape-string-regexp/package.json':
          '{"version": "1.0.5"}',
        'node_modules/eslint-scope/package.json': '{"version": "5.1.1"}',
        'node_modules/eslint-visitor-keys/package.json': '{"version": "3.3.0"}',
        'node_modules/estraverse/package.json': '{"version": "5.3.0"}',
        'node_modules/estree-walker/package.json': '{"version": "2.0.2"}',
        'node_modules/execa/package.json': '{"version": "5.1.1"}',
        'node_modules/extsprintf/package.json': '{"version": "1.3.0"}',
        'node_modules/fast-glob/package.json': '{"version": "3.2.12"}',
        'node_modules/find-up/package.json': '{"version": "4.1.0"}',
        'node_modules/form-data/package.json': '{"version": "4.0.0"}',
        'node_modules/fs-extra/package.json': '{"version": "10.1.0"}',
        'node_modules/get-stream/package.json': '{"version": "5.2.0"}',
        'node_modules/glob-parent/package.json': '{"version": "5.1.2"}',
        'node_modules/glob/package.json': '{"version": "7.2.3"}',
        'node_modules/globals/package.json': '{"version": "11.12.0"}',
        'node_modules/globby/package.json': '{"version": "11.1.0"}',
        'node_modules/has-flag/package.json': '{"version": "4.0.0"}',
        'node_modules/http-errors/package.json': '{"version": "2.0.0"}',
        'node_modules/human-signals/package.json': '{"version": "2.1.0"}',
        'node_modules/iconv-lite/package.json': '{"version": "0.4.24"}',
        'node_modules/inherits/package.json': '{"version": "2.0.4"}',
        'node_modules/ipaddr.js/package.json': '{"version": "2.0.1"}',
        'node_modules/is-plain-object/package.json': '{"version": "2.0.4"}',
        'node_modules/isarray/package.json': '{"version": "2.0.5"}',
        'node_modules/jest-config/package.json': '{"version": "28.1.3"}',
        'node_modules/jest-diff/package.json': '{"version": "28.1.3"}',
        'node_modules/jest-get-type/package.json': '{"version": "28.0.2"}',
        'node_modules/jest-matcher-utils/package.json': '{"version": "28.1.3"}',
        'node_modules/jest-resolve/package.json': '{"version": "28.1.3"}',
        'node_modules/jest-util/package.json': '{"version": "28.1.3"}',
        'node_modules/jest-worker/package.json': '{"version": "28.1.3"}',
        'node_modules/js-yaml/package.json': '{"version": "4.1.0"}',
        'node_modules/jsesc/package.json': '{"version": "2.5.2"}',
        'node_modules/json-schema-traverse/package.json':
          '{"version": "0.4.1"}',
        'node_modules/json5/package.json': '{"version": "2.2.1"}',
        'node_modules/jsonfile/package.json': '{"version": "6.1.0"}',
        'node_modules/levn/package.json': '{"version": "0.4.1"}',
        'node_modules/loader-utils/package.json': '{"version": "2.0.4"}',
        'node_modules/locate-path/package.json': '{"version": "5.0.0"}',
        'node_modules/make-dir/package.json': '{"version": "3.1.0"}',
        'node_modules/minimatch/package.json': '{"version": "3.1.2"}',
        'node_modules/mkdirp/package.json': '{"version": "0.5.6"}',
        'node_modules/ms/package.json': '{"version": "2.0.0"}',
        'node_modules/optionator/package.json': '{"version": "0.9.1"}',
        'node_modules/p-limit/package.json': '{"version": "3.1.0"}',
        'node_modules/p-locate/package.json': '{"version": "4.1.0"}',
        'node_modules/parse5/package.json': '{"version": "6.0.1"}',
        'node_modules/pify/package.json': '{"version": "2.3.0"}',
        'node_modules/pkg-dir/package.json': '{"version": "4.2.0"}',
        'node_modules/postcss/package.json': '{"version": "8.4.20"}',
        'node_modules/prelude-ls/package.json': '{"version": "1.1.2"}',
        'node_modules/pretty-format/package.json': '{"version": "28.1.3"}',
        'node_modules/proxy-from-env/package.json': '{"version": "1.0.0"}',
        'node_modules/qs/package.json': '{"version": "6.11.0"}',
        'node_modules/react-is/package.json': '{"version": "18.2.0"}',
        'node_modules/readable-stream/package.json': '{"version": "3.6.0"}',
        'node_modules/regenerator-runtime/package.json':
          '{"version": "0.13.7"}',
        'node_modules/resolve-from/package.json': '{"version": "5.0.0"}',
        'node_modules/resolve/package.json': '{"version": "1.22.1"}',
        'node_modules/rxjs/package.json': '{"version": "6.6.7"}',
        'node_modules/safe-buffer/package.json': '{"version": "5.2.1"}',
        'node_modules/schema-utils/package.json': '{"version": "3.1.1"}',
        'node_modules/semver/package.json': '{"version": "6.3.0"}',
        'node_modules/setprototypeof/package.json': '{"version": "1.2.0"}',
        'node_modules/slash/package.json': '{"version": "3.0.0"}',
        'node_modules/slice-ansi/package.json': '{"version": "3.0.0"}',
        'node_modules/source-map-support/package.json': '{"version": "0.5.13"}',
        'node_modules/source-map/package.json': '{"version": "0.6.1"}',
        'node_modules/statuses/package.json': '{"version": "2.0.1"}',
        'node_modules/string_decoder/package.json': '{"version": "1.3.0"}',
        'node_modules/strip-bom/package.json': '{"version": "3.0.0"}',
        'node_modules/supports-color/package.json': '{"version": "7.2.0"}',
        'node_modules/tough-cookie/package.json': '{"version": "4.1.2"}',
        'node_modules/tslib/package.json': '{"version": "2.4.1"}',
        'node_modules/type-check/package.json': '{"version": "0.3.2"}',
        'node_modules/type-fest/package.json': '{"version": "0.20.2"}',
        'node_modules/universalify/package.json': '{"version": "2.0.0"}',
        'node_modules/whatwg-url/package.json': '{"version": "10.0.0"}',
        'node_modules/wrap-ansi/package.json': '{"version": "7.0.0"}',
      };
      vol.fromJSON(fileSys, '/root');
    });

    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package.json'
    ));

    it('should parse root lock file', async () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/yarn.lock'
      )).default;
      const result = parseYarnLockFile(lockFile, packageJson);
      expect(result.nodes.size).toEqual(1245); // 1104
      expect(result.isValid).toBeTruthy();
    });
  });

  describe('auxiliary packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/brace-expansion/package.json': '{"version": "1.1.11"}',
        'node_modules/eslint-visitor-keys/package.json': '{"version": "3.3.0"}',
        'node_modules/ignore/package.json': '{"version": "5.2.4"}',
        'node_modules/minimatch/package.json': '{"version": "3.1.2"}',
      };
      vol.fromJSON(fileSys, '/root');
    });

    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package.json'
    ));

    it('should parse yarn classic', async () => {
      const classicLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/yarn.lock'
      )).default;
      const resultClassic = parseYarnLockFile(classicLockFile, packageJson);
      expect(resultClassic.nodes.size).toEqual(128); // 124 hoisted
      expect(resultClassic.isValid).toBeTruthy();

      const classicPostgres = resultClassic.nodes.get(
        'postgres@https://codeload.github.com/charsleysa/postgres/tar.gz/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(classicPostgres.name).toEqual('postgres');
      expect(classicPostgres.packageName).toBeUndefined();
      expect(classicPostgres.version).toMatch(
        '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(classicPostgres.edgesIn.values().next().value.versionSpec).toEqual(
        'charsleysa/postgres#fix-errors-compiled'
      );

      const classicAlias = resultClassic.nodes.get(
        'eslint-plugin-disable-autofix@npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0'
      );
      expect(classicAlias.name).toEqual('eslint-plugin-disable-autofix');
      expect(classicAlias.packageName).toEqual(
        '@mattlewis92/eslint-plugin-disable-autofix'
      );
      expect(classicAlias.version).toEqual('3.0.0');
      expect(classicAlias.edgesIn.values().next().value.versionSpec).toEqual(
        'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0'
      );
    });

    it('should parse yarn berry', async () => {
      const berryLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/yarn-berry.lock'
      )).default;
      const resultBerry = parseYarnLockFile(berryLockFile, packageJson);
      expect(resultBerry.nodes.size).toEqual(129); //124 hoisted
      expect(resultBerry.isValid).toBeTruthy();

      const berryPostgres = resultBerry.nodes.get(
        'postgres@https://github.com/charsleysa/postgres.git#commit=3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(berryPostgres.name).toEqual('postgres');
      expect(berryPostgres.packageName).toBeUndefined();
      expect(berryPostgres.version).toMatch(
        '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(berryPostgres.edgesIn.values().next().value.versionSpec).toEqual(
        'charsleysa/postgres#fix-errors-compiled'
      );

      const berryAlias = resultBerry.nodes.get(
        'eslint-plugin-disable-autofix@npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0'
      );
      expect(berryAlias.name).toEqual('eslint-plugin-disable-autofix');
      expect(berryAlias.packageName).toEqual(
        '@mattlewis92/eslint-plugin-disable-autofix'
      );
      expect(berryAlias.version).toEqual('3.0.0');
      expect(berryAlias.edgesIn.values().next().value.versionSpec).toEqual(
        'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0'
      );
    });
  });

  describe('duplicate packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@jest/test-result/package.json': '{"version": "28.1.3"}',
        'node_modules/@jridgewell/gen-mapping/package.json':
          '{"version": "0.1.1"}',
        'node_modules/@nrwl/cli/package.json': '{"version": "15.4.0"}',
        'node_modules/@nrwl/tao/package.json': '{"version": "15.4.0"}',
        'node_modules/ansi-styles/package.json': '{"version": "4.3.0"}',
        'node_modules/argparse/package.json': '{"version": "2.0.1"}',
        'node_modules/brace-expansion/package.json': '{"version": "1.1.11"}',
        'node_modules/camelcase/package.json': '{"version": "6.3.0"}',
        'node_modules/chalk/package.json': '{"version": "4.1.2"}',
        'node_modules/cliui/package.json': '{"version": "7.0.4"}',
        'node_modules/color-convert/package.json': '{"version": "2.0.1"}',
        'node_modules/color-name/package.json': '{"version": "1.1.4"}',
        'node_modules/escape-string-regexp/package.json':
          '{"version": "1.0.5"}',
        'node_modules/glob/package.json': '{"version": "7.2.3"}',
        'node_modules/has-flag/package.json': '{"version": "4.0.0"}',
        'node_modules/jest-resolve/package.json': '{"version": "28.1.3"}',
        'node_modules/jest-util/package.json': '{"version": "28.1.3"}',
        'node_modules/js-yaml/package.json': '{"version": "3.14.1"}',
        'node_modules/json5/package.json': '{"version": "1.0.2"}',
        'node_modules/lru-cache/package.json': '{"version": "6.0.0"}',
        'node_modules/minimatch/package.json': '{"version": "3.1.2"}',
        'node_modules/nx/package.json': '{"version": "15.4.0"}',
        'node_modules/p-limit/package.json': '{"version": "3.1.0"}',
        'node_modules/semver/package.json': '{"version": "6.3.0"}',
        'node_modules/strip-bom/package.json': '{"version": "3.0.0"}',
        'node_modules/supports-color/package.json': '{"version": "7.2.0"}',
        'node_modules/tslib/package.json': '{"version": "2.4.1"}',
        'node_modules/yallist/package.json': '{"version": "4.0.0"}',
        'node_modules/yargs-parser/package.json': '{"version": "21.0.1"}',
      };
      vol.fromJSON(fileSys, '/root');
    });

    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/duplicate-package/package.json'
    ));

    it('should parse root lock file', async () => {
      const classicLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/yarn.lock'
      )).default;
      const resultClassic = parseYarnLockFile(classicLockFile, packageJson);
      expect(resultClassic.nodes.size).toEqual(372); //337 hoisted
      expect(resultClassic.isValid).toBeTruthy();
    });
  });
});
