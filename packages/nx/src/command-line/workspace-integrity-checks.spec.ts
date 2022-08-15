import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import { vol } from 'memfs';
import * as chalk from 'chalk';
import { joinPathFragments } from '../utils/path';
import { PackageJson } from '../utils/package-json';
import { workspaceRoot } from '../utils/workspace-root';

jest.mock('fs', () => require('memfs').fs);

describe('WorkspaceIntegrityChecks', () => {
  describe('workspace.json is in sync with the filesystem', () => {
    beforeAll(() => {
      vol.fromJSON({
        [joinPathFragments(__dirname, '../../package.json')]: JSON.stringify({
          name: 'nx',
          version: '1.0.0',
          'nx-migrations': {
            packageGroup: [],
          },
        } as PackageJson),
        [joinPathFragments(workspaceRoot, 'package.json')]: JSON.stringify({
          name: 'nx-workspace',
          version: '0.0.1',
        } as PackageJson),
      });
    });

    it('should not error when they are in sync', () => {
      const c = new WorkspaceIntegrityChecks(
        {
          nodes: {
            project1: {
              name: 'project1',
              type: 'lib',
              data: {
                root: 'libs/project1',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/project1/src/index.ts')],
              },
            },
          },
          dependencies: {},
        },
        ['libs/project1/src/index.ts']
      );
      expect(c.run().error.length).toEqual(0);
    });

    it('should error when there are projects without files', () => {
      const c = new WorkspaceIntegrityChecks(
        {
          nodes: {
            project1: {
              name: 'project1',
              type: 'lib',
              data: {
                root: 'libs/project1',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [],
              },
            },
            project2: {
              name: 'project2',
              type: 'lib',
              data: {
                root: 'libs/project2',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/project2/src/index.ts')],
              },
            },
          },
          dependencies: {},
        },
        ['libs/project2/src/index.ts']
      );

      const { error } = c.run();
      expect(error).toEqual([
        {
          bodyLines: [
            `${chalk.dim(
              '-'
            )} Cannot find project 'project1' in 'libs/project1'`,
          ],
          title: 'The workspace.json file is out of sync',
        },
      ]);
    });

    it('should error when there are files in apps or libs without projects', () => {
      const c = new WorkspaceIntegrityChecks(
        {
          nodes: {
            project1: {
              name: 'project1',
              type: 'lib',
              data: {
                root: 'libs/project1',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/project1/src/index.ts')],
              },
            },
          },
          dependencies: {},
        },
        ['libs/project1/src/index.ts', 'libs/project2/src/index.ts']
      );

      const { error } = c.run();
      expect(error).toEqual([
        {
          bodyLines: [`${chalk.dim('-')} libs/project2/src/index.ts`],
          title: 'The following file(s) do not belong to any projects:',
        },
      ]);
    });
  });

  describe('package.json versions are aligned', () => {
    beforeAll(() => {
      vol.fromJSON({
        [joinPathFragments(__dirname, '../../package.json')]: JSON.stringify({
          name: 'nx',
          version: '1.0.0',
          'nx-migrations': {
            packageGroup: [
              '@nrwl/dependency',
              '@nrwl/dev-dependency',
              '@nrwl/correct',
              '@nrwl/not-installed',
              '@nrwl/installed-higher',
              { package: '@nrwl/may-not-be-aligned', version: 'latest' },
            ],
          },
        } as PackageJson),
        [joinPathFragments(workspaceRoot, 'package.json')]: JSON.stringify({
          name: 'nx-workspace',
          version: '0.0.1',
          dependencies: {
            '@nrwl/dependency': '1.0.1',
          },
          devDependencies: {
            '@nrwl/dev-dependency': '0.9.1',
            '@nrwl/may-not-be-aligned': '1.0.15',
            '@nrwl/correct': '1.0.0',
            '@nrwl/not-in-pkg-group': '0.9.1',
            '@nrwl/installed-higher': '2.0.0',
            nx: '1.0.0',
          },
        } as PackageJson),
      });
    });

    it('should pick up expected errors', () => {
      const integrity = new WorkspaceIntegrityChecks(null, null);
      const errors = integrity.misalignedPackages();
      // All errors are in 1 message
      expect(errors.length).toEqual(1);
      const { bodyLines } = errors[0];
      expect(bodyLines).toContainEqual(
        expect.stringContaining('@nrwl/dependency')
      );
      expect(bodyLines).toContainEqual(
        expect.stringContaining('@nrwl/dev-dependency')
      );
      expect(bodyLines).toContainEqual(
        expect.stringContaining('@nrwl/installed-higher')
      );
      expect(bodyLines).not.toContainEqual(
        expect.stringContaining('@nrwl/correct')
      );
      expect(bodyLines).not.toContainEqual(
        expect.stringContaining('@nrwl/not-installed')
      );
      expect(bodyLines).not.toContainEqual(
        expect.stringContaining('@nrwl/may-not-be-aligned')
      );
      expect(bodyLines[bodyLines.length - 1]).toEqual(
        expect.stringContaining('2.0.0')
      );
    });
  });
});

function createFile(f) {
  return { file: f, hash: '' };
}
