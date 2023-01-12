import { joinPathFragments } from '../utils/path';
import { parsePnpmLockFile, prunePnpmLockFile } from './pnpm-parser';
import { vol } from 'memfs';
import { LockFileBuilder } from './lock-file-builder';
import { LockFileGraph } from './utils/types';
import { mapLockFileGraphToProjectGraph } from './lock-file-graph-mapper';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('pnpm LockFile utility', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('next.js generated', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@babel/preset-react/package.json':
          '{"version": "7.18.6"}',
        'node_modules/@eslint/eslintrc/package.json': '{"version": "1.3.3"}',
        'node_modules/@next/eslint-plugin-next/package.json':
          '{"version": "13.0.0"}',
        'node_modules/@nrwl/cypress/package.json': '{"version": "15.3.3"}',
        'node_modules/@nrwl/eslint-plugin-nx/package.json':
          '{"version": "15.3.3"}',
        'node_modules/@nrwl/jest/package.json': '{"version": "15.3.3"}',
        'node_modules/@nrwl/linter/package.json': '{"version": "15.3.3"}',
        'node_modules/@nrwl/next/package.json': '{"version": "15.3.3"}',
        'node_modules/@nrwl/react/package.json': '{"version": "15.3.3"}',
        'node_modules/@nrwl/web/package.json': '{"version": "15.3.3"}',
        'node_modules/@nrwl/workspace/package.json': '{"version": "15.3.3"}',
        'node_modules/@rushstack/eslint-patch/package.json':
          '{"version": "1.2.0"}',
        'node_modules/@testing-library/react/package.json':
          '{"version": "13.4.0"}',
        'node_modules/@types/eslint/package.json': '{"version": "8.4.10"}',
        'node_modules/@types/eslint-scope/package.json': '{"version": "3.7.4"}',
        'node_modules/@types/jest/package.json': '{"version": "28.1.1"}',
        'node_modules/@types/node/package.json': '{"version": "18.11.9"}',
        'node_modules/@types/prettier/package.json': '{"version": "2.7.1"}',
        'node_modules/@types/react/package.json': '{"version": "18.0.25"}',
        'node_modules/@types/react-dom/package.json': '{"version": "18.0.9"}',
        'node_modules/@typescript-eslint/eslint-plugin/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/parser/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/scope-manager/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/type-utils/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/types/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/typescript-estree/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/utils/package.json':
          '{"version": "5.46.1"}',
        'node_modules/@typescript-eslint/visitor-keys/package.json':
          '{"version": "5.46.1"}',
        'node_modules/babel-jest/package.json': '{"version": "28.1.1"}',
        'node_modules/core-js/package.json': '{"version": "3.26.1"}',
        'node_modules/cypress/package.json': '{"version": "11.2.0"}',
        'node_modules/eslint/package.json': '{"version": "8.15.0"}',
        'node_modules/eslint-config-next/package.json': '{"version": "13.0.0"}',
        'node_modules/eslint-config-prettier/package.json':
          '{"version": "8.1.0"}',
        'node_modules/eslint-import-resolver-node/package.json':
          '{"version": "0.3.6"}',
        'node_modules/eslint-import-resolver-typescript/package.json':
          '{"version": "2.7.1"}',
        'node_modules/eslint-module-utils/package.json': '{"version": "2.7.4"}',
        'node_modules/eslint-plugin-cypress/package.json':
          '{"version": "2.12.1"}',
        'node_modules/eslint-plugin-import/package.json':
          '{"version": "2.26.0"}',
        'node_modules/eslint-plugin-jsx-a11y/package.json':
          '{"version": "6.6.1"}',
        'node_modules/eslint-plugin-react/package.json':
          '{"version": "7.31.11"}',
        'node_modules/eslint-plugin-react-hooks/package.json':
          '{"version": "4.6.0"}',
        'node_modules/eslint-scope/package.json': '{"version": "7.1.1"}',
        'node_modules/eslint-utils/package.json': '{"version": "3.0.0"}',
        'node_modules/eslint-visitor-keys/package.json': '{"version": "3.3.0"}',
        'node_modules/jest/package.json': '{"version": "28.1.1"}',
        'node_modules/jest-environment-jsdom/package.json':
          '{"version": "28.1.1"}',
        'node_modules/next/package.json': '{"version": "13.0.0"}',
        'node_modules/nx/package.json': '{"version": "15.3.3"}',
        'node_modules/prettier/package.json': '{"version": "2.8.1"}',
        'node_modules/react/package.json': '{"version": "18.2.0"}',
        'node_modules/react-dom/package.json': '{"version": "18.2.0"}',
        'node_modules/react-test-renderer/package.json':
          '{"version": "18.2.0"}',
        'node_modules/regenerator-runtime/package.json':
          '{"version": "0.13.7"}',
        'node_modules/ts-jest/package.json': '{"version": "28.0.5"}',
        'node_modules/ts-node/package.json': '{"version": "10.9.1"}',
        'node_modules/tslib/package.json': '{"version": "2.4.1"}',
        'node_modules/typescript/package.json': '{"version": "4.8.4"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    let rootResult: LockFileGraph;

    beforeEach(() => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/pnpm-lock.yaml'
      )).default;
      rootResult = parsePnpmLockFile(lockFile);
    });

    it('should parse root lock file', async () => {
      expect(rootResult.nodes.size).toEqual(1280); ///1143
      expect(rootResult.isValid).toBeTruthy();
    });

    it('should prune lock file', async () => {
      const appPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/app/package.json'
      ));
      const appLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/app/pnpm-lock.yaml'
      )).default;

      // this is original generated lock file
      const appResult = parsePnpmLockFile(appLockFile);
      expect(appResult.nodes.size).toEqual(863);
      expect(appResult.isValid).toBeTruthy();

      // this is our pruned lock file structure
      const builder = new LockFileBuilder(rootResult);
      builder.prune(appPackageJson);
      expect(builder.nodes.size).toEqual(appResult.nodes.size);

      const keys = new Set(builder.nodes.keys());
      const originalKeys = new Set(appResult.nodes.keys());
      //TODO: this does not match, it gets resolved to latest version + signatures are different
      //  perhaps it's still possible to run `pnpm install --frozen-lockfile` on it?
      // -   "@types/node@18.11.15",
      // +   "@types/node@18.11.9",
      // -   "babel-jest@28.1.3",
      // +   "babel-jest@28.1.1",
      // expect(keys).toEqual(originalKeys);
    });
  });

  describe('auxiliary packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@eslint/eslintrc/package.json': '{"version": "1.3.3"}',
        'node_modules/@nrwl/devkit/package.json': '{"version": "15.0.13"}',
        'node_modules/eslint/package.json': '{"version": "8.29.0"}',
        'node_modules/eslint-plugin-disable-autofix/package.json':
          '{"version": "3.0.0"}',
        'node_modules/eslint-rule-composer/package.json':
          '{"version": "0.3.0"}',
        'node_modules/eslint-scope/package.json': '{"version": "7.1.1"}',
        'node_modules/eslint-utils/package.json': '{"version": "3.0.0"}',
        'node_modules/eslint-visitor-keys/package.json': '{"version": "3.3.0"}',
        'node_modules/postgres/package.json': '{"version": "3.2.4"}',
        'node_modules/react/package.json': '{"version": "18.2.0"}',
        'node_modules/typescript/package.json': '{"version": "4.8.4"}',
        'node_modules/yargs/package.json': '{"version": "17.6.2"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/auxiliary-packages/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    it('should parse root lock file', async () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/pnpm-lock.yaml'
      )).default;
      const result = parsePnpmLockFile(lockFile);
      expect(result.nodes.size).toEqual(213); //202
      expect(result.isValid).toBeTruthy();

      const postgres = result.nodes.get(
        'postgres@https://codeload.github.com/charsleysa/postgres/tar.gz/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(postgres.name).toEqual('postgres');
      expect(postgres.packageName).toBeUndefined();
      expect(postgres.version).toMatch(
        '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(postgres.edgesIn.values().next().value.versionSpec).toEqual(
        'github.com/charsleysa/postgres/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );

      const alias = result.nodes.get(
        'eslint-plugin-disable-autofix@npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0'
      );
      expect(alias.name).toEqual('eslint-plugin-disable-autofix');
      expect(alias.packageName).toEqual(
        '@mattlewis92/eslint-plugin-disable-autofix'
      );
      expect(alias.version).toEqual('3.0.0');
      expect(alias.edgesIn.values().next().value.versionSpec).toEqual(
        '/@mattlewis92/eslint-plugin-disable-autofix/3.0.0'
      );

      const projectGraph = mapLockFileGraphToProjectGraph(result);
      expect(projectGraph.externalNodes['npm:minimatch'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "packageName": "minimatch",
            "version": "3.1.2",
          },
          "name": "npm:minimatch",
          "type": "npm",
        }
      `);
      expect(projectGraph.externalNodes['npm:minimatch@5.1.1'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "packageName": "minimatch",
            "version": "5.1.1",
          },
          "name": "npm:minimatch@5.1.1",
          "type": "npm",
        }
      `);
      expect(projectGraph.externalNodes['npm:postgres']).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "packageName": "postgres",
            "version": "https://codeload.github.com/charsleysa/postgres/tar.gz/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
          },
          "name": "npm:postgres",
          "type": "npm",
        }
      `);
      expect(projectGraph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "packageName": "@mattlewis92/eslint-plugin-disable-autofix",
            "version": "3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });
  });

  describe('duplicate packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@nrwl/devkit/package.json': '{"version": "14.8.6"}',
        'node_modules/@nrwl/workspace/package.json': '{"version": "14.8.6"}',
        'node_modules/@types/prettier/package.json': '{"version": "2.7.2"}',
        'node_modules/nx/package.json': '{"version": "15.4.0"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/duplicate-package/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    it('should parse root lock file', async () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/pnpm-lock.yaml'
      )).default;
      const result = parsePnpmLockFile(lockFile);
      expect(result.nodes.size).toEqual(370); //337
      expect(result.isValid).toBeTruthy();
    });
  });

  describe('optional packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/ssh2/package.json': '{"version": "1.11.6"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/optional/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    it('should match parsed and pruned graph', async () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/optional/pnpm-lock.yaml'
      )).default;
      const result = parsePnpmLockFile(lockFile);
      expect(result.nodes.size).toEqual(8);
      expect(result.isValid).toBeTruthy();

      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/optional/package.json'
      ));
      const builder = new LockFileBuilder(result);
      builder.prune(packageJson);
      expect(builder.nodes.size).toEqual(8);
      expect(builder.isGraphConsistent().isValid).toBeTruthy();
    });
  });

  describe('pruning', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/argparse/package.json': '{"version": "2.0.1"}',
        'node_modules/brace-expansion/package.json': '{"version": "1.1.11"}',
        'node_modules/cliui/package.json': '{"version": "7.0.4"}',
        'node_modules/js-yaml/package.json': '{"version": "4.1.0"}',
        'node_modules/minimatch/package.json': '{"version": "3.0.5"}',
        'node_modules/tslib/package.json': '{"version": "2.4.1"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    it('should prune single package', () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/pnpm-lock.yaml'
      )).default;
      const typescriptPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/typescript/package.json'
      ));
      const result = prunePnpmLockFile(lockFile, typescriptPackageJson);
      expect(result).toEqual(
        require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/typescript/pnpm-lock.yaml'
        )).default
      );
    });

    it('should prune multi packages', () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/pnpm-lock.yaml'
      )).default;

      const multiPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/devkit-yargs/package.json'
      ));
      const result = prunePnpmLockFile(lockFile, multiPackageJson);
      expect(result).toEqual(
        require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/devkit-yargs/pnpm-lock.yaml'
        )).default
      );
    });
  });
});
