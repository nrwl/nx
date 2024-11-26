import { joinPathFragments } from '../../../utils/path';
import {
  getNpmLockfileDependencies,
  getNpmLockfileNodes,
  stringifyNpmLockfile,
} from './npm-parser';
import { pruneProjectGraph } from './project-graph-pruning';
import { vol } from 'memfs';
import { ProjectGraph } from '../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { CreateDependenciesContext } from '../../../project-graph/plugins';

jest.mock('fs', () => {
  const memFs = require('memfs').fs;
  return {
    ...memFs,
    existsSync: (p) => (p.endsWith('.node') ? true : memFs.existsSync(p)),
  };
});

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
      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const pg: ProjectGraph = {
        dependencies: {},
        nodes: {},
        externalNodes,
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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
      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(appLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(appLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootV2LockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootV2LockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootV2LockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootV2LockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
      const graph = builder.getUpdatedProjectGraph();

      expect(Object.keys(graph.externalNodes).length).toEqual(369);
    });
    it('should parse v3', async () => {
      const rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/duplicate-package/package-lock.json'
      ));

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(JSON.stringify(lockFile), hash);
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(lockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
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

  describe('pruning handling npm hoisting', () => {
    let rootLockFile;

    beforeAll(() => {
      rootLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/npm-hoisting/package-lock.json'
      ));
    });

    it('should prune correctly', () => {
      const appPackageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/npm-hoisting/app/package.json'
      ));

      const hash = uniq('mock-hash');
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(rootLockFile),
        hash
      );
      const pg = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(rootLockFile),
        hash,
        ctx
      );

      const builder = new ProjectGraphBuilder(pg);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
      const graph = builder.getUpdatedProjectGraph();

      const prunedGraph = pruneProjectGraph(graph, appPackageJson);
      const result = stringifyNpmLockfile(
        prunedGraph,
        JSON.stringify(rootLockFile),
        appPackageJson
      );

      expect(result).toEqual(
        JSON.stringify(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/npm-hoisting/app/package-lock.json'
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

      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(lockFile),
        uniq('mock-hash')
      );

      expect(Object.keys(externalNodes).length).toEqual(5);
    });

    it('should parse v1 lock file', async () => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/workspaces/package-lock.v1.json'
      ));
      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(lockFile),
        uniq('mock')
      );
      expect(Object.keys(externalNodes).length).toEqual(5);
    });
  });

  describe('mixed keys', () => {
    let lockFile, lockFileHash;

    beforeEach(() => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/mixed-keys/package-lock.json'
      ));
      lockFileHash = '__fixtures__/mixed-keys/package-lock.json';
    });

    it('should parse and prune packages with mixed keys', () => {
      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/mixed-keys/package.json'
      ));

      const externalNodes = getNpmLockfileNodes(
        JSON.stringify(lockFile),
        lockFileHash
      );
      let graph: ProjectGraph = {
        nodes: {},
        dependencies: {},
        externalNodes,
      };
      const ctx: CreateDependenciesContext = {
        projects: {},
        externalNodes,
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        nxJsonConfiguration: null,
        workspaceRoot: '/virtual',
      };
      const dependencies = getNpmLockfileDependencies(
        JSON.stringify(lockFile),
        lockFileHash,
        ctx
      );

      const builder = new ProjectGraphBuilder(graph);
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : null
        );
      }
      graph = builder.getUpdatedProjectGraph();

      expect(graph.externalNodes).toMatchInlineSnapshot(`
        {
          "npm:@isaacs/cliui": {
            "data": {
              "hash": "sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==",
              "packageName": "@isaacs/cliui",
              "version": "8.0.2",
            },
            "name": "npm:@isaacs/cliui",
            "type": "npm",
          },
          "npm:ansi-regex": {
            "data": {
              "hash": "sha512-n5M855fKb2SsfMIiFFoVrABHJC8QtHwVx+mHWP3QcEqBHYienj5dHSgjbxtC0WEZXYt4wcD6zrQElDPhFuZgfA==",
              "packageName": "ansi-regex",
              "version": "6.0.1",
            },
            "name": "npm:ansi-regex",
            "type": "npm",
          },
          "npm:ansi-regex@5.0.1": {
            "data": {
              "hash": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
              "packageName": "ansi-regex",
              "version": "5.0.1",
            },
            "name": "npm:ansi-regex@5.0.1",
            "type": "npm",
          },
          "npm:ansi-styles": {
            "data": {
              "hash": "sha512-bN798gFfQX+viw3R7yrGWRqnrN2oRkEkUjjl4JNn4E8GxxbjtG3FbrEIIY3l8/hrwUwIeCZvi4QuOTP4MErVug==",
              "packageName": "ansi-styles",
              "version": "6.2.1",
            },
            "name": "npm:ansi-styles",
            "type": "npm",
          },
          "npm:ansi-styles@4.3.0": {
            "data": {
              "hash": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
              "packageName": "ansi-styles",
              "version": "4.3.0",
            },
            "name": "npm:ansi-styles@4.3.0",
            "type": "npm",
          },
          "npm:cliui": {
            "data": {
              "hash": "sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==",
              "packageName": "cliui",
              "version": "8.0.1",
            },
            "name": "npm:cliui",
            "type": "npm",
          },
          "npm:color-convert": {
            "data": {
              "hash": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
              "packageName": "color-convert",
              "version": "2.0.1",
            },
            "name": "npm:color-convert",
            "type": "npm",
          },
          "npm:color-name": {
            "data": {
              "hash": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
              "packageName": "color-name",
              "version": "1.1.4",
            },
            "name": "npm:color-name",
            "type": "npm",
          },
          "npm:eastasianwidth": {
            "data": {
              "hash": "sha512-I88TYZWc9XiYHRQ4/3c5rjjfgkjhLyW2luGIheGERbNQ6OY7yTybanSpDXZa8y7VUP9YmDcYa+eyq4ca7iLqWA==",
              "packageName": "eastasianwidth",
              "version": "0.2.0",
            },
            "name": "npm:eastasianwidth",
            "type": "npm",
          },
          "npm:emoji-regex": {
            "data": {
              "hash": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
              "packageName": "emoji-regex",
              "version": "9.2.2",
            },
            "name": "npm:emoji-regex",
            "type": "npm",
          },
          "npm:emoji-regex@8.0.0": {
            "data": {
              "hash": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
              "packageName": "emoji-regex",
              "version": "8.0.0",
            },
            "name": "npm:emoji-regex@8.0.0",
            "type": "npm",
          },
          "npm:is-fullwidth-code-point": {
            "data": {
              "hash": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
              "packageName": "is-fullwidth-code-point",
              "version": "3.0.0",
            },
            "name": "npm:is-fullwidth-code-point",
            "type": "npm",
          },
          "npm:string-width": {
            "data": {
              "hash": "sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==",
              "packageName": "string-width",
              "version": "5.1.2",
            },
            "name": "npm:string-width",
            "type": "npm",
          },
          "npm:string-width-cjs": {
            "data": {
              "hash": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
              "packageName": "string-width-cjs",
              "version": "npm:string-width@4.2.3",
            },
            "name": "npm:string-width-cjs",
            "type": "npm",
          },
          "npm:string-width@4.2.3": {
            "data": {
              "hash": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
              "packageName": "string-width",
              "version": "4.2.3",
            },
            "name": "npm:string-width@4.2.3",
            "type": "npm",
          },
          "npm:strip-ansi": {
            "data": {
              "hash": "sha512-iq6eVVI64nQQTRYq2KtEg2d2uU7LElhTJwsH4YzIHZshxlgZms/wIc4VoDQTlG/IvVIrBKG06CrZnp0qv7hkcQ==",
              "packageName": "strip-ansi",
              "version": "7.1.0",
            },
            "name": "npm:strip-ansi",
            "type": "npm",
          },
          "npm:strip-ansi-cjs": {
            "data": {
              "hash": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
              "packageName": "strip-ansi-cjs",
              "version": "npm:strip-ansi@6.0.1",
            },
            "name": "npm:strip-ansi-cjs",
            "type": "npm",
          },
          "npm:strip-ansi@6.0.1": {
            "data": {
              "hash": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
              "packageName": "strip-ansi",
              "version": "6.0.1",
            },
            "name": "npm:strip-ansi@6.0.1",
            "type": "npm",
          },
          "npm:wrap-ansi": {
            "data": {
              "hash": "sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==",
              "packageName": "wrap-ansi",
              "version": "8.1.0",
            },
            "name": "npm:wrap-ansi",
            "type": "npm",
          },
          "npm:wrap-ansi-cjs": {
            "data": {
              "hash": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
              "packageName": "wrap-ansi-cjs",
              "version": "npm:wrap-ansi@7.0.0",
            },
            "name": "npm:wrap-ansi-cjs",
            "type": "npm",
          },
          "npm:wrap-ansi@7.0.0": {
            "data": {
              "hash": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
              "packageName": "wrap-ansi",
              "version": "7.0.0",
            },
            "name": "npm:wrap-ansi@7.0.0",
            "type": "npm",
          },
        }
      `);

      expect(graph.dependencies).toMatchInlineSnapshot(`
        {
          "npm:@isaacs/cliui": [
            {
              "source": "npm:@isaacs/cliui",
              "target": "npm:string-width",
              "type": "static",
            },
            {
              "source": "npm:@isaacs/cliui",
              "target": "npm:string-width-cjs",
              "type": "static",
            },
            {
              "source": "npm:@isaacs/cliui",
              "target": "npm:strip-ansi",
              "type": "static",
            },
            {
              "source": "npm:@isaacs/cliui",
              "target": "npm:strip-ansi-cjs",
              "type": "static",
            },
            {
              "source": "npm:@isaacs/cliui",
              "target": "npm:wrap-ansi",
              "type": "static",
            },
            {
              "source": "npm:@isaacs/cliui",
              "target": "npm:wrap-ansi-cjs",
              "type": "static",
            },
          ],
          "npm:ansi-styles@4.3.0": [
            {
              "source": "npm:ansi-styles@4.3.0",
              "target": "npm:color-convert",
              "type": "static",
            },
          ],
          "npm:cliui": [
            {
              "source": "npm:cliui",
              "target": "npm:string-width@4.2.3",
              "type": "static",
            },
            {
              "source": "npm:cliui",
              "target": "npm:strip-ansi@6.0.1",
              "type": "static",
            },
            {
              "source": "npm:cliui",
              "target": "npm:wrap-ansi@7.0.0",
              "type": "static",
            },
          ],
          "npm:color-convert": [
            {
              "source": "npm:color-convert",
              "target": "npm:color-name",
              "type": "static",
            },
          ],
          "npm:string-width": [
            {
              "source": "npm:string-width",
              "target": "npm:eastasianwidth",
              "type": "static",
            },
            {
              "source": "npm:string-width",
              "target": "npm:emoji-regex",
              "type": "static",
            },
            {
              "source": "npm:string-width",
              "target": "npm:strip-ansi",
              "type": "static",
            },
          ],
          "npm:string-width-cjs": [
            {
              "source": "npm:string-width-cjs",
              "target": "npm:emoji-regex@8.0.0",
              "type": "static",
            },
            {
              "source": "npm:string-width-cjs",
              "target": "npm:is-fullwidth-code-point",
              "type": "static",
            },
            {
              "source": "npm:string-width-cjs",
              "target": "npm:strip-ansi@6.0.1",
              "type": "static",
            },
          ],
          "npm:string-width@4.2.3": [
            {
              "source": "npm:string-width@4.2.3",
              "target": "npm:emoji-regex@8.0.0",
              "type": "static",
            },
            {
              "source": "npm:string-width@4.2.3",
              "target": "npm:is-fullwidth-code-point",
              "type": "static",
            },
            {
              "source": "npm:string-width@4.2.3",
              "target": "npm:strip-ansi@6.0.1",
              "type": "static",
            },
          ],
          "npm:strip-ansi": [
            {
              "source": "npm:strip-ansi",
              "target": "npm:ansi-regex",
              "type": "static",
            },
          ],
          "npm:strip-ansi-cjs": [
            {
              "source": "npm:strip-ansi-cjs",
              "target": "npm:ansi-regex@5.0.1",
              "type": "static",
            },
          ],
          "npm:strip-ansi@6.0.1": [
            {
              "source": "npm:strip-ansi@6.0.1",
              "target": "npm:ansi-regex@5.0.1",
              "type": "static",
            },
          ],
          "npm:wrap-ansi": [
            {
              "source": "npm:wrap-ansi",
              "target": "npm:ansi-styles",
              "type": "static",
            },
            {
              "source": "npm:wrap-ansi",
              "target": "npm:string-width",
              "type": "static",
            },
            {
              "source": "npm:wrap-ansi",
              "target": "npm:strip-ansi",
              "type": "static",
            },
          ],
          "npm:wrap-ansi-cjs": [
            {
              "source": "npm:wrap-ansi-cjs",
              "target": "npm:ansi-styles@4.3.0",
              "type": "static",
            },
            {
              "source": "npm:wrap-ansi-cjs",
              "target": "npm:string-width@4.2.3",
              "type": "static",
            },
            {
              "source": "npm:wrap-ansi-cjs",
              "target": "npm:strip-ansi@6.0.1",
              "type": "static",
            },
          ],
          "npm:wrap-ansi@7.0.0": [
            {
              "source": "npm:wrap-ansi@7.0.0",
              "target": "npm:ansi-styles@4.3.0",
              "type": "static",
            },
            {
              "source": "npm:wrap-ansi@7.0.0",
              "target": "npm:string-width@4.2.3",
              "type": "static",
            },
            {
              "source": "npm:wrap-ansi@7.0.0",
              "target": "npm:strip-ansi@6.0.1",
              "type": "static",
            },
          ],
        }
      `);

      const prunedGraph = pruneProjectGraph(graph, packageJson);
      const result = stringifyNpmLockfile(
        prunedGraph,
        JSON.stringify(lockFile),
        packageJson
      );
      expect(result).toEqual(
        JSON.stringify(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/mixed-keys/package-lock.json'
          )),
          null,
          2
        )
      );
    });
  });
});

function uniq(str: string) {
  return `str-${(Math.random() * 10000).toFixed(0)}`;
}
