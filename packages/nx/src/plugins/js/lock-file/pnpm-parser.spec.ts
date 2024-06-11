import { joinPathFragments } from '../../../utils/path';
import {
  getPnpmLockfileNodes,
  getPnpmLockfileDependencies,
  stringifyPnpmLockfile,
} from './pnpm-parser';
import { ProjectGraph } from '../../../config/project-graph';
import { vol } from 'memfs';
import { pruneProjectGraph } from './project-graph-pruning';
import {
  ProjectGraphBuilder,
  RawProjectGraphDependency,
} from '../../../project-graph/project-graph-builder';
import { CreateDependenciesContext } from '../../../project-graph/plugins';

jest.mock('fs', () => {
  const memFs = require('memfs').fs;
  return {
    ...memFs,
    existsSync: (p) => (p.endsWith('.node') ? true : memFs.existsSync(p)),
  };
});

jest.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

jest.mock('../../../hasher/file-hasher', () => ({
  hashArray: (values: string[]) => values.join('|'),
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

    let externalNodes: ProjectGraph['externalNodes'];
    let dependencies: RawProjectGraphDependency[];
    let graph: ProjectGraph;

    let lockFile: string;
    let lockFileHash: string;

    describe('v5.4', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/pnpm-lock.yaml'
        )).default;
        lockFileHash = '__fixtures__/nextjs/pnpm-lock.yaml';

        externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
        graph = {
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
        dependencies = getPnpmLockfileDependencies(lockFile, lockFileHash, ctx);

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
      });

      it('should parse root lock file', async () => {
        expect(Object.keys(externalNodes).length).toEqual(1280);
      });

      it('should prune lock file', async () => {
        const appPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/app/package.json'
        ));

        // this is our pruned lock file structure
        const prunedGraph = pruneProjectGraph(graph, appPackageJson);
        // our pruning keep all transitive peer deps, mainly cypress and eslint
        // which adds 119 more deps
        //  but it's still possible to run `pnpm install --frozen-lockfile` on it (there are e2e tests for that)
        expect(Object.keys(prunedGraph.externalNodes).length).toEqual(
          863 + 119
        );

        // this should not fail
        expect(() =>
          stringifyPnpmLockfile(prunedGraph, lockFile, appPackageJson)
        ).not.toThrow();
      });
    });

    describe('v6.0', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/pnpm-lock-v6.yaml'
        )).default;
        lockFileHash = '__fixtures__/nextjs/pnpm-lock-v6.yaml';
        externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
        graph = {
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
        dependencies = getPnpmLockfileDependencies(lockFile, lockFileHash, ctx);

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
      });

      it('should parse root lock file', async () => {
        expect(Object.keys(graph.externalNodes).length).toEqual(1296);
      });

      it('should prune lock file', async () => {
        const appPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/app/package.json'
        ));
        // this is original generated lock file
        const appLockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/app/pnpm-lock-v6.yaml'
        )).default;
        const appLockFileHash = '__fixtures__/nextjs/app/pnpm-lock-v6.yaml';

        const externalNodes = getPnpmLockfileNodes(
          appLockFile,
          appLockFileHash
        );
        let appGraph: ProjectGraph = {
          nodes: {},
          dependencies: {},
          externalNodes,
        };
        const appCtx: CreateDependenciesContext = {
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
        const dependencies = getPnpmLockfileDependencies(
          appLockFile,
          appLockFileHash,
          appCtx
        );

        const builder = new ProjectGraphBuilder(appGraph);
        for (const dep of dependencies) {
          builder.addDependency(
            dep.source,
            dep.target,
            dep.type,
            'sourceFile' in dep ? dep.sourceFile : null
          );
        }
        appGraph = builder.getUpdatedProjectGraph();
        expect(Object.keys(appGraph.externalNodes).length).toEqual(864);

        // this is our pruned lock file structure
        const prunedGraph = pruneProjectGraph(graph, appPackageJson);
        expect(Object.keys(prunedGraph.externalNodes).length).toEqual(
          864 + 119 // peer cypress adds additional 119 deps
        );

        // this should not fail
        expect(() =>
          stringifyPnpmLockfile(prunedGraph, appLockFile, appPackageJson)
        ).not.toThrow();
      });
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
      const lockFileHash = '__fixtures__/auxiliary-packages/pnpm-lock.yaml';

      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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

      expect(Object.keys(graph.externalNodes).length).toEqual(213);

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
            "hash": "https://codeload.github.com/charsleysa/postgres/tar.gz/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
            "packageName": "postgres",
            "version": "https://codeload.github.com/charsleysa/postgres/tar.gz/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
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

    it('should prune lock file', () => {
      const lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/pnpm-lock.yaml'
      )).default;
      const lockFileHash = '__fixtures__/auxiliary-packages/pnpm-lock.yaml';
      const prunedLockFile: string = require(joinPathFragments(
        __dirname,
        '__fixtures__/auxiliary-packages/pnpm-lock.yaml.pruned'
      )).default;

      const prunedPackageJson = {
        name: 'test',
        version: '0.0.0',
        license: 'MIT',
        dependencies: {
          '@nrwl/devkit': '15.0.13',
          'eslint-plugin-disable-autofix':
            'npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0',
          postgres:
            'https://codeload.github.com/charsleysa/postgres/tar.gz/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb',
          yargs: '17.6.2',
        },
        devDependencies: {
          react: '18.2.0',
        },
        peerDependencies: {
          typescript: '4.8.4',
        },
      };

      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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
      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);
      const result = stringifyPnpmLockfile(
        prunedGraph,
        lockFile,
        prunedPackageJson
      );
      // we replace the dev: true with dev: false because the lock file is generated with dev: false
      // this does not break the intallation, despite being inaccurate
      const manipulatedLockFile = prunedLockFile.replace(
        /dev: true/g,
        'dev: false'
      );
      expect(result).toEqual(manipulatedLockFile);
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
      const lockFileHash = '__fixtures__/duplicate-package/pnpm-lock.yaml';

      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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
      expect(Object.keys(graph.externalNodes).length).toEqual(370);
      expect(Object.keys(graph.dependencies).length).toEqual(213);
      expect(graph.dependencies['npm:@nrwl/devkit'].length).toEqual(6);
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
      const lockFileHash = '__fixtures__/optional/pnpm-lock.yaml';
      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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
      expect(Object.keys(graph.externalNodes).length).toEqual(8);

      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/optional/package.json'
      ));
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      expect(Object.keys(prunedGraph.externalNodes).length).toEqual(8);
    });
  });

  describe('pruning', () => {
    let graph, lockFile, lockFileHash;

    beforeEach(() => {
      const fileSys = {
        'node_modules/argparse/package.json': '{"version": "2.0.1"}',
        'node_modules/brace-expansion/package.json': '{"version": "1.1.11"}',
        'node_modules/cliui/package.json': '{"version": "7.0.4"}',
        'node_modules/js-yaml/package.json': '{"version": "4.1.0"}',
        'node_modules/minimatch/package.json': '{"version": "3.0.5"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    describe('v5.4', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/pnpm-lock.yaml'
        )).default;
        lockFileHash = '__fixtures__/pruning/pnpm-lock.yaml';

        const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
        graph = {
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
        const dependencies = getPnpmLockfileDependencies(
          lockFile,
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
      });

      it('should parse hoisted versions', () => {
        expect(graph.externalNodes['npm:tslib']).toMatchInlineSnapshot(`
          {
            "data": {
              "hash": "sha512-336iVw3rtn2BUK7ORdIAHTyxHGRIHVReokCR3XjbckJMK7ms8FysBfhLR8IXnAgy7T0PTPNBWKiH514FOW/WSg==",
              "packageName": "tslib",
              "version": "2.5.0",
            },
            "name": "npm:tslib",
            "type": "npm",
          }
        `);
      });

      it('should prune single package', () => {
        const typescriptPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/typescript/package.json'
        ));
        const prunedGraph = pruneProjectGraph(graph, typescriptPackageJson);
        const result = stringifyPnpmLockfile(
          prunedGraph,
          lockFile,
          typescriptPackageJson
        );
        expect(result).toEqual(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/typescript/pnpm-lock.yaml'
          )).default
        );
      });

      it('should prune multi packages', () => {
        const multiPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/devkit-yargs/package.json'
        ));
        const prunedGraph = pruneProjectGraph(graph, multiPackageJson);
        const result = stringifyPnpmLockfile(
          prunedGraph,
          lockFile,
          multiPackageJson
        );
        expect(result).toEqual(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/devkit-yargs/pnpm-lock.yaml'
          )).default
        );
      });
    });

    describe('v6.0', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/pnpm-lock-v6.yaml'
        )).default;
        lockFileHash = '__fixtures__/pruning/pnpm-lock-v6.yaml';

        const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
        graph = {
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
        const dependencies = getPnpmLockfileDependencies(
          lockFile,
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
      });

      it('should parse hoisted versions', () => {
        expect(graph.externalNodes['npm:tslib']).toMatchInlineSnapshot(`
          {
            "data": {
              "hash": "sha512-336iVw3rtn2BUK7ORdIAHTyxHGRIHVReokCR3XjbckJMK7ms8FysBfhLR8IXnAgy7T0PTPNBWKiH514FOW/WSg==",
              "packageName": "tslib",
              "version": "2.5.0",
            },
            "name": "npm:tslib",
            "type": "npm",
          }
        `);
      });

      it('should prune single package', () => {
        const typescriptPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/typescript/package.json'
        ));
        const prunedGraph = pruneProjectGraph(graph, typescriptPackageJson);
        const result = stringifyPnpmLockfile(
          prunedGraph,
          lockFile,
          typescriptPackageJson
        );
        expect(result).toEqual(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/typescript/pnpm-lock-v6.yaml'
          )).default
        );
      });

      it('should prune multi packages', () => {
        const multiPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/devkit-yargs/package.json'
        ));
        const prunedGraph = pruneProjectGraph(graph, multiPackageJson);
        const result = stringifyPnpmLockfile(
          prunedGraph,
          lockFile,
          multiPackageJson
        );
        expect(result).toEqual(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/devkit-yargs/pnpm-lock-v6.yaml'
          )).default
        );
      });
    });

    describe('v9.0', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/pnpm-lock-v9.yaml'
        )).default;
        lockFileHash = '__fixtures__/pruning/pnpm-lock-v9.yaml';

        const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
        graph = {
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
        const dependencies = getPnpmLockfileDependencies(
          lockFile,
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
      });

      it('should parse hoisted versions', () => {
        expect(graph.externalNodes['npm:tslib']).toMatchInlineSnapshot(`
          {
            "data": {
              "hash": "sha512-336iVw3rtn2BUK7ORdIAHTyxHGRIHVReokCR3XjbckJMK7ms8FysBfhLR8IXnAgy7T0PTPNBWKiH514FOW/WSg==",
              "packageName": "tslib",
              "version": "2.5.0",
            },
            "name": "npm:tslib",
            "type": "npm",
          }
        `);
      });

      it('should prune single package', () => {
        const typescriptPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/typescript/package.json'
        ));
        const prunedGraph = pruneProjectGraph(graph, typescriptPackageJson);
        const result = stringifyPnpmLockfile(
          prunedGraph,
          lockFile,
          typescriptPackageJson
        );
        expect(result).toEqual(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/typescript/pnpm-lock-v9.yaml'
          )).default
        );
      });

      it('should prune multi packages', () => {
        const multiPackageJson = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/devkit-yargs/package.json'
        ));
        const prunedGraph = pruneProjectGraph(graph, multiPackageJson);
        const result = stringifyPnpmLockfile(
          prunedGraph,
          lockFile,
          multiPackageJson
        );
        expect(result).toEqual(
          require(joinPathFragments(
            __dirname,
            '__fixtures__/pruning/devkit-yargs/pnpm-lock-v9.yaml'
          )).default
        );
      });
    });
  });

  describe('workspaces', () => {
    let lockFile, lockFileHash;

    beforeAll(() => {
      const fileSys = {
        'node_modules/react/package.json': '{"version": "17.0.2"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/workspaces/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');

      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/workspaces/pnpm-lock.yaml'
      )).default;
      lockFileHash = '__fixtures__/workspaces/pnpm-lock.yaml';
    });

    it('should parse lock file', async () => {
      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
      expect(Object.keys(externalNodes).length).toEqual(5);
    });
  });

  describe('mixed keys', () => {
    let lockFile, lockFileHash;

    beforeEach(() => {
      const fileSys = {
        'node_modules/@isaacs/cliui/package.json': '{"version": "8.0.2"}',
        'node_modules/ansi-regex/package.json': '{"version": "5.0.1"}',
        'node_modules/ansi-styles/package.json': '{"version": "4.3.0"}',
        'node_modules/cliui/package.json': '{"version": "8.0.1"}',
        'node_modules/color-convert/package.json': '{"version": "2.0.1"}',
        'node_modules/color-name/package.json': '{"version": "1.1.4"}',
        'node_modules/eastasianwidth/package.json': '{"version": "0.2.0"}',
        'node_modules/emoji-regex/package.json': '{"version": "8.0.0"}',
        'node_modules/is-fullwidth-code-point/package.json':
          '{"version": "3.0.0"}',
        'node_modules/string-width/package.json': '{"version": "5.1.2"}',
        'node_modules/string-width-cjs/package.json': '{"version": "4.2.3"}',
        'node_modules/strip-ansi/package.json': '{"version": "7.1.0"}',
        'node_modules/strip-ansi-cjs/package.json': '{"version": "6.0.1"}',
        'node_modules/wrap-ansi/package.json': '{"version": "8.1.0"}',
        'node_modules/wrap-ansi-cjs/package.json': '{"version": "7.0.0"}',
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/mixed-keys/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    it('should parse classic and prune packages with mixed keys (v6)', () => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/mixed-keys/pnpm-lock.yaml'
      )).default;
      lockFileHash = '__fixtures__/mixed-keys/pnpm-lock.yaml';

      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/mixed-keys/package.json'
      ));

      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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
              "hash": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
              "packageName": "ansi-regex",
              "version": "5.0.1",
            },
            "name": "npm:ansi-regex",
            "type": "npm",
          },
          "npm:ansi-regex@6.0.1": {
            "data": {
              "hash": "sha512-n5M855fKb2SsfMIiFFoVrABHJC8QtHwVx+mHWP3QcEqBHYienj5dHSgjbxtC0WEZXYt4wcD6zrQElDPhFuZgfA==",
              "packageName": "ansi-regex",
              "version": "6.0.1",
            },
            "name": "npm:ansi-regex@6.0.1",
            "type": "npm",
          },
          "npm:ansi-styles": {
            "data": {
              "hash": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
              "packageName": "ansi-styles",
              "version": "4.3.0",
            },
            "name": "npm:ansi-styles",
            "type": "npm",
          },
          "npm:ansi-styles@6.2.1": {
            "data": {
              "hash": "sha512-bN798gFfQX+viw3R7yrGWRqnrN2oRkEkUjjl4JNn4E8GxxbjtG3FbrEIIY3l8/hrwUwIeCZvi4QuOTP4MErVug==",
              "packageName": "ansi-styles",
              "version": "6.2.1",
            },
            "name": "npm:ansi-styles@6.2.1",
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
              "hash": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
              "packageName": "emoji-regex",
              "version": "8.0.0",
            },
            "name": "npm:emoji-regex",
            "type": "npm",
          },
          "npm:emoji-regex@9.2.2": {
            "data": {
              "hash": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
              "packageName": "emoji-regex",
              "version": "9.2.2",
            },
            "name": "npm:emoji-regex@9.2.2",
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

      const prunedGraph = pruneProjectGraph(graph, packageJson);
      const result = stringifyPnpmLockfile(prunedGraph, lockFile, packageJson);
      expect(result).toEqual(lockFile);
    });

    it('should parse classic and prune packages with mixed keys (v9)', () => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/mixed-keys/pnpm-lock-v9.yaml'
      )).default;
      lockFileHash = '__fixtures__/mixed-keys/pnpm-lock-v9.yaml';

      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/mixed-keys/package.json'
      ));

      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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
              "hash": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
              "packageName": "ansi-regex",
              "version": "5.0.1",
            },
            "name": "npm:ansi-regex",
            "type": "npm",
          },
          "npm:ansi-regex@6.0.1": {
            "data": {
              "hash": "sha512-n5M855fKb2SsfMIiFFoVrABHJC8QtHwVx+mHWP3QcEqBHYienj5dHSgjbxtC0WEZXYt4wcD6zrQElDPhFuZgfA==",
              "packageName": "ansi-regex",
              "version": "6.0.1",
            },
            "name": "npm:ansi-regex@6.0.1",
            "type": "npm",
          },
          "npm:ansi-styles": {
            "data": {
              "hash": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
              "packageName": "ansi-styles",
              "version": "4.3.0",
            },
            "name": "npm:ansi-styles",
            "type": "npm",
          },
          "npm:ansi-styles@6.2.1": {
            "data": {
              "hash": "sha512-bN798gFfQX+viw3R7yrGWRqnrN2oRkEkUjjl4JNn4E8GxxbjtG3FbrEIIY3l8/hrwUwIeCZvi4QuOTP4MErVug==",
              "packageName": "ansi-styles",
              "version": "6.2.1",
            },
            "name": "npm:ansi-styles@6.2.1",
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
              "hash": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
              "packageName": "emoji-regex",
              "version": "8.0.0",
            },
            "name": "npm:emoji-regex",
            "type": "npm",
          },
          "npm:emoji-regex@9.2.2": {
            "data": {
              "hash": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
              "packageName": "emoji-regex",
              "version": "9.2.2",
            },
            "name": "npm:emoji-regex@9.2.2",
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

      const prunedGraph = pruneProjectGraph(graph, packageJson);
      const result = stringifyPnpmLockfile(prunedGraph, lockFile, packageJson);
      expect(result).toEqual(lockFile);
    });
  });

  describe('regression check', () => {
    let lockFile, lockFileHash, prunedLockFile;

    beforeEach(() => {
      const fileSys = {
        'node_modules/.modules.yaml': require(joinPathFragments(
          __dirname,
          '__fixtures__/pnpm-regression/.modules.yaml'
        )).default,
      };
      vol.fromJSON(fileSys, '/root');
    });

    it('should correctly prune the lock file', () => {
      lockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/pnpm-regression/pnpm-lock.yaml'
      )).default;
      prunedLockFile = require(joinPathFragments(
        __dirname,
        '__fixtures__/pnpm-regression/pruned-pnpm-lock.yaml'
      )).default;
      lockFileHash = '__fixtures__/pnpm-regression/pnpm-lock.yaml';

      const packageJson = require(joinPathFragments(
        __dirname,
        '__fixtures__/pnpm-regression/package.json'
      ));

      const externalNodes = getPnpmLockfileNodes(lockFile, lockFileHash);
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
      const dependencies = getPnpmLockfileDependencies(
        lockFile,
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

      const prunedGraph = pruneProjectGraph(graph, packageJson);
      const result = stringifyPnpmLockfile(prunedGraph, lockFile, packageJson);
      expect(result).toEqual(prunedLockFile);
    });
  });
});
