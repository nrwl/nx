import { joinPathFragments } from '../../../utils/path';
import { parsePnpmLockfile, stringifyPnpmLockfile } from './pnpm-parser';
import { ProjectGraph } from '../../../config/project-graph';
import { vol } from 'memfs';
import { pruneProjectGraph } from './project-graph-pruning';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';

jest.mock('fs', () => require('memfs').fs);

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

    let graph: ProjectGraph;
    let lockFile: string;

    describe('v5.4', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/nextjs/pnpm-lock.yaml'
        )).default;
        const builder = new ProjectGraphBuilder();
        parsePnpmLockfile(lockFile, builder);
        graph = builder.getUpdatedProjectGraph();
      });

      it('should parse root lock file', async () => {
        expect(Object.keys(graph.externalNodes).length).toEqual(1280);
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
        const builder = new ProjectGraphBuilder();
        parsePnpmLockfile(lockFile, builder);
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

        const builder = new ProjectGraphBuilder();
        parsePnpmLockfile(appLockFile, builder);
        const appGraph = builder.getUpdatedProjectGraph();
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
      const builder = new ProjectGraphBuilder();
      parsePnpmLockfile(lockFile, builder);
      const graph = builder.getUpdatedProjectGraph();
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
            "version": "github.com/charsleysa/postgres/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
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
            'github.com/charsleysa/postgres/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb',
          yargs: '17.6.2',
        },
        devDependencies: {
          react: '18.2.0',
        },
        peerDependencies: {
          typescript: '4.8.4',
        },
      };

      const builder = new ProjectGraphBuilder();
      parsePnpmLockfile(lockFile, builder);
      const graph = builder.getUpdatedProjectGraph();
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
      const builder = new ProjectGraphBuilder();
      parsePnpmLockfile(lockFile, builder);
      const graph = builder.getUpdatedProjectGraph();
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
      const builder = new ProjectGraphBuilder();
      parsePnpmLockfile(lockFile, builder);
      const graph = builder.getUpdatedProjectGraph();
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
    let graph, lockFile;

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

    describe('v5.4', () => {
      beforeEach(() => {
        lockFile = require(joinPathFragments(
          __dirname,
          '__fixtures__/pruning/pnpm-lock.yaml'
        )).default;

        const builder = new ProjectGraphBuilder();
        parsePnpmLockfile(lockFile, builder);
        graph = builder.getUpdatedProjectGraph();
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

        const builder = new ProjectGraphBuilder();
        parsePnpmLockfile(lockFile, builder);
        graph = builder.getUpdatedProjectGraph();
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
  });

  describe('workspaces', () => {
    let lockFile;

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
    });

    it('should parse lock file', async () => {
      const builder = new ProjectGraphBuilder();
      parsePnpmLockfile(lockFile, builder);
      const graph = builder.getUpdatedProjectGraph();
      expect(Object.keys(graph.externalNodes).length).toEqual(5);
    });
  });
});
