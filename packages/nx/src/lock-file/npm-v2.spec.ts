import { joinPathFragments } from '../utils/path';
import { parseNpmLockFile } from './npm-v2';
import { vol } from 'memfs';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('NPM lock file utility', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('next.js generated', () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package-lock.json'
    ));
    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package.json'
    ));

    it('should parse root lock file', async () => {
      const result = parseNpmLockFile(
        JSON.stringify(rootLockFile),
        packageJson
      );
      expect(result.root.children.size).toEqual(1143);
      expect(result.isValid).toBeTruthy();
    });
  });

  describe('auxiliary packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@nrwl/devkit/package.json':
          '{"peerDependencies":{"nx":">= 14 <= 16"}}',
        'node_modules/@phenomnomnominal/tsquery/package.json':
          '{"peerDependencies":{"typescript":"^3 || ^4"}}',
        'node_modules/@yarnpkg/parsers/node_modules/argparse/package.json':
          '{}',
        'node_modules/@yarnpkg/parsers/node_modules/js-yaml/package.json': '{}',
        'node_modules/acorn-jsx/package.json':
          '{"peerDependencies":{"acorn":"^6.0.0 || ^7.0.0 || ^8.0.0"}}',
        'node_modules/debug/package.json':
          '{"peerDependenciesMeta":{"supports-color":{"optional":true}}}',
        'node_modules/eslint-utils/package.json':
          '{"peerDependencies":{"eslint":">=5"}}',
        'node_modules/follow-redirects/package.json':
          '{"peerDependenciesMeta":{"debug":{"optional":true}}}',
        'node_modules/json-stable-stringify-without-jsonify/package.json': '{}',
        'node_modules/nx/package.json':
          '{"peerDependencies":{"@swc-node/register":"^1.4.2","@swc/core":"^1.2.173"},"peerDependenciesMeta":{"@swc-node/register":{"optional":true},"@swc/core":{"optional":true}}}',
      };
      vol.fromJSON(fileSys, '/root');
    });

    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package.json'
    ));

    it('should parse v1', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/package-lock.json'
      ));

      const resultV1 = parseNpmLockFile(
        JSON.stringify(rootLockFile),
        packageJson
      );

      expect(resultV1.root.children.size).toEqual(202);
      expect(resultV1.isValid).toBeTruthy();

      expect(resultV1.nodes.get('node_modules/postgres').name).toEqual(
        'postgres'
      );
      expect(
        resultV1.nodes.get('node_modules/postgres').packageName
      ).toBeUndefined();
      expect(resultV1.nodes.get('node_modules/postgres').version).toMatch(
        '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(
        resultV1.nodes.get('node_modules/postgres').edgesIn.values().next()
          .value.versionSpec
      ).toMatch('charsleysa/postgres#fix-errors-compiled');

      expect(
        resultV1.nodes.get('node_modules/eslint-plugin-disable-autofix').name
      ).toEqual('eslint-plugin-disable-autofix');
      expect(
        resultV1.nodes.get('node_modules/eslint-plugin-disable-autofix')
          .packageName
      ).toEqual('@mattlewis92/eslint-plugin-disable-autofix');
      expect(
        resultV1.nodes.get('node_modules/eslint-plugin-disable-autofix').version
      ).toEqual('3.0.0');
      expect(
        resultV1.nodes
          .get('node_modules/eslint-plugin-disable-autofix')
          .edgesIn.values()
          .next().value.versionSpec
      ).toEqual('npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0');
    });

    it('should parse v3', async () => {
      const rootV2LockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/package-lock-v2.json'
      ));

      const resultV2 = parseNpmLockFile(
        JSON.stringify(rootV2LockFile),
        packageJson
      );
      expect(resultV2.root.children.size).toEqual(resultV2.root.children.size);
      expect(resultV2.isValid).toBeTruthy();

      expect(resultV2.nodes.get('node_modules/postgres').name).toEqual(
        'postgres'
      );
      expect(
        resultV2.nodes.get('node_modules/postgres').packageName
      ).toBeUndefined();
      expect(resultV2.nodes.get('node_modules/postgres').version).toMatch(
        '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
      );
      expect(
        resultV2.nodes.get('node_modules/postgres').edgesIn.values().next()
          .value.versionSpec
      ).toEqual('charsleysa/postgres#fix-errors-compiled');

      expect(
        resultV2.nodes.get('node_modules/eslint-plugin-disable-autofix').name
      ).toEqual('eslint-plugin-disable-autofix');
      expect(
        resultV2.nodes.get('node_modules/eslint-plugin-disable-autofix')
          .packageName
      ).toEqual('@mattlewis92/eslint-plugin-disable-autofix');
      expect(
        resultV2.nodes.get('node_modules/eslint-plugin-disable-autofix').version
      ).toEqual('3.0.0');
      expect(
        resultV2.nodes
          .get('node_modules/eslint-plugin-disable-autofix')
          .edgesIn.values()
          .next().value.versionSpec
      ).toEqual('npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0');
    });
  });

  describe('duplicate packages', () => {
    beforeEach(() => {
      const fileSys = {
        'node_modules/@babel/helper-compilation-targets/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0"}}',
        'node_modules/@babel/plugin-syntax-async-generators/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-bigint/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-class-properties/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-import-meta/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-json-strings/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-logical-assignment-operators/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-nullish-coalescing-operator/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-numeric-separator/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-object-rest-spread/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-optional-catch-binding/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-optional-chaining/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-top-level-await/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@babel/plugin-syntax-typescript/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0-0"}}',
        'node_modules/@jest/reporters/package.json':
          '{"peerDependencies":{"node-notifier":"^8.0.1 || ^9.0.0 || ^10.0.0"},"peerDependenciesMeta":{"node-notifier":{"optional":true}}}',
        'node_modules/@nrwl/devkit/package.json':
          '{"peerDependencies":{"nx":">= 13.10 <= 15"}}',
        'node_modules/@nrwl/linter/package.json':
          '{"peerDependencies":{"eslint":"^8.0.0"},"peerDependenciesMeta":{"eslint":{"optional":true}}}',
        'node_modules/@nrwl/linter/node_modules/nx/package.json':
          '{"peerDependencies":{"@swc-node/register":"^1.4.2","@swc/core":"^1.2.173"},"peerDependenciesMeta":{"@swc-node/register":{"optional":true},"@swc/core":{"optional":true}}}',
        'node_modules/@nrwl/workspace/package.json':
          '{"peerDependencies":{"prettier":"^2.6.2"},"peerDependenciesMeta":{"prettier":{"optional":true}}}',
        'node_modules/@nrwl/workspace/node_modules/nx/package.json':
          '{"peerDependencies":{"@swc-node/register":"^1.4.2","@swc/core":"^1.2.173"},"peerDependenciesMeta":{"@swc-node/register":{"optional":true},"@swc/core":{"optional":true}}}',
        'node_modules/@phenomnomnominal/tsquery/package.json':
          '{"peerDependencies":{"typescript":"^3 || ^4"}}',
        'node_modules/babel-jest/package.json':
          '{"peerDependencies":{"@babel/core":"^7.8.0"}}',
        'node_modules/babel-preset-current-node-syntax/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0"}}',
        'node_modules/babel-preset-jest/package.json':
          '{"peerDependencies":{"@babel/core":"^7.0.0"}}',
        'node_modules/debug/package.json':
          '{"peerDependenciesMeta":{"supports-color":{"optional":true}}}',
        'node_modules/follow-redirects/package.json':
          '{"peerDependenciesMeta":{"debug":{"optional":true}}}',
        'node_modules/jest-config/package.json':
          '{"peerDependencies":{"@types/node":"*","ts-node":">=9.0.0"},"peerDependenciesMeta":{"@types/node":{"optional":true},"ts-node":{"optional":true}}}',
        'node_modules/jest-pnp-resolver/package.json':
          '{"peerDependencies":{"jest-resolve":"*"},"peerDependenciesMeta":{"jest-resolve":{"optional":true}}}',
        'node_modules/nx/package.json':
          '{"peerDependencies":{"@swc-node/register":"^1.4.2","@swc/core":"^1.2.173"},"peerDependenciesMeta":{"@swc-node/register":{"optional":true},"@swc/core":{"optional":true}}}',
        'node_modules/update-browserslist-db/package.json':
          '{"peerDependencies":{"browserslist":">= 4.21.0"}}',
      };
      vol.fromJSON(fileSys, '/root');
    });

    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/duplicate-package/package.json'
    ));

    it('should parse v1', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/package-lock-v1.json'
      ));

      const result = parseNpmLockFile(
        JSON.stringify(rootLockFile),
        packageJson
      );
      expect(result.root.children.size).toEqual(338);
      expect(result.isValid).toBeTruthy();
    });
    it('should parse v3', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/package-lock.json'
      ));

      const result = parseNpmLockFile(
        JSON.stringify(rootLockFile),
        packageJson
      );
      expect(result.root.children.size).toEqual(338);
      expect(result.isValid).toBeTruthy();
    });
  });
});
