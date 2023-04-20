import { joinPathFragments } from '../../../utils/path';
import { parseNpmLockfile, stringifyNpmLockfile } from './npm-parser';
import { pruneProjectGraph } from './project-graph-pruning';
import { vol } from 'memfs';
import { ProjectGraph } from '../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';

jest.mock('fs', () => require('memfs').fs);

describe('NPM lock file utility', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('next.js generated', () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package-lock.json'
    ));

    let graph: ProjectGraph;

    beforeEach(() => {
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootLockFile), builder);
      graph = builder.getUpdatedProjectGraph();
    });

    it('should parse root lock file', async () => {
      expect(Object.keys(graph.externalNodes).length).toEqual(1285);
    });

    it('should prune lock file', async () => {
      const appPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/app/package.json'
      ));
      const appLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/nextjs/app/package-lock.json'
      ));

      // this is original generated lock file
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(appLockFile), builder);
      const appGraph = builder.getUpdatedProjectGraph();
      expect(Object.keys(appGraph.externalNodes).length).toEqual(984);

      // this is our pruned lock file structure
      const prunedGraph = pruneProjectGraph(graph, appPackageJson);
      expect(Object.keys(prunedGraph.externalNodes).length).toEqual(
        Object.keys(appGraph.externalNodes).length
      );

      const keys = new Set(Object.keys(prunedGraph.externalNodes));
      const originalKeys = new Set(Object.keys(appGraph.externalNodes));
      expect(keys).toEqual(originalKeys);
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

    it('should parse v1', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/package-lock.json'
      ));

      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootLockFile), builder);
      const graph = builder.getUpdatedProjectGraph();

      expect(Object.keys(graph.externalNodes).length).toEqual(212); // 202

      expect(graph.externalNodes['npm:minimatch']).toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
            "packageName": "minimatch",
            "version": "3.1.2",
          },
          "name": "npm:minimatch",
          "type": "npm",
        }
      `);
      expect(graph.externalNodes['npm:minimatch@5.1.1']).toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-362NP+zlprccbEt/SkxKfRMHnNY85V74mVnpUpNyr3F35covl09Kec7/sEFLt3RA4oXmewtoaanoIf67SE5Y5g==",
            "packageName": "minimatch",
            "version": "5.1.1",
          },
          "name": "npm:minimatch@5.1.1",
          "type": "npm",
        }
      `);
      expect(graph.externalNodes['npm:postgres']).toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-M7i4XVjrrReHG+IjWEeDSfBnyNg2Q5OQpxrr3dqCGpleYx0FyUpMQZfk8zb6yyPrn6ut3KbrkYfnAf+TG6DPLQ==",
            "packageName": "postgres",
            "version": "git+ssh://git@github.com/charsleysa/postgres.git#3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
          },
          "name": "npm:postgres",
          "type": "npm",
        }
      `);
      expect(graph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-zYDdpaj+1Al8Ki3WpY2I9bOAd8NSgFWGT7yR6KemSi25qWwDMNArnR2q6gDEDKSw+KuYY4shFxkY/JpoNF64tg==",
            "packageName": "eslint-plugin-disable-autofix",
            "version": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });

    it('should parse v3', async () => {
      const rootV2LockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/package-lock-v2.json'
      ));

      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootV2LockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      expect(Object.keys(graph.externalNodes).length).toEqual(212);

      expect(graph.externalNodes['npm:minimatch']).toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
            "packageName": "minimatch",
            "version": "3.1.2",
          },
          "name": "npm:minimatch",
          "type": "npm",
        }
      `);
      expect(graph.externalNodes['npm:minimatch@5.1.1']).toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-362NP+zlprccbEt/SkxKfRMHnNY85V74mVnpUpNyr3F35covl09Kec7/sEFLt3RA4oXmewtoaanoIf67SE5Y5g==",
            "packageName": "minimatch",
            "version": "5.1.1",
          },
          "name": "npm:minimatch@5.1.1",
          "type": "npm",
        }
      `);
      expect(graph.externalNodes['npm:postgres']).toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-M7i4XVjrrReHG+IjWEeDSfBnyNg2Q5OQpxrr3dqCGpleYx0FyUpMQZfk8zb6yyPrn6ut3KbrkYfnAf+TG6DPLQ==",
            "packageName": "postgres",
            "version": "git+ssh://git@github.com/charsleysa/postgres.git#3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
          },
          "name": "npm:postgres",
          "type": "npm",
        }
      `);
      expect(graph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        {
          "data": {
            "hash": "sha512-zYDdpaj+1Al8Ki3WpY2I9bOAd8NSgFWGT7yR6KemSi25qWwDMNArnR2q6gDEDKSw+KuYY4shFxkY/JpoNF64tg==",
            "packageName": "eslint-plugin-disable-autofix",
            "version": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });

    function cleanupTypes(
      collection: Record<string, any>,
      recursive?: boolean
    ) {
      Object.values(collection).forEach((p: any) => {
        delete p.peer;
        delete p.dev;

        if (p.dependencies && recursive) {
          cleanupTypes(p.dependencies, recursive);
        }
      });
    }

    it('should prune v2', async () => {
      const rootV2LockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/package-lock-v2.json'
      ));
      const prunedV2LockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/package-lock-v2.pruned.json'
      ));
      const normalizedPackageJson = {
        name: 'test',
        version: '0.0.0',
        license: 'MIT',
        dependencies: {
          '@nrwl/devkit': '15.0.13',
          'eslint-plugin-disable-autofix':
            'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0',
          postgres:
            'git+ssh://git@github.com/charsleysa/postgres.git#3b1a01b2da3e2fafb1a79006f838eff11a8de3cb',
          yargs: '17.6.2',
        },
        devDependencies: {
          react: '18.2.0',
        },
        peerDependencies: {
          typescript: '4.8.4',
        },
      };
      // (meeroslav)this test is ignoring types since they are not vital (dev, peer, etc..)
      cleanupTypes(prunedV2LockFile.packages);
      cleanupTypes(prunedV2LockFile.dependencies, true);

      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootV2LockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      const prunedGraph = pruneProjectGraph(graph, normalizedPackageJson);
      const result = stringifyNpmLockfile(
        prunedGraph,
        JSON.stringify(rootV2LockFile),
        normalizedPackageJson
      );

      expect(result).toEqual(JSON.stringify(prunedV2LockFile, null, 2));
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

    it('should parse v1', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/package-lock-v1.json'
      ));

      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootLockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      expect(Object.keys(graph.externalNodes).length).toEqual(369);
    });
    it('should parse v3', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/package-lock.json'
      ));

      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootLockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      expect(Object.keys(graph.externalNodes).length).toEqual(369);
    });
  });

  describe('optional packages', () => {
    it('should match parsed and pruned graph', async () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/optional/package-lock.json'
      ));
      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/optional/package.json'
      ));
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(lockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      expect(Object.keys(graph.externalNodes).length).toEqual(8);

      const prunedGraph = pruneProjectGraph(graph, packageJson);
      expect(Object.keys(prunedGraph.externalNodes).length).toEqual(8);
    });
  });

  describe('pruning', () => {
    let rootLockFile;

    beforeAll(() => {
      rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/package-lock.json'
      ));
    });

    it('should prune single package', () => {
      const typescriptPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/typescript/package.json'
      ));
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootLockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      const prunedGraph = pruneProjectGraph(graph, typescriptPackageJson);
      const result = stringifyNpmLockfile(
        prunedGraph,
        JSON.stringify(rootLockFile),
        typescriptPackageJson
      );

      expect(result).toEqual(
        JSON.stringify(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/typescript/package-lock.json'
          )),
          null,
          2
        )
      );
    });

    it('should prune multi packages', () => {
      const multiPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/pruning/devkit-yargs/package.json'
      ));
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(rootLockFile), builder);
      const graph = builder.getUpdatedProjectGraph();
      const prunedGraph = pruneProjectGraph(graph, multiPackageJson);
      const result = stringifyNpmLockfile(
        prunedGraph,
        JSON.stringify(rootLockFile),
        multiPackageJson
      );

      expect(result).toEqual(
        JSON.stringify(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/devkit-yargs/package-lock.json'
          )),
          null,
          2
        )
      );
    });
  });

  describe('workspaces', () => {
    let lockFile;

    it('should parse v2 lock file', async () => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/workspaces/package-lock.json'
      ));
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(lockFile), builder);
      const result = builder.getUpdatedProjectGraph();
      expect(Object.keys(result.externalNodes).length).toEqual(5);
    });

    it('should parse v1 lock file', async () => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/workspaces/package-lock.v1.json'
      ));
      const builder = new ProjectGraphBuilder();
      parseNpmLockfile(JSON.stringify(lockFile), builder);
      const result = builder.getUpdatedProjectGraph();
      expect(Object.keys(result.externalNodes).length).toEqual(5);
    });
  });
});
