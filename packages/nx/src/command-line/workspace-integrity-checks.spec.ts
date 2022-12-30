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
          externalNodes: {
            'npm:@nrwl/workspace': {
              type: 'npm',
              name: 'npm:@nrwl/worrkspace',
              data: {
                packageName: '@nrwl/workspace',
                version: '1.0.0',
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
      });
    });

    it('should pick up expected errors', () => {
      const integrity = new WorkspaceIntegrityChecks(
        {
          nodes: {},
          dependencies: {},
          externalNodes: {
            'npm:@nrwl/dependency': {
              type: 'npm',
              name: 'npm:@nrwl/dev-dependency',
              data: {
                packageName: '@nrwl/dev-dependency',
                version: '1.0.1',
              },
            },
            'npm:@nrwl/dev-dependency': {
              type: 'npm',
              name: 'npm:@nrwl/dev-dependency',
              data: {
                packageName: '@nrwl/dev-dependency',
                version: '0.9.1',
              },
            },
            'npm:@nrwl/may-not-be-aligned': {
              type: 'npm',
              name: 'npm:@nrwl/may-not-be-aligned',
              data: {
                packageName: '@nrwl/may-not-be-aligned',
                version: '1.0.15',
              },
            },
            'npm:@nrwl/correct': {
              type: 'npm',
              name: 'npm:@nrwl/correct',
              data: {
                packageName: '@nrwl/correct',
                version: '1.0.0',
              },
            },
            'npm:@nrwl/not-in-pkg-group': {
              type: 'npm',
              name: 'npm:@nrwl/not-in-pkg-group',
              data: {
                packageName: '@nrwl/not-in-pkg-group',
                version: '1.0.0',
              },
            },
            'npm:@nrwl/installed-higher': {
              type: 'npm',
              name: 'npm:@nrwl/installed-higher',
              data: {
                packageName: '@nrwl/installed-higher',
                version: '2.0.0',
              },
            },
          },
        },
        null
      );
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
