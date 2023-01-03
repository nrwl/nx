import { mapLockFileDataToPartialGraph } from './lock-file';
import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
} from './npm';
import {
  parsePnpmLockFile,
  prunePnpmLockFile,
  stringifyPnpmLockFile,
} from './pnpm';
import {
  parseYarnLockFile,
  pruneYarnLockFile,
  stringifyYarnLockFile,
} from './yarn';
import {
  npmLockFileV1WithAliases,
  npmLockFileWithAliases,
  pnpmLockFileWithAliases,
  yarnLockFileWithAliases,
} from './__fixtures__/aux.lock';
import {
  lockFileV3YargsAndDevkitOnly as npmLockFileV3YargsAndDevkit,
  lockFileV2YargsAndDevkitOnly as npmLockFileV2YargsAndDevkit,
  lockFileV1YargsAndDevkitOnly as npmLockFileV1YargsAndDevkit,
  lockFileV3 as npmLockFileV3,
  lockFileV2 as npmLockFileV2,
  lockFileV1 as npmLockFileV1,
} from './__fixtures__/npm.lock';
import {
  lockFileYargsAndDevkit as pnpmLockFileYargsAndDevkit,
  lockFile as pnpmLockFile,
} from './__fixtures__/pnpm.lock';
import {
  lockFileDevkitAndYargs as yarnLockFileDevkitAndYargs,
  lockFile as yarnLockFile,
} from './__fixtures__/yarn.lock';
import { vol } from 'memfs';
import { ProjectGraph } from '../config/project-graph';
import { createPackageJson } from '../utils/create-package-json';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('lock-file', () => {
  describe('mapLockFileDataToExternalNodes', () => {
    describe('yarn', () => {
      const fileSys = {
        'node_modules/chalk/package.json': '{"version": "4.1.0"}',
        'node_modules/glob/package.json': '{"version": "7.1.4"}',
        'node_modules/js-yaml/package.json': '{"version": "4.1.0"}',
        'node_modules/minimatch/package.json': '{"version": "3.0.5"}',
        'node_modules/semver/package.json': '{"version": "7.3.4"}',
        'node_modules/tslib/package.json': '{"version": "2.4.0"}',
        'node_modules/yargs-parser/package.json': '{"version": "21.0.1"}',
      };
      beforeEach(() => {
        vol.fromJSON(fileSys, '/root');
      });

      it('should map lock file data to external nodes', () => {
        const lockFileData = parseYarnLockFile(yarnLockFileDevkitAndYargs);

        const partialGraph = mapLockFileDataToPartialGraph(
          lockFileData,
          'yarn'
        );

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map successfully complex lock file', () => {
        const lockFileData = parseYarnLockFile(yarnLockFile);

        const partialGraph = mapLockFileDataToPartialGraph(
          lockFileData,
          'yarn'
        );

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });
    });

    describe('npm', () => {
      const fileSys = {
        'node_modules/chalk/package.json': '{"version": "4.1.2"}',
        'node_modules/glob/package.json': '{"version": "7.1.4"}',
        'node_modules/js-yaml/package.json': '{"version": "4.1.0"}',
        'node_modules/minimatch/package.json': '{"version": "4.0.5"}',
        'node_modules/semver/package.json': '{"version": "7.3.4"}',
        'node_modules/tslib/package.json': '{"version": "2.4.1"}',
        'node_modules/yargs-parser/package.json': '{"version": "21.1.1"}',
      };
      beforeEach(() => {
        vol.fromJSON(fileSys, '/root');
      });

      it('should map lock file v3 data to external nodes', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV3YargsAndDevkit);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData, 'npm');

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map lock file v2 data to external nodes', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV2YargsAndDevkit);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData, 'npm');

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map lock file v1 data to external nodes', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV1YargsAndDevkit);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData, 'npm');

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map successfully complex lock file v3', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV3);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData, 'npm');

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });

      it('should map successfully complex lock file v2', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV2);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData, 'npm');

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });

      it('should map successfully complex lock file v1', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV1);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData, 'npm');

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });
    });

    describe('pnpm', () => {
      const fileSys = {
        'node_modules/chalk/package.json': '{"version": "4.1.0"}',
        'node_modules/glob/package.json': '{"version": "7.1.4"}',
        'node_modules/js-yaml/package.json': '{"version": "4.1.0"}',
        'node_modules/minimatch/package.json': '{"version": "3.0.5"}',
        'node_modules/semver/package.json': '{"version": "7.3.4"}',
        'node_modules/tslib/package.json': '{"version": "2.4.0"}',
        'node_modules/yargs-parser/package.json': '{"version": "21.0.1"}',
      };
      beforeEach(() => {
        vol.fromJSON(fileSys, '/root');
      });

      it('should map lock file data to external nodes', () => {
        const lockFileData = parsePnpmLockFile(pnpmLockFileYargsAndDevkit);

        const partialGraph = mapLockFileDataToPartialGraph(
          lockFileData,
          'pnpm'
        );

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map successfully complex lock file', () => {
        const lockFileData = parsePnpmLockFile(pnpmLockFile);

        const partialGraph = mapLockFileDataToPartialGraph(
          lockFileData,
          'pnpm'
        );

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
        expect(
          partialGraph.externalNodes['npm:@phenomnomnominal/tsquery']
        ).toMatchSnapshot();
        expect(
          partialGraph.dependencies['npm:@phenomnomnominal/tsquery']
        ).toMatchSnapshot();
      });
    });
  });

  describe('package aliases and direct urls', () => {
    function expandGraph(partialGraph: ProjectGraph) {
      partialGraph.nodes['lib1'] = {
        type: 'lib',
        name: 'lib1',
        data: {
          root: 'libs/lib1',
        } as any,
      };
      partialGraph.dependencies['lib1'] = [
        {
          type: 'static',
          source: 'lib1',
          target: 'npm:postgres',
        },
      ];
      return partialGraph;
    }

    const fileSys = {
      'package.json': JSON.stringify({
        name: 'test',
        version: '0.0.0',
        license: 'MIT',
        dependencies: {
          '@nrwl/devkit': '15.0.13',
          yargs: '17.6.2',
          postgres: 'charsleysa/postgres#fix-errors-compiled',
        },
        devDependencies: {
          react: '18.2.0',
        },
        peerDependencies: {
          typescript: '4.8.4',
        },
      }),
    };
    beforeEach(() => {
      vol.fromJSON(fileSys, '/root');
    });

    it('should properly parse, map and stringify npm V2/3', () => {
      const lockFileData = parseNpmLockFile(npmLockFileWithAliases);
      const lockFile = stringifyNpmLockFile(lockFileData);

      expect(JSON.parse(lockFile)).toEqual(JSON.parse(npmLockFileWithAliases));

      const partialGraph = expandGraph(
        mapLockFileDataToPartialGraph(lockFileData, 'npm')
      );

      const newPackage = createPackageJson('lib1', partialGraph, {});
      const prunedLockFile = pruneYarnLockFile(lockFileData, newPackage);
      expect(newPackage).toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "postgres": "git+ssh://git@github.com/charsleysa/postgres.git#3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
          },
          "name": "lib1",
          "version": "0.0.1",
        }
      `);
      expect(partialGraph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "hash": "29ded3acf364abfbda0186d5ae76ec0aebe1b31662dadb4263126e272ababdf9",
            "packageName": "eslint-plugin-disable-autofix",
            "version": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });

    it('should properly parse, map and stringify npm V1', () => {
      const lockFileData = parseNpmLockFile(npmLockFileV1WithAliases);
      const lockFile = stringifyNpmLockFile(lockFileData);

      expect(JSON.parse(lockFile)).toEqual(
        JSON.parse(npmLockFileV1WithAliases)
      );

      const partialGraph = expandGraph(
        mapLockFileDataToPartialGraph(lockFileData, 'npm')
      );

      const newPackage = createPackageJson('lib1', partialGraph, {});
      const prunedLockFile = pruneNpmLockFile(lockFileData, newPackage);
      expect(newPackage).toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "postgres": "git+ssh://git@github.com/charsleysa/postgres.git#3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
          },
          "name": "lib1",
          "version": "0.0.1",
        }
      `);
      expect(partialGraph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "hash": "29ded3acf364abfbda0186d5ae76ec0aebe1b31662dadb4263126e272ababdf9",
            "packageName": "eslint-plugin-disable-autofix",
            "version": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });

    it('should properly parse, map and stringify yarn', () => {
      const lockFileData = parseYarnLockFile(yarnLockFileWithAliases);
      const lockFile = stringifyYarnLockFile(lockFileData);

      expect(lockFile).toEqual(yarnLockFileWithAliases);

      const partialGraph = expandGraph(
        mapLockFileDataToPartialGraph(lockFileData, 'yarn')
      );

      const newPackage = createPackageJson('lib1', partialGraph, {});
      const prunedLockFile = pruneYarnLockFile(lockFileData, newPackage);
      expect(newPackage).toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "postgres": "charsleysa/postgres#fix-errors-compiled",
          },
          "name": "lib1",
          "version": "0.0.1",
        }
      `);
      expect(partialGraph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "hash": "4adf0349b24951646e5657c35e819065d283446fae842d72ce73ba2d466492bf",
            "packageName": "eslint-plugin-disable-autofix",
            "version": "3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });

    it('should properly parse, map and stringify pnpm', () => {
      const lockFileData = parsePnpmLockFile(pnpmLockFileWithAliases);
      const lockFile = stringifyPnpmLockFile(lockFileData);

      expect(lockFile).toEqual(pnpmLockFileWithAliases);

      const partialGraph = expandGraph(
        mapLockFileDataToPartialGraph(lockFileData, 'pnpm')
      );
      const newPackage = createPackageJson('lib1', partialGraph, {});
      const prunedLockFile = prunePnpmLockFile(lockFileData, newPackage);
      expect(newPackage).toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "postgres": "github.com/charsleysa/postgres/3b1a01b2da3e2fafb1a79006f838eff11a8de3cb",
          },
          "name": "lib1",
          "version": "0.0.1",
        }
      `);
      expect(partialGraph.externalNodes['npm:eslint-plugin-disable-autofix'])
        .toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "hash": "308b8cb8052d8d26cf1a2be5dc197f7ba6291185a309d00f2a0c1497df9089db",
            "packageName": "eslint-plugin-disable-autofix",
            "version": "/@mattlewis92/eslint-plugin-disable-autofix/3.0.0",
          },
          "name": "npm:eslint-plugin-disable-autofix",
          "type": "npm",
        }
      `);
    });
  });
});
